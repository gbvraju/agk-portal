// The sign-in offer, the OAuth web flow and the state against CSRF (SPEC-0002 rules 1 to 3).
// The state is random (256 bits from Web Crypto) and goes to GitHub in the address. The browser keeps only its
// SHA-256 hash, in a short-lived cookie, so no cookie value is ever in a URL (SPEC-0004 rule 5). On the way back the
// hash of the returned state is compared with the cookie in constant time. Nothing is stored on the server.
import { clearCookie, readCookie, serializeCookie } from "./cookies.ts";
import { AUTHORIZE_ADDRESS } from "./github.ts";
import { htmlPage, redirectHome, redirectToAuthorize } from "./responses.ts";

export const STATE_COOKIE = "__Host-state";
export const NOTICE_COOKIE = "__Host-notice";
export const SIGN_IN_FAILED_PHRASE = "Sign-in could not be completed. Sign in with GitHub to try again.";

const STATE_SECONDS = 600;
const NOTICE_SECONDS = 60;
const NOTICE_VALUE = "signin-failed";
const OFFER = '<p><a href="/login">Sign in with GitHub</a></p>';

function base64url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newState(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashState(state: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state))));
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
  const failed = readCookie(request, NOTICE_COOKIE) === NOTICE_VALUE;
  const body = failed ? `<p>${SIGN_IN_FAILED_PHRASE}</p>\n${OFFER}` : OFFER;
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

export type Verified = { ok: true; code: string } | { ok: false };

// A missing or different state, a missing cookie or a missing code is a refusal.
export async function verifyCallback(request: Request): Promise<Verified> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = readCookie(request, STATE_COOKIE);
  if (!code || !state || !cookie) return { ok: false };
  return constantTimeEqual(await hashState(state), cookie) ? { ok: true, code } : { ok: false };
}

// No request to GitHub, no session; the state cookie is cleared and a one-time notice is left for the home page.
export function refusal(): Response {
  return redirectHome([clearCookie(STATE_COOKIE), serializeCookie(NOTICE_COOKIE, NOTICE_VALUE, NOTICE_SECONDS)]);
}
