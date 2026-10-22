// GitHub refuses a request that carries no User-Agent, and Cloudflare Workers' fetch adds none (Node's does, so a test that
// uses Node's fetch cannot see it). Every request the GitHub client sends carries "User-Agent: agk-portal". The doubles
// here record exactly the headers the core gives them and add nothing themselves. Marker REQ-104 AC5: GitHub calls carry
// the token in the Authorization header and nowhere else; the new header is not a credential. No network.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  USER_AGENT,
  createApp,
  createCore,
  createGithubClient,
  guardedFetch,
  hashState,
  sealSession,
  type Config,
  type ConfigName,
} from "../src/core/index.ts";

const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const TOKEN = "ghu_fixture_user_token_0123456789";
const values: Record<ConfigName, string> = {
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
  SESSION_KEY: KEY,
  CALLBACK_URL: "https://portal.example/callback",
};
const config: Config = { get: (name) => values[name] };

type Recorded = { url: string; method: string; headers: Headers };

function recorder(answer: (url: string) => Response = () => new Response("{}", { status: 404 })) {
  const calls: Recorded[] = [];
  return {
    calls,
    send: async (url: string, init?: RequestInit): Promise<Response> => {
      // The double adds no header of its own: what is recorded is what the core supplied.
      calls.push({ url, method: (init?.method ?? "GET").toUpperCase(), headers: new Headers(init?.headers) });
      return answer(url);
    },
  };
}

test("REQ-104 AC5: the agent name is the fixed text agk-portal", () => {
  assert.equal(USER_AGENT, "agk-portal");
});

test("REQ-104 AC5: the API calls and the code exchange carry User-Agent: agk-portal", async () => {
  const { calls, send } = recorder();
  const client = createGithubClient({ fetch: send });
  await client.get("/user/installations?per_page=100&page=1", TOKEN);
  await client.exchangeCode({ clientId: "id", clientSecret: "secret", code: "code", redirectUri: "https://portal.example/callback" });
  assert.equal(calls.length, 2);
  for (const call of calls) assert.equal(call.headers.get("user-agent"), "agk-portal", `${call.method} ${call.url}`);
  assert.equal(calls[0]!.headers.get("authorization"), `Bearer ${TOKEN}`, "the token is still only in Authorization");
  assert.equal(calls[1]!.headers.get("authorization"), null, "the exchange carries no token");
  assert.ok(!calls[1]!.headers.get("user-agent")!.includes("secret"), "the agent name is not a credential");
});

test("REQ-104 AC5: the signed download carries the agent name when it is to GitHub, and no header at all when it is to the storage host", async () => {
  const { calls, send } = recorder();
  const client = createGithubClient({ fetch: send });
  await client.getSigned("https://productionresultssa6.blob.core.windows.net/signed/archive?sig=SIGNED");
  await client.getSigned("https://pipelines.actions.githubusercontent.com/signed/archive?sig=SIGNED");
  await client.getSigned("https://api.github.com/signed/archive?sig=SIGNED");
  assert.deepEqual([...calls[0]!.headers.keys()], [], "the storage host gets no header and no credential");
  assert.equal(calls[1]!.headers.get("user-agent"), "agk-portal");
  assert.equal(calls[2]!.headers.get("user-agent"), "agk-portal");
  assert.equal(calls[1]!.headers.get("authorization"), null);
  assert.equal(calls[2]!.headers.get("authorization"), null);
  await client.getSigned("https://notgithub.com/x");
  await client.getSigned("https://github.com.evil.example/x");
  assert.deepEqual([...calls[3]!.headers.keys()], [], "a look-alike host is not GitHub");
  assert.deepEqual([...calls[4]!.headers.keys()], []);
});

test("REQ-104 AC5: the guard supplies the agent name itself, whatever the caller gave, and never lets a caller's value through", async () => {
  const { calls, send } = recorder();
  const guarded = guardedFetch(send);
  await guarded("https://api.github.com/user", { method: "GET", redirect: "manual", headers: { Authorization: `Bearer ${TOKEN}` } });
  await guarded("https://api.github.com/user", { method: "GET", redirect: "manual", headers: { Authorization: `Bearer ${TOKEN}`, "User-Agent": "someone-else", "user-agent": "again" } });
  await guarded("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json" }, body: "a=b" });
  for (const call of calls) assert.equal(call.headers.get("user-agent"), "agk-portal", call.url);
  assert.equal(calls[1]!.headers.get("authorization"), `Bearer ${TOKEN}`);
});

test("REQ-104 AC5: a whole sign-in and a whole page read send the header on every call, and only those headers", async () => {
  const listing = JSON.stringify({ total_count: 1, installations: [{ id: 1, account: { login: "acme" }, permissions: { actions: "read", metadata: "read" } }] });
  const repos = JSON.stringify({ total_count: 1, repositories: [{ full_name: "acme/api" }] });
  const artifacts = JSON.stringify({ total_count: 1, artifacts: [{ id: 5, name: "agk-facts-2026-W42", expired: false, created_at: "2026-10-19T08:00:00Z" }] });
  const { calls, send } = recorder((url) => {
    if (url.endsWith("/user/installations?per_page=100&page=1")) return new Response(listing);
    if (url.includes("/installations/1/repositories")) return new Response(repos);
    if (url.includes("/actions/artifacts?")) return new Response(artifacts);
    if (url.endsWith("/zip")) return new Response(null, { status: 302, headers: { location: "https://blob.example.net/signed?sig=X" } });
    if (url === "https://github.com/login/oauth/access_token") return new Response(JSON.stringify({ access_token: TOKEN, expires_in: 28_800 }));
    return new Response("not found", { status: 404 });
  });
  const app = createApp(createCore({ config, now: () => START }), { github: createGithubClient({ fetch: send }) });
  const state = "fixture-state-value-abcdef0123456789";
  const back = await app(new Request(`https://portal.example/callback?code=c&state=${state}`, { headers: { cookie: `${STATE_COOKIE}=${await hashState(state)}` } }));
  assert.equal(back.status, 303);
  const session = await sealSession({ token: TOKEN, expiresAt: START + 3_600_000 }, KEY);
  const home = await app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${session}` } }));
  assert.equal(home.status, 200);
  assert.ok(calls.length >= 5, `the sign-in and the page read made ${calls.length} calls`);
  for (const call of calls) {
    const onGithub = call.url.startsWith("https://api.github.com/") || call.url.startsWith("https://github.com/");
    if (onGithub) assert.equal(call.headers.get("user-agent"), "agk-portal", `${call.method} ${call.url}`);
    else assert.deepEqual([...call.headers.keys()], [], `${call.url}: the storage host gets no header`);
  }
});
