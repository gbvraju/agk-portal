// The report's schema 2 (agk SPEC-0024, kit 0.43.0): the week-totals item gains hours_unknown, an integer always present.
// The reader accepts schema 1 and schema 2, each with its own closed field list; for schema 2 Time and review gains a sixth
// tile, "{hours_unknown} changes without known hours", placed from the field and never computed. The schema 2 documents are
// the kit's own goldens at v0.43.0 (tests/fixtures/report-schema-2); the schema 1 documents are written by this
// repository's scripts/agk/product_report.py. Markers REQ-105 AC2, AC5 and AC8. Recorded GitHub answers, no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { createGithubClient, factsCard, parseReport, readFacts } from "../src/core/index.ts";
import { fixtureDir, writeReport } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
const schema2Dir = resolve(import.meta.dirname, "fixtures", "report-schema-2");
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));

// A schema 2 fixture: the kit's golden report.json and the facts document it was made from.
function schema2(name: string): { facts: string; document: Doc } {
  const facts = name === "facts-ok" ? readFileSync(resolve(schema2Dir, "facts-ok.facts.json"), "utf8") : readFileSync(resolve(fixtureDir, `${name}.facts.json`), "utf8");
  return { facts, document: JSON.parse(readFileSync(resolve(schema2Dir, `${name}.report.json`), "utf8")) };
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
const textOf = (inner: string): string => unescape(inner.replace(/<[^>]*>/g, "")).trim();
// The tiles of Time and review, as text.
function tiles(page: string): string[] {
  const at = page.indexOf('<div class="part time">');
  assert.ok(at >= 0, "Time and review is shown");
  const rest = page.slice(at);
  return [...rest.slice(0, rest.indexOf("</ul>")).matchAll(/<li class="tile">(.*?)<\/li>/gs)].map((m) => textOf(m[1] as string));
}
const totals = (doc: Doc): Doc => doc.sections.cost.find((i: Doc) => i.kind === "week-totals");
const READABLE = "<h3>This week</h3>";
const UNREADABLE = /not known yet: the report could not be read\./;

test("REQ-105 AC8: the reader accepts schema 2 (the kit's goldens: busy, facts-ok, kinds) and schema 1 (this repository's script)", async () => {
  for (const name of ["busy", "facts-ok", "kinds"]) {
    const { facts, document } = schema2(name);
    assert.equal(document.schema, 2, name);
    assert.notEqual(parseReport(JSON.stringify(document)), undefined, `${name}: schema 2 reads`);
    assert.ok((await cardOf(facts, document)).includes(READABLE), `${name}: the card shows This week`);
  }
  for (const name of ["busy", "kinds", "quiet", "dirty-unknown", "empty"]) {
    const written = writeReport(name);
    assert.equal(written.document.schema, 1, name);
    assert.ok((await cardOf(written.facts, written.document)).includes(READABLE), `${name}: schema 1 still reads`);
  }
});

test("REQ-105 AC2: the schema 1 form of the repository's script's report is the schema 2 golden without the number 2 and hours_unknown", () => {
  for (const name of ["busy", "kinds"]) {
    const two = clone(schema2(name).document);
    const one = writeReport(name).document;
    delete totals(two).hours_unknown;
    two.schema = 1;
    assert.deepEqual(two, one, name);
  }
});

test("REQ-105 AC8: schema 2 needs hours_unknown on the week-totals item, an integer from 0, and nothing else is added", async () => {
  const { facts, document } = schema2("kinds");
  const bad: [string, (d: Doc) => void][] = [
    ["the field missing", (d) => delete totals(d).hours_unknown],
    ["the string unknown", (d) => (totals(d).hours_unknown = "unknown")],
    ["a numeral string", (d) => (totals(d).hours_unknown = "3")],
    ["null", (d) => (totals(d).hours_unknown = null)],
    ["a fraction", (d) => (totals(d).hours_unknown = 1.5)],
    ["a negative number", (d) => (totals(d).hours_unknown = -1)],
    ["a boolean", (d) => (totals(d).hours_unknown = false)],
    ["a list", (d) => (totals(d).hours_unknown = [0])],
    ["an extra field on the totals", (d) => (totals(d).extra = 1)],
    ["the field on a per-change cost item", (d) => (d.sections.cost[0].hours_unknown = 0)],
    ["the schema 3", (d) => (d.schema = 3)],
    ["the schema as text", (d) => (d.schema = "2")],
    ["the schema missing", (d) => delete d.schema],
    ["schema 2 with a schema 1 totals item (no field)", (d) => delete totals(d).hours_unknown],
  ];
  for (const [name, change] of bad) {
    const doc = clone(document);
    change(doc);
    assert.equal(parseReport(JSON.stringify(doc)), undefined, name);
    assert.match(await cardOf(facts, doc), UNREADABLE, name);
  }
  for (const good of [0, 1, 12, 400]) {
    const doc = clone(document);
    totals(doc).hours_unknown = good;
    assert.notEqual(parseReport(JSON.stringify(doc)), undefined, `hours_unknown ${good}`);
  }
});

test("REQ-105 AC8: schema 1 stays exactly as it was: a schema 1 document with hours_unknown is refused", async () => {
  const { facts, document } = schema2("kinds");
  const doc = clone(document);
  doc.schema = 1;
  assert.equal(parseReport(JSON.stringify(doc)), undefined);
  assert.match(await cardOf(facts, doc), UNREADABLE);
  const written = writeReport("kinds");
  const plain = clone(written.document);
  assert.notEqual(parseReport(JSON.stringify(plain)), undefined, "schema 1 without the field is read");
  totals(plain).hours_unknown = 0;
  assert.equal(parseReport(JSON.stringify(plain)), undefined, "schema 1 with the field is not");
});

test("REQ-105 AC5: for schema 2 Time and review has a sixth tile after the hours tile, the count of changes without known hours, 0 included", async () => {
  const { facts, document } = schema2("kinds");
  assert.deepEqual(tiles(await cardOf(facts, document)).slice(4), [
    "4 changes merged",
    "107.3 hours from opening to merge, in total",
    "0 changes without known hours",
    "2 review rounds in total",
    "2 declared as not changing behaviour",
    "estimate: none declared this week",
  ]);
  const busy = schema2("busy");
  assert.deepEqual(tiles(await cardOf(busy.facts, busy.document)), [
    "12 changes merged",
    "124.3 hours from opening to merge, in total",
    "0 changes without known hours",
    "4 review rounds in total",
    "3 declared as not changing behaviour",
    "estimate: none declared this week",
  ]);
  const ok = schema2("facts-ok");
  assert.deepEqual(tiles(await cardOf(ok.facts, ok.document)).slice(-6), [
    "1 change merged",
    "72.0 hours from opening to merge, in total",
    "0 changes without known hours",
    "0 review rounds in total",
    "0 declared as not changing behaviour",
    "estimate: 1 of 1 within range",
  ]);
});

test("REQ-105 AC5: with hours that are not known the count says how many changes lack them, and the singular for one", async () => {
  const { facts, document } = schema2("kinds");
  const doc = clone(document);
  totals(doc).hours = "unknown";
  totals(doc).hours_unknown = 3;
  assert.deepEqual(tiles(await cardOf(facts, doc)).slice(4, 7), ["4 changes merged", "hours from opening to merge, in total: not known yet", "3 changes without known hours"]);
  totals(doc).hours_unknown = 1;
  assert.equal(tiles(await cardOf(facts, doc))[6], "1 change without known hours");
  totals(doc).hours_unknown = 0;
  assert.equal(tiles(await cardOf(facts, doc))[6], "0 changes without known hours");
});

test("REQ-105 AC5: for schema 1 there is no sixth tile, and no sentence says changes without known hours", async () => {
  const written = writeReport("kinds");
  const page = await cardOf(written.facts, written.document);
  assert.equal(tiles(page).length, 9);
  assert.doesNotMatch(page, /without known hours/);
  assert.deepEqual(tiles(page).slice(4), ["4 changes merged", "107.3 hours from opening to merge, in total", "2 review rounds in total", "2 declared as not changing behaviour", "estimate: none declared this week"]);
});

test("REQ-105 AC5: nothing is computed: the tile places the field, whatever the other numbers are, and only its own line changes", async () => {
  const { facts, document } = schema2("kinds");
  const placed = clone(document);
  totals(placed).merged = 9;
  totals(placed).hours_unknown = 20;
  assert.equal(tiles(await cardOf(facts, placed))[6], "20 changes without known hours", "not checked against merged, not derived from it");
  const base = (await cardOf(facts, document)).split("\n");
  const changed = clone(document);
  totals(changed).hours_unknown = 6;
  const after = (await cardOf(facts, changed)).split("\n");
  assert.equal(after.length, base.length);
  assert.equal(base.filter((l, i) => l !== after[i]).length, 1, "exactly one line differs");
  assert.ok(after.some((l) => l.includes("6 changes without known hours")));
});

test("REQ-105 AC8: the fixtures are the kit's goldens at v0.43.0, schema 2, and hold no token and no signed address", () => {
  for (const name of ["busy", "facts-ok", "kinds"]) {
    const text = readFileSync(resolve(schema2Dir, `${name}.report.json`), "utf8");
    assert.doesNotMatch(text, /ghu_|ghs_|github_pat_|sig=|token/i, name);
    assert.equal(JSON.parse(text).schema, 2);
  }
  assert.doesNotMatch(readFileSync(resolve(schema2Dir, "facts-ok.facts.json"), "utf8"), /ghu_|ghs_|github_pat_|sig=/);
});
