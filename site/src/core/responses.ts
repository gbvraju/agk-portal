// Every response of the server is built here, and only here, so that none leaves without the security headers
// (SPEC-0004 rules 1 to 5). Server-rendered HTML only: no script, no event handler, no inline style, no style
// element. Nothing is logged: this file never touches the console (SPEC-0004 rule 4).
import { AUTHORIZE_ADDRESS } from "./github.ts";

export const CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

// The page uses no browser feature, so every feature of the current list is denied with an empty allowlist (SPEC-0004 rule 1,
// Amendment 5). The names are the W3C Permissions Policy features list (standardized, proposed and experimental) as read on
// 2026-10-22, without the client-hint family ch-ua* and without interest-cohort, which is no longer on the list. A browser
// ignores a name it does not know; the list is revisited when the specification changes.
const DENIED_FEATURES = [
  "accelerometer", "all-screens-capture", "ambient-light-sensor", "attribution-reporting", "autofill", "autoplay",
  "battery", "bluetooth", "browsing-topics", "camera", "captured-surface-control", "clipboard-read",
  "clipboard-write", "compute-pressure", "conversion-measurement", "cross-origin-isolated", "deferred-fetch",
  "digital-credentials-create", "digital-credentials-get", "direct-sockets", "display-capture", "encrypted-media",
  "execution-while-not-rendered", "execution-while-out-of-viewport", "focus-without-user-activation", "fullscreen",
  "gamepad", "geolocation", "gyroscope", "hid", "identity-credentials-get", "idle-detection",
  "join-ad-interest-group", "keyboard-map", "language-detector", "language-model", "local-fonts", "magnetometer",
  "manual-text", "mediasession", "microphone", "midi", "monetization", "navigation-override", "otp-credentials",
  "payment", "picture-in-picture", "publickey-credentials-get", "rewriter", "run-ad-auction", "screen-wake-lock",
  "serial", "smart-card", "speaker-selection", "storage-access", "summarizer", "sync-script", "sync-xhr", "tools",
  "translator", "trust-token-redemption", "unload", "usb", "vertical-scroll", "web-share", "window-management",
  "writer", "xr-spatial-tracking"
];

export const PERMISSIONS_POLICY = DENIED_FEATURES.map((name) => `${name}=()`).join(", ");

const HSTS = "max-age=31536000; includeSubDomains";

export const FIXED_ERROR_PHRASE = "Something went wrong. Please try again.";

function respond(body: BodyInit | null, init: ResponseInit, noStore: boolean, cookies: readonly string[] = []): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Strict-Transport-Security", HSTS);
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  if (noStore) headers.set("Cache-Control", "no-store");
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(body, { ...init, headers });
}

export function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Characters a browser removes or decodes before it reads an address: so "java&#9;script:" is still "javascript:".
function plainAddress(value: string): string {
  const named: Record<string, string> = { tab: "\t", newline: "\n", colon: ":", lpar: "(" };
  const decoded = value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex: string) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
    .replace(/&#([0-9]+);?/g, (_m, dec: string) => String.fromCodePoint(Math.min(parseInt(dec, 10), 0x10ffff)))
    .replace(/&(tab|newline|colon|lpar);/gi, (_m, name: string) => named[name.toLowerCase()] ?? "");
  return decoded.replace(/[\u0000-\u0020\u007f-\u009f]/g, "").toLowerCase();
}

// The markup guard: it reads the tags and their attributes, never the text between them. Text reaches a page only
// escaped, so words such as "style =" or "onclick=" in a title are text and render; a script or style element, a style
// attribute, an event-handler attribute, a javascript: address, a comment or a tag that never ends is refused.
function assertAllowed(html: string): void {
  const refuse = (): never => {
    throw new Error("markup is not allowed: no script, no event handler and no inline style");
  };
  let at = 0;
  for (;;) {
    at = html.indexOf("<", at);
    if (at < 0) return;
    if (html.startsWith("<!--", at) || html.startsWith("<?", at) || html.startsWith("<![", at)) refuse();
    if (html.startsWith("<!", at)) {
      if (!/^<!doctype html>/i.test(html.slice(at, at + 15))) refuse();
      at += 15;
      continue;
    }
    const open = /^<\/?([A-Za-z][A-Za-z0-9:-]*)/.exec(html.slice(at, at + 64));
    if (open === null) {
      // A "<" that starts no tag is text.
      at += 1;
      continue;
    }
    const name = (open[1] ?? "").toLowerCase();
    if (name === "script" || name === "style") refuse();
    let i = at + open[0].length;
    for (;;) {
      while (i < html.length && /[\s/]/.test(html.charAt(i))) i += 1;
      if (i >= html.length) refuse();
      if (html.charAt(i) === ">") break;
      const start = i;
      while (i < html.length && !/[\s/=>]/.test(html.charAt(i))) i += 1;
      const attribute = html.slice(start, i).toLowerCase();
      if (attribute === "" || attribute === "style" || attribute.startsWith("on") || /[<"'`]/.test(attribute)) refuse();
      while (i < html.length && /\s/.test(html.charAt(i))) i += 1;
      if (html.charAt(i) !== "=") continue;
      i += 1;
      while (i < html.length && /\s/.test(html.charAt(i))) i += 1;
      const quote = html.charAt(i);
      let value: string;
      if (quote === '"' || quote === "'") {
        const end = html.indexOf(quote, i + 1);
        if (end < 0) refuse();
        value = html.slice(i + 1, end);
        i = end + 1;
      } else {
        const from = i;
        while (i < html.length && !/[\s>]/.test(html.charAt(i))) i += 1;
        value = html.slice(from, i);
      }
      if (plainAddress(value).startsWith("javascript:")) refuse();
    }
    at = i + 1;
  }
}

function document(title: string, bodyHtml: string): string {
  const html =
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    `<title>${escapeText(title)}</title>\n<link rel="stylesheet" href="/style.css">\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`;
  assertAllowed(html);
  return html;
}

export function htmlPage(title: string, bodyHtml: string, status = 200, cookies: readonly string[] = []): Response {
  return respond(document(title, bodyHtml), { status, headers: { "Content-Type": "text/html; charset=utf-8" } }, true, cookies);
}

const STYLE = `*,*::before,*::after{box-sizing:border-box}
body{margin:0 auto;padding:16px;max-width:40rem;font:16px/1.5 system-ui,sans-serif;color:#1a1a1a;background:#fff}
h1,h2,h3{line-height:1.25}
a{color:#0b57d0}
details{margin:.5rem 0}
p,li,summary{overflow-wrap:anywhere}
@media (prefers-color-scheme:dark){body{color:#eee;background:#111}a{color:#8ab4f8}}
`;

export function stylesheet(): Response {
  return respond(STYLE, { status: 200, headers: { "Content-Type": "text/css; charset=utf-8" } }, false);
}

// The OAuth callback answers with this, whether it completed or refused, so that no code or state stays in the
// address bar or the history (SPEC-0004 rule 3). It takes cookies and never a location: nothing from the request can
// reach the address.
export function redirectHome(cookies: readonly string[] = []): Response {
  return respond(null, { status: 303, headers: { Location: "/" } }, true, cookies);
}

// The one redirect away from the portal: to GitHub's authorization address, and nowhere else.
export function redirectToAuthorize(location: string, cookies: readonly string[]): Response {
  if (!location.startsWith(`${AUTHORIZE_ADDRESS}?`)) throw new Error("the redirect is not allowed");
  return respond(null, { status: 303, headers: { Location: location } }, true, cookies);
}

export function notFoundPage(): Response {
  return htmlPage("Not found", "<p>Page not found.</p>", 404);
}

// The same response with more cookies set (a new response: the first one is not changed).
export function withCookies(response: Response, cookies: readonly string[]): Response {
  const headers = new Headers(response.headers);
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(response.body, { status: response.status, headers });
}

export function errorPage(): Response {
  return htmlPage("Error", `<p>${FIXED_ERROR_PHRASE}</p>`, 500);
}

type Handler = (request: Request) => Response | Promise<Response>;

// An unhandled error becomes the fixed page, with no detail and no log (SPEC-0004 rule 4).
export function safely(handler: Handler): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request);
    } catch {
      return errorPage();
    }
  };
}
