// The Cloudflare adapter (SPEC-0003 rule 8): the Workers fetch handler fills Config from a fake env, passes the request and
// the Config to the core and returns the core's response unchanged, and hands the core nothing else. Markers REQ-103 AC7
// and REQ-103 AC8 are in the test names. A fake env and a fake request, in Node, no network.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import worker, { createWorker } from "../src/adapters/cloudflare/index.ts";
import { CONFIG_NAMES, SESSION_COOKIE, sealSession, type Config } from "../src/core/index.ts";
import { scanFile } from "./support/import-scan.ts";

const siteRoot = resolve(import.meta.dirname, "..");
const adapterDir = resolve(siteRoot, "src", "adapters", "cloudflare");

const SECRETS = {
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
  SESSION_KEY: "fixture-session-key-A-0123456789abcdefXYZ",
  CALLBACK_URL: "https://portal.example/callback",
};
// What a real Workers env also holds: bindings that are objects, and variables the core never asks for.
const binding = { get: async () => "kv value", put: async () => undefined };
const fakeEnv = (): Record<string, unknown> => ({ ...SECRETS, ASSETS: binding, KV: binding, OTHER_VARIABLE: "unrelated", COUNT: 3 });
const fakeContext = { waitUntil: () => undefined, passThroughOnException: () => undefined };

type Handle = (request: Request, config: Config, ...rest: unknown[]) => Promise<Response>;

function recording(response = new Response("from the core", { status: 202, headers: { "x-core": "1" } })) {
  const calls: unknown[][] = [];
  const handle: Handle = async (...args) => {
    calls.push(args);
    return response;
  };
  return { calls, handle, response };
}

test("REQ-103 AC7: the handler fills Config from the env's secrets and variables, passes the request to the core and returns the core's response unchanged", async () => {
  const { calls, handle, response } = recording();
  const request = new Request("https://portal.example/");
  const result = await createWorker(handle).fetch(request, fakeEnv(), fakeContext);
  assert.equal(result, response, "the very same response, not a copy");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]![0], request, "the very same request");
  const config = calls[0]![1] as Config;
  for (const name of CONFIG_NAMES) assert.equal(config.get(name), SECRETS[name], name);
});

test("REQ-103 AC7: a missing, empty or non-text setting is not set; a value that is not text is never passed on", async () => {
  const { calls, handle } = recording();
  const env: Record<string, unknown> = { ...SECRETS, SESSION_KEY: undefined, GITHUB_APP_CLIENT_ID: "", CALLBACK_URL: binding, GITHUB_APP_CLIENT_SECRET: 7 };
  await createWorker(handle).fetch(new Request("https://portal.example/"), env, fakeContext);
  const config = calls[0]![1] as Config;
  for (const name of CONFIG_NAMES) assert.equal(config.get(name), undefined, name);
});

test("REQ-103 AC8: the core gets the request and the Config and nothing else: no env, no binding, no context", async () => {
  const { calls, handle } = recording();
  const env = fakeEnv();
  await createWorker(handle).fetch(new Request("https://portal.example/"), env, fakeContext);
  assert.equal(calls[0]!.length, 2, "exactly two arguments");
  const config = calls[0]![1] as Config;
  assert.deepEqual(Object.keys(config), ["get"], "the Config has the one method");
  assert.deepEqual(Object.getOwnPropertySymbols(config), []);
  for (const argument of calls[0]!) {
    assert.notEqual(argument, env);
    assert.notEqual(argument, binding);
    assert.notEqual(argument, fakeContext);
  }
  // Names that are not on the documented list reach nothing, even when the env holds them.
  assert.equal((config.get as (name: string) => unknown)("OTHER_VARIABLE"), undefined);
  assert.equal((config.get as (name: string) => unknown)("KV"), undefined);
  assert.equal((config.get as (name: string) => unknown)("ASSETS"), undefined);
  assert.equal((config.get as (name: string) => unknown)("__proto__"), undefined);
  assert.equal((config.get as (name: string) => unknown)("constructor"), undefined);
  // The env cannot be reached through the Config: a change to it afterwards changes nothing.
  env["SESSION_KEY"] = "changed after the call";
  assert.equal(config.get("SESSION_KEY"), SECRETS.SESSION_KEY);
});

test("REQ-103 AC8: the handler keeps nothing between requests: each request reads its own env", async () => {
  const { calls, handle } = recording();
  const w = createWorker(handle);
  await w.fetch(new Request("https://portal.example/"), fakeEnv(), fakeContext);
  await w.fetch(new Request("https://portal.example/"), { ...fakeEnv(), SESSION_KEY: "second-session-key-0123456789abcdefghij" }, fakeContext);
  assert.equal((calls[0]![1] as Config).get("SESSION_KEY"), SECRETS.SESSION_KEY);
  assert.equal((calls[1]![1] as Config).get("SESSION_KEY"), "second-session-key-0123456789abcdefghij");
});

test("REQ-103 AC7: with the real core, the handler serves the sign-in offer and the start of sign-in from a fake env", async () => {
  const offer = await worker.fetch(new Request("https://portal.example/"), fakeEnv(), fakeContext);
  assert.equal(offer.status, 200);
  assert.match(await offer.text(), /\/login/);
  assert.ok(offer.headers.get("content-security-policy"), "the core's secure headers are returned as they are");
  const start = await worker.fetch(new Request("https://portal.example/login"), fakeEnv(), fakeContext);
  assert.equal(start.status, 302);
  const location = new URL(start.headers.get("location") ?? "");
  assert.equal(location.searchParams.get("client_id"), SECRETS.GITHUB_APP_CLIENT_ID);
  assert.ok(!(start.headers.get("location") ?? "").includes(SECRETS.GITHUB_APP_CLIENT_SECRET), "the client secret is never in the address");
});

test("REQ-103 AC7: the real core reads the system clock and fetch when the adapter gives it neither: a session made now is valid, and the data step calls the GitHub API", async () => {
  const seen: { url: string; authorization: string | null }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    seen.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  try {
    const cookie = await sealSession({ token: "ghu_fixture_user_token_0123456789", expiresAt: Date.now() + 3_600_000 }, SECRETS.SESSION_KEY);
    const home = await worker.fetch(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }), fakeEnv(), fakeContext);
    const html = await home.text();
    assert.ok(html.includes('action="/signout"'), "the session is read as valid");
    assert.ok(html.includes("Projects could not be read: not known yet."));
    assert.equal(seen[0]?.url, "https://api.github.com/user/installations?per_page=100&page=1");
    assert.equal(seen[0]?.authorization, "Bearer ghu_fixture_user_token_0123456789");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("REQ-103 AC7: a setting that is missing gives the core's refusal, which names the setting and not a value, and nothing is called", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls += 1;
    throw new Error("fetch must not be called");
  }) as typeof fetch;
  try {
    for (const missing of CONFIG_NAMES) {
      const env = fakeEnv();
      delete env[missing];
      for (const path of ["/", "/login", "/callback?code=x&state=y", "/style.css"]) {
        const response = await worker.fetch(new Request(`https://portal.example${path}`), env, fakeContext);
        const text = await response.text();
        assert.equal(response.status, 500, `${missing} ${path}`);
        assert.ok(text.includes(missing), `${path}: the refusal names ${missing}`);
        for (const value of Object.values(SECRETS)) assert.ok(!text.includes(value), "no value in the refusal");
        assert.ok(!JSON.stringify([...response.headers]).includes(SECRETS.SESSION_KEY), "no value in a header");
        assert.ok(response.headers.get("content-security-policy"), "the refusal carries the secure headers");
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("set-cookie"), null);
      }
    }
    const empty = await worker.fetch(new Request("https://portal.example/"), { ...fakeEnv(), SESSION_KEY: "" }, fakeContext);
    assert.equal(empty.status, 500, "an empty setting is missing");
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls, 0);
});

test("REQ-103 AC8: the adapter is the only code that touches the host, and it imports only the core", () => {
  const files = readdirSync(adapterDir);
  assert.deepEqual(files, ["index.ts"], "one thin adapter file");
  const text = readFileSync(resolve(adapterDir, "index.ts"), "utf8");
  assert.ok(!/\bprocess\b|\bBuffer\b|\bconsole\b|\bglobalThis\b/.test(text), "no Node global, no console, no global lookup");
  assert.ok(!/\bfetch\s*\(/.test(text.replace(/\.fetch\(/g, "").replace(/fetch\(request/g, "")), "the adapter makes no request itself");
  const imports = [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["../../core/index.ts"], "the only import is the core's entry");
  assert.deepEqual(scanFile(resolve(adapterDir, "index.ts"), resolve(siteRoot, "src", "core")), [], "the import scan, run over the adapter with the core as its boundary, finds nothing outside it");
});
