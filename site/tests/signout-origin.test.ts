// POST /signout answers only a request whose Origin is this site's own origin, the origin of CALLBACK_URL (the register's
// residual on app.ts, closed by this change). Marker REQ-102 AC7: signing out clears the cookie and calls nothing at GitHub;
// a request from another origin does neither. Recorded settings, a fixed clock and no network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SESSION_COOKIE, createApp, createCore, sealSession, type Config, type ConfigName } from "../src/core/index.ts";

const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const TOKEN = "ghu_fixture_user_token_0123456789";

function app(callbackUrl = "https://portal.example/callback") {
  const values: Record<ConfigName, string> = {
    GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
    GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
    SESSION_KEY: KEY,
    CALLBACK_URL: callbackUrl,
  };
  const config: Config = { get: (name) => values[name] };
  const calls: string[] = [];
  const handle = createApp(createCore({ config, now: () => START }), {
    projects: async (token) => {
      calls.push(token);
      return [];
    },
  });
  return { handle, calls };
}

const cookie = async (): Promise<string> => `${SESSION_COOKIE}=${await sealSession({ token: TOKEN, expiresAt: START + 3_600_000 }, KEY)}`;
const post = async (origin: string | undefined, url = "https://portal.example/signout"): Promise<Request> => {
  const headers: Record<string, string> = { cookie: await cookie() };
  if (origin !== undefined) headers["origin"] = origin;
  return new Request(url, { method: "POST", headers });
};

test("REQ-102 AC7: a sign-out from this site's own origin clears the cookie, whatever path CALLBACK_URL has", async () => {
  for (const [callbackUrl, origin] of [
    ["https://portal.example/callback", "https://portal.example"],
    ["https://portal.example/some/other/path?x=1", "https://portal.example"],
    ["https://portal.example:8443/callback", "https://portal.example:8443"],
    ["https://Portal.Example/callback", "https://portal.example"],
  ] as const) {
    const { handle } = app(callbackUrl);
    const out = await handle(await post(origin));
    assert.equal(out.status, 200, `${callbackUrl} ${origin}`);
    assert.ok(out.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=`) && c.includes("Max-Age=0")), "the cookie is cleared");
    assert.ok((await out.text()).includes('<a href="/login">Sign in with GitHub</a>'));
  }
});

test("REQ-102 AC7: a sign-out from any other origin, or with no usable Origin, is the not-found page and clears nothing", async () => {
  const others: (string | undefined)[] = [
    "https://evil.example",
    "https://portal.example.evil.example",
    "https://evil.example/https://portal.example",
    "http://portal.example",
    "https://portal.example:8443",
    "https://portal.example/",
    "https://portal.example/signout",
    "https://sub.portal.example",
    "null",
    "",
    "HTTPS://PORTAL.EXAMPLE.evil.example",
    undefined,
  ];
  for (const origin of others) {
    const { handle, calls } = app();
    const out = await handle(await post(origin));
    assert.equal(out.status, 404, JSON.stringify(origin));
    assert.deepEqual(out.headers.getSetCookie(), [], `${JSON.stringify(origin)}: nothing is cleared or set`);
    assert.ok((await out.text()).includes("Page not found."), "the not-found page");
    assert.ok(out.headers.get("content-security-policy"), "with the secure headers");
    assert.deepEqual(calls, [], "nothing was read for the person");
    const still = await handle(new Request("https://portal.example/", { headers: { cookie: await cookie() } }));
    assert.ok((await still.text()).includes('action="/signout"'), "the person is still signed in");
  }
});

test("REQ-102 AC7: a Referer or a forwarding header is not a substitute for the Origin", async () => {
  const { handle } = app();
  const forged = new Request("https://portal.example/signout", {
    method: "POST",
    headers: { cookie: await cookie(), origin: "https://evil.example", referer: "https://portal.example/", "x-forwarded-host": "portal.example", host: "portal.example" },
  });
  assert.equal((await handle(forged)).status, 404);
  const refererOnly = new Request("https://portal.example/signout", { method: "POST", headers: { cookie: await cookie(), referer: "https://portal.example/" } });
  assert.equal((await handle(refererOnly)).status, 404, "no Origin is refused even with a Referer of this site");
});

test("REQ-102 AC7: a CALLBACK_URL that is not an address refuses every sign-out rather than allowing every origin", async () => {
  for (const callbackUrl of ["not a url", "/callback", "ftp://portal.example/callback", "mailto:a@b.example"]) {
    const { handle } = app(callbackUrl);
    for (const origin of ["https://portal.example", "null", "https://evil.example", undefined]) {
      const out = await handle(await post(origin));
      assert.equal(out.status, 404, `${JSON.stringify(callbackUrl)} ${String(origin)}`);
      assert.deepEqual(out.headers.getSetCookie(), []);
    }
  }
});

test("REQ-102 AC7: the sign-out form still posts to /signout with no field, and other methods and paths are unchanged", async () => {
  const { handle } = app();
  const signedIn = await handle(new Request("https://portal.example/", { headers: { cookie: await cookie() } }));
  assert.match(await signedIn.text(), /<form method="post" action="\/signout"><button type="submit">Sign out<\/button><\/form>/);
  const get = await handle(new Request("https://portal.example/signout", { headers: { cookie: await cookie(), origin: "https://portal.example" } }));
  assert.equal(get.status, 404, "a GET never signs out");
  const put = await handle(new Request("https://portal.example/signout", { method: "PUT", headers: { cookie: await cookie(), origin: "https://portal.example" } }));
  assert.equal(put.status, 404);
});
