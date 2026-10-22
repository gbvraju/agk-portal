// The This week section, first part (SPEC-0005 as amended by Amendment 6, ADR-0019): the archive gives the card the
// report's data, the data is checked against the closed list of agk SPEC-0022 before anything in it is used, and the
// section opens with the week, the dirty notice and the facts commit. The data is what this repository's own
// scripts/agk/product_report.py --json writes from the kit's fixture facts documents. Markers REQ-105 AC1 (the week and
// the opening), AC6 and AC8. Recorded GitHub answers and archives in memory, no network.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRTY_NOTICE_PHRASE,
  NO_REPORT_REASON,
  REPORT_UNREADABLE_REASON,
  UNKNOWN_REPOSITORY_REASON,
  createGithubClient,
  factsCard,
  openingPhrase,
  parseReport,
  readFacts,
  type FactsResult,
} from "../src/core/index.ts";
import { readArchive } from "../src/core/zip.ts";
import { fixtureDir, writeReport } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
const FIXTURES = ["kinds", "busy", "quiet", "dirty-unknown", "empty"];

type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));

async function resultOf(entries: { name: string; data: string | Uint8Array }[], week: string): Promise<FactsResult> {
  const bytes = zip(entries);
  const artifacts = { total_count: 1, artifacts: [{ id: 777, name: `agk-facts-${week}`, expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] };
  const routes: Record<string, () => Response> = {
    "https://api.github.com/repos/acme/api/actions/artifacts?per_page=100&page=1": () => new Response(JSON.stringify(artifacts)),
    "https://api.github.com/repos/acme/api/actions/artifacts/777/zip": () => new Response(null, { status: 302, headers: { location: SIGNED } }),
    [SIGNED]: () => new Response(bytes as BodyInit),
  };
  const github = createGithubClient({ fetch: async (url) => routes[url]?.() ?? new Response("{}", { status: 404 }) });
  return readFacts(github, TOKEN, "acme/api", START);
}

// The card of a fixture: facts.json and report.json as the script wrote them, optionally changed.
async function cardOf(fixture: string, change?: (report: Doc) => void, facts?: (facts: Doc) => void): Promise<{ html: string; result: FactsResult }> {
  const written = writeReport(fixture);
  const report = clone(written.document);
  change?.(report);
  const factsDoc = JSON.parse(written.facts);
  facts?.(factsDoc);
  const result = await resultOf(
    [
      { name: "facts.json", data: JSON.stringify(factsDoc) },
      { name: "report.json", data: JSON.stringify(report, null, 2) + "\n" },
    ],
    written.document.week,
  );
  return { html: factsCard("acme/api", result), result };
}

const OPENING = (d: Doc): string => `Week ${d.week}: Monday ${d.opening.first} to Sunday ${d.opening.last} (UTC). What waits for you is as of ${d.opening.as_of}.`;

test("REQ-105 AC1: the archive reader returns report.json beside facts.json, in either order, and none when the archive holds facts.json alone", async () => {
  const facts = { name: "facts.json", data: '{"schema":1}' };
  const report = { name: "report.json", data: '{"a":1}' };
  const both = await readArchive(zip([facts, report]));
  assert.equal(new TextDecoder().decode(both?.facts), '{"schema":1}');
  assert.equal(new TextDecoder().decode(both?.report), '{"a":1}');
  const reversed = await readArchive(zip([report, facts]));
  assert.equal(new TextDecoder().decode(reversed?.report), '{"a":1}');
  const alone = await readArchive(zip([facts]));
  assert.equal(new TextDecoder().decode(alone?.facts), '{"schema":1}');
  assert.equal(alone?.report, undefined);
  assert.equal(await readArchive(zip([report])), undefined, "report.json alone is no archive of ours");
});

test("REQ-105 AC1: the report the repository's own script writes passes the document check, for each fixture", () => {
  for (const name of FIXTURES) {
    const written = writeReport(name);
    const parsed = parseReport(written.report);
    assert.ok(parsed, `${name} passes`);
    assert.equal(parsed.week, written.document.week);
    assert.deepEqual(parsed.opening, written.document.opening);
    assert.deepEqual(Object.keys(written.document).sort(), ["notices", "opening", "schema", "sections", "week"]);
  }
});

test("REQ-105 AC1: the section opens with the fixed phrase of SPEC-0005 rule 1, from the data, for each fixture", async () => {
  assert.equal(
    openingPhrase({ week: "2026-W41", opening: { first: "2026-10-05", last: "2026-10-11", as_of: "2026-10-14" } }),
    "Week 2026-W41: Monday 2026-10-05 to Sunday 2026-10-11 (UTC). What waits for you is as of 2026-10-14.",
  );
  for (const name of FIXTURES) {
    const { html, result } = await cardOf(name);
    assert.equal(result.kind, "facts", name);
    const document = writeReport(name).document;
    assert.ok(html.includes(OPENING(document)), `${name}: ${html.slice(0, 400)}`);
    assert.equal((html.match(/Week 20\d\d-W\d\d:/g) ?? []).length, 1, "once");
    assert.match(html, /<h2><a href="https:\/\/github\.com\/acme\/api">acme\/api<\/a><\/h2>/);
    assert.ok(html.includes("Facts read for "), "the facts line stays");
  }
});

test("REQ-105 AC1: the week window is Monday to Sunday UTC across a year boundary and an ISO week 53, as the script writes it, and the page copies it", async () => {
  const cases: [string, string][] = [
    ["2027-01-06", "2026-W53"],
    ["2026-01-07", "2026-W01"],
    ["2026-12-30", "2026-W52"],
    ["2027-01-13", "2027-W01"],
    ["2028-01-05", "2027-W52"],
  ];
  for (const [today, label] of cases) {
    const written = writeReport(
      "quiet",
      (facts) => {
        facts["today"] = today;
      },
      today,
    );
    const d = written.document;
    const first = new Date(`${d.opening.first}T00:00:00Z`);
    const last = new Date(`${d.opening.last}T00:00:00Z`);
    assert.equal(first.getUTCDay(), 1, `${today}: a Monday`);
    assert.equal(last.getUTCDay(), 0, `${today}: a Sunday`);
    assert.equal((last.getTime() - first.getTime()) / 86_400_000, 6);
    // The ISO label of the Thursday of that week (an independent computation).
    const thursday = new Date(first.getTime() + 3 * 86_400_000);
    const year = thursday.getUTCFullYear();
    const jan1 = Date.UTC(year, 0, 1);
    const isoWeek = Math.floor((thursday.getTime() - jan1) / 86_400_000 / 7) + 1;
    assert.equal(d.week, `${year}-W${String(isoWeek).padStart(2, "0")}`, `${today}: the script's label is the ISO week`);
    assert.equal(d.week, label, today);
    const result = await resultOf([{ name: "facts.json", data: written.facts }, { name: "report.json", data: written.report }], d.week);
    assert.ok(factsCard("acme/api", result).includes(OPENING(d)), today);
  }
});

test("REQ-105 AC1: a report whose week is not the week of its artifact is not used", async () => {
  const written = writeReport("quiet");
  const result = await resultOf([{ name: "facts.json", data: written.facts }, { name: "report.json", data: written.report }], "2026-W42");
  assert.equal(result.kind, "facts");
  const html = factsCard("acme/api", result);
  assert.ok(html.includes(`Not known yet: ${REPORT_UNREADABLE_REASON}.`));
  assert.ok(!html.includes("Week 2026-W41:"));
});

test("REQ-105 AC6: facts that were made from a modified working tree show the fixed notice and the facts commit", async () => {
  assert.equal(DIRTY_NOTICE_PHRASE, "These numbers were made from a copy with unsaved changes; treat them with care.");
  const { html } = await cardOf("dirty-unknown");
  assert.ok(html.includes(DIRTY_NOTICE_PHRASE));
  assert.ok(html.includes("c0ffee0000000000000000000000000000000000"), "the facts commit");
  for (const name of ["kinds", "busy", "quiet", "empty"]) {
    const clean = await cardOf(name);
    assert.ok(!clean.html.includes("unsaved changes"), `${name}: no notice on a clean tree`);
  }
});

test("REQ-105 AC6: the facts commit is a link only when the data gives a GitHub address, and the dirty value is never shown", async () => {
  const link = (url: string) => (report: Doc) => {
    for (const n of report.notices) if (n.kind === "facts-commit") n.links = [{ to: "directory", url }];
  };
  const good = await cardOf("dirty-unknown", link("https://github.com/demo-org/demo-repo/tree/c0ffee0000000000000000000000000000000000"));
  assert.match(good.html, /<a href="https:\/\/github\.com\/demo-org\/demo-repo\/tree\/c0ffee0000000000000000000000000000000000">c0ffee0000000000000000000000000000000000<\/a>/);
  const query = await cardOf("dirty-unknown", link("https://github.com/demo-org/demo-repo/pulls?q=is%3Apr+merged%3A2026-10-05..2026-10-11&type=pr"));
  assert.ok(query.html.includes('href="https://github.com/demo-org/demo-repo/pulls?q=is%3Apr+merged%3A2026-10-05..2026-10-11&amp;type=pr"'), "an ampersand in an address is escaped");
  for (const bad of [
    "https://evil.example/x",
    "https://github.com.evil.example/x",
    "https://github.com@evil.example/x",
    "https://github.comx/x",
    'https://github.com/a"onclick="x',
    "https://github.com/a b",
    "https://github.com/a\nb",
    "https://github.com/a'b",
    "https://github.com/a<b",
  ]) {
    const { html } = await cardOf("dirty-unknown", link(bad));
    assert.ok(html.includes("c0ffee0000000000000000000000000000000000"), "the commit is still said");
    assert.ok(!html.includes(bad) && !/href="[^"]*(evil|onclick)/.test(html), `${JSON.stringify(bad)} is not shown as an address`);
  }
  const { html } = await cardOf("dirty-unknown");
  assert.ok(!html.includes(">true<") && !/dirty/i.test(html), "the printed value of the flag is not shown");
});

test("REQ-105 AC6: a title or a commit with markup is escaped, and the page still renders", async () => {
  const hostile = '<img src=x onerror=alert(1)> style = x onclick = y "quoted" & done';
  const { html } = await cardOf("dirty-unknown", (report) => {
    for (const n of report.notices) if (n.kind === "facts-commit") n.commit = hostile;
  });
  assert.ok(!html.includes("<img"), html.slice(0, 300));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(html.includes("&quot;quoted&quot; &amp; done"));
});

test("REQ-105 AC8: an archive without report.json (made before kit 0.39.0) gives the card its reason, keeps the facts card and shows no This week", async () => {
  const written = writeReport("quiet");
  const result = await resultOf([{ name: "facts.json", data: written.facts }], written.document.week);
  assert.equal(result.kind, "facts");
  const html = factsCard("acme/api", result);
  assert.equal(NO_REPORT_REASON, "the artifact has no report (made before kit 0.39.0)");
  assert.ok(html.includes("Facts read for 2026-W41."));
  assert.ok(html.includes(`Not known yet: ${NO_REPORT_REASON}.`));
  assert.ok(!html.includes("Week 2026-W41:") && !html.includes("This week"));
});

const BREAKS: [string, (report: Doc) => void][] = [
  ["schema 2", (r) => (r.schema = 2)],
  ["schema as text", (r) => (r.schema = "1")],
  ["no schema", (r) => delete r.schema],
  ["an extra top key", (r) => (r.extra = 1)],
  ["no notices", (r) => delete r.notices],
  ["no week", (r) => delete r.week],
  ["a week that is not a week", (r) => (r.week = "2026-41")],
  ["an extra opening key", (r) => (r.opening.extra = "2026-10-14")],
  ["a missing opening key", (r) => delete r.opening.as_of],
  ["a date that is not a date", (r) => (r.opening.first = "2026-10-5")],
  ["a date as a number", (r) => (r.opening.last = 20261011)],
  ["an extra section", (r) => (r.sections.extra = [])],
  ["a missing section", (r) => delete r.sections.cost],
  ["a section that is not a list", (r) => (r.sections.proven = {})],
  ["an unknown kind in delivered", (r) => r.sections.delivered.push({ kind: "mystery", links: [] })],
  ["a kind of another section in proven", (r) => r.sections.proven.push({ kind: "pull-request-merged", number: 1, title: "t", merged_on: "2026-10-08", links: [] })],
  ["an extra field", (r) => (r.sections.delivered[0].extra = 1)],
  ["a missing links", (r) => delete r.sections.delivered[0].links],
  ["a link that is not a list", (r) => (r.sections.delivered[0].links = {})],
  ["a link to nowhere known", (r) => (r.sections.delivered[0].links = [{ to: "elsewhere", url: "https://github.com/a" }])],
  ["a link that is not https", (r) => (r.sections.delivered[0].links = [{ to: "file", url: "http://github.com/a" }])],
  ["a link with an extra key", (r) => (r.sections.delivered[0].links = [{ to: "file", url: "https://github.com/a", x: 1 }])],
  ["a number as text", (r) => (r.sections.delivered.find((i: Doc) => i.kind === "pull-request-merged").number = "5")],
  ["a number with a fraction", (r) => (r.sections.delivered.find((i: Doc) => i.kind === "pull-request-merged").number = 5.5)],
  ["a merge date that is not a date", (r) => (r.sections.delivered.find((i: Doc) => i.kind === "pull-request-merged").merged_on = "yesterday")],
  ["a became_done off the list", (r) => (r.sections.delivered.find((i: Doc) => i.kind === "requirement-done").became_done = "last-week")],
  ["criteria that are not a list or unknown", (r) => (r.sections.delivered.find((i: Doc) => i.kind === "requirement-done").criteria = "AC1")],
  ["a reason that is not on the list", (r) => r.sections.proven.find((i: Doc) => i.kind === "requirement-not-proven").reasons.push({ reason: "because" })],
  ["a reason with an extra key", (r) => r.sections.proven.find((i: Doc) => i.kind === "requirement-not-proven").reasons.push({ reason: "no-merged-change", x: 1 })],
  ["a group off the list", (r) => (r.sections.needs_you[0].group = "other")],
  ["a group count as text", (r) => (r.sections.needs_you[0].count = "3")],
  ["a group without items", (r) => delete r.sections.needs_you[0].items],
  ["an item of a kind that is not for a group", (r) => r.sections.needs_you[0].items.push({ kind: "requirement-done", id: "x", title: "t", criteria: [], became_done: "this-week", links: [] })],
  ["an entry without days", (r) => delete r.sections.at_risk.find((i: Doc) => i.kind === "pull-requests-open-long").entries[0].days],
  ["an entry with an extra key", (r) => (r.sections.at_risk.find((i: Doc) => i.kind === "pull-requests-merged-not-cleared").entries[0].x = 1)],
  ["drift counts that are not an object", (r) => (r.sections.at_risk.find((i: Doc) => i.kind === "drift-audit").counts = [])],
  ["an open issue that is not allowed", (r) => (r.sections.at_risk.find((i: Doc) => i.kind === "drift-audit").open_issue = "maybe")],
  ["hours as a number", (r) => (r.sections.cost.find((i: Doc) => i.kind === "pull-request-cost").hours = 1.2)],
  ["hours with two decimals", (r) => (r.sections.cost.find((i: Doc) => i.kind === "pull-request-cost").hours = "1.25")],
  ["an estimate off the list", (r) => (r.sections.cost.find((i: Doc) => i.kind === "week-totals").estimate = "later")],
  ["busy as text", (r) => (r.sections.cost.find((i: Doc) => i.kind === "week-totals").busy = "true")],
  ["a notice of an unknown kind", (r) => r.notices.push({ kind: "mystery", links: [] })],
  ["a notice with a state off the list", (r) => (r.notices.find((n: Doc) => n.kind === "metrics-issue").state = "maybe")],
  ["null for the sections", (r) => (r.sections = null)],
  ["a list for the opening", (r) => (r.opening = [])],
];

test("REQ-105 AC8: a report that departs from the closed list in any way gives the card the reason and no This week, and the facts card still reads", async () => {
  assert.ok(BREAKS.length >= 40);
  for (const [name, change] of BREAKS) {
    const { html, result } = await cardOf("kinds", change);
    assert.equal(result.kind, "facts", name);
    assert.ok(html.includes("Facts read for 2026-W41."), `${name}: the facts line stays`);
    assert.ok(html.includes(`Not known yet: ${REPORT_UNREADABLE_REASON}.`), `${name}: ${html.slice(0, 500)}`);
    assert.ok(!html.includes("Week 2026-W41:"), `${name}: no This week`);
  }
  assert.equal(REPORT_UNREADABLE_REASON, "the report could not be read");
});

test("REQ-105 AC8: documents that are not JSON, empty, a list, a number or null are refused whole", async () => {
  const written = writeReport("quiet");
  for (const text of ["", "not json", "[]", "7", "null", '"text"', "{", written.report + "garbage", "\u0000" + written.report]) {
    const result = await resultOf([{ name: "facts.json", data: written.facts }, { name: "report.json", data: text }], written.document.week);
    assert.equal(result.kind, "facts");
    assert.ok(factsCard("acme/api", result).includes(`Not known yet: ${REPORT_UNREADABLE_REASON}.`), JSON.stringify(text.slice(0, 20)));
  }
  const invalid = await resultOf([{ name: "facts.json", data: written.facts }, { name: "report.json", data: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) }], written.document.week);
  assert.ok(factsCard("acme/api", invalid).includes(REPORT_UNREADABLE_REASON), "invalid UTF-8");
});

test("REQ-105 AC8: the places where the closed list allows unknown are accepted", async () => {
  const { html } = await cardOf("kinds", (r) => {
    r.sections.delivered.find((i: Doc) => i.kind === "requirement-done").criteria = "unknown";
    r.sections.delivered.find((i: Doc) => i.kind === "requirement-done").became_done = "unknown";
    r.sections.needs_you[0].count = "unknown";
    r.sections.cost.find((i: Doc) => i.kind === "pull-request-cost").hours = "unknown";
    r.sections.cost.find((i: Doc) => i.kind === "pull-request-cost").fix_verdicts = "unknown";
    r.sections.cost.find((i: Doc) => i.kind === "week-totals").hours = "unknown";
    r.sections.cost.find((i: Doc) => i.kind === "week-totals").estimate = "none-declared";
    r.sections.at_risk.find((i: Doc) => i.kind === "drift-audit").total = "unknown";
    r.sections.at_risk.find((i: Doc) => i.kind === "drift-audit").open_issue = "none";
    r.sections.proven.push({ kind: "unknown", what: "test markers", links: [] });
  });
  assert.ok(html.includes("Week 2026-W41:"), html.slice(0, 300));
});

test("REQ-105 AC8: a repository the facts mark unknown shows no This week, only its card, with the reason", async () => {
  assert.equal(UNKNOWN_REPOSITORY_REASON, "its repository is not known");
  const { html } = await cardOf("quiet", undefined, (facts) => {
    facts["repo"] = "unknown";
  });
  assert.ok(html.includes(`Not known yet: ${UNKNOWN_REPOSITORY_REASON}.`));
  assert.ok(!html.includes("Week 2026-W41:"));
});

test("REQ-105 AC8: facts that cannot be read give the card the facts reason and no This week, as before", async () => {
  const written = writeReport("quiet");
  const result = await resultOf([{ name: "facts.json", data: JSON.stringify({ ...JSON.parse(written.facts), schema: 2 }) }, { name: "report.json", data: written.report }], written.document.week);
  assert.deepEqual(result, { kind: "unknown", reason: "the schema is not 1" });
  const html = factsCard("acme/api", result);
  assert.ok(html.includes("Not known yet: the schema is not 1.") && !html.includes("Week 2026-W41:"));
});

test("REQ-105 AC1: until the parts are built no part is shown, not even as empty (Delivered and Time and review are built; the others are not)", async () => {
  const { html } = await cardOf("quiet");
  for (const part of ["Proven", "Needs your decision", "At risk"]) {
    assert.ok(!html.includes(part), `${part} is not shown yet`);
  }
});

test("REQ-105 AC1: the fixtures are the kit's facts documents, unchanged, with no token and no signed address", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const files = readdirSync(fixtureDir).sort();
  assert.deepEqual(files, FIXTURES.map((n) => `${n}.facts.json`).sort());
  for (const file of files) {
    const text = readFileSync(join(fixtureDir, file), "utf8");
    assert.ok(!/\bgh[pousr]_[A-Za-z0-9]{10,}|github_pat_|sig=|-----BEGIN/.test(text), file);
  }
});
