// Every response of the server is built here, and only here, so that none leaves without the security headers
// (SPEC-0004 rules 1 to 5). Server-rendered HTML only: no script, no event handler, no inline style, no style
// element. Nothing is logged: this file never touches the console (SPEC-0004 rule 4).
export const CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

const HSTS = "max-age=31536000; includeSubDomains";

export const FIXED_ERROR_PHRASE = "Something went wrong. Please try again.";

function respond(body: BodyInit | null, init: ResponseInit, noStore: boolean): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Strict-Transport-Security", HSTS);
  if (noStore) headers.set("Cache-Control", "no-store");
  return new Response(body, { ...init, headers });
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function assertAllowed(html: string): void {
  if (/<script|<style|\sstyle\s*=|\son[a-z]+\s*=|javascript:/i.test(html)) {
    throw new Error("markup is not allowed: no script, no event handler and no inline style");
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

export function htmlPage(title: string, bodyHtml: string, status = 200): Response {
  return respond(document(title, bodyHtml), { status, headers: { "Content-Type": "text/html; charset=utf-8" } }, true);
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
// address bar or the history (SPEC-0004 rule 3). It takes no argument: nothing from the request can reach the
// address.
export function redirectHome(): Response {
  return respond(null, { status: 303, headers: { Location: "/" } }, true);
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
