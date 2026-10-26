// The report's schema 7 (agk #228, REQ-042 build c): the item `week-totals` of `cost` gains one required field, `shadow`: the
// string "not-running" or "unknown", or an object with `week` and `total` (each exactly the eight counts heads,
// right_conductor_only, right_shadow_only, right_both, wrong_conductor, wrong_shadow, unmarked_heads and unmarked_findings, and
// `catch_rate`, "none" or "R/T (P%)"), `unpaired` and `unread`; nothing else changes. The reader accepts schemas 1 to 7, each
// with its own closed list, and a schema above 7 is still said not to be read. The page places the data and computes nothing.
// The goldens are those of agk #228 at 362bf06 (cleared at d8fafc6, unchanged between the two), copied unchanged into
// tests/fixtures/report-schema-7. Markers REQ-105 AC2, AC5 and AC8. No network.
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
const dir6 = resolve(import.meta.dirname, "fixtures", "report-schema-6");
const dir7 = resolve(import.meta.dirname, "fixtures", "report-schema-7");
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));
const read = (path: string): string => readFileSync(path, "utf8");
const counts = (heads: number, rate: string): Doc => ({ heads, right_conductor_only: 3, right_shadow_only: 1, right_both: 2, wrong_conductor: 1, wrong_shadow: 2, unmarked_heads: 1, unmarked_findings: 0, catch_rate: rate });
const SHADOW = { week: counts(4, "5/6 (83.3%)"), total: counts(9, "11/14 (78.6%)"), unpaired: 2, unread: 1 };
const totals = (doc: Doc): Doc => doc.sections.cost.find((i: Doc) => i.kind === "week-totals");

// A schema 7 document: the schema 6 golden raised, with the shadow field.
function schema7(shadow: unknown = SHADOW): { facts: string; document: Doc } {
  const document = JSON.parse(read(resolve(dir6, "busy.report.json")));
  document.schema = 7;
  totals(document).shadow = clone(shadow);
  return { facts: read(resolve(fixtureDir, "busy.facts.json")), document };
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
const textOf = (inner: string): string => unescape(inner.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
function tiles(page: string): string[] {
  const at = page.indexOf('<div class="part time">');
  assert.ok(at >= 0, "Time and review is shown");
  const rest = page.slice(at);
  return [...rest.slice(0, rest.indexOf("</ul>")).matchAll(/<li class="tile">(.*?)<\/li>/gs)].map((m) => textOf(m[1] as string));
}
const READABLE = "<h3>This week</h3>";
const UNREADABLE = /not known yet: the report could not be read\./;

test("REQ-105 AC8: the reader accepts schema 7 and still schemas 1 to 6", async () => {
  const { facts, document } = schema7();
  assert.notEqual(parseReport(JSON.stringify(document)), undefined, "schema 7 reads");
  assert.ok((await cardOf(facts, document)).includes(READABLE));
  for (const dir of ["report-schema-2", "report-schema-3", "report-schema-4", "report-schema-5", "report-schema-6"]) {
    const old = JSON.parse(read(resolve(import.meta.dirname, "fixtures", dir, "busy.report.json")));
    assert.notEqual(parseReport(JSON.stringify(old)), undefined, `${dir} still reads`);
  }
});

test("REQ-105 AC8: schema 7 is schema 6's closed list plus shadow on the totals, and nothing else", async () => {
  const { facts, document } = schema7();
  const bad: [string, (d: Doc) => void][] = [
    ["shadow missing", (d) => delete totals(d).shadow],
    ["shadow as another word", (d) => (totals(d).shadow = "off")],
    ["shadow as null", (d) => (totals(d).shadow = null)],
    ["shadow as a number", (d) => (totals(d).shadow = 0)],
    ["shadow as a list", (d) => (totals(d).shadow = [])],
    ["the week missing", (d) => delete totals(d).shadow.week],
    ["the total missing", (d) => delete totals(d).shadow.total],
    ["unpaired missing", (d) => delete totals(d).shadow.unpaired],
    ["unread missing", (d) => delete totals(d).shadow.unread],
    ["unpaired as text", (d) => (totals(d).shadow.unpaired = "2")],
    ["unread as a fraction", (d) => (totals(d).shadow.unread = 1.5)],
    ["an extra key on shadow", (d) => (totals(d).shadow.extra = 1)],
    ["an extra key on the week", (d) => (totals(d).shadow.week.extra = 1)],
    ["a count missing on the week", (d) => delete totals(d).shadow.week.unmarked_findings],
    ["a count missing on the total", (d) => delete totals(d).shadow.total.right_both],
    ["a count as text", (d) => (totals(d).shadow.week.heads = "4")],
    ["a count as a fraction", (d) => (totals(d).shadow.total.wrong_shadow = 0.5)],
    ["a count as unknown", (d) => (totals(d).shadow.week.right_both = "unknown")],
    ["a negative count", (d) => (totals(d).shadow.week.heads = -1)],
    ["a catch rate missing", (d) => delete totals(d).shadow.week.catch_rate],
    ["a catch rate as a number", (d) => (totals(d).shadow.week.catch_rate = 0)],
    ["a catch rate of 0", (d) => (totals(d).shadow.week.catch_rate = "0")],
    ["a catch rate without the percent", (d) => (totals(d).shadow.total.catch_rate = "5/6")],
    ["a catch rate with two decimals", (d) => (totals(d).shadow.total.catch_rate = "5/6 (83.33%)")],
    ["a catch rate with a trailing word", (d) => (totals(d).shadow.total.catch_rate = "none yet")],
    ["a catch rate as unknown", (d) => (totals(d).shadow.week.catch_rate = "unknown")],
    ["shadow on a per-change item", (d) => d.sections.cost.unshift({ kind: "pull-request-cost", number: 7, title: "t", hours: "1.0", fix_verdicts: 0, usage: 1, shadow: "unknown", links: [] })],
    ["the schema as text", (d) => (d.schema = "7")],
  ];
  for (const [name, mutate] of bad) {
    const doc = clone(document);
    mutate(doc);
    assert.equal(parseReport(JSON.stringify(doc)), undefined, name);
    assert.match(await cardOf(facts, doc), UNREADABLE, name);
  }
  for (const word of ["not-running", "unknown"]) {
    const doc = clone(document);
    totals(doc).shadow = word;
    assert.notEqual(parseReport(JSON.stringify(doc)), undefined, word);
  }
  for (const rate of ["none", "0/1 (0.0%)", "14/14 (100.0%)"]) {
    const doc = clone(document);
    totals(doc).shadow.week.catch_rate = rate;
    assert.notEqual(parseReport(JSON.stringify(doc)), undefined, rate);
  }
  const zero = clone(document);
  for (const side of ["week", "total"]) for (const key of Object.keys(totals(zero).shadow[side])) if (key !== "catch_rate") totals(zero).shadow[side][key] = 0;
  assert.notEqual(parseReport(JSON.stringify(zero)), undefined, "all counts 0");
});

test("REQ-105 AC8: shadow belongs to schema 7 only: schemas 1 to 6 refuse it, schema 7 refuses its absence, and a schema above 7 is not read", async () => {
  const { facts, document } = schema7();
  for (const schema of [1, 2, 3, 4, 5, 6]) {
    const doc = clone(document);
    doc.schema = schema;
    assert.equal(parseReport(JSON.stringify(doc)), undefined, `schema ${schema} with shadow`);
  }
  const plain = JSON.parse(read(resolve(dir6, "busy.report.json")));
  plain.schema = 7;
  assert.equal(parseReport(JSON.stringify(plain)), undefined, "schema 6's content under the number 7 lacks shadow");
  const eight = clone(document);
  eight.schema = 8;
  assert.equal(parseReport(JSON.stringify(eight)), undefined);
  assert.match(await cardOf(facts, eight), new RegExp(`not known yet: ${UNKNOWN_SCHEMA_REASON}\\.`));
});

test("REQ-105 AC5: the totals end with two catch-rate tiles, the week's and the total's, from the data's own words", async () => {
  const { facts, document } = schema7();
  const t = tiles(await cardOf(facts, document));
  assert.deepEqual(t.slice(-2), ["Conductor catch rate this week: 5/6 (83.3%) (4 changes reviewed twice)", "Conductor catch rate in total: 11/14 (78.6%) (9 changes reviewed twice)"]);
  assert.ok(t.some((x) => /^usage in total:/.test(x)), "the usage tiles stay before them");
  assert.ok(!t.some((x) => /unpaired|unread/i.test(x)), "unpaired and unread are not shown");
});

test("REQ-105 AC5: none is shown as written, never as 0; one change is singular; 0 changes is shown", async () => {
  const { facts, document } = schema7();
  const doc = clone(document);
  totals(doc).shadow.week = counts(1, "none");
  totals(doc).shadow.total = counts(0, "none");
  assert.deepEqual(tiles(await cardOf(facts, doc)).slice(-2), ["Conductor catch rate this week: none (1 change reviewed twice)", "Conductor catch rate in total: none (0 changes reviewed twice)"]);
});

test("REQ-105 AC5: not-running reads Second review: not running and unknown reads Second review: not known yet, one tile each", async () => {
  const { facts } = schema7();
  for (const [word, line] of [["not-running", "Second review: not running"], ["unknown", "Second review: not known yet"]] as const) {
    const t = tiles(await cardOf(facts, schema7(word).document));
    assert.equal(t.at(-1), line, word);
    assert.ok(!t.some((x) => /catch rate/.test(x)), word);
  }
});

test("REQ-105 AC5: nothing is computed: the tiles place the data's catch rate and heads, and only their own lines change", async () => {
  const { facts, document } = schema7();
  const placed = clone(document);
  totals(placed).shadow.week = counts(7, "99/100 (99.0%)");
  assert.equal(tiles(await cardOf(facts, placed)).at(-2), "Conductor catch rate this week: 99/100 (99.0%) (7 changes reviewed twice)", "not checked against the other counts");
  const base = (await cardOf(facts, document)).split("\n");
  const changed = clone(document);
  totals(changed).shadow.total.heads = 10;
  const after = (await cardOf(facts, changed)).split("\n");
  assert.equal(after.length, base.length);
  assert.equal(base.filter((l, i) => l !== after[i]).length, 1, "exactly one line differs");
});

test("REQ-105 AC5: schemas 1 to 6 show no catch-rate tile and no sentence says second review", async () => {
  for (const dir of ["report-schema-5", "report-schema-6"]) {
    const old = JSON.parse(read(resolve(import.meta.dirname, "fixtures", dir, "busy.report.json")));
    assert.doesNotMatch(await cardOf(read(resolve(fixtureDir, "busy.facts.json")), old), /catch rate|Second review/);
  }
});

const factsOf = (name: string): string => read(name === "facts-ok" ? resolve(import.meta.dirname, "fixtures", "report-schema-3", "facts-ok.facts.json") : resolve(fixtureDir, `${name}.facts.json`));
const golden = (name: string): Doc => JSON.parse(read(resolve(dir7, `${name}.report.json`)));

test("REQ-105 AC8: the goldens of agk #228 (busy, facts-ok, kinds) are schema 7, hold no token and no signed address, and read", async () => {
  for (const name of ["busy", "facts-ok", "kinds"]) {
    const text = read(resolve(dir7, `${name}.report.json`));
    assert.doesNotMatch(text, /ghu_|ghs_|github_pat_|sig=|token/i, name);
    assert.equal(JSON.parse(text).schema, 7, name);
    assert.notEqual(parseReport(text), undefined, `${name}: reads`);
    assert.ok((await cardOf(factsOf(name), golden(name))).includes(READABLE), `${name}: the card shows This week`);
  }
});

test("REQ-105 AC5: the goldens place the shadow review as the data holds it", async () => {
  const busy = tiles(await cardOf(factsOf("busy"), golden("busy")));
  const s = totals(golden("busy")).shadow;
  assert.deepEqual(busy.slice(-2), [`Conductor catch rate this week: ${s.week.catch_rate} (${s.week.heads} changes reviewed twice)`, `Conductor catch rate in total: ${s.total.catch_rate} (${s.total.heads} changes reviewed twice)`]);
  assert.equal(tiles(await cardOf(factsOf("facts-ok"), golden("facts-ok"))).at(-1), "Second review: not running");
  assert.equal(tiles(await cardOf(factsOf("kinds"), golden("kinds"))).at(-1), "Second review: not known yet");
});
