// Sign-in: the offer, the OAuth flow and the state (SPEC-0002 rules 1 to 3, SPEC-0004 rule 3).
// Markers REQ-102 AC1 to AC3 are in the test names. The token exchange and the session are Item 6. No network.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTHORIZE_ADDRESS,
  NOTICE_COOKIE,
  SIGN_IN_FAILED_PHRASE,
  STATE_COOKIE,
  constantTimeEqual,
  createApp,
  createCore,
  redirectHome,
  type Config,
  type ConfigName,
} from "../src/core/index.ts";

const values: Record<ConfigName, string> = {
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
  SESSION_KEY: "fixture-session-key-value",
  CALLBACK_URL: "https://portal.example/callback",
};
const config: Config = { get: (name) => values[name] };

function build(complete?: (code: string) => Promise<Response>) {
  const completed: string[] = [];
  const app = createApp(createCore({ config, now: () => 0 }), {
    complete: async (code) => {
      completed.push(code);
      return complete ? complete(code) : redirectHome();
    },
  });
  return { app, completed };
}

function cookieNamed(response: Response, name: string): string | undefined {
  return response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
}

async function start(app: (r: Request) => Promise<Response>): Promise<{ state: string; cookie: string; response: Response }> {
  const response = await app(new Request("https://portal.example/login"));
  const location = new URL(response.headers.get("location") ?? "");
  const cookie = cookieNamed(response, STATE_COOKIE) ?? "";
  return { state: location.searchParams.get("state") ?? "", cookie, response };
}

const cookieValue = (setCookie: string): string => setCookie.split(";")[0]!.split("=")[1]!;

test("REQ-102 AC1: a visitor who is not signed in sees only the sign-in offer and no project name", async () => {
  const { app } = build();
  const response = await app(new Request("https://portal.example/"));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('<a href="/login">Sign in with GitHub</a>'), "the fixed phrase as a link that starts sign-in");
  assert.ok(!/gbvraju|REQ-\d|SPEC-\d|ADR-\d|\/pull\/|github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(html), "no project, repository or organisation");
  assert.ok(!html.includes(SIGN_IN_FAILED_PHRASE), "no notice without a refusal");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(!response.headers.getSetCookie().some((c) => c.startsWith("__Host-session")), "no session");
});

test("REQ-102 AC2: starting sign-in redirects to GitHub with a random state of at least 128 bits bound to the browser", async () => {
  const { app } = build();
  const seen = new Set<string>();
  for (let i = 0; i < 20; i += 1) {
    const { state, cookie, response } = await start(app);
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get("location") ?? "");
    assert.equal(`${location.origin}${location.pathname}`, AUTHORIZE_ADDRESS);
    assert.equal(location.searchParams.get("client_id"), values.GITHUB_APP_CLIENT_ID);
    assert.equal(location.searchParams.get("redirect_uri"), values.CALLBACK_URL);
    assert.ok(!location.href.includes(values.GITHUB_APP_CLIENT_SECRET), "the secret is never in the address");
    assert.match(state, /^[A-Za-z0-9_-]+$/);
    assert.ok(state.length >= 22, "at least 128 bits in base64url");
    assert.ok(!seen.has(state), "a fresh state each time");
    seen.add(state);
    const parts = cookie.split("; ");
    assert.equal(parts[0]!.split("=")[0], STATE_COOKIE);
    assert.equal(STATE_COOKIE, "__Host-state");
    for (const attribute of ["Path=/", "Max-Age=600", "Secure", "HttpOnly", "SameSite=Lax"]) {
      assert.ok(parts.includes(attribute), `${attribute} in ${cookie}`);
    }
    assert.ok(!parts.some((p) => p.toLowerCase().startsWith("domain")), "no Domain");
    assert.notEqual(cookieValue(cookie), state, "the cookie holds a hash, so no cookie value is in a URL");
    assert.ok(!location.href.includes(cookieValue(cookie)));
  }
});

test("REQ-102 AC3: a missing or different state, a missing cookie and a missing code each refuse the sign-in", async () => {
  const { app, completed } = build();
  const { state, cookie } = await start(app);
  const hash = cookieValue(cookie);
  const code = "fixture-oauth-code-abcdef";
  const cases: [string, string, string][] = [
    ["missing state", `https://portal.example/callback?code=${code}`, `${STATE_COOKIE}=${hash}`],
    ["different state", `https://portal.example/callback?code=${code}&state=${state}x`, `${STATE_COOKIE}=${hash}`],
    ["missing cookie", `https://portal.example/callback?code=${code}&state=${state}`, ""],
    ["wrong cookie", `https://portal.example/callback?code=${code}&state=${state}`, `${STATE_COOKIE}=${hash}x`],
    ["missing code", `https://portal.example/callback?state=${state}`, `${STATE_COOKIE}=${hash}`],
    ["empty code", `https://portal.example/callback?code=&state=${state}`, `${STATE_COOKIE}=${hash}`],
  ];
  for (const [name, url, cookieHeader] of cases) {
    const response = await app(new Request(url, { headers: cookieHeader ? { cookie: cookieHeader } : {} }));
    assert.equal(response.status, 303, name);
    assert.equal(response.headers.get("location"), "/", `${name}: the answer is the 303 to the home page`);
    for (const [, value] of response.headers) assert.ok(!value.includes(code) && !value.includes(state), `${name}: no code or state in what is sent`);
    const cleared = cookieNamed(response, STATE_COOKIE);
    assert.ok(cleared?.includes("Max-Age=0"), `${name}: the state cookie is cleared`);
    assert.ok(!response.headers.getSetCookie().some((c) => c.startsWith("__Host-session")), `${name}: no session`);
    const notice = cookieNamed(response, NOTICE_COOKIE);
    assert.ok(notice, `${name}: a one-time notice is left for the home page`);
    // The home page shows the fixed phrase and the offer once, and clears the notice.
    const home = await app(new Request("https://portal.example/", { headers: { cookie: `${NOTICE_COOKIE}=${cookieValue(notice as string)}` } }));
    const html = await home.text();
    assert.ok(html.includes(SIGN_IN_FAILED_PHRASE), `${name}: the fixed phrase is shown`);
    assert.equal(SIGN_IN_FAILED_PHRASE, "Sign-in could not be completed. Sign in with GitHub to try again.");
    assert.ok(html.includes('<a href="/login">Sign in with GitHub</a>'), `${name}: with the offer`);
    assert.ok(cookieNamed(home, NOTICE_COOKIE)?.includes("Max-Age=0"), `${name}: the notice is cleared`);
  }
  assert.deepEqual(completed, [], "no request to GitHub is made: the completion is never called");
});

test("REQ-102 AC3: a matching state and a code hand the code on once, and the state cookie is cleared", async () => {
  const { app, completed } = build();
  const { state, cookie } = await start(app);
  const code = "fixture-oauth-code-abcdef";
  const response = await app(
    new Request(`https://portal.example/callback?code=${code}&state=${state}`, { headers: { cookie: `${STATE_COOKIE}=${cookieValue(cookie)}` } }),
  );
  assert.deepEqual(completed, [code]);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  assert.ok(cookieNamed(response, STATE_COOKIE)?.includes("Max-Age=0"), "the state cookie is cleared on success too");
  for (const [, value] of response.headers) assert.ok(!value.includes(code) && !value.includes(state), "no code or state in what is sent");
});

test("REQ-102 AC3: the comparison is constant time over equal-length hashes", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false);
  assert.equal(constantTimeEqual("", ""), true);
});

test("REQ-102 AC1: an unknown address is a fixed not-found page, never a project name", async () => {
  const { app } = build();
  const response = await app(new Request("https://portal.example/nowhere"));
  assert.equal(response.status, 404);
  assert.ok((await response.text()).includes("Page not found."));
  assert.equal(response.headers.get("content-security-policy") !== null, true);
});
