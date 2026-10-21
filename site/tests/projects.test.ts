// The per-person list of projects and the run-time permission check (SPEC-0001 rules 1 and 3, SPEC-0004 rule 7).
// Markers REQ-101 AC6 and AC7 and REQ-104 AC7 are in the test names. Recorded GitHub answers, no network.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EMPTY_LIST_PHRASE,
  PERMISSIONS_REFUSED_PHRASE,
  PROJECTS_UNREADABLE_PHRASE,
  SESSION_COOKIE,
  createApp,
  createCore,
  createGithubClient,
  sealSession,
  type Config,
  type ConfigName,
} from "../src/core/index.ts";

const siteRoot = resolve(import.meta.dirname, "..");
const coreDir = resolve(siteRoot, "src", "core");
const fixtures = resolve(import.meta.dirname, "fixtures", "github");
const fixture = (name: string): string => readFileSync(resolve(fixtures, `${name}.json`), "utf8");

const TOKEN = "ghu_fixture_user_token_0123456789";
const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const values: Record<ConfigName, string> = {
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
  SESSION_KEY: KEY,
  CALLBACK_URL: "https://portal.example/callback",
};
const config: Config = { get: (name) => values[name] };

type Routes = Record<string, { status?: number; body: string }>;

function harness(routes: Routes) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const github = createGithubClient({
    fetch: async (url, init) => {
      calls.push({ url, init });
      const route = routes[url.replace("https://api.github.com", "")];
      return route ? new Response(route.body, { status: route.status ?? 200 }) : new Response("{}", { status: 404 });
    },
  });
  const app = createApp(createCore({ config, now: () => START }), { github });
  return { app, calls };
}

async function home(app: (r: Request) => Promise<Response>): Promise<string> {
  const cookie = await sealSession({ token: TOKEN, expiresAt: START + 3_600_000 }, KEY);
  const response = await app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  assert.equal(response.status, 200);
  return response.text();
}

const okRoutes: Routes = {
  "/user/installations?per_page=100&page=1": { body: fixture("installations-ok") },
  "/user/installations/1001/repositories?per_page=100&page=1": { body: fixture("repositories-1001-page1") },
  "/user/installations/1001/repositories?per_page=100&page=2": { body: fixture("repositories-1001-page2") },
  "/user/installations/1002/repositories?per_page=100&page=1": { body: fixture("repositories-1002-page1") },
  "/repos/acme/secret/actions/artifacts?per_page=100": { body: "{}" },
};

test("REQ-101 AC6: the page lists exactly the repositories GitHub returns for the person, once each, in order, linked, never counted", async () => {
  const { app, calls } = harness(okRoutes);
  const html = await home(app);
  const names = [...html.matchAll(/<h2><a href="https:\/\/github\.com\/([^"]+)">\1<\/a><\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(names, ["acme/api", "acme/web", "beta-co/app"], "deduplicated across installations and sorted");
  assert.ok(!html.includes("acme/secret"), "a repository the person cannot read is never named");
  assert.ok(!/\b\d+ (repositories|projects|installations)\b/i.test(html) && !html.includes("total_count"), "nothing is counted");
  assert.ok(!html.includes(EMPTY_LIST_PHRASE) && !html.includes(PROJECTS_UNREADABLE_PHRASE) && !html.includes(PERMISSIONS_REFUSED_PHRASE));
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      "https://api.github.com/user/installations?per_page=100&page=1",
      "https://api.github.com/user/installations/1001/repositories?per_page=100&page=1",
      "https://api.github.com/user/installations/1001/repositories?per_page=100&page=2",
      "https://api.github.com/user/installations/1002/repositories?per_page=100&page=1",
    ],
    "the listing follows the pages until the count is reached",
  );
});

test("REQ-101 AC6: a person with no installation or no repository sees the fixed empty phrase", async () => {
  const none = harness({ "/user/installations?per_page=100&page=1": { body: fixture("installations-empty") } });
  assert.ok((await home(none.app)).includes(EMPTY_LIST_PHRASE));
  const noRepos = harness({
    "/user/installations?per_page=100&page=1": { body: fixture("installations-write-permission").replace('"write"', '"read"') },
    "/user/installations/1001/repositories?per_page=100&page=1": { body: fixture("repositories-empty") },
  });
  assert.ok((await home(noRepos.app)).includes(EMPTY_LIST_PHRASE));
});

test("REQ-101 AC6: a list that cannot be read is said, with no partial list", async () => {
  for (const status of [401, 403, 404, 500]) {
    const first = harness({ "/user/installations?per_page=100&page=1": { status, body: "{}" } });
    const html = await home(first.app);
    assert.ok(html.includes(PROJECTS_UNREADABLE_PHRASE), `installations ${status}`);
    const second = harness({ ...okRoutes, "/user/installations/1002/repositories?per_page=100&page=1": { status, body: "{}" } });
    const partial = await home(second.app);
    assert.ok(partial.includes(PROJECTS_UNREADABLE_PHRASE), `repositories ${status}`);
    assert.ok(!partial.includes("acme/api"), "no partial list is shown");
  }
  for (const body of ["not json", "[]", '{"installations":"x"}', '{"installations":[{"id":"x"}]}']) {
    const h = harness({ "/user/installations?per_page=100&page=1": { body } });
    assert.ok((await home(h.app)).includes(PROJECTS_UNREADABLE_PHRASE), `malformed ${body}`);
  }
});

test("REQ-104 AC7: an installation that grants more than Actions read and Metadata read refuses the person, shows no project and adds no call", async () => {
  const lateKey = fixture("installations-ok").replace('"metadata":"read"}', '"metadata":"read","pull_requests":"read"}');
  const variants: [string, string][] = [
    ["extra permission (contents)", fixture("installations-extra-permission")],
    ["extra permission sorting after metadata", lateKey],
    ["write permission", fixture("installations-write-permission")],
    ["missing permission", fixture("installations-missing-permission")],
  ];
  for (const [name, body] of variants) {
    const { app, calls } = harness({
      "/user/installations?per_page=100&page=1": { body },
      "/user/installations/1001/repositories?per_page=100&page=1": { body: fixture("repositories-1001-page1") },
      "/user/installations/1002/repositories?per_page=100&page=1": { body: fixture("repositories-1002-page1") },
    });
    const html = await home(app);
    assert.ok(html.includes(PERMISSIONS_REFUSED_PHRASE), name);
    assert.equal(PERMISSIONS_REFUSED_PHRASE, "This GitHub App has more access than this portal allows. Ask your administrator to review it.");
    assert.ok(!/acme\/|beta-co\//.test(html), `${name}: no project`);
    assert.ok(html.includes('<form method="post" action="/signout">'), "the person can still sign out");
    assert.equal(calls.length, 1, `${name}: no call beyond the installation listing the page already makes`);
  }
});

test("REQ-101 AC7: every request is a GET to the GitHub API with the person's own token, no write, no other credential, no model", async () => {
  const { app, calls } = harness(okRoutes);
  await home(app);
  assert.ok(calls.length >= 4);
  for (const { url, init } of calls) {
    assert.ok(url.startsWith("https://api.github.com/"), url);
    assert.equal((init?.method ?? "GET").toUpperCase(), "GET");
    assert.equal(init?.body, undefined);
    assert.equal(init?.redirect, "manual");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), `Bearer ${TOKEN}`);
    assert.deepEqual([...headers.keys()].sort(), ["accept", "authorization", "x-github-api-version"], "no other credential or header");
    assert.ok(!url.includes(TOKEN));
  }
  for (const file of readdirSync(coreDir)) {
    assert.ok(!/anthropic|claude|openai|gemini|\bllm\b/i.test(readFileSync(resolve(coreDir, file), "utf8")), `${file} names no model or model credential`);
  }
});

test("REQ-101 AC6: a repository name that is not owner/name is not shown, and the list reads as not known", async () => {
  for (const name of ['"><script>x()</script>/y', "no-slash", "a b/c", "a/b/c", 42]) {
    const h = harness({
      "/user/installations?per_page=100&page=1": { body: fixture("installations-write-permission").replace('"write"', '"read"') },
      "/user/installations/1001/repositories?per_page=100&page=1": { body: JSON.stringify({ total_count: 1, repositories: [{ full_name: name }] }) },
    });
    const html = await home(h.app);
    assert.ok(html.includes(PROJECTS_UNREADABLE_PHRASE), `${JSON.stringify(name)} makes the list unknown`);
    assert.ok(!html.includes("<script>x()"), "never put into the page");
  }
});
