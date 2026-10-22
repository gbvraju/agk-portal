// The stateless session and sign-out (SPEC-0002 rules 4 to 10). Markers REQ-102 AC4 to AC8 are in the test names.
// Recorded GitHub answers, Web Crypto, a fixed clock and no network.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  TOKEN_ADDRESS,
  createApp,
  createCore,
  createGithubClient,
  hashState,
  openSession,
  sealPlaintext,
  sealSession,
  type Config,
  type ConfigName,
} from "../src/core/index.ts";
import { filesUsingIdentifier } from "./support/syntax-scan.ts";
import { resolve } from "node:path";

const coreDir = resolve(import.meta.dirname, "..", "src", "core");
const HOUR = 3_600_000;
const START = 1_800_000_000_000;
const TOKEN = "ghu_fixture_user_token_0123456789";
const REFRESH = "ghr_fixture_refresh_token_9876543210";
const CODE = "fixture-oauth-code-abcdef";
const STATE = "fixture-state-value-abcdef0123456789";
const KEY_A = "fixture-session-key-A-0123456789abcdefXYZ";
const KEY_B = "fixture-session-key-B-0123456789abcdefXYZ";
const EXPIRED_PHRASE = "Your session has ended. Sign in with GitHub to continue.";
const EMPTY_PHRASE = "No projects are available to you yet.";

const settings = (key: string): Record<ConfigName, string> => ({
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
  SESSION_KEY: key,
  CALLBACK_URL: "https://portal.example/callback",
});

interface Harness {
  app: (request: Request) => Promise<Response>;
  calls: { url: string; init: RequestInit | undefined }[];
  tokensSeen: string[];
  clock: { now: number };
}

function harness(key = KEY_A, answer: unknown = { access_token: TOKEN, expires_in: 28_800, refresh_token: REFRESH, token_type: "bearer" }, status = 200): Harness {
  const values = settings(key);
  const config: Config = { get: (name) => values[name] };
  const clock = { now: START };
  const calls: Harness["calls"] = [];
  const tokensSeen: string[] = [];
  const github = createGithubClient({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } });
    },
  });
  const app = createApp(createCore({ config, now: () => clock.now }), {
    github,
    projects: async (token) => {
      tokensSeen.push(token);
      return [];
    },
  });
  return { app, calls, tokensSeen, clock };
}

const setCookie = (response: Response, name: string): string | undefined => response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
const valueOf = (cookie: string): string => cookie.split(";")[0]!.slice(cookie.indexOf("=") + 1);

async function signIn(h: Harness): Promise<Response> {
  const hash = await hashState(STATE);
  return h.app(new Request(`https://portal.example/callback?code=${CODE}&state=${STATE}`, { headers: { cookie: `${STATE_COOKIE}=${hash}` } }));
}

test("REQ-102 AC4: a recorded token answer gives one session cookie that holds the token and its expiry only", async () => {
  const h = harness();
  const response = await signIn(h);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0]!.url, TOKEN_ADDRESS);
  const body = String(h.calls[0]!.init?.body);
  for (const part of ["client_id=Iv1.fixtureclientid", "client_secret=fixture-client-secret-value", `code=${CODE}`, "redirect_uri="]) {
    assert.ok(body.includes(part), `the exchange sends ${part}`);
  }
  const cookies = response.headers.getSetCookie().filter((c) => c.startsWith(`${SESSION_COOKIE}=`));
  assert.equal(cookies.length, 1, "exactly one session cookie");
  assert.equal(SESSION_COOKIE, "__Host-session");
  const parts = cookies[0]!.split("; ");
  for (const attribute of ["Path=/", "Secure", "HttpOnly", "SameSite=Lax", "Max-Age=28800"]) assert.ok(parts.includes(attribute), `${attribute} in ${cookies[0]}`);
  assert.ok(!parts.some((p) => p.toLowerCase().startsWith("domain")), "no Domain");
  const value = valueOf(cookies[0]!);
  assert.ok(!value.includes(TOKEN) && !value.includes(REFRESH), "the token is encrypted");
  const opened = await openSession(value, KEY_A, START + 1);
  assert.deepEqual(opened, { token: TOKEN, expiresAt: START + 8 * HOUR }, "the token and its expiry and nothing else, and no refresh token");
});

test("REQ-102 AC4: the lifetime is the smaller of 8 hours and the token's expiry, and with no expiry it is 8 hours", async () => {
  for (const [expiresIn, maxAge] of [[3_600, 3_600], [100_000, 28_800], [undefined, 28_800]] as const) {
    const h = harness(KEY_A, { access_token: TOKEN, ...(expiresIn === undefined ? {} : { expires_in: expiresIn }), refresh_token: REFRESH });
    const cookie = setCookie(await signIn(h), SESSION_COOKIE)!;
    assert.ok(cookie.includes(`Max-Age=${maxAge}`), `expires_in ${String(expiresIn)} gives Max-Age ${maxAge}: ${cookie}`);
    const opened = await openSession(valueOf(cookie), KEY_A, START + 1);
    assert.equal(opened?.expiresAt, START + maxAge * 1000);
  }
});

test("REQ-102 AC4: a refused exchange sets no session", async () => {
  for (const [answer, status] of [
    [{ error: "bad_verification_code" }, 200],
    [{ error: "bad_verification_code" }, 400],
    [{}, 200],
    [{ access_token: "" }, 200],
    ["not an object", 200],
  ] as const) {
    const h = harness(KEY_A, answer, status);
    const response = await signIn(h);
    assert.equal(response.status, 303);
    assert.equal(setCookie(response, SESSION_COOKIE), undefined, `no session for ${JSON.stringify(answer)} ${status}`);
    assert.ok(setCookie(response, STATE_COOKIE)?.includes("Max-Age=0"));
  }
});

test("REQ-102 AC5: any instance that has the key answers, and no storage is touched", async () => {
  const a = harness(KEY_A);
  const cookie = setCookie(await signIn(a), SESSION_COOKIE)!;
  const b = harness(KEY_A);
  b.clock.now = START + HOUR;
  const home = await b.app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${valueOf(cookie)}` } }));
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(html.includes(EMPTY_PHRASE) && html.includes('<form method="post" action="/signout">'), "signed in on another instance");
  assert.deepEqual(b.tokensSeen, [TOKEN], "the token read from the cookie is used");
  assert.equal(b.calls.length, 0, "nothing was fetched");
  assert.deepEqual(
    ["localStorage", "sessionStorage", "indexedDB", "caches", "DurableObject", "KVNamespace", "D1Database", "R2Bucket"].flatMap((name) => filesUsingIdentifier(coreDir, name)),
    [],
    "the core names no storage",
  );
});

test("REQ-102 AC6: an expired, tampered, short, empty or other-key cookie is signed out with the fixed phrase and no token use", async () => {
  const a = harness(KEY_A);
  const good = valueOf(setCookie(await signIn(a), SESSION_COOKIE)!);
  const flipped = good.slice(0, 20) + (good[20] === "A" ? "B" : "A") + good.slice(21);
  const cases: [string, string, (h: Harness) => void][] = [
    ["expired", good, (h) => void (h.clock.now = START + 9 * HOUR)],
    ["tampered", flipped, () => undefined],
    ["truncated", good.slice(0, 10), () => undefined],
    ["empty", "", () => undefined],
    ["garbage", "!!!not-base64!!!", () => undefined],
  ];
  for (const [name, value, tune] of cases) {
    const h = harness(KEY_A);
    tune(h);
    const response = await h.app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${value}` } }));
    assert.equal(response.status, 200, `${name}: no error status`);
    const html = await response.text();
    assert.ok(html.includes(EXPIRED_PHRASE), `${name}: the fixed phrase`);
    assert.ok(html.includes('<a href="/login">Sign in with GitHub</a>'), `${name}: with the offer`);
    assert.ok(setCookie(response, SESSION_COOKIE)?.includes("Max-Age=0"), `${name}: the cookie is cleared`);
    assert.deepEqual(h.tokensSeen, [], `${name}: no token is used`);
  }
  const other = harness(KEY_B);
  const response = await other.app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${good}` } }));
  assert.ok((await response.text()).includes(EXPIRED_PHRASE), "another key signs everyone out");
  assert.deepEqual(other.tokensSeen, []);
  const fresh = await harness(KEY_A).app(new Request("https://portal.example/"));
  assert.ok(!(await fresh.text()).includes(EXPIRED_PHRASE), "a visitor with no cookie at all sees the offer only (Q-B2-6)");
});

test("REQ-102 AC7: signing out is a POST that clears the cookie and calls nothing at GitHub, and a GET does not sign out", async () => {
  const h = harness(KEY_A);
  const cookie = valueOf(setCookie(await signIn(h), SESSION_COOKIE)!);
  const callsBefore = h.calls.length;
  const out = await h.app(new Request("https://portal.example/signout", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${cookie}`, origin: "https://portal.example" } }));
  assert.equal(out.status, 200);
  assert.ok((await out.text()).includes('<a href="/login">Sign in with GitHub</a>'), "the sign-in offer");
  const cleared = setCookie(out, SESSION_COOKIE)!;
  for (const attribute of ["Max-Age=0", "Path=/", "Secure", "HttpOnly", "SameSite=Lax"]) assert.ok(cleared.includes(attribute), `${attribute} in ${cleared}`);
  assert.equal(h.calls.length, callsBefore, "nothing was called at GitHub");
  const get = await h.app(new Request("https://portal.example/signout", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  assert.equal(get.status, 404);
  assert.equal(setCookie(get, SESSION_COOKIE), undefined, "a GET does not touch the session");
});

test("REQ-102 AC8: a signed-in person with no readable project sees the fixed phrase, not a blank page, and no project name", async () => {
  const h = harness(KEY_A);
  const cookie = valueOf(setCookie(await signIn(h), SESSION_COOKIE)!);
  const response = await h.app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  const html = await response.text();
  assert.ok(html.includes(EMPTY_PHRASE));
  assert.ok(!/gbvraju|REQ-\d|SPEC-\d|\/pull\//.test(html), "no project name");
  assert.ok(html.replace(/<[^>]*>/g, "").trim().length > 20, "not blank");
});

test("REQ-102 AC4: every cookie has its own random nonce, and a short session key is refused by name, never by value", async () => {
  const h = harness(KEY_A);
  const first = valueOf(setCookie(await signIn(h), SESSION_COOKIE)!);
  const second = valueOf(setCookie(await signIn(h), SESSION_COOKIE)!);
  assert.notEqual(first, second, "the same session sealed twice gives two different cookies");
  const short = "short-key-value";
  await assert.rejects(
    () => sealSession({ token: TOKEN, expiresAt: START + HOUR }, short),
    (error: unknown) => error instanceof Error && error.message.includes("SESSION_KEY") && !error.message.includes(short),
  );
});

test("REQ-102 AC6: a cookie this key made but whose plaintext is not exactly a token and an expiry is signed out", async () => {
  const good = { t: TOKEN, e: START + HOUR };
  assert.deepEqual(await openSession(await sealPlaintext(JSON.stringify(good), KEY_A), KEY_A, START), { token: TOKEN, expiresAt: START + HOUR });
  const bad: unknown[] = [
    { ...good, r: REFRESH },
    { t: TOKEN },
    { e: START + HOUR },
    { t: "", e: START + HOUR },
    { t: TOKEN, e: "soon" },
    { t: TOKEN, e: Number.NaN },
    [TOKEN, START + HOUR],
    "plain text",
    null,
  ];
  for (const plaintext of bad) {
    const sealed = await sealPlaintext(typeof plaintext === "string" && plaintext === "plain text" ? plaintext : JSON.stringify(plaintext), KEY_A);
    assert.equal(await openSession(sealed, KEY_A, START), undefined, `refused: ${JSON.stringify(plaintext)}`);
  }
});
