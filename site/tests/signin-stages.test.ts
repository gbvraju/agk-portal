// The sign-in refusal names its stage in a fixed phrase, never a value (the maintainers' order after the first live sign-in).
// The stage travels to the home page in the one-time notice cookie, as a code from a fixed list, and is shown once.
// Marker REQ-102 AC3 (the refusals before any token request) and REQ-102 AC4 (the exchange). Recorded answers, no network.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NOTICE_COOKIE,
  SIGN_IN_FAILED_PHRASE,
  STATE_COOKIE,
  createApp,
  createCore,
  createGithubClient,
  hashState,
  type Config,
  type ConfigName,
} from "../src/core/index.ts";

const START = 1_800_000_000_000;
const STATE = "fixture-state-value-abcdef0123456789";
const CODE = "fixture-oauth-code-abcdef";
const SECRET = "fixture-client-secret-value";
const values: Record<ConfigName, string> = {
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: SECRET,
  SESSION_KEY: "fixture-session-key-A-0123456789abcdefXYZ",
  CALLBACK_URL: "https://portal.example/callback",
};
const config: Config = { get: (name) => values[name] };

function build(exchange: () => Response | Promise<Response>) {
  const calls: string[] = [];
  const github = createGithubClient({
    fetch: async (url) => {
      calls.push(url);
      return exchange();
    },
  });
  return { app: createApp(createCore({ config, now: () => START }), { github }), calls };
}

const noteOf = (response: Response): string | undefined => response.headers.getSetCookie().find((c) => c.startsWith(`${NOTICE_COOKIE}=`));
const valueOf = (cookie: string): string => cookie.split(";")[0]!.slice(cookie.indexOf("=") + 1);

async function callback(app: (r: Request) => Promise<Response>, query: string, cookieState: string | null = STATE): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cookieState !== null) headers["cookie"] = `${STATE_COOKIE}=${await hashState(cookieState)}`;
  return app(new Request(`https://portal.example/callback?${query}`, { headers }));
}

async function shown(app: (r: Request) => Promise<Response>, refusal: Response): Promise<{ html: string; cleared: boolean }> {
  const notice = noteOf(refusal);
  assert.ok(notice, "a one-time notice is left");
  const home = await app(new Request("https://portal.example/", { headers: { cookie: `${NOTICE_COOKIE}=${valueOf(notice)}` } }));
  return { html: await home.text(), cleared: noteOf(home)?.includes("Max-Age=0") === true };
}

const STAGES = [
  "the sign-in state did not match",
  "GitHub returned no code",
  "GitHub refused the code exchange",
  "GitHub's answer had no token",
];

test("REQ-102 AC3: a state that is missing, different or has no cookie says the sign-in state did not match, and GitHub is not called", async () => {
  const { app, calls } = build(() => new Response("{}"));
  const cases: [string, string, string | null][] = [
    ["missing state", `code=${CODE}`, STATE],
    ["different state", `code=${CODE}&state=${STATE}x`, STATE],
    ["no cookie", `code=${CODE}&state=${STATE}`, null],
    ["different cookie", `code=${CODE}&state=${STATE}`, `${STATE}y`],
    ["no code and a different state", `state=${STATE}x`, STATE],
  ];
  for (const [name, query, cookieState] of cases) {
    const refusal = await callback(app, query, cookieState);
    const { html, cleared } = await shown(app, refusal);
    assert.ok(html.includes(SIGN_IN_FAILED_PHRASE), name);
    assert.ok(html.includes("The sign-in state did not match."), `${name}: ${html}`);
    assert.ok(cleared, `${name}: shown once`);
    for (const other of STAGES.slice(1)) assert.ok(!html.toLowerCase().includes(other.toLowerCase()), `${name}: only its own stage`);
  }
  assert.deepEqual(calls, []);
});

test("REQ-102 AC3: a matching state with no code (GitHub sent the person back without one) says GitHub returned no code", async () => {
  const { app, calls } = build(() => new Response("{}"));
  for (const query of [`state=${STATE}`, `state=${STATE}&code=`, `state=${STATE}&error=access_denied&error_description=The+user+has+denied`]) {
    const { html, cleared } = await shown(app, await callback(app, query));
    assert.ok(html.includes("GitHub returned no code."), `${query}: ${html}`);
    assert.ok(!html.includes("access_denied") && !html.includes("denied"), "GitHub's own words in the address are never shown");
    assert.ok(cleared);
  }
  assert.deepEqual(calls, []);
});

test("REQ-102 AC4: an exchange that GitHub answers with a status other than 200 says GitHub refused the code exchange, with the status", async () => {
  for (const status of [400, 401, 403, 404, 422, 429, 500, 502, 503]) {
    const { app, calls } = build(() => new Response(JSON.stringify({ error: "bad_verification_code" }), { status }));
    const refusal = await callback(app, `code=${CODE}&state=${STATE}`);
    const { html } = await shown(app, refusal);
    assert.ok(html.includes(`GitHub refused the code exchange (HTTP ${status}).`), `${status}: ${html}`);
    assert.ok(!html.includes("bad_verification_code"), "a refused exchange shows the status, not the body");
    assert.equal(calls.length, 1);
    assert.ok(!refusal.headers.getSetCookie().some((c) => c.startsWith("__Host-session")), "no session");
  }
});

test("REQ-102 AC4: an answer with no token names GitHub's own error only when it is on the fixed list, else unknown", async () => {
  const listed = ["bad_verification_code", "incorrect_client_credentials", "redirect_uri_mismatch", "unverified_user_email", "access_denied"];
  for (const error of listed) {
    const { app } = build(() => new Response(JSON.stringify({ error, error_description: "free text with fixture-client-secret-value", error_uri: "https://x.example" })));
    const { html } = await shown(app, await callback(app, `code=${CODE}&state=${STATE}`));
    assert.ok(html.includes(`GitHub&#39;s answer had no token (${error}).`) || html.includes(`GitHub's answer had no token (${error}).`), `${error}: ${html}`);
    assert.ok(!html.includes("free text") && !html.includes(SECRET) && !html.includes("error_uri"), "no description, no uri, no secret");
  }
  const others: unknown[] = ["unexpected_thing", "<script>x()</script>", "Bad_Verification_Code", "", "bad_verification_code ", 7, null, ["bad_verification_code"], { e: 1 }];
  for (const error of others) {
    const { app } = build(() => new Response(JSON.stringify({ error })));
    const { html } = await shown(app, await callback(app, `code=${CODE}&state=${STATE}`));
    assert.ok(html.includes("answer had no token (unknown)."), `${JSON.stringify(error)}: ${html}`);
    assert.ok(!html.includes("<script>") && !html.includes("unexpected_thing"));
  }
  for (const body of ["{}", '{"access_token":""}', '{"access_token":7}', "[]", "null", "not json"]) {
    const { app } = build(() => new Response(body));
    const { html } = await shown(app, await callback(app, `code=${CODE}&state=${STATE}`));
    assert.ok(html.includes("answer had no token (unknown)."), `${body}: ${html}`);
  }
});

test("REQ-102 AC4: a failed request to GitHub also reads as an answer with no token, in the fixed list", async () => {
  const { app } = build(() => {
    throw new Error(`network down ${SECRET}`);
  });
  const { html } = await shown(app, await callback(app, `code=${CODE}&state=${STATE}`));
  assert.ok(html.includes("answer had no token (unknown)."));
  assert.ok(!html.includes("network down") && !html.includes(SECRET));
});

test("REQ-102 AC3: the notice cookie holds a code from a fixed list, nothing GitHub sent, and a forged value shows only the general phrase", async () => {
  const { app } = build(() => new Response(JSON.stringify({ error: "access_denied" })));
  const refusal = await callback(app, `code=${CODE}&state=${STATE}`);
  const notice = noteOf(refusal)!;
  assert.match(valueOf(notice), /^[A-Za-z0-9_-]+$/);
  for (const attribute of ["Path=/", "Max-Age=60", "Secure", "HttpOnly", "SameSite=Lax"]) assert.ok(notice.includes(attribute), attribute);
  assert.ok(!notice.includes(CODE) && !notice.includes(STATE) && !notice.includes(SECRET));
  const forged = ["failed-token-script", "failed-http-99", "failed-http-1000", "failed-http-4x1", "failed-token-ACCESS_DENIED", "failed-state-extra", "failed-", "failed", "x", "failed-http-401-402"];
  for (const value of forged) {
    const home = await app(new Request("https://portal.example/", { headers: { cookie: `${NOTICE_COOKIE}=${value}` } }));
    const html = await home.text();
    assert.ok(!/did not match|returned no code|refused the code exchange|had no token/.test(html), `${value}: no stage is shown for a value off the list`);
    assert.ok(!html.includes(SIGN_IN_FAILED_PHRASE), `${value}: a value off the list is not a notice at all`);
  }
  const old = await app(new Request("https://portal.example/", { headers: { cookie: `${NOTICE_COOKIE}=signin-failed` } }));
  assert.ok((await old.text()).includes(SIGN_IN_FAILED_PHRASE), "the former value still shows the general phrase");
});

test("REQ-102 AC4: a sign-in that succeeds leaves no notice, and the stage line is not shown to a visitor with no notice", async () => {
  const { app } = build(() => new Response(JSON.stringify({ access_token: "ghu_fixture_user_token_0123456789", expires_in: 28_800 })));
  const ok = await callback(app, `code=${CODE}&state=${STATE}`);
  assert.equal(noteOf(ok), undefined);
  const fresh = await app(new Request("https://portal.example/"));
  const html = await fresh.text();
  assert.ok(!html.includes(SIGN_IN_FAILED_PHRASE) && !/did not match|returned no code|refused the code exchange|had no token/.test(html));
});
