// The report's schema 4 (agk #184, REQ-037 part c): `needs_you` gains the group `ready` ("Ready to merge"), first, with the item
// kind `pull-request-ready` (exactly number, title and links); no other field changes. The reader accepts schemas 1 to 4, each
// with its own closed list, says on the page when a schema is not one it reads, and the start page groups a schema 4 report by
// its counts as it does a schema 3 one. The schema 4 documents are the goldens of agk #184 at head 98dca8c
// (tests/fixtures/report-schema-4); the page places the data and computes nothing. Markers REQ-105 AC2, AC3, AC5 and AC8.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { SESSION_COOKIE, UNKNOWN_SCHEMA_REASON, createApp, createCore, createGithubClient, factsCard, parseReport, readFacts, sealSession, type Config, type ConfigName } from "../src/core/index.ts";
import { fixtureDir } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
const WEEK42 = Date.UTC(2026, 9, 14, 12);
const dir4 = resolve(import.meta.dirname, "fixtures", "report-schema-4");
const dir3 = resolve(import.meta.dirname, "fixtures", "report-schema-3");
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));
const read = (path: string): string => readFileSync(path, "utf8");

function schema4(name: string): { facts: string; document: Doc } {
  const facts = name === "facts-pr-states" ? read(resolve(dir3, "facts-pr-states.facts.json")) : read(resolve(fixtureDir, `${name}.facts.json`));
  return { facts, document: JSON.parse(read(resolve(dir4, `${name}.report.json`))) };
}
function archiveRoutes(facts: string, report: string, week: string): Record<string, () => Response> {
  const artifacts = { total_count: 1, artifacts: [{ id: 777, name: `agk-facts-${week}`, expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] };
  const bytes = zip([{ name: "facts.json", data: facts }, { name: "report.json", data: report }]);
  return {
    "https://api.github.com/repos/acme/api/actions/artifacts?per_page=100&page=1": () => new Response(JSON.stringify(artifacts)),
    "https://api.github.com/repos/acme/api/actions/artifacts/777/zip": () => new Response(null, { status: 302, headers: { location: SIGNED } }),
    [SIGNED]: () => new Response(bytes as BodyInit),
  };
}
async function resultOf(facts: string, report: unknown): Promise<Awaited<ReturnType<typeof readFacts>>> {
  const text = typeof report === "string" ? report : JSON.stringify(report);
  const week = typeof report === "string" ? "2026-W41" : (report as Doc).week;
  const routes = archiveRoutes(facts, text, week);
  const github = createGithubClient({ fetch: async (url) => routes[url]?.() ?? new Response("{}", { status: 404 }) });
  return readFacts(github, TOKEN, "acme/api", START);
}
const cardOf = async (facts: string, report: unknown): Promise<string> => factsCard("acme/api", await resultOf(facts, report));
const unescape = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const BADGE = /<span class="badge [a-z]+">.*?<\/span>/gs;
const textOf = (inner: string): string => unescape(inner.replace(BADGE, "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const hrefs = (inner: string): string[] => [...inner.matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1] as string));
function needs(page: string): { heading: string; lines: string[]; raw: string }[] {
  const at = page.indexOf("<h4>Needs your decision</h4>");
  assert.ok(at >= 0, "Needs your decision is shown");
  const rest = page.slice(at + 28);
  const body = rest.slice(0, rest.search(/<h4>|<\/section>/));
  return body
    .split("<h5>")
    .slice(1)
    .map((chunk) => ({ heading: textOf(chunk.slice(0, chunk.indexOf("</h5>"))), raw: chunk, lines: [...chunk.matchAll(/<li>(.*?)<\/li>/gs)].map((m) => m[1] as string) }));
}
const ready = (doc: Doc): Doc => doc.sections.needs_you.find((g: Doc) => g.group === "ready");
const UNREADABLE = /not known yet: the report could not be read\./;

test("REQ-105 AC8: the reader accepts schema 4 (the goldens of agk #184: busy and facts-pr-states) and still schemas 1 to 3", async () => {
  for (const name of ["busy", "facts-pr-states"]) {
    const { facts, document } = schema4(name);
    assert.equal(document.schema, 4, name);
    assert.notEqual(parseReport(JSON.stringify(document)), undefined, `${name}: schema 4 reads`);
    assert.ok((await cardOf(facts, document)).includes("<h3>This week</h3>"), `${name}: the card shows This week`);
  }
  const three = JSON.parse(read(resolve(dir3, "kinds.report.json")));
  assert.equal(three.schema, 3);
  assert.notEqual(parseReport(JSON.stringify(three)), undefined, "schema 3 still reads");
  assert.ok((await cardOf(read(resolve(fixtureDir, "kinds.facts.json")), three)).includes("<h3>This week</h3>"));
  const two = JSON.parse(read(resolve(import.meta.dirname, "fixtures", "report-schema-2", "kinds.report.json")));
  assert.notEqual(parseReport(JSON.stringify(two)), undefined, "schema 2 still reads");
});

test("REQ-105 AC8: schema 4 is schema 3's closed list plus the group ready and the kind pull-request-ready with exactly number, title and links", async () => {
  const { facts, document } = schema4("busy");
  const readyItem = (d: Doc): Doc => ready(d).items[0];
  const bad: [string, (d: Doc) => void][] = [
    ["an extra field on the item", (d) => (readyItem(d).extra = 1)],
    ["the title missing", (d) => delete readyItem(d).title],
    ["the number missing", (d) => delete readyItem(d).number],
    ["the links missing", (d) => delete readyItem(d).links],
    ["the number as text", (d) => (readyItem(d).number = "9")],
    ["a fractional number", (d) => (readyItem(d).number = 9.5)],
    ["the title as a number", (d) => (readyItem(d).title = 9)],
    ["the days field of another kind", (d) => (readyItem(d).days = 3)],
    ["a link that is not an object", (d) => (readyItem(d).links = ["x"])],
    ["a kind with another name", (d) => (readyItem(d).kind = "pull-request-ready-now")],
    ["a group with another name", (d) => (ready(d).group = "ready-to-merge")],
    ["the count as text", (d) => (ready(d).count = "1")],
    ["the counts without a key", (d) => delete d.counts.needs_you],
    ["schema 4 with the totals of schema 2", (d) => delete d.sections.cost[0].fix_verdicts_unknown],
  ];
  for (const [name, change] of bad) {
    const doc = clone(document);
    change(doc);
    assert.equal(parseReport(JSON.stringify(doc)), undefined, name);
    assert.match(await cardOf(facts, doc), UNREADABLE, name);
  }
  const without = clone(document);
  without.sections.needs_you = without.sections.needs_you.filter((g: Doc) => g.group !== "ready");
  assert.notEqual(parseReport(JSON.stringify(without)), undefined, "a week with nothing ready has no group");
  const many = clone(document);
  ready(many).items.push({ ...readyItem(many), number: 10 });
  ready(many).count = 2;
  assert.notEqual(parseReport(JSON.stringify(many)), undefined);
});

test("REQ-105 AC8: the group and the kind belong to schema 4 only: schemas 1 to 3 refuse them", () => {
  const three = JSON.parse(read(resolve(dir3, "busy.report.json")));
  const withGroup = clone(three);
  withGroup.sections.needs_you.unshift({ group: "ready", count: 0, items: [] });
  assert.equal(parseReport(JSON.stringify(withGroup)), undefined, "schema 3 with the group");
  const withKind = clone(three);
  withKind.sections.needs_you[0].items.push({ kind: "pull-request-ready", number: 1, title: "t", links: [] });
  assert.equal(parseReport(JSON.stringify(withKind)), undefined, "schema 3 with the kind");
  const plain3 = clone(three);
  plain3.schema = 4;
  assert.notEqual(parseReport(JSON.stringify(plain3)), undefined, "schema 3's content under the number 4 is a schema 4 report with nothing ready");
  const two = JSON.parse(read(resolve(import.meta.dirname, "fixtures", "report-schema-2", "kinds.report.json")));
  two.sections.needs_you.unshift({ group: "ready", count: 0, items: [] });
  assert.equal(parseReport(JSON.stringify(two)), undefined, "schema 2 with the group");
  const one = clone(JSON.parse(read(resolve(import.meta.dirname, "fixtures", "report-schema-2", "kinds.report.json"))));
  one.schema = 1;
  delete one.sections.cost.find((i: Doc) => i.kind === "week-totals").hours_unknown;
  assert.notEqual(parseReport(JSON.stringify(one)), undefined, "a schema 1 report without the group reads");
  one.sections.needs_you.unshift({ group: "ready", count: 0, items: [] });
  assert.equal(parseReport(JSON.stringify(one)), undefined, "schema 1 with the group");
  one.sections.needs_you.shift();
  one.sections.needs_you[0].items.push({ kind: "pull-request-ready", number: 1, title: "t", links: [] });
  assert.equal(parseReport(JSON.stringify(one)), undefined, "schema 1 with the kind");
});

test("REQ-105 AC2: the group Ready to merge stands first, its heading carries the data's count and each item is PR #n and its title, linked to its pull request", async () => {
  const { facts, document } = schema4("busy");
  const groups = needs(await cardOf(facts, document));
  assert.equal(groups[0]?.heading, "Ready to merge (1)");
  assert.deepEqual(groups.map((g) => g.heading), ["Ready to merge (1)", "Specification waiting for approval (1)", "Decision waiting (1)", "Questions waiting (2)", "Changes waiting for a review (2)", "Overdue items (2)", "Planned requirement with no specification (1)"]);
  const [line] = groups[0]?.lines ?? [];
  assert.equal(textOf(line as string), 'PR #9 "Change number 9"');
  assert.equal(line, '<span class="badge decide">Needs you</span> <a href="https://github.com/demo-org/demo-repo/pull/9">PR #9 &quot;Change number 9&quot;</a>');
  assert.deepEqual(hrefs(line as string), ["https://github.com/demo-org/demo-repo/pull/9"]);
});

test("REQ-105 AC5: a count of unknown reads not known yet, never zero, and the unreadable clearance is the existing unknown line with its link", async () => {
  const { facts, document } = schema4("facts-pr-states");
  const groups = needs(await cardOf(facts, document));
  assert.equal(groups[0]?.heading, "Ready to merge (not known yet)");
  assert.equal(textOf(groups[0]?.lines[0] as string), "The clearance of 1 open pull request could not be read: not known yet. (the item)");
  assert.deepEqual(hrefs(groups[0]?.lines[0] as string), ["https://github.com/demo-org/demo-repo/pull/19"]);
  assert.ok(groups[0]?.lines[0]?.includes('<span class="badge none">Not known yet</span>'));
  assert.doesNotMatch(groups[0]?.raw ?? "", /\(0\)/);
  assert.match(groups[1]?.heading ?? "", /^Changes waiting for a review \(not known yet\)$/);
});

test("REQ-105 AC3: the title of a ready pull request is escaped, an address that is not GitHub's leaves the text unlinked, and a ready group over 5 items folds", async () => {
  const { facts, document } = schema4("busy");
  const hostile = clone(document);
  ready(hostile).items[0].title = '<img src=x onerror=alert(1)> "q" & <script>';
  const page = await cardOf(facts, hostile);
  assert.doesNotMatch(page, /<img|<script/);
  assert.equal(textOf(needs(page)[0]?.lines[0] as string), 'PR #9 "<img src=x onerror=alert(1)> "q" & <script>"');
  const bad = clone(document);
  ready(bad).items[0].links = [{ to: "pull-request", url: "https://evil.example/x" }];
  const line = needs(await cardOf(facts, bad))[0]?.lines[0] as string;
  assert.equal(textOf(line), 'PR #9 "Change number 9"');
  assert.doesNotMatch(line, /<a |evil/);
  const six = clone(document);
  ready(six).items = Array.from({ length: 6 }, (_, i) => ({ kind: "pull-request-ready", number: 20 + i, title: `Ready ${i}`, links: [{ to: "pull-request", url: `https://github.com/demo-org/demo-repo/pull/${20 + i}` }] }));
  ready(six).count = 6;
  const folded = await cardOf(facts, six);
  assert.match(folded, /<details class="fold"><summary>Ready to merge \(6\)<\/summary>/);
});

test("REQ-105 AC8: a schema this page does not read is said on the card, not shown as an empty week, and a malformed schema still could not be read", async () => {
  assert.equal(UNKNOWN_SCHEMA_REASON, "the report has a schema this page does not read");
  const { facts, document } = schema4("busy");
  for (const schema of [8, 9, 99, 0, -1]) {
    const doc = clone(document);
    doc.schema = schema;
    const page = await cardOf(facts, doc);
    assert.match(page, new RegExp(`<p>Week 2026-W41: not known yet: ${UNKNOWN_SCHEMA_REASON}\\.</p>`), `schema ${schema}`);
    assert.doesNotMatch(page, /<h3>This week<\/h3>|Nothing this week|could not be read/, `schema ${schema}: no empty week`);
  }
  for (const schema of ["4", 4.5, null, true, [4], {}]) {
    const doc = clone(document);
    doc.schema = schema;
    assert.match(await cardOf(facts, doc), UNREADABLE, `schema ${JSON.stringify(schema)}`);
  }
  const noSchema = clone(document);
  delete noSchema.schema;
  assert.match(await cardOf(facts, noSchema), UNREADABLE);
  assert.match(await cardOf(facts, "not json"), UNREADABLE);
  assert.match(await cardOf(facts, JSON.stringify([5])), UNREADABLE);
});

test("REQ-109 AC3: the start page groups a schema 4 report by its counts, and a project of a schema it does not read stands under Not known yet with that reason", async () => {
  const busy = schema4("busy");
  const calm = clone(busy.document);
  calm.counts.needs_you = 0;
  calm.counts.at_risk = 0;
  const unknown = clone(busy.document);
  unknown.schema = 8;
  const results = [await resultOf(busy.facts, busy.document), await resultOf(busy.facts, calm), await resultOf(busy.facts, unknown)];
  const app = createApp(createCore({ config: { get: (n: ConfigName) => ({ GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid", GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value", SESSION_KEY: KEY, CALLBACK_URL: "https://portal.example/callback" })[n] } as Config, now: () => WEEK42 }), {
    projects: async () => ({ kind: "ok", notices: [], projects: [{ name: "acme/api", result: results[0]! }, { name: "acme/web", result: results[1]! }, { name: "acme/app", result: results[2]! }] }),
  });
  const cookie = await sealSession({ token: TOKEN, expiresAt: WEEK42 + 3_600_000 }, KEY);
  const html = await (await app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }))).text();
  const sections = [...html.matchAll(/<section class="group">\s*<h2>(.*?)<\/h2>\s*<ul class="projects">(.*?)<\/ul>/gs)].map((m) => [m[1], textOf(m[2] as string)]);
  assert.deepEqual(sections.map((s) => s[0]), ["Needs your attention", "On track", "Not known yet"]);
  assert.match(sections[0]?.[1] as string, /^acme\/api Week 2026-W41 delivered: 5 needs you: 10 at risk: 7 merged: 12 hours: 124\.3$/);
  assert.match(sections[1]?.[1] as string, /^acme\/web Week 2026-W41 delivered: 5/);
  assert.equal(sections[2]?.[1], `acme/app Week 2026-W41 Not known yet: ${UNKNOWN_SCHEMA_REASON}.`);
});

test("REQ-105 AC8: the schema 4 fixtures are the goldens of agk #184 at head 98dca8c, hold no token and no signed address, and are schema 4", () => {
  for (const name of ["busy", "facts-pr-states"]) {
    const text = read(resolve(dir4, `${name}.report.json`));
    assert.doesNotMatch(text, /ghu_|ghs_|github_pat_|sig=|token/i, name);
    assert.equal(JSON.parse(text).schema, 4);
  }
  assert.ok(ready(schema4("busy").document).items[0].kind === "pull-request-ready");
  assert.equal(ready(schema4("facts-pr-states").document).count, "unknown");
});
