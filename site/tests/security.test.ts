// Secure responses, the one guard for GitHub calls and the declared permissions (SPEC-0004).
// Markers REQ-104 AC1 to AC6 and AC8 are in the test names. REQ-104 AC7 is built with the data step. No network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  CONTENT_SECURITY_POLICY,
  createGithubClient,
  errorPage,
  guardedFetch,
  htmlPage,
  redirectHome,
  safely,
  stylesheet,
  TOKEN_ADDRESS,
} from "../src/core/index.ts";
import { filesConstructing, filesUsingIdentifier } from "./support/syntax-scan.ts";

const siteRoot = resolve(import.meta.dirname, "..");
const coreDir = resolve(siteRoot, "src", "core");
const manifestPath = resolve(siteRoot, "..", "github-app-manifest.json");

const TOKEN = "ghu_fixture_user_token_0123456789";
const CODE = "fixture-oauth-code-abcdef";
const STATE = "fixture-state-value-123456";
const COOKIE = "fixture-cookie-value-xyz";
const SECRET = "fixture-client-secret-value";
const SECRETS = [TOKEN, CODE, STATE, COOKIE, SECRET];

const EXPECTED_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

async function everyResponse(): Promise<Response[]> {
  return [
    htmlPage("Sign in", "<p>Sign in with GitHub</p>"),
    stylesheet(),
    redirectHome(),
    errorPage(),
    await safely(() => {
      throw new Error(`detail ${TOKEN}`);
    })(new Request("https://portal.example/")),
  ];
}

test("REQ-104 AC1: every response carries the exact policy with no unsafe keyword and the other three headers", async () => {
  assert.equal(CONTENT_SECURITY_POLICY, EXPECTED_POLICY);
  for (const response of await everyResponse()) {
    const policy = response.headers.get("content-security-policy");
    assert.equal(policy, EXPECTED_POLICY);
    assert.ok(!/unsafe-/.test(policy ?? ""), "no unsafe keyword");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  }
});

test("REQ-104 AC1: a response is only built in the one place that sets the headers", () => {
  assert.deepEqual(filesConstructing(coreDir, "Response"), ["responses.ts"]);
});

test("REQ-104 AC2: pages and redirects are never cached, and pages hold no script and no inline style", async () => {
  const page = htmlPage("Sign in", "<p>Sign in with GitHub</p>");
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(redirectHome().headers.get("cache-control"), "no-store");
  assert.equal(errorPage().headers.get("cache-control"), "no-store");
  const html = await page.text();
  assert.ok(html.includes('<link rel="stylesheet" href="/style.css">'), "one same-origin stylesheet");
  assert.ok(html.includes('name="viewport"'), "mobile first");
  assert.ok(!/<script|<style|\sstyle\s*=|\son[a-z]+\s*=|javascript:/i.test(html));
  for (const bad of ["<script>x()</script>", '<p style="color:red">x</p>', "<style>p{}</style>", '<a onclick="x()">x</a>', '<a href="javascript:x()">x</a>']) {
    assert.throws(() => htmlPage("x", bad), /not allowed/, `${bad} must be refused`);
  }
  assert.match(await stylesheet().text(), /max-width/, "the stylesheet is a real file");
});

test("REQ-104 AC3: the callback answers 303 to the home page and leaves no code or state in any URL", () => {
  const callback = new Request(`https://portal.example/callback?code=${CODE}&state=${STATE}`);
  assert.ok(callback.url.includes(CODE));
  const response = redirectHome();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  for (const [, value] of response.headers) {
    assert.ok(!value.includes(CODE) && !value.includes(STATE), `a header holds the code or the state: ${value}`);
  }
});

test("REQ-104 AC4: nothing is logged and no error detail reaches the response", async () => {
  assert.deepEqual(filesUsingIdentifier(coreDir, "console"), [], "the core never touches console");
  const lines: string[] = [];
  const saved = { ...console };
  for (const level of ["log", "info", "warn", "error", "debug", "trace"] as const) {
    console[level] = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  }
  let response: Response;
  try {
    response = await safely(() => {
      throw new Error(`secret detail ${TOKEN} ${CODE} ${COOKIE}`);
    })(new Request(`https://portal.example/?code=${CODE}`));
    const client = createGithubClient({ fetch: async () => new Response("{}") });
    await client.get("/user/installations", TOKEN);
    await client.exchangeCode({ clientId: "id", clientSecret: SECRET, code: CODE, redirectUri: "https://portal.example/callback" });
    await assert.rejects(() => client.get(`/x?access_token=${TOKEN}`, TOKEN));
  } finally {
    Object.assign(console, saved);
  }
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.ok(body.includes("Something went wrong. Please try again."));
  for (const secret of SECRETS) {
    assert.ok(!body.includes(secret), "no secret in the body");
    for (const line of lines) assert.ok(!line.includes(secret), "no secret in any console output");
  }
  assert.deepEqual(lines, [], "nothing is logged at all");
});

test("REQ-104 AC5: no token, code or cookie value is in any URL and GitHub calls carry the token only in Authorization", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const client = createGithubClient({
    fetch: async (url, init) => {
      seen.push({ url: String(url), init });
      return new Response("{}");
    },
  });
  await client.get("/user/installations?per_page=30", TOKEN);
  await client.getSigned("https://objects.example.net/artifact.zip?sig=abc");
  await client.exchangeCode({ clientId: "id", clientSecret: SECRET, code: CODE, redirectUri: "https://portal.example/callback" });
  assert.equal(seen.length, 3);
  for (const { url } of seen) for (const secret of SECRETS) assert.ok(!url.includes(secret), `a URL holds a secret: ${url}`);
  const authorized = seen[0]!.init?.headers as Record<string, string>;
  assert.equal(authorized["Authorization"], `Bearer ${TOKEN}`);
  assert.equal(new Headers(seen[1]!.init?.headers).get("authorization"), null, "the signed address gets no token");
  const exchange = seen[2]!;
  assert.equal(exchange.url, TOKEN_ADDRESS);
  assert.equal(new Headers(exchange.init?.headers).get("authorization"), null);
  assert.ok(String(exchange.init?.body).includes(`client_secret=${SECRET}`), "the secret travels in the body");
  await assert.rejects(() => client.get(`/user?access_token=${TOKEN}`, TOKEN), /not allowed/);
  await assert.rejects(() => client.get(`/user/${TOKEN}`, TOKEN), /not allowed/);
  await assert.rejects(() => client.get("https://evil.example/user", TOKEN), /not allowed/);
  assert.equal(seen.length, 3, "a refused call sends nothing");
});

test("REQ-104 AC6: the declared permissions are exactly Actions read and Metadata read, tokens expire, and no secret is declared", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  assert.deepEqual(manifest["permissions"], { actions: "read", metadata: "read" });
  assert.equal(manifest["expire_user_authorization_tokens"], true);
  const text = readFileSync(manifestPath, "utf8");
  assert.ok(!/secret|private_key|password|webhook_secret|client_secret|ghu_|ghp_|BEGIN [A-Z ]*KEY/i.test(text), "no secret in the file");
});

test("REQ-104 AC8: GET and the one sign-in POST are sent; every other method and address is refused before any request", async () => {
  let sent = 0;
  const guarded = guardedFetch(async () => {
    sent += 1;
    return new Response("{}");
  });
  await guarded("https://api.github.com/user/installations", { method: "GET", redirect: "manual", headers: { Authorization: `Bearer ${TOKEN}` } });
  await guarded("https://objects.example.net/a.zip");
  await guarded(TOKEN_ADDRESS, { method: "POST", body: "client_id=x" });
  assert.equal(sent, 3);
  const refused: [string, RequestInit][] = [
    ["https://api.github.com/user", { method: "PUT" }],
    ["https://api.github.com/user", { method: "DELETE" }],
    ["https://api.github.com/user", { method: "PATCH" }],
    ["https://api.github.com/user", { method: "HEAD" }],
    ["https://api.github.com/user", { method: "POST" }],
    ["https://github.com/login/device/code", { method: "POST" }],
    [`${TOKEN_ADDRESS}/extra`, { method: "POST" }],
    [`${TOKEN_ADDRESS}?x=1`, { method: "POST" }],
    ["http://api.github.com/user", { method: "GET" }],
    ["https://user:pw@api.github.com/user", { method: "GET" }],
    ["https://objects.example.net/a.zip", { method: "GET", headers: { Authorization: `Bearer ${TOKEN}` } }],
    [TOKEN_ADDRESS, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } }],
  ];
  for (const [url, init] of refused) {
    await assert.rejects(() => guarded(url, init), /not allowed/, `${init.method} ${url} must be refused`);
  }
  assert.equal(sent, 3, "nothing was sent for a refused call");
  assert.deepEqual(filesUsingIdentifier(coreDir, "fetch"), ["github.ts"], "fetch is used in the one guard file only");
});

test("REQ-104 AC8: a credentialed request must not follow redirects, because a runtime may carry the token to the redirect target", async () => {
  let sent = 0;
  const guarded = guardedFetch(async () => {
    sent += 1;
    return new Response("{}");
  });
  const headers = { Authorization: `Bearer ${TOKEN}` };
  for (const redirect of [undefined, "follow", "error"] as const) {
    await assert.rejects(
      () => guarded("https://api.github.com/user", { method: "GET", headers, ...(redirect ? { redirect } : {}) }),
      /not allowed/,
      `a credentialed request with redirect ${String(redirect)} must be refused`,
    );
  }
  assert.equal(sent, 0, "nothing was sent");
  await guarded("https://api.github.com/user", { method: "GET", headers, redirect: "manual" });
  assert.equal(sent, 1, "manual is allowed");
  await guarded("https://objects.example.net/a.zip", { method: "GET" });
  assert.equal(sent, 2, "a request without a credential may follow redirects");
});

test("REQ-104 AC5: the client never follows a redirect with the token; the download reads the Location and fetches it without a credential", async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const signed = "https://objects.example.net/signed/abc?sig=fixture-signature";
  const client = createGithubClient({
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.startsWith("https://api.github.com/")) return new Response(null, { status: 302, headers: { Location: signed } });
      return new Response("zip", { status: 200 });
    },
  });
  const first = await client.get("/repos/o/r/actions/artifacts/1/zip", TOKEN);
  assert.equal(calls[0]!.init?.redirect, "manual", "the credentialed call asks not to follow");
  assert.equal(first.status, 302, "the redirect is returned, not followed");
  const location = first.headers.get("location");
  assert.equal(location, signed);
  const second = await client.getSigned(location as string);
  assert.equal(second.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(new Headers(calls[1]!.init?.headers).get("authorization"), null, "the signed address gets no credential");
  assert.ok(!calls[1]!.url.includes(TOKEN));
});
