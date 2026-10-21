// The routes. A visitor who is not signed in sees the offer; the session arrives with Item 6.
import type { Core } from "./index.ts";
import { clearCookie } from "./cookies.ts";
import { notFoundPage, safely, stylesheet, withCookies } from "./responses.ts";
import { STATE_COOKIE, offerPage, refusal, startSignIn, verifyCallback } from "./signin.ts";

export interface AppOptions {
  // Exchanges the code for the token and sets the session (Item 6). Until it is given, a valid return is refused.
  complete?: (code: string) => Promise<Response>;
}

export function createApp(core: Core, options: AppOptions = {}): (request: Request) => Promise<Response> {
  return safely(async (request) => {
    const path = new URL(request.url).pathname;
    if (request.method !== "GET") return notFoundPage();
    switch (path) {
      case "/":
        return offerPage(request);
      case "/login":
        return startSignIn(core.settings);
      case "/callback": {
        const verified = await verifyCallback(request);
        if (!verified.ok) return refusal();
        const response = options.complete ? await options.complete(verified.code) : refusal();
        return withCookies(response, [clearCookie(STATE_COOKIE)]);
      }
      case "/style.css":
        return stylesheet();
      default:
        return notFoundPage();
    }
  });
}
