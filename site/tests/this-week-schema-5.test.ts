// The report's schema 5 (agk #198, REQ-040 part c1): `pull-request-cost` gains `usage` and `week-totals` gains `usage` and
// `usage_reported`; no other field changes. `usage` is a whole number of tokens, "not-reported" or "unknown"; `usage_reported` is
// a whole number. The reader accepts schemas 1 to 5, each with its own closed list, and a schema above 5 is still said not to
// be read. The page places the data and computes nothing. Markers REQ-105 AC2, AC5 and AC8. Recorded GitHub answers, no network.
// The documents here are schema 4 goldens of agk #184 raised to schema 5 in the test; the goldens of agk #198 are tested in
// the last tests of this file (tests/fixtures/report-schema-5).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { UNKNOWN_SCHEMA_REASON, createGithubClient, factsCard, parseReport, readFacts } from "../src/core/index.ts";
import { fixtureDir } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
const dir5 = resolve(import.meta.dirname, "fixtures", "report-schema-5");
const dir4 = resolve(import.meta.dirname, "fixtures", "report-schema-4");
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));
const read = (path: string): string => readFileSync(path, "utf8");
const link = { label: "pull request", url: "https://github.com/acme/api/pull/7" };

// A schema 5 document: the schema 4 golden with the new fields; one per-change cost item is added before the totals.
function schema5(usage: unknown = 1200, reported = 3, perChange: unknown = 640): { facts: string; document: Doc } {
  const document = JSON.parse(read(resolve(dir4, "busy.report.json")));
  document.schema = 5;
  const cost: Doc[] = document.sections.cost;
  cost[cost.length - 1].usage = usage;
  cost[cost.length - 1].usage_reported = reported;
  const one = { kind: "pull-request-cost", number: 7, title: "Tidy the tests", hours: "3.5", fix_verdicts: 1, usage: perChange, links: [] };
  cost.unshift(one);
  return { facts: read(resolve(fixtureDir, "busy.facts.json")), document };
}
const totals = (doc: Doc): Doc => doc.sections.cost.find((i: Doc) => i.kind === "week-totals");
const change = (doc: Doc): Doc => doc.sections.cost.find((i: Doc) => i.kind === "pull-request-cost");

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
const textOf = (inner: string): string => unescape(inner.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
function tiles(page: string): string[] {
  const at = page.indexOf('<div class="part time">');
  assert.ok(at >= 0, "Time and review is shown");
  const rest = page.slice(at);
  return [...rest.slice(0, rest.indexOf("</ul>")).matchAll(/<li class="tile">(.*?)<\/li>/gs)].map((m) => textOf(m[1] as string));
}
const READABLE = "<h3>This week</h3>";
const UNREADABLE = /not known yet: the report could not be read\./;

test("REQ-105 AC8: the reader accepts schema 5 and still schemas 1 to 4", async () => {
  const { facts, document } = schema5();
  assert.notEqual(parseReport(JSON.stringify(document)), undefined, "schema 5 reads");
  assert.ok((await cardOf(facts, document)).includes(READABLE));
  for (const dir of ["report-schema-2", "report-schema-3", "report-schema-4"]) {
    const old = JSON.parse(read(resolve(import.meta.dirname, "fixtures", dir, "busy.report.json")));
    assert.notEqual(parseReport(JSON.stringify(old)), undefined, `${dir} still reads`);
  }
});

test("REQ-105 AC8: schema 5 is schema 4's closed list plus usage on the two cost kinds and usage_reported on the totals, nothing else", async () => {
  const { facts, document } = schema5();
  const bad: [string, (d: Doc) => void][] = [
    ["the totals usage missing", (d) => delete totals(d).usage],
    ["usage_reported missing", (d) => delete totals(d).usage_reported],
    ["the change usage missing", (d) => delete change(d).usage],
    ["usage as a numeral string", (d) => (totals(d).usage = "12")],
    ["usage as a fraction", (d) => (totals(d).usage = 1.5)],
    ["usage as a negative number", (d) => (totals(d).usage = -1)],
    ["usage as another word", (d) => (totals(d).usage = "none")],
    ["usage not-reported spelled with a space", (d) => (change(d).usage = "not reported")],
    ["usage as null", (d) => (change(d).usage = null)],
    ["usage as a boolean", (d) => (change(d).usage = false)],
    ["usage_reported as the string unknown", (d) => (totals(d).usage_reported = "unknown")],
    ["usage_reported as a fraction", (d) => (totals(d).usage_reported = 0.5)],
    ["usage_reported negative", (d) => (totals(d).usage_reported = -1)],
    ["usage_reported on a change", (d) => (change(d).usage_reported = 1)],
    ["an extra field on the totals", (d) => (totals(d).extra = 1)],
    ["an extra field on a change", (d) => (change(d).extra = 1)],
    ["the schema as text", (d) => (d.schema = "5")],
  ];
  for (const [name, mutate] of bad) {
    const doc = clone(document);
    mutate(doc);
    assert.equal(parseReport(JSON.stringify(doc)), undefined, name);
    assert.match(await cardOf(facts, doc), UNREADABLE, name);
  }
  for (const good of [0, 1, 99, 5_000_000]) {
    const doc = clone(document);
    totals(doc).usage = good;
    totals(doc).usage_reported = good;
    change(doc).usage = good;
    assert.notEqual(parseReport(JSON.stringify(doc)), undefined, `usage ${good}`);
  }
  for (const word of ["not-reported", "unknown"]) {
    const doc = clone(document);
    totals(doc).usage = word;
    change(doc).usage = word;
    assert.notEqual(parseReport(JSON.stringify(doc)), undefined, word);
  }
});

test("REQ-105 AC8: the new fields belong to schema 5 only: schemas 1 to 4 refuse them, and a schema above 5 is said not to be read", async () => {
  const { facts, document } = schema5();
  for (const schema of [1, 2, 3, 4]) {
    const doc = clone(document);
    doc.schema = schema;
    assert.equal(parseReport(JSON.stringify(doc)), undefined, `schema ${schema} with usage`);
  }
  const plain = clone(JSON.parse(read(resolve(dir4, "busy.report.json"))));
  plain.schema = 5;
  assert.equal(parseReport(JSON.stringify(plain)), undefined, "schema 4's content under the number 5 lacks the new fields");
  const six = clone(document);
  six.schema = 7;
  assert.equal(parseReport(JSON.stringify(six)), undefined);
  assert.match(await cardOf(facts, six), new RegExp(`not known yet: ${UNKNOWN_SCHEMA_REASON}\\.`));
});

test("REQ-105 AC5: the totals gain two tiles after the estimate: the usage in tokens and the count of pull requests that reported one", async () => {
  const { facts, document } = schema5();
  assert.deepEqual(tiles(await cardOf(facts, document)).slice(-9, -2), [
    "12 changes merged",
    "124.3 hours from opening to merge, in total",
    "0 changes without known hours",
    "4 review rounds in total",
    "0 changes without known review rounds",
    "3 declared as not changing behaviour",
    "estimate: none declared this week",
  ]);
  const all = tiles(await cardOf(facts, document));
  assert.deepEqual(all.slice(-2), ["usage in total: 1200 tokens", "3 pull requests reported a usage figure"]);
});

test("REQ-105 AC5: usage reads 1 token in the singular, not reported and unknown in words, and never zero for a missing figure", async () => {
  const { facts, document } = schema5();
  const cases: [unknown, string][] = [[1, "usage in total: 1 token"], [0, "usage in total: 0 tokens"], ["not-reported", "usage in total: not reported"], ["unknown", "usage in total: unknown"]];
  for (const [value, line] of cases) {
    const doc = clone(document);
    totals(doc).usage = value;
    assert.equal(tiles(await cardOf(facts, doc)).at(-2), line, String(value));
  }
  for (const [n, line] of [[1, "1 pull request reported a usage figure"], [0, "0 pull requests reported a usage figure"], [2, "2 pull requests reported a usage figure"]] as [number, string][]) {
    const doc = clone(document);
    totals(doc).usage_reported = n;
    assert.equal(tiles(await cardOf(facts, doc)).at(-1), line, String(n));
  }
});

test("REQ-105 AC2: a per-change cost line ends with its usage, in the same words", async () => {
  const { facts, document } = schema5();
  const lines = async (value: unknown): Promise<string> => {
    const doc = clone(document);
    change(doc).usage = value;
    return tiles(await cardOf(facts, doc))[0] as string;
  };
  assert.match(await lines(640), /^A change took 3\.5 hours from opening to merge and 1 review round\. Usage: 640 tokens\./);
  assert.match(await lines(1), /Usage: 1 token\./);
  assert.match(await lines("not-reported"), /Usage: not reported\./);
  assert.match(await lines("unknown"), /Usage: unknown\./);
});

test("REQ-105 AC5: nothing is computed: the totals place their own fields, whatever the changes say, and only their lines change", async () => {
  const { facts, document } = schema5();
  const placed = clone(document);
  totals(placed).usage = 7;
  change(placed).usage = 900;
  totals(placed).usage_reported = 50;
  const t = tiles(await cardOf(facts, placed));
  assert.deepEqual(t.slice(-2), ["usage in total: 7 tokens", "50 pull requests reported a usage figure"]);
  const base = (await cardOf(facts, document)).split("\n");
  const changed = clone(document);
  totals(changed).usage = 4;
  const after = (await cardOf(facts, changed)).split("\n");
  assert.equal(after.length, base.length);
  assert.equal(base.filter((l, i) => l !== after[i]).length, 1, "exactly one line differs");
});

test("REQ-105 AC5: schemas 1 to 4 show no usage tile and no sentence says usage", async () => {
  const old = JSON.parse(read(resolve(dir4, "busy.report.json")));
  const page = await cardOf(read(resolve(fixtureDir, "busy.facts.json")), old);
  assert.doesNotMatch(page, /usage/i);
});

// The goldens of agk #198 at head a34c56f (tests/kit/fixtures/report/golden/{busy,facts-ok,kinds}/report.json), copied unchanged.
const factsOf = (name: string): string => read(name === "facts-ok" ? resolve(import.meta.dirname, "fixtures", "report-schema-3", "facts-ok.facts.json") : resolve(fixtureDir, `${name}.facts.json`));
const golden = (name: string): Doc => JSON.parse(read(resolve(dir5, `${name}.report.json`)));

test("REQ-105 AC8: the goldens of agk #198 (busy, facts-ok, kinds) are schema 5, hold no token and no signed address, and read", async () => {
  for (const name of ["busy", "facts-ok", "kinds"]) {
    const text = read(resolve(dir5, `${name}.report.json`));
    assert.doesNotMatch(text, /ghu_|ghs_|github_pat_|sig=|token/i, name);
    assert.equal(JSON.parse(text).schema, 5, name);
    assert.notEqual(parseReport(text), undefined, `${name}: reads`);
    assert.ok((await cardOf(factsOf(name), golden(name))).includes(READABLE), `${name}: the card shows This week`);
  }
});

test("REQ-105 AC2 and AC5: the goldens place the usage as the data holds it: unknown, not reported, never zero", async () => {
  const busy = tiles(await cardOf(factsOf("busy"), golden("busy")));
  assert.deepEqual(busy.slice(-2), ["usage in total: unknown", "0 pull requests reported a usage figure"]);
  const ok = tiles(await cardOf(factsOf("facts-ok"), golden("facts-ok")));
  assert.deepEqual(ok.slice(-2), ["usage in total: not reported", "0 pull requests reported a usage figure"]);
  assert.match(ok[0] as string, /^A change took 72\.0 hours from opening to merge and 0 review rounds\. Usage: not reported\./);
  const kinds = tiles(await cardOf(factsOf("kinds"), golden("kinds")));
  assert.equal(kinds.filter((t) => /Usage: unknown\./.test(t)).length, 4, "four per-change lines");
  assert.deepEqual(kinds.slice(-2), ["usage in total: unknown", "0 pull requests reported a usage figure"]);
  for (const page of [busy, ok, kinds]) assert.ok(page.every((t) => !/usage.*\b0 tokens/.test(t)));
});
