// The routes. A visitor with no cookie sees the offer; a signed-in person sees the page; a cookie that is not
// valid is signed out (SPEC-0002 rules 8 to 10).
import { clearCookie, readCookie } from "./cookies.ts";
import type { GithubClient } from "./github.ts";
import type { Core } from "./index.ts";
import { htmlPage, notFoundPage, safely, stylesheet, withCookies } from "./responses.ts";
import { listProjectCards } from "./projects.ts";
import { SESSION_COOKIE, completeSignIn, openSession, type Session } from "./session.ts";
import { OFFER_HTML, SESSION_ENDED_PHRASE, STATE_COOKIE, offerPage, refusal, startSignIn, verifyCallback } from "./signin.ts";

export const EMPTY_LIST_PHRASE = "No projects are available to you yet.";

export interface AppOptions {
  github?: GithubClient;
  // Replaces the code exchange (tests of the sign-in flow). Without it and without `github`, a valid return is refused.
  complete?: (code: string) => Promise<Response>;
  // The card of each project the person can read, as HTML; by default the per-person list read from GitHub.
  projects?: (token: string) => Promise<readonly string[]>;
}

type Reading = { kind: "none" } | { kind: "invalid" } | { kind: "valid"; session: Session };

async function readSession(request: Request, core: Core): Promise<Reading> {
  const value = readCookie(request, SESSION_COOKIE);
  if (value === undefined) return { kind: "none" };
  const session = await openSession(value, core.settings.sessionKey, core.now());
  return session === undefined ? { kind: "invalid" } : { kind: "valid", session };
}

function signedInPage(cards: readonly string[]): Response {
  const list = cards.length > 0 ? cards.join("\n") : `<p>${EMPTY_LIST_PHRASE}</p>`;
  const form = '<form method="post" action="/signout"><button type="submit">Sign out</button></form>';
  return htmlPage("Portal", `${list}\n${form}`);
}

// The origin of this site, from the one address the operator sets for it (CALLBACK_URL). An address that cannot be read
// has no origin, so no request matches it.
function ownOrigin(callbackUrl: string): string | undefined {
  try {
    const url = new URL(callbackUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function fromThisSite(request: Request, callbackUrl: string): boolean {
  const own = ownOrigin(callbackUrl);
  if (own === undefined) return false;
  const origin = request.headers.get("origin");
  if (origin === own) return true;
  return (origin === null || origin === "null") && request.headers.get("sec-fetch-site") === "same-origin";
}

export function createApp(core: Core, options: AppOptions = {}): (request: Request) => Promise<Response> {
  const github = options.github;
  const complete = options.complete ?? (github ? (code: string) => completeSignIn(core, github, code) : async () => refusal({ kind: "token", error: "unknown" }));
  const projects = options.projects ?? (github ? (token: string) => listProjectCards(github, token, core.now()) : async () => []);
  return safely(async (request) => {
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && path === "/signout") {
      // Another site must not be able to sign a visitor out. A request is from this site when its Origin is this site's
      // origin; or, because a page with Referrer-Policy: no-referrer makes the browser send the Origin of a form POST as
      // "null" (or none), when the browser's own Sec-Fetch-Site, which a page cannot set, says same-origin.
      if (!fromThisSite(request, core.settings.callbackUrl)) return notFoundPage();
      return htmlPage("Sign in", OFFER_HTML, 200, [clearCookie(SESSION_COOKIE)]);
    }
    if (request.method !== "GET") return notFoundPage();
    switch (path) {
      case "/": {
        const reading = await readSession(request, core);
        if (reading.kind === "none") return offerPage(request);
        if (reading.kind === "invalid") {
          return htmlPage("Sign in", `<p>${SESSION_ENDED_PHRASE}</p>\n${OFFER_HTML}`, 200, [clearCookie(SESSION_COOKIE)]);
        }
        return signedInPage(await projects(reading.session.token));
      }
      case "/login":
        return startSignIn(core.settings);
      case "/callback": {
        const verified = await verifyCallback(request);
        if (!verified.ok) return refusal({ kind: verified.stage });
        return withCookies(await complete(verified.code), [clearCookie(STATE_COOKIE)]);
      }
      case "/style.css":
        return stylesheet();
      default:
        return notFoundPage();
    }
  });
}
