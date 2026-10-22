// The Cloudflare adapter (SPEC-0003 rule 8): the Workers fetch handler fills Config from a fake env, builds the core with
// it, answers the request and returns the core's response unchanged, and hands the core no env, no binding and no context.
// Markers REQ-103 AC7 and REQ-103 AC8 are in the test names. A fake env and a fake request, in Node, no network.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import worker, { createWorker } from "../src/adapters/cloudflare/index.ts";
import {
  CONFIG_NAMES,
  SESSION_COOKIE,
  createApp,
  createCore,
  createGithubClient,
  sealSession,
  type Config,
  type ConfigName,
} from "../src/core/index.ts";
import { scanFile } from "./support/import-scan.ts";

const siteRoot = resolve(import.meta.dirname, "..");
const adapterDir = resolve(siteRoot, "src", "adapters", "cloudflare");

const SECRETS: Record<ConfigName, string> = {
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
  SESSION_KEY: "fixture-session-key-A-0123456789abcdefXYZ",
  CALLBACK_URL: "https://portal.example/callback",
};
const TOKEN = "ghu_fixture_user_token_0123456789";
const START = 1_800_000_000_000;
// What a real Workers env also holds: bindings that are objects, and variables the core never asks for.
const binding = { get: async () => "kv value", put: async () => undefined };
const fakeEnv = (): Record<string, unknown> => ({ ...SECRETS, ASSETS: binding, KV: binding, OTHER_VARIABLE: "unrelated", COUNT: 3 });
const fakeContext = { waitUntil: () => undefined, passThroughOnException: () => undefined };

interface Seen {
  url: string;
  authorization: string | null;
}
function fakeRuntime(now = START) {
  const seen: Seen[] = [];
  return {
    seen,
    runtime: {
      now: () => now,
      send: async (url: string, init?: RequestInit): Promise<Response> => {
        seen.push({ url, authorization: new Headers(init?.headers).get("authorization") });
        return new Response("{}", { status: 404 });
      },
    },
  };
}

// The core, built the way the adapter must build it, from the same settings: the reference for "unchanged".
function reference(now = START): (request: Request) => Promise<Response> {
  const config: Config = { get: (name) => SECRETS[name] };
  const github = createGithubClient({ fetch: async () => new Response("{}", { status: 404 }) });
  return createApp(createCore({ config, now: () => now }), { github });
}

async function same(a: Response, b: Response, label: string): Promise<void> {
  assert.equal(a.status, b.status, `${label}: status`);
  assert.deepEqual([...a.headers].sort(), [...b.headers].sort(), `${label}: headers`);
  assert.equal(await a.text(), await b.text(), `${label}: body`);
}

test("REQ-103 AC7: the handler fills Config from the env's secrets and variables, passes the request to the core and returns the core's response unchanged", async () => {
  const { runtime } = fakeRuntime();
  const w = createWorker(runtime);
  const core = reference();
  for (const path of ["/", "/style.css", "/nothing-here", "/callback"]) {
    const url = `https://portal.example${path}`;
    await same(await w.fetch(new Request(url), fakeEnv(), fakeContext), await core(new Request(url)), path);
  }
  const post = (): Request => new Request("https://portal.example/signout", { method: "POST" });
  await same(await w.fetch(post(), fakeEnv(), fakeContext), await core(post()), "POST /signout");
});

test("REQ-103 AC7: each of the four settings reaches the core from the env: the client id is in the address of the sign-in, the session key opens the session, the callback address is the redirect", async () => {
  const { runtime, seen } = fakeRuntime();
  const w = createWorker(runtime);
  const start = await w.fetch(new Request("https://portal.example/login"), fakeEnv(), fakeContext);
  assert.equal(start.status, 303);
  const location = new URL(start.headers.get("location") ?? "");
  assert.equal(location.searchParams.get("client_id"), SECRETS.GITHUB_APP_CLIENT_ID);
  assert.equal(location.searchParams.get("redirect_uri"), SECRETS.CALLBACK_URL);
  assert.ok(!(start.headers.get("location") ?? "").includes(SECRETS.GITHUB_APP_CLIENT_SECRET), "the client secret is never in the address");
  const cookie = await sealSession({ token: TOKEN, expiresAt: START + 3_600_000 }, SECRETS.SESSION_KEY);
  const home = await w.fetch(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }), fakeEnv(), fakeContext);
  assert.ok((await home.text()).includes('action="/signout"'), "the session key from the env opens the session");
  assert.equal(seen[0]?.url, "https://api.github.com/user/installations?per_page=100&page=1");
  assert.equal(seen[0]?.authorization, `Bearer ${TOKEN}`);
  const other = await w.fetch(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }), { ...fakeEnv(), SESSION_KEY: "another-session-key-0123456789abcdefghij" }, fakeContext);
  assert.ok((await other.text()).includes("Your session has ended"), "another key does not open it: each request reads its own env");
});

test("REQ-103 AC7: the host's clock ends a session, and the default worker reads the system clock and fetch", async () => {
  const past = await sealSession({ token: TOKEN, expiresAt: START + 1_000 }, SECRETS.SESSION_KEY);
  const late = createWorker(fakeRuntime(START + 2_000).runtime);
  const ended = await late.fetch(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${past}` } }), fakeEnv(), fakeContext);
  assert.ok((await ended.text()).includes("Your session has ended"));
  const seen: Seen[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    seen.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  try {
    const now = await sealSession({ token: TOKEN, expiresAt: Date.now() + 3_600_000 }, SECRETS.SESSION_KEY);
    const home = await worker.fetch(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${now}` } }), fakeEnv(), fakeContext);
    assert.ok((await home.text()).includes('action="/signout"'), "a session made now is valid by the system clock");
    assert.equal(seen[0]?.url, "https://api.github.com/user/installations?per_page=100&page=1");
    const expired = await sealSession({ token: TOKEN, expiresAt: Date.now() - 1_000 }, SECRETS.SESSION_KEY);
    const gone = await worker.fetch(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${expired}` } }), fakeEnv(), fakeContext);
    assert.ok((await gone.text()).includes("Your session has ended"));
    assert.equal(seen.length, 1, "no call is made for an ended session");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("REQ-103 AC8: the adapter reads only the four documented names of the env, never a binding, and touches the context not at all", async () => {
  const touched: string[] = [];
  const watch = <T extends object>(label: string, target: T): T =>
    new Proxy(target, {
      get(object, key, receiver) {
        touched.push(`${label}.${String(key)}`);
        return Reflect.get(object, key, receiver);
      },
      has(object, key) {
        touched.push(`${label}.${String(key)}`);
        return Reflect.has(object, key);
      },
      ownKeys(object) {
        touched.push(`${label}.<keys>`);
        return Reflect.ownKeys(object);
      },
    });
  const w = createWorker(fakeRuntime().runtime);
  for (const path of ["/", "/login", "/style.css"]) {
    touched.length = 0;
    await w.fetch(new Request(`https://portal.example${path}`), watch("env", fakeEnv()), watch("context", fakeContext));
    const names = new Set(touched);
    assert.deepEqual([...names].filter((n) => n.startsWith("context.")), [], `${path}: the context is not touched`);
    assert.deepEqual([...names].sort(), CONFIG_NAMES.map((n) => `env.${n}`).sort(), `${path}: only the four names of the env are read`);
  }
});

test("REQ-103 AC8: a missing, empty or non-text setting is not set, and the env cannot be reached once the core is built", async () => {
  const env: Record<string, unknown> = { ...SECRETS, SESSION_KEY: undefined, GITHUB_APP_CLIENT_ID: "", CALLBACK_URL: binding, GITHUB_APP_CLIENT_SECRET: 7 };
  const w = createWorker(fakeRuntime().runtime);
  for (const name of CONFIG_NAMES) {
    const alone: Record<string, unknown> = { ...SECRETS, [name]: env[name] };
    const response = await w.fetch(new Request("https://portal.example/"), alone, fakeContext);
    assert.equal(response.status, 500, name);
    assert.ok((await response.text()).includes(name), `${name} is named`);
  }
});

test("REQ-103 AC7: a setting that is missing gives the core's refusal, which names the setting and not a value, and nothing is called", async () => {
  const { runtime, seen } = fakeRuntime();
  const w = createWorker(runtime);
  for (const missing of CONFIG_NAMES) {
    const env = fakeEnv();
    delete env[missing];
    for (const path of ["/", "/login", "/callback?code=x&state=y", "/style.css"]) {
      const response = await w.fetch(new Request(`https://portal.example${path}`), env, fakeContext);
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
  const empty = await w.fetch(new Request("https://portal.example/"), { ...fakeEnv(), SESSION_KEY: "" }, fakeContext);
  assert.equal(empty.status, 500, "an empty setting is missing");
  assert.ok((await empty.text()).includes("SESSION_KEY"), "and is named");
  assert.equal(seen.length, 0, "nothing was called");
});

test("REQ-103 AC8: any other failure is the core's fixed error page, with no detail", async () => {
  const w = createWorker({ now: () => START, send: async () => new Response("{}") });
  const env = fakeEnv();
  Object.defineProperty(env, "SESSION_KEY", { get: () => { throw new Error(`boom ${SECRETS.SESSION_KEY}`); } });
  const response = await w.fetch(new Request("https://portal.example/"), env, fakeContext);
  const text = await response.text();
  assert.ok(text.includes("Something went wrong. Please try again."));
  assert.ok(!text.includes("boom") && !text.includes(SECRETS.SESSION_KEY));
});

test("REQ-103 AC8: the adapter is the only code that touches the host, it imports only the core, and it never passes the env on", () => {
  assert.deepEqual(readdirSync(adapterDir), ["index.ts"], "one thin adapter file");
  const text = readFileSync(resolve(adapterDir, "index.ts"), "utf8");
  const code = text.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  assert.ok(!/\bprocess\b|\bBuffer\b|\bconsole\b|\brequire\b/.test(code), "no Node global and no console");
  const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["../../core/index.ts"], "the only import is the core's entry");
  assert.deepEqual(scanFile(resolve(adapterDir, "index.ts"), resolve(siteRoot, "src", "core")), [], "the import scan, run over the adapter with the core as its boundary, finds nothing outside it");
  assert.equal((code.match(/\benv\b/g) ?? []).length, 4, "env is named in the signature of configFrom, in its loop and in the handler's signature and call only");
  assert.ok(/configFrom\(env\)/.test(code) && !/\(\s*env\s*[,)]/.test(code.replace(/configFrom\(env\)/g, "").replace(/function configFrom\(env: [^)]*\)/, "").replace(/async fetch\(request: Request, env: [^)]*\)/, "")), "env goes to configFrom and nowhere else");
});
