// The start page (SPEC-0009): one line per project, grouped by attention, with the report's own counts and totals; a project's
// page at /p/{owner}/{repo} with a link back; a find form; the reads per project. The data is the kit's own goldens
// (schema 3 at v0.50.0, schema 2 at v0.43.0) and this repository's script (schema 1 form); recorded GitHub answers in
// memory, no network. Markers REQ-109 AC1 to AC8.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  SESSION_COOKIE,
  createApp,
  createCore,
  createGithubClient,
  isoWeekLabel,
  readFacts,
  sealSession,
  type Config,
  type ConfigName,
  type FactsResult,
  type ProjectList,
} from "../src/core/index.ts";
import { fixtureDir, writeReport } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const ARTIFACT_EXPIRES_CHECK = 1_800_000_000_000;
const WEEK42 = Date.UTC(2026, 9, 14, 12); // 2026-W42: the goldens' week 2026-W41 is its previous week
const WEEK43 = Date.UTC(2026, 9, 21, 12); // 2026-W43: 2026-W41 is two weeks back
const dir3 = resolve(import.meta.dirname, "fixtures", "report-schema-3");
const dir2 = resolve(import.meta.dirname, "fixtures", "report-schema-2");
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));
const read = (path: string): string => readFileSync(path, "utf8");

const values: Record<ConfigName, string> = { GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid", GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value", SESSION_KEY: KEY, CALLBACK_URL: "https://portal.example/callback" };
const config: Config = { get: (name) => values[name] };

// A facts result as readFacts gives it for an archive of facts.json and report.json (a recorded GitHub answer).
async function resultOf(facts: string, report: string | undefined, week: string): Promise<FactsResult> {
  const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
  const artifacts = { total_count: 1, artifacts: [{ id: 777, name: `agk-facts-${week}`, expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] };
  const bytes = zip([{ name: "facts.json", data: facts }, ...(report === undefined ? [] : [{ name: "report.json", data: report }])]);
  const routes: Record<string, () => Response> = {
    "https://api.github.com/repos/acme/api/actions/artifacts?per_page=100&page=1": () => new Response(JSON.stringify(artifacts)),
    "https://api.github.com/repos/acme/api/actions/artifacts/777/zip": () => new Response(null, { status: 302, headers: { location: SIGNED } }),
    [SIGNED]: () => new Response(bytes as BodyInit),
  };
  const github = createGithubClient({ fetch: async (url) => routes[url]?.() ?? new Response("{}", { status: 404 }) });
  return readFacts(github, TOKEN, "acme/api", ARTIFACT_EXPIRES_CHECK);
}
// A schema 3 golden with a change, as a result.
async function schema3(name: string, change?: (doc: Doc) => void): Promise<FactsResult> {
  const own = name === "facts-ok" || name === "facts-pr-states";
  const facts = read(resolve(own ? dir3 : fixtureDir, `${name}.facts.json`));
  const doc = JSON.parse(read(resolve(dir3, `${name}.report.json`)));
  change?.(doc);
  return resultOf(facts, JSON.stringify(doc), doc.week);
}
const totals = (doc: Doc): Doc => doc.sections.cost.find((i: Doc) => i.kind === "week-totals");

async function page(list: ProjectList, now: number, query = ""): Promise<string> {
  const app = createApp(createCore({ config, now: () => now }), { projects: async () => list });
  const cookie = await sealSession({ token: TOKEN, expiresAt: now + 3_600_000 }, KEY);
  const response = await app(new Request(`https://portal.example/${query}`, { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  assert.equal(response.status, 200);
  return response.text();
}
const ok = (projects: { name: string; result: FactsResult }[], notices: string[] = []): ProjectList => ({ kind: "ok", notices, projects });
const unescape = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const textOf = (inner: string): string => unescape(inner.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
// The groups of the page: heading and the lines under it, in order.
function groups(html: string): { heading: string; lines: string[] }[] {
  return [...html.matchAll(/<section class="group">\s*<h2>(.*?)<\/h2>\s*<ul class="projects">(.*?)<\/ul>\s*<\/section>/gs)].map((m) => ({
    heading: textOf(m[1] as string),
    lines: [...(m[2] as string).matchAll(/<li class="project">(.*?)<\/li>\s*(?=<li class="project">|$)/gs)].map((l) => l[1] as string),
  }));
}
const names = (g: { lines: string[] }): string[] => g.lines.map((l) => /<a href="\/p\/[^"]+">([^<]+)<\/a>/.exec(l)?.[1] as string);

test("REQ-109 AC1: the week of a label is the ISO week of the UTC day, across a year boundary and an ISO week 53", () => {
  const cases: [number, string][] = [
    [Date.UTC(2026, 9, 14), "2026-W42"],
    [Date.UTC(2026, 9, 11, 23, 59), "2026-W41"],
    [Date.UTC(2026, 9, 12), "2026-W42"],
    [Date.UTC(2026, 11, 31), "2026-W53"],
    [Date.UTC(2027, 0, 3, 23, 59), "2026-W53"],
    [Date.UTC(2027, 0, 4), "2027-W01"],
    [Date.UTC(2025, 11, 29), "2026-W01"],
    [Date.UTC(2024, 11, 30), "2025-W01"],
    [Date.UTC(2021, 0, 3), "2020-W53"],
    [Date.UTC(2027, 11, 31), "2027-W52"],
  ];
  for (const [ms, label] of cases) assert.equal(isoWeekLabel(ms), label, new Date(ms).toISOString());
  assert.equal(isoWeekLabel(Date.UTC(2027, 0, 4) - 7 * 86_400_000), "2026-W53", "the week before 2027-W01");
});

test("REQ-109 AC1: each project is one line with its name, week, counts and totals, linked to its page, and an unknown count reads not known yet", async () => {
  const busy = await schema3("busy");
  const html = await page(ok([{ name: "acme/api", result: busy }]), WEEK42);
  const [attention] = groups(html);
  assert.equal(attention?.heading, "Needs your attention");
  assert.equal(attention?.lines.length, 1);
  const line = attention?.lines[0] as string;
  assert.match(line, /^<a href="\/p\/acme\/api">acme\/api<\/a>/);
  assert.equal(textOf(line), "acme/api Week 2026-W41 delivered: 5 needs you: 9 at risk: 7 merged: 12 hours: 124.3");
  const unknown = await schema3("kinds", (d) => {
    d.counts.needs_you = "unknown";
    totals(d).hours = "unknown";
  });
  const text = textOf(groups(await page(ok([{ name: "acme/api", result: unknown }]), WEEK42))[0]?.lines[0] as string);
  assert.equal(text, "acme/api Week 2026-W41 delivered: 5 needs you: not known yet at risk: 6 merged: 4 hours: not known yet");
  const noTotals = await schema3("kinds", (d) => {
    d.sections.cost = [];
  });
  assert.match(textOf(groups(await page(ok([{ name: "acme/api", result: noTotals }]), WEEK42))[0]?.lines[0] as string), /merged: not known yet hours: not known yet$/);
});

test("REQ-109 AC2: the groups and their order follow the counts, projects keep the order of the list, and an empty group is not shown", async () => {
  const attentionNeeds = await schema3("kinds");
  const attentionRisk = await schema3("kinds", (d) => (d.counts.needs_you = 0));
  const attentionUnknown = await schema3("kinds", (d) => ((d.counts.needs_you = 0), (d.counts.at_risk = "unknown")));
  const onTrack = await schema3("kinds", (d) => ((d.counts.needs_you = 0), (d.counts.at_risk = 0)));
  const noReport = await resultOf(read(resolve(fixtureDir, "kinds.facts.json")), undefined, "2026-W41");
  const html = await page(
    ok([
      { name: "a/track", result: onTrack },
      { name: "b/needs", result: attentionNeeds },
      { name: "c/unknown-risk", result: attentionUnknown },
      { name: "d/none", result: noReport },
      { name: "e/risk", result: attentionRisk },
      { name: "f/track", result: onTrack },
    ]),
    WEEK42,
  );
  const g = groups(html);
  assert.deepEqual(g.map((x) => x.heading), ["Needs your attention", "On track", "Not known yet"]);
  assert.deepEqual(names(g[0] as { lines: string[] }), ["b/needs", "c/unknown-risk", "e/risk"]);
  assert.deepEqual(names(g[1] as { lines: string[] }), ["a/track", "f/track"]);
  assert.deepEqual(names(g[2] as { lines: string[] }), ["d/none"]);
  const onlyTrack = groups(await page(ok([{ name: "a/track", result: onTrack }]), WEEK42));
  assert.deepEqual(onlyTrack.map((x) => x.heading), ["On track"], "a group with no project is not shown");
});

test("REQ-109 AC3: a project with no readable report, a report without counts or an older report stands under Not known yet with its reason and no number", async () => {
  const facts = read(resolve(fixtureDir, "kinds.facts.json"));
  const unreadableFacts = await resultOf("not json", undefined, "2026-W41");
  const noReport = await resultOf(facts, undefined, "2026-W41");
  const badReport = await resultOf(facts, JSON.stringify({ week: "2026-W41" }), "2026-W41");
  const newerSchema = await resultOf(facts, JSON.stringify({ schema: 99 }), "2026-W41");
  const schema2 = await resultOf(facts, read(resolve(dir2, "kinds.report.json")), "2026-W41");
  const w = writeReport("kinds");
  const schema1 = await resultOf(w.facts, w.report, "2026-W41");
  const stale = await schema3("kinds");
  const repoUnknown = await resultOf(JSON.stringify({ ...JSON.parse(facts), repo: "unknown" }), read(resolve(dir3, "kinds.report.json")), "2026-W41");
  const cases: [string, FactsResult, number, string][] = [
    ["unreadable", unreadableFacts, WEEK42, "acme/api Not known yet: the file is not valid JSON."],
    ["noreport", noReport, WEEK42, "acme/api Week 2026-W41 Not known yet: the artifact has no report (made before kit 0.39.0)."],
    ["badreport", badReport, WEEK42, "acme/api Week 2026-W41 Not known yet: the report could not be read."],
    ["newerschema", newerSchema, WEEK42, "acme/api Week 2026-W41 Not known yet: the report has a schema this page does not read."],
    ["schema2", schema2, WEEK42, "acme/api Week 2026-W41 Not known yet: the report has no counts (made by an older kit)."],
    ["schema1", schema1, WEEK42, "acme/api Week 2026-W41 Not known yet: the report has no counts (made by an older kit)."],
    ["stale", stale, WEEK43, "acme/api Week 2026-W41 Not known yet: the latest report is for week 2026-W41."],
    ["repo", repoUnknown, WEEK42, "acme/api Week 2026-W41 Not known yet: its repository is not known."],
  ];
  for (const [name, result, now, expected] of cases) {
    const g = groups(await page(ok([{ name: "acme/api", result }]), now));
    assert.deepEqual(g.map((x) => x.heading), ["Not known yet"], name);
    assert.equal(textOf(g[0]?.lines[0] as string), expected, name);
    assert.doesNotMatch(g[0]?.lines[0] as string, /delivered|needs you|at risk|merged:|hours:/, `${name}: no number of it`);
  }
});

test("REQ-109 AC3: a report of the current week or of the previous one is grouped by its counts, and one older is not, whatever its counts", async () => {
  const r = await schema3("kinds"); // week 2026-W41
  for (const [now, group] of [[Date.UTC(2026, 9, 7), "Needs your attention"], [WEEK42, "Needs your attention"], [WEEK43, "Not known yet"], [Date.UTC(2026, 10, 30), "Not known yet"]] as [number, string][]) {
    assert.equal(groups(await page(ok([{ name: "acme/api", result: r }]), now))[0]?.heading, group, new Date(now).toISOString());
  }
  // a year boundary: a report of 2026-W53 is the previous week in 2027-W01, and 2026-W52 is not
  const w53 = await schema3("kinds", (d) => (d.week = "2026-W53"));
  assert.equal(groups(await page(ok([{ name: "acme/api", result: w53 }]), Date.UTC(2027, 0, 4)))[0]?.heading, "Needs your attention");
  const w52 = await schema3("kinds", (d) => (d.week = "2026-W52"));
  assert.equal(groups(await page(ok([{ name: "acme/api", result: w52 }]), Date.UTC(2027, 0, 4)))[0]?.heading, "Not known yet");
});

test("REQ-109 AC4: a count of 0 carries the zero class and a count above 0 or unknown never does", async () => {
  const r = await schema3("kinds", (d) => ((d.counts.delivered = 0), (d.counts.needs_you = "unknown"), (d.counts.at_risk = 3)));
  const line = groups(await page(ok([{ name: "acme/api", result: r }]), WEEK42))[0]?.lines[0] as string;
  assert.match(line, /<span class="figure pill done zero">delivered: 0<\/span>/);
  assert.match(line, /<span class="figure pill none">needs you: not known yet<\/span>/);
  assert.match(line, /<span class="figure pill risk">at risk: 3<\/span>/);
  const zeros = await schema3("kinds", (d) => ((d.counts.needs_you = 0), (d.counts.at_risk = 0), (d.counts.delivered = 0), (totals(d).merged = 0)));
  const zl = groups(await page(ok([{ name: "acme/api", result: zeros }]), WEEK42))[0]?.lines[0] as string;
  assert.equal((zl.match(/ zero"/g) ?? []).length, 4, "delivered, needs you, at risk and merged are 0");
  assert.match(zl, /<span class="figure zero">merged: 0<\/span>/, "merged is plain text, not a pill");
  assert.match(zl, /<span class="figure">hours: 107\.3<\/span>/, "hours is the data's string and is never muted");
});

const KIT = (name: string): Promise<FactsResult> => schema3(name);

test("REQ-109 AC5: a listed project's page shows its This week and a link back to All projects", async () => {
  const result = await KIT("busy");
  const app = createApp(createCore({ config, now: () => WEEK42 }), { projects: async () => ok([]), project: async (_t, name) => (name === "acme/api" ? { kind: "found", result } : { kind: "missing" }) });
  const cookie = await sealSession({ token: TOKEN, expiresAt: WEEK42 + 3_600_000 }, KEY);
  const get = (path: string): Promise<Response> => app(new Request(`https://portal.example${path}`, { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  const response = await get("/p/acme/api");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<p class="back"><a href="\/">All projects<\/a><\/p>/);
  assert.match(html, /<h3>This week<\/h3>/);
  assert.match(html, /<h2><a href="https:\/\/github\.com\/acme\/api">acme\/api<\/a><\/h2>/);
  assert.match(html, /<title>acme\/api<\/title>/);
  for (const bad of ["/p/acme/missing", "/p/acme", "/p/", "/p/acme/api/extra", "/p/acme/a%20b", "/p/a b/c", "/p/<x>/y", "/p//api", "/p/acme/..", "/p/../api"]) {
    const refused = await get(bad);
    assert.equal(refused.status, 404, bad);
    assert.match(await refused.text(), /Page not found/, bad);
  }
});

test("REQ-109 AC5: a name that is not of the shape makes no read of GitHub, and a name not in the list makes no read of its facts", async () => {
  const calls: string[] = [];
  const github = createGithubClient({
    fetch: async (url) => {
      calls.push(url.replace("https://api.github.com", ""));
      if (url.endsWith("/user/installations?per_page=100&page=1")) return new Response(read(resolve(import.meta.dirname, "fixtures", "github", "installations-write-permission.json")).replace('"write"', '"read"'));
      if (url.includes("/user/installations/1001/repositories")) return new Response(JSON.stringify({ total_count: 1, repositories: [{ full_name: "acme/api" }] }));
      return new Response("{}", { status: 404 });
    },
  });
  const app = createApp(createCore({ config, now: () => WEEK42 }), { github });
  const cookie = await sealSession({ token: TOKEN, expiresAt: WEEK42 + 3_600_000 }, KEY);
  const get = (path: string): Promise<Response> => app(new Request(`https://portal.example${path}`, { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  assert.equal((await get("/p/acme/a%20b")).status, 404);
  assert.equal((await get("/p/a")).status, 404);
  assert.equal(calls.length, 0, "no read of GitHub for a name of a bad shape");
  assert.equal((await get("/p/acme/secret")).status, 404);
  assert.ok(calls.length > 0 && calls.every((c) => c.startsWith("/user/installations")), "only the person's list was read");
  assert.ok(!calls.some((c) => c.includes("acme/secret")), "nothing about the project not in the list");
});

test("REQ-109 AC6: the find form keeps the lines whose name contains q ignoring case, q is escaped and cut at 100, and nothing matching says No project matches", async () => {
  const r = await KIT("kinds");
  const list = ok(["acme/api", "acme/Web", "beta-co/App", "acme/applet"].map((name) => ({ name, result: r })));
  const all = groups(await page(list, WEEK42));
  assert.deepEqual(names(all[0] as { lines: string[] }), ["acme/api", "acme/Web", "beta-co/App", "acme/applet"]);
  const app = groups(await page(list, WEEK42, "?q=APP"));
  assert.deepEqual(names(app[0] as { lines: string[] }), ["beta-co/App", "acme/applet"]);
  assert.deepEqual(names(groups(await page(list, WEEK42, "?q=%20acme%2Fa%20"))[0] as { lines: string[] }), ["acme/api", "acme/applet"], "trimmed");
  assert.deepEqual(names(groups(await page(list, WEEK42, "?q="))[0] as { lines: string[] }), ["acme/api", "acme/Web", "beta-co/App", "acme/applet"], "an empty q keeps every line");
  const none = await page(list, WEEK42, "?q=zzz");
  assert.match(none, /<p>No project matches\.<\/p>/);
  assert.equal(groups(none).length, 0);
  const hostile = await page(list, WEEK42, `?q=${encodeURIComponent('"><script>alert(1)</script>')}`);
  assert.doesNotMatch(hostile, /<script/);
  assert.match(hostile, /value="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;"/);
  const long = await page(list, WEEK42, `?q=${"a".repeat(150)}`);
  assert.match(long, new RegExp(`value="a{100}"`));
  assert.doesNotMatch(long, /a{101}/);
  assert.match(all.length ? await page(list, WEEK42) : "", /<form method="get" action="\/" class="find">\s*<label for="q">Find a project<\/label>\s*<input type="text" id="q" name="q" value="" maxlength="100">\s*<button type="submit">Find<\/button>\s*<\/form>/);
});

test("REQ-109 AC1: a person with no project sees the empty phrase, one with a single project still sees the list, and the notices and the unreadable list are said", async () => {
  assert.match(await page(ok([]), WEEK42), /No projects are available to you yet\./);
  const one = await page(ok([{ name: "acme/api", result: await KIT("kinds") }]), WEEK42);
  assert.equal(groups(one).length, 1);
  assert.match(await page(ok([], ["<p>NOTICE</p>"]), WEEK42), /<p>NOTICE<\/p>/);
  assert.match(await page({ kind: "unreadable" }, WEEK42), /Projects could not be read: not known yet\./);
});

test("REQ-109 AC7: the reads per project are counted and recorded, and one failing project stops no other", async () => {
  const doc = read(resolve(import.meta.dirname, "..", "..", "docs", "runs", "start-page-reads.md"));
  const facts = read(resolve(fixtureDir, "kinds.facts.json"));
  const report = read(resolve(dir3, "kinds.report.json"));
  const reposOf = ["acme/api", "acme/web", "acme/app"];
  const calls: string[] = [];
  const github = createGithubClient({
    fetch: async (url) => {
      const path = url.replace("https://api.github.com", "");
      calls.push(path);
      if (path === "/user/installations?per_page=100&page=1") return new Response(JSON.stringify({ total_count: 1, installations: [{ id: 1001, account: { login: "acme" }, permissions: { actions: "read", metadata: "read" } }] }));
      if (path === "/user/installations/1001/repositories?per_page=100&page=1") return new Response(JSON.stringify({ total_count: 3, repositories: reposOf.map((full_name) => ({ full_name })) }));
      for (const repo of reposOf) {
        if (path === `/repos/${repo}/actions/artifacts?per_page=100&page=1`) {
          if (repo === "acme/web") return new Response("{}", { status: 500 });
          return new Response(JSON.stringify({ total_count: 1, artifacts: [{ id: 5, name: "agk-facts-2026-W41", expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] }));
        }
        if (path === `/repos/${repo}/actions/artifacts/5/zip`) return new Response(null, { status: 302, headers: { location: `https://blob.example.net/signed/${repo.split("/")[1]}?sig=S` } });
      }
      if (url.startsWith("https://blob.example.net/signed/")) return new Response(zip([{ name: "facts.json", data: facts }, { name: "report.json", data: report }]) as BodyInit);
      return new Response("{}", { status: 404 });
    },
  });
  const app = createApp(createCore({ config, now: () => WEEK42 }), { github });
  const cookie = await sealSession({ token: TOKEN, expiresAt: WEEK42 + 3_600_000 }, KEY);
  const response = await app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  const html = await response.text();
  const g = groups(html);
  assert.deepEqual(g.map((x) => x.heading), ["Needs your attention", "Not known yet"]);
  assert.deepEqual(names(g[0] as { lines: string[] }), ["acme/api", "acme/app"]);
  assert.deepEqual(names(g[1] as { lines: string[] }), ["acme/web"]);
  assert.match(g[1]?.lines[0] as string, /Not known yet: GitHub answered 500\./);
  const own = (repo: string): number => calls.filter((c) => c.includes(`/repos/${repo}/`)).length;
  const signed = (repo: string): number => calls.filter((c) => c.includes(`/signed/${repo.split("/")[1]}?`)).length;
  const reads = (repo: string): number => own(repo) + signed(repo);
  assert.equal(reads("acme/api"), 3, "the artifact listing, the download address and the signed download");
  assert.equal(reads("acme/app"), 3);
  assert.equal(reads("acme/web"), 1, "a failing listing is one read and stops no other");
  assert.equal(calls.filter((c) => c.startsWith("/user/")).length, 2, "the person's list: the installations and the repositories of one installation");
  assert.match(doc, /GitHub reads per project: 3 /);
  assert.match(doc, /GitHub reads for the person's list: 2 /);
  assert.match(doc, /3 projects: 11 reads/);
  assert.match(doc, /time to first byte on staging: not recorded yet/i);
  assert.match(doc, /No claim about 50 projects/);
});

test("REQ-109 AC8: the start page has no script, no style attribute, only classes and native controls", async () => {
  const r = await KIT("kinds");
  const html = await page(ok([{ name: "acme/api", result: r }]), WEEK42);
  assert.doesNotMatch(html, /\sstyle\s*=|<script\b|\son[a-z]+\s*=|\stabindex\s*=|\srole\s*=|<img\b|<svg\b/i);
  assert.deepEqual([...html.matchAll(/<link[^>]*>/g)].map((m) => m[0]), ['<link rel="stylesheet" href="/style.css">']);
  assert.match(html, /<title>Your projects<\/title>/);
  assert.match(html, /<h1>Your projects<\/h1>/);
  assert.match(html, /<form method="post" action="\/signout"><button type="submit">Sign out<\/button><\/form>/);
});

test("REQ-109 AC1: the name in the link of a line is escaped in its href, as everywhere else", async () => {
  const r = await KIT("kinds");
  const name = 'acme/a&b"c<d>\'e';
  const html = await page(ok([{ name, result: r }]), WEEK42);
  assert.match(html, /<a href="\/p\/acme\/a&amp;b&quot;c&lt;d&gt;'e">acme\/a&amp;b&quot;c&lt;d&gt;'e<\/a>/);
  assert.doesNotMatch(html, /href="\/p\/acme\/a&b/, "no raw ampersand in the href");
  assert.doesNotMatch(html, /a&b"c|<d>/, "no raw quote or tag from the name");
  assert.equal([...html.matchAll(/href="([^"]*)"/g)].filter((m) => (m[1] as string).startsWith("/p/")).length, 1);
});

test("REQ-109 AC6: the find input has one accessible name, a visible label tied to it, and the button reads Find", async () => {
  const html = await page(ok([{ name: "acme/api", result: await KIT("kinds") }]), WEEK42);
  assert.match(html, /<label for="q">Find a project<\/label>\s*<input type="text" id="q" name="q"/);
  assert.doesNotMatch(html, /aria-label=/, "the visible label is the one name");
  assert.match(html, /<button type="submit">Find<\/button>/);
  assert.equal((html.match(/id="q"/g) ?? []).length, 1);
  const empty = await page(ok([]), WEEK42);
  assert.doesNotMatch(empty, /<input/, "no form when there is no project");
});

test("REQ-109 AC1: the counts are pills in the status colours: delivered done, needs you decide, at risk risk, not known yet none; merged and hours are plain text", async () => {
  const r = await schema3("kinds", (d) => ((d.counts.delivered = 4), (d.counts.needs_you = 2), (d.counts.at_risk = "unknown")));
  const line = groups(await page(ok([{ name: "acme/api", result: r }]), WEEK42))[0]?.lines[0] as string;
  assert.match(line, /<span class="figure pill done">delivered: 4<\/span>/);
  assert.match(line, /<span class="figure pill decide">needs you: 2<\/span>/);
  assert.match(line, /<span class="figure pill none">at risk: not known yet<\/span>/);
  assert.match(line, /<span class="figure">merged: 4<\/span>/);
  assert.match(line, /<span class="figure">hours: 107\.3<\/span>/);
  const unknownAll = await schema3("kinds", (d) => ((d.counts.delivered = "unknown"), (d.counts.needs_you = "unknown"), (d.counts.at_risk = "unknown")));
  const text = groups(await page(ok([{ name: "acme/api", result: unknownAll }]), WEEK42))[0]?.lines[0] as string;
  assert.equal((text.match(/pill none/g) ?? []).length, 3, "every count that is not known yet is a none pill");
  const notKnown = groups(await page(ok([{ name: "acme/api", result: await resultOf("not json", undefined, "2026-W41") }]), WEEK42))[0]?.lines[0] as string;
  assert.doesNotMatch(notKnown, /pill/, "a line under Not known yet has no figure");
});
