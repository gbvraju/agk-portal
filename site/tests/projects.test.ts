// The per-person list of projects and the run-time permission check (SPEC-0001 rules 1 and 3, SPEC-0004 rule 7).
// Markers REQ-101 AC6 and AC7 and REQ-104 AC7 are in the test names. Recorded GitHub answers, no network.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EMPTY_LIST_PHRASE,
  PROJECTS_UNREADABLE_PHRASE,
  permissionsRefusedLine,
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

async function get(app: (r: Request) => Promise<Response>, path: string): Promise<string> {
  const cookie = await sealSession({ token: TOKEN, expiresAt: START + 3_600_000 }, KEY);
  const response = await app(new Request(`https://portal.example${path}`, { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  assert.equal(response.status, 200, "the page does not fail");
  return response.text();
}

// The start page alone (the list and its lines).
const start = (app: (r: Request) => Promise<Response>): Promise<string> => get(app, "/");

// The start page and the page of every project it links: where the cards of the projects are shown (SPEC-0009 rule 5).
async function home(app: (r: Request) => Promise<Response>): Promise<string> {
  const first = await start(app);
  const pages = [];
  for (const m of first.matchAll(/href="(\/p\/[^"]+)"/g)) pages.push(await get(app, m[1] as string));
  return [first, ...pages].join("\n");
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
  const html = await start(app);
  const names = [...html.matchAll(/<a href="\/p\/([^"]+)">\1<\/a>/g)].map((m) => m[1]);
  assert.deepEqual(names, ["acme/api", "acme/web", "beta-co/app"], "deduplicated across installations and sorted");
  assert.ok(!html.includes("acme/secret"), "a repository the person cannot read is never named");
  assert.ok(!/\b\d+ (repositories|projects|installations)\b/i.test(html) && !html.includes("total_count"), "nothing is counted");
  assert.ok(!html.includes(EMPTY_LIST_PHRASE) && !html.includes(PROJECTS_UNREADABLE_PHRASE) && !html.includes("has more access than this portal allows"));
  assert.deepEqual(
    calls.map((c) => c.url).filter((url) => url.includes("/user/")),
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

test("REQ-104 AC7: an installation that grants more than Actions read and Metadata read is refused by itself, with one fixed line, and its repositories are not fetched", async () => {
  assert.equal(
    permissionsRefusedLine("acme"),
    "The GitHub App installed on acme has more access than this portal allows. Ask its administrator to review it.",
  );
  const lateKey = fixture("installations-write-permission").replace('"actions":"write","metadata":"read"}', '"actions":"read","metadata":"read","pull_requests":"read"}');
  const variants: [string, string][] = [
    ["extra permission sorting after metadata", lateKey],
    ["write permission", fixture("installations-write-permission")],
    ["missing permission", fixture("installations-missing-permission")],
  ];
  for (const [name, body] of variants) {
    const { app, calls } = harness({
      "/user/installations?per_page=100&page=1": { body },
      "/user/installations/1001/repositories?per_page=100&page=1": { body: fixture("repositories-1001-page1") },
    });
    const html = await home(app);
    assert.ok(html.includes(permissionsRefusedLine("acme")), name);
    assert.ok(!/acme\/(web|api)/.test(html), `${name}: no repository of the refused installation`);
    assert.ok(!html.includes(EMPTY_LIST_PHRASE), `${name}: the refusal is not an empty list`);
    assert.ok(html.includes('<form method="post" action="/signout">'), "the person can still sign out");
    assert.equal(calls.length, 1, `${name}: its repositories are not fetched`);
  }
});

test("REQ-104 AC7: one over-granted installation does not hide the others", async () => {
  const { app, calls } = harness({
    "/user/installations?per_page=100&page=1": { body: fixture("installations-extra-permission") },
    "/user/installations/1001/repositories?per_page=100&page=1": { body: fixture("repositories-1001-page1") },
    "/user/installations/1001/repositories?per_page=100&page=2": { body: fixture("repositories-1001-page2") },
    "/user/installations/1002/repositories?per_page=100&page=1": { body: fixture("repositories-1002-page1") },
  });
  const html = await home(app);
  const names = [...html.matchAll(/<h2><a href="https:\/\/github\.com\/([^"]+)">\1<\/a><\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(names, ["acme/api", "acme/web"], "the well-granted installation is listed as usual");
  assert.ok(html.includes(permissionsRefusedLine("beta-co")), "one fixed line for the over-granted one");
  assert.ok(!html.includes("beta-co/app"), "none of its repositories");
  assert.ok(!calls.some((c) => c.url.includes("/installations/1002/")), "its repositories are not fetched");
  assert.equal((html.match(/has more access than this portal allows/g) ?? []).length, 1, "exactly one line");
});

test("REQ-104 AC7: an over-granted installation whose account cannot be named reads as not known, never as a guess", async () => {
  for (const login of ['"><script>x()</script>', "a b", ""]) {
    const body = fixture("installations-extra-permission").replace('"login":"beta-co"', `"login":${JSON.stringify(login)}`);
    const { app } = harness({
      "/user/installations?per_page=100&page=1": { body },
      "/user/installations/1001/repositories?per_page=100&page=1": { body: fixture("repositories-1001-page1") },
      "/user/installations/1001/repositories?per_page=100&page=2": { body: fixture("repositories-1001-page2") },
    });
    const html = await home(app);
    assert.ok(html.includes(PROJECTS_UNREADABLE_PHRASE), JSON.stringify(login));
    assert.ok(!html.includes("<script>x()"));
  }
});

test("REQ-101 AC6: a listing ended by the page cap before the stated count is not known, never partial; the cap itself is enough when the count is reached", async () => {
  const page = (n: number): string => JSON.stringify({ total_count: 25, repositories: [{ full_name: `acme/r${n}` }] });
  const routes: Routes = { "/user/installations?per_page=100&page=1": { body: fixture("installations-write-permission").replace('"write"', '"read"') } };
  for (let n = 1; n <= 12; n += 1) routes[`/user/installations/1001/repositories?per_page=100&page=${n}`] = { body: page(n) };
  const capped = await home(harness(routes).app);
  assert.ok(capped.includes(PROJECTS_UNREADABLE_PHRASE), "25 repositories in 1-per-page answers cannot be read within 10 pages");
  assert.ok(!capped.includes("acme/r1"), "no partial list");
  const exact: Routes = { "/user/installations?per_page=100&page=1": routes["/user/installations?per_page=100&page=1"]! };
  for (let n = 1; n <= 10; n += 1) exact[`/user/installations/1001/repositories?per_page=100&page=${n}`] = { body: JSON.stringify({ total_count: 10, repositories: [{ full_name: `acme/r${n}` }] }) };
  const complete = await home(harness(exact).app);
  assert.ok(!complete.includes(PROJECTS_UNREADABLE_PHRASE) && complete.includes("acme/r10"), "ten pages that reach the count are a complete list");
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
    assert.deepEqual([...headers.keys()].sort(), ["accept", "authorization", "user-agent", "x-github-api-version"], "no other credential or header");
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
