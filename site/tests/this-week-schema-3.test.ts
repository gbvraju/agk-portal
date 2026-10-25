// The report's schema 3 (agk SPEC-0026, kit 0.50.0): `counts` on the report, `count` on the four grouped kinds,
// `fix_verdicts_unknown` on the totals, and the unknown items of open pull requests whose verdicts could not be read. The
// reader accepts schemas 1, 2 and 3, each with its own closed field list. For schema 3, Time and review gains a tile after the
// review-rounds tile and a grouped At risk line whose count is above 5 is folded. The schema 3 documents are the kit's own
// goldens at v0.50.0 (tests/fixtures/report-schema-3); the page places the data's numbers and computes nothing.
// Markers REQ-105 AC2, AC5 and AC8, and REQ-108 AC8 (the fold). Recorded GitHub answers, no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { createGithubClient, factsCard, parseReport, readFacts } from "../src/core/index.ts";
import { fixtureDir, writeReportKit } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
const dir3 = resolve(import.meta.dirname, "fixtures", "report-schema-3");
const dir2 = resolve(import.meta.dirname, "fixtures", "report-schema-2");
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));
const read = (path: string): string => readFileSync(path, "utf8");

// A schema 3 fixture: the kit's golden report.json and the facts document it was made from.
function schema3(name: string): { facts: string; document: Doc } {
  const own = name === "facts-ok" || name === "facts-pr-states";
  return { facts: read(resolve(own ? dir3 : fixtureDir, own ? `${name}.facts.json` : `${name}.facts.json`)), document: JSON.parse(read(resolve(dir3, `${name}.report.json`))) };
}

async function cardOf(facts: string, report: unknown): Promise<string> {
  const doc = report as Doc;
  const artifacts = { total_count: 1, artifacts: [{ id: 777, name: `agk-facts-${doc.week}`, expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] };
  const bytes = zip([{ name: "facts.json", data: facts }, { name: "report.json", data: JSON.stringify(report) }]);
  const routes: Record<string, () => Response> = {
    "https://api.github.com/repos/acme/api/actions/artifacts?per_page=100&page=1": () => new Response(JSON.stringify(artifacts)),
    "https://api.github.com/repos/acme/api/actions/artifacts/777/zip": () => new Response(null, { status: 302, headers: { location: SIGNED } }),
    [SIGNED]: () => new Response(bytes as BodyInit),
  };
  const github = createGithubClient({ fetch: async (url) => routes[url]?.() ?? new Response("{}", { status: 404 }) });
  return factsCard("acme/api", await readFacts(github, TOKEN, "acme/api", START));
}
const unescape = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const BADGE = /<span class="badge [a-z]+">.*?<\/span>/gs;
const textOf = (inner: string): string => unescape(inner.replace(BADGE, "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const hrefs = (inner: string): string[] => [...inner.matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1] as string));
function tiles(page: string): string[] {
  const at = page.indexOf('<div class="part time">');
  assert.ok(at >= 0, "Time and review is shown");
  const rest = page.slice(at);
  return [...rest.slice(0, rest.indexOf("</ul>")).matchAll(/<li class="tile">(.*?)<\/li>/gs)].map((m) => textOf(m[1] as string));
}
function part(page: string, title: string): string {
  const at = page.indexOf(`<h4>${title}</h4>`);
  assert.ok(at >= 0, `${title} is shown`);
  const rest = page.slice(at + title.length + 9);
  const end = rest.search(/<h4>|<\/section>/);
  return end < 0 ? rest : rest.slice(0, end);
}
const lis = (b: string): string[] => [...b.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map((m) => m[1] as string);
const totals = (doc: Doc): Doc => doc.sections.cost.find((i: Doc) => i.kind === "week-totals");
const GROUPED = ["pull-requests-open-long", "pull-requests-sent-back", "pull-requests-merged-no-verdict", "pull-requests-merged-not-cleared"];
const READABLE = "<h3>This week</h3>";
const UNREADABLE = /not known yet: the report could not be read\./;

test("REQ-105 AC8: the reader accepts schema 3 (the kit's goldens: busy, facts-ok, kinds, facts-pr-states), and schemas 1 and 2 as before", async () => {
  for (const name of ["busy", "facts-ok", "kinds", "facts-pr-states"]) {
    const { facts, document } = schema3(name);
    assert.equal(document.schema, 3, name);
    assert.notEqual(parseReport(JSON.stringify(document)), undefined, `${name}: schema 3 reads`);
    assert.ok((await cardOf(facts, document)).includes(READABLE), `${name}: the card shows This week`);
  }
  for (const name of ["busy", "kinds"]) {
    const two = JSON.parse(read(resolve(dir2, `${name}.report.json`)));
    assert.equal(two.schema, 2);
    assert.ok((await cardOf(read(resolve(fixtureDir, `${name}.facts.json`)), two)).includes(READABLE), `${name}: schema 2 still reads`);
  }
});

test("REQ-105 AC8: schema 3 needs counts, count on the four grouped kinds and fix_verdicts_unknown, and nothing else is added", async () => {
  const { facts, document } = schema3("kinds");
  const grouped = (d: Doc, kind: string): Doc => d.sections.at_risk.find((i: Doc) => i.kind === kind);
  const bad: [string, (d: Doc) => void][] = [
    ["counts missing", (d) => delete d.counts],
    ["counts without a key", (d) => delete d.counts.at_risk],
    ["counts with an extra key", (d) => (d.counts.cost = 1)],
    ["a count as text", (d) => (d.counts.delivered = "5")],
    ["a fractional count", (d) => (d.counts.proven = 1.5)],
    ["a negative count", (d) => (d.counts.needs_you = -1)],
    ["counts as a list", (d) => (d.counts = [0, 0, 0, 0])],
    ["fix_verdicts_unknown missing", (d) => delete totals(d).fix_verdicts_unknown],
    ["fix_verdicts_unknown as unknown", (d) => (totals(d).fix_verdicts_unknown = "unknown")],
    ["fix_verdicts_unknown negative", (d) => (totals(d).fix_verdicts_unknown = -1)],
    ["fix_verdicts_unknown null", (d) => (totals(d).fix_verdicts_unknown = null)],
    ["hours_unknown missing", (d) => delete totals(d).hours_unknown],
    ["an extra field on the totals", (d) => (totals(d).extra = 1)],
    ["count on a kind that is not grouped", (d) => (d.sections.at_risk[0].count = 1)],
    ["count on a per-change cost item", (d) => (d.sections.cost[0].count = 1)],
    ["the schema as text", (d) => (d.schema = "3")],
    ["schema 3 with schema 2 content", (d) => {
      delete d.counts;
      delete totals(d).fix_verdicts_unknown;
      for (const kind of GROUPED) {
        const item = grouped(d, kind);
        if (item) delete item.count;
      }
    }],
    ...GROUPED.flatMap((kind): [string, (d: Doc) => void][] => [
      [`${kind} without count`, (d) => delete (grouped(d, kind) ?? { count: 0 }).count],
      [`${kind} with count as text`, (d) => ((grouped(d, kind) ?? {}).count = "2")],
    ]),
  ];
  for (const [name, change] of bad) {
    const doc = clone(document);
    change(doc);
    if (JSON.stringify(doc) === JSON.stringify(document)) continue; // a kind this fixture does not hold
    assert.equal(parseReport(JSON.stringify(doc)), undefined, name);
    assert.match(await cardOf(facts, doc), UNREADABLE, name);
  }
  const good = clone(document);
  good.counts = { delivered: "unknown", proven: 0, needs_you: 12, at_risk: "unknown" };
  totals(good).fix_verdicts_unknown = 4;
  assert.notEqual(parseReport(JSON.stringify(good)), undefined);
});

test("REQ-105 AC8: schemas 1 and 2 stay exactly as they were: the schema 3 fields are refused there", () => {
  const three = schema3("kinds").document;
  const two = clone(three);
  two.schema = 2;
  assert.equal(parseReport(JSON.stringify(two)), undefined, "schema 2 with counts and the other fields");
  const plain2 = clone(JSON.parse(read(resolve(dir2, "kinds.report.json"))));
  assert.notEqual(parseReport(JSON.stringify(plain2)), undefined);
  for (const [name, change] of [
    ["counts", (d: Doc) => (d.counts = three.counts)],
    ["fix_verdicts_unknown", (d: Doc) => (totals(d).fix_verdicts_unknown = 0)],
    ["count on a grouped item", (d: Doc) => (d.sections.at_risk.find((i: Doc) => i.kind === "pull-requests-open-long").count = 2)],
  ] as [string, (d: Doc) => void][]) {
    const doc = clone(plain2);
    change(doc);
    assert.equal(parseReport(JSON.stringify(doc)), undefined, `schema 2 with ${name}`);
  }
});

test("REQ-105 AC5: for schema 3 a tile after the review-rounds tile gives the count of changes without known review rounds, 0 included", async () => {
  const { facts, document } = schema3("kinds");
  assert.deepEqual(tiles(await cardOf(facts, document)).slice(4), [
    "4 changes merged",
    "107.3 hours from opening to merge, in total",
    "0 changes without known hours",
    "2 review rounds in total",
    "0 changes without known review rounds",
    "2 declared as not changing behaviour",
    "estimate: none declared this week",
  ]);
  const busy = schema3("busy");
  assert.deepEqual(tiles(await cardOf(busy.facts, busy.document)).slice(0, 6), ["12 changes merged", "124.3 hours from opening to merge, in total", "0 changes without known hours", "4 review rounds in total", "0 changes without known review rounds", "3 declared as not changing behaviour"]);
});

test("REQ-105 AC5: with review rounds that are not known the count says how many changes lack them, and the singular for one", async () => {
  const { facts, document } = schema3("kinds");
  const doc = clone(document);
  totals(doc).fix_verdicts = "unknown";
  totals(doc).fix_verdicts_unknown = 3;
  assert.deepEqual(tiles(await cardOf(facts, doc)).slice(7, 9), ["review rounds in total: not known yet", "3 changes without known review rounds"]);
  totals(doc).fix_verdicts_unknown = 1;
  assert.equal(tiles(await cardOf(facts, doc))[8], "1 change without known review rounds");
});

test("REQ-105 AC5: for schemas 1 and 2 there is no tile for review rounds that are not known", async () => {
  const two = JSON.parse(read(resolve(dir2, "kinds.report.json")));
  const page = await cardOf(read(resolve(fixtureDir, "kinds.facts.json")), two);
  assert.doesNotMatch(page, /without known review rounds/);
  assert.equal(tiles(page).length, 4 + 6);
});

test("REQ-105 AC5: nothing is computed: the tile places the field, and only its own line changes", async () => {
  const { facts, document } = schema3("kinds");
  const base = (await cardOf(facts, document)).split("\n");
  const changed = clone(document);
  totals(changed).fix_verdicts_unknown = 6;
  const after = (await cardOf(facts, changed)).split("\n");
  assert.equal(after.length, base.length);
  assert.equal(base.filter((l, i) => l !== after[i]).length, 1);
  assert.ok(after.some((l) => l.includes("6 changes without known review rounds")));
});

const FOLD_WORDS: Record<string, string> = {
  "pull-requests-open-long": "have been open.",
  "pull-requests-sent-back": "were sent back.",
  "pull-requests-merged-no-verdict": "were merged without a review.",
  "pull-requests-merged-not-cleared": "were merged before their final review.",
};
function withGroup(document: Doc, kind: string, count: number, n: number): Doc {
  const doc = clone(document);
  const entry = (i: number): Doc => (kind === "pull-requests-open-long" ? { number: 100 + i, days: 3 } : kind === "pull-requests-sent-back" ? { number: 100 + i, times: 2 } : { number: 100 + i });
  const item = { kind, entries: Array.from({ length: n }, (_, i) => entry(i)), count, links: Array.from({ length: n }, (_, i) => ({ to: "pull-request", url: `https://github.com/demo-org/demo-repo/pull/${100 + i}` })) };
  doc.sections.at_risk = [item];
  return doc;
}

test("REQ-108 AC8: a grouped At risk line whose count is above 5 reads the phrase with the data's count and its changes in a details element", async () => {
  const { facts, document } = schema3("kinds");
  for (const kind of GROUPED) {
    const page = await cardOf(facts, withGroup(document, kind, 8, 8));
    const [line] = lis(part(page, "At risk"));
    assert.ok(line !== undefined, kind);
    assert.match(line, /^<span class="badge risk">At risk<\/span> <details class="fold"><summary>8 changes /, kind);
    assert.equal(textOf((/<summary>(.*?)<\/summary>/s.exec(line) as RegExpExecArray)[1] as string), `8 changes ${FOLD_WORDS[kind]}`, kind);
    const inner = line.slice(line.indexOf("</summary>") + 10);
    assert.deepEqual(hrefs(inner), Array.from({ length: 8 }, (_, i) => `https://github.com/demo-org/demo-repo/pull/${100 + i}`), `${kind}: every change is a link in the details`);
    assert.ok(textOf(inner).startsWith("#100"), kind);
  }
  const days = textOf(lis(part(await cardOf(facts, withGroup(document, "pull-requests-open-long", 6, 6)), "At risk"))[0] as string);
  assert.ok(days.includes("#100 (3 days), #101 (3 days)"), days);
  const back = textOf(lis(part(await cardOf(facts, withGroup(document, "pull-requests-sent-back", 6, 6)), "At risk"))[0] as string);
  assert.ok(back.includes("#100 (2 times), #101 (2 times)"), back);
});

test("REQ-108 AC8: a count of 5 or fewer stays as before, and the page uses the data's count and counts nothing", async () => {
  const { facts, document } = schema3("kinds");
  const five = part(await cardOf(facts, withGroup(document, "pull-requests-open-long", 5, 5)), "At risk");
  assert.doesNotMatch(five, /<details/);
  assert.match(textOf(lis(five)[0] as string), /^Changes #100 \(3 days\), #101 \(3 days\), #102 \(3 days\), #103 \(3 days\) and #104 \(3 days\) have been open\.$/);
  const entriesMore = part(await cardOf(facts, withGroup(document, "pull-requests-open-long", 5, 9)), "At risk");
  assert.doesNotMatch(entriesMore, /<details/, "nine entries but the data's count is 5: not folded");
  const countMore = part(await cardOf(facts, withGroup(document, "pull-requests-sent-back", 12, 3)), "At risk");
  assert.match(countMore, /<summary>12 changes were sent back\.<\/summary>/, "three entries but the data's count is 12: folded with 12");
  const one = part(await cardOf(facts, withGroup(document, "pull-requests-merged-no-verdict", 1, 1)), "At risk");
  assert.equal(textOf(lis(one)[0] as string), "A change was merged without a review. (#100)");
});

test("REQ-108 AC8: schemas 1 and 2 are never folded, whatever the entries: they carry no count", async () => {
  const two = JSON.parse(read(resolve(dir2, "kinds.report.json")));
  two.sections.at_risk.find((i: Doc) => i.kind === "pull-requests-open-long").entries = Array.from({ length: 8 }, (_, i) => ({ number: 200 + i, days: 2 }));
  assert.doesNotMatch(part(await cardOf(read(resolve(fixtureDir, "kinds.facts.json")), two), "At risk"), /<details/);
});

test("REQ-105 AC2: open pull requests whose verdicts could not be read are shown by the existing unknown line, with their links, in Needs your decision and in At risk", async () => {
  const { facts, document } = schema3("facts-pr-states");
  const page = await cardOf(facts, document);
  const risk = lis(part(page, "At risk")).filter((l) => l.includes("verdicts of 1 open pull request"));
  assert.equal(risk.length, 1);
  assert.equal(textOf(risk[0] as string), "The verdicts of 1 open pull request could not be read: not known yet. (the item)");
  assert.deepEqual(hrefs(risk[0] as string), ["https://github.com/demo-org/demo-repo/pull/19"]);
  assert.ok(risk[0]?.includes('<span class="badge none">Not known yet</span>'));
  const needs = lis(part(page, "Needs your decision")).filter((l) => l.includes("verdicts of 1 open pull request"));
  assert.equal(needs.length, 1);
  assert.equal(textOf(needs[0] as string), "The verdicts of 1 open pull request could not be read: not known yet. (the item)");
  assert.doesNotMatch(page, /<details/);
});

test("REQ-105 AC2: the schema 3 goldens show every item once for each of the four fixtures", async () => {
  for (const name of ["busy", "facts-ok", "kinds", "facts-pr-states"]) {
    const { facts, document } = schema3(name);
    const page = await cardOf(facts, document);
    const s = document.sections;
    const expected = s.delivered.length + s.proven.length + s.needs_you.reduce((n: number, g: Doc) => n + g.items.length, 0) + s.at_risk.length + s.cost.reduce((n: number, i: Doc) => n + (i.kind === "week-totals" ? 7 : 1), 0);
    assert.equal((page.match(/<li[ >]/g) ?? []).length, expected, `${name}: one line per item, seven tiles for the totals`);
  }
});

test("REQ-105 AC2: the schema 3 golden is what the repository's script writes (kit 0.50.0) for the same facts", () => {
  for (const name of ["busy", "kinds"]) assert.deepEqual(writeReportKit(name).document, schema3(name).document, name);
});

test("REQ-105 AC8: the schema 3 fixtures are the kit's goldens at v0.50.0 and hold no token and no signed address", () => {
  for (const name of ["busy", "facts-ok", "kinds", "facts-pr-states"]) {
    const text = read(resolve(dir3, `${name}.report.json`));
    assert.doesNotMatch(text, /ghu_|ghs_|github_pat_|sig=|token/i, name);
    assert.equal(JSON.parse(text).schema, 3);
  }
  for (const name of ["facts-ok", "facts-pr-states"]) assert.doesNotMatch(read(resolve(dir3, `${name}.facts.json`)), /ghu_|ghs_|github_pat_|sig=/);
});
