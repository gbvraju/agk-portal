// The sign-in offer, the OAuth web flow and the state against CSRF (SPEC-0002 rules 1 to 3).
// The state is random (256 bits from Web Crypto) and goes to GitHub in the address. The browser keeps only its
// SHA-256 hash, in a short-lived cookie, so no cookie value is ever in a URL (SPEC-0004 rule 5). On the way back the
// hash of the returned state is compared with the cookie in constant time. Nothing is stored on the server.
import { clearCookie, readCookie, serializeCookie } from "./cookies.ts";
import { base64urlEncode } from "./encoding.ts";
import { AUTHORIZE_ADDRESS } from "./github.ts";
import { htmlPage, redirectHome, redirectToAuthorize } from "./responses.ts";

export const STATE_COOKIE = "__Host-state";
export const NOTICE_COOKIE = "__Host-notice";
export const SIGN_IN_FAILED_PHRASE = "Sign-in could not be completed. Sign in with GitHub to try again.";

const STATE_SECONDS = 600;
const NOTICE_SECONDS = 60;
// The former value, which still shows the general phrase only.
const NOTICE_VALUE = "signin-failed";
// GitHub's own error names that may be named on the page; any other is shown as "unknown", never as GitHub sent it.
export const TOKEN_ERRORS = ["bad_verification_code", "incorrect_client_credentials", "redirect_uri_mismatch", "unverified_user_email", "access_denied"] as const;

// The stage at which a sign-in was refused. Nothing in it is a value from the person or from GitHub's free text.
export type Stage =
  | { kind: "state" }
  | { kind: "code" }
  | { kind: "exchange"; status: number }
  | { kind: "request" }
  | { kind: "unreadable" }
  | { kind: "token"; error: string };

export function tokenError(answer: unknown): string {
  const error = typeof answer === "object" && answer !== null && !Array.isArray(answer) ? (answer as Record<string, unknown>)["error"] : undefined;
  return typeof error === "string" && (TOKEN_ERRORS as readonly string[]).includes(error) ? error : "unknown";
}

function noticeValue(stage: Stage): string {
  switch (stage.kind) {
    case "state":
      return "failed-state";
    case "code":
      return "failed-code";
    case "exchange":
      return `failed-http-${stage.status}`;
    case "request":
      return "failed-request";
    case "unreadable":
      return "failed-unreadable";
    case "token":
      return `failed-token-${(TOKEN_ERRORS as readonly string[]).includes(stage.error) ? stage.error : "unknown"}`;
  }
}

// The fixed sentence of a notice value, or undefined when the value is not one of the list.
function stagePhrase(value: string): string | undefined {
  if (value === "failed-state") return "The sign-in state did not match.";
  if (value === "failed-code") return "GitHub returned no code.";
  if (value === "failed-request") return "The request to GitHub failed.";
  if (value === "failed-unreadable") return "GitHub's answer could not be read.";
  const status = /^failed-http-([1-5]\d\d)$/.exec(value)?.[1];
  if (status !== undefined) return `GitHub refused the code exchange (HTTP ${status}).`;
  const error = /^failed-token-([a-z_]+)$/.exec(value)?.[1];
  if (error !== undefined && (error === "unknown" || (TOKEN_ERRORS as readonly string[]).includes(error))) return `GitHub's answer had no token (${error}).`;
  return undefined;
}
export const OFFER_HTML = '<p><a href="/login">Sign in with GitHub</a></p>';
export const SESSION_ENDED_PHRASE = "Your session has ended. Sign in with GitHub to continue.";

export function newState(): string {
  return base64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashState(state: string): Promise<string> {
  return base64urlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state))));
}

export function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let difference = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) difference |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return difference === 0;
}

// The home page of a visitor who is not signed in: the offer, and once the fixed phrase after a refusal.
export function offerPage(request: Request): Response {
  const notice = readCookie(request, NOTICE_COOKIE);
  const stage = notice === undefined ? undefined : stagePhrase(notice);
  const failed = notice === NOTICE_VALUE || stage !== undefined;
  const body = failed ? `<p>${SIGN_IN_FAILED_PHRASE}</p>\n${stage === undefined ? "" : `<p>${stage}</p>\n`}${OFFER_HTML}` : OFFER_HTML;
  return htmlPage("Sign in", body, 200, failed ? [clearCookie(NOTICE_COOKIE)] : []);
}

export async function startSignIn(settings: { clientId: string; callbackUrl: string }): Promise<Response> {
  const state = newState();
  const address = new URL(AUTHORIZE_ADDRESS);
  address.searchParams.set("client_id", settings.clientId);
  address.searchParams.set("redirect_uri", settings.callbackUrl);
  address.searchParams.set("state", state);
  return redirectToAuthorize(address.toString(), [serializeCookie(STATE_COOKIE, await hashState(state), STATE_SECONDS)]);
}

export type Verified = { ok: true; code: string } | { ok: false; stage: "state" | "code" };

// A missing or different state or a missing cookie is a refusal at the state; a missing code, with the state right, is a
// refusal at the code (GitHub sent the person back without one).
export async function verifyCallback(request: Request): Promise<Verified> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = readCookie(request, STATE_COOKIE);
  if (!state || !cookie || !constantTimeEqual(await hashState(state), cookie)) return { ok: false, stage: "state" };
  return code ? { ok: true, code } : { ok: false, stage: "code" };
}

// No request to GitHub, no session; the state cookie is cleared and a one-time notice is left for the home page.
export function refusal(stage: Stage): Response {
  return redirectHome([clearCookie(STATE_COOKIE), serializeCookie(NOTICE_COOKIE, noticeValue(stage), NOTICE_SECONDS)]);
}
