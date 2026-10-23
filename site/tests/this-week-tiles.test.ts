// The totals line of Time and review as five tiles (SPEC-0005 rule 10 as amended by Amendment 8): the item of kind
// week-totals is shown as five fixed phrases over its own five fields, in the data's order, with the link of the week once
// after them; the per-change lines stay as they were; nothing is computed. The data is this repository's own
// scripts/agk/product_report.py --json on the kit's fixtures; recorded GitHub answers and archives in memory, no network.
// Markers REQ-105 AC2, AC3, AC5 and AC7 (the Time and review part).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createGithubClient, factsCard, readFacts } from "../src/core/index.ts";
import { writeReport } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));

async function html(fixture: string, change?: (report: Doc) => void): Promise<string> {
  const written = writeReport(fixture);
  const report = clone(written.document);
  change?.(report);
  const artifacts = { total_count: 1, artifacts: [{ id: 777, name: `agk-facts-${report.week}`, expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] };
  const bytes = zip([{ name: "facts.json", data: written.facts }, { name: "report.json", data: JSON.stringify(report) }]);
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
const hrefs = (inner: string): string[] => [...inner.matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1] as string));
// The Time and review part: its list and what follows the list.
function time(page: string): { tiles: string[]; after: string } {
  const at = page.indexOf('<div class="part time">');
  assert.ok(at >= 0, "the part is shown");
  const rest = page.slice(at);
  const end = rest.indexOf("</ul>");
  return { tiles: [...rest.slice(0, end).matchAll(/<li class="tile">(.*?)<\/li>/gs)].map((m) => m[1] as string), after: rest.slice(end, rest.indexOf("</div>", end)) };
}
const WEEK = "https://github.com/demo-org/demo-repo/pulls?q=is%3Apr+is%3Amerged+merged%3A2026-10-05..2026-10-11";

test("REQ-105 AC2: the totals are five tiles, each a fixed phrase over one field of the item, in this order, and the sentence is gone", async () => {
  const page = await html("kinds");
  const { tiles } = time(page);
  assert.deepEqual(tiles.map(textOf), [
    "A change took 48.0 hours from opening to merge and 0 review rounds. (#5)",
    "A change took 49.3 hours from opening to merge and 2 review rounds. (#6)",
    "A change took 10.0 hours from opening to merge and 0 review rounds. (#7)",
    "A change took 0.0 hours from opening to merge and 0 review rounds. (#8)",
    "4 changes merged",
    "107.3 hours from opening to merge, in total",
    "2 review rounds in total",
    "2 declared as not changing behaviour",
    "estimate: none declared this week",
  ]);
  assert.doesNotMatch(page, /This week: \d|time from opening to merge:/);
});

test("REQ-105 AC2: the link of the week stays once, after the tiles, and the tiles themselves hold no link", async () => {
  const page = await html("kinds");
  const { tiles, after } = time(page);
  assert.deepEqual(tiles.slice(4).flatMap(hrefs), []);
  assert.match(after, /<p class="week">\(<a href="[^"]+">the week<\/a>\)<\/p>/);
  assert.deepEqual(hrefs(after), [WEEK]);
  assert.match(textOf(after), /^\(the week\)$/);
  const bare = await html("kinds", (r) => {
    r.sections.cost[4].links = [];
  });
  assert.doesNotMatch(time(bare).after, /the week/);
  assert.equal(time(bare).tiles.length, 9, "the tiles stay without the link");
});

test("REQ-105 AC7: a busy week shows only the five tiles of the totals and their link", async () => {
  const page = await html("busy");
  const { tiles, after } = time(page);
  assert.deepEqual(tiles.map(textOf), ["12 changes merged", "124.3 hours from opening to merge, in total", "4 review rounds in total", "3 declared as not changing behaviour", "estimate: none declared this week"]);
  assert.deepEqual(hrefs(after), [WEEK]);
});

test("REQ-105 AC2: the per-change cost lines are exactly as before: the same sentence and the same links, one tile each", async () => {
  const page = await html("kinds");
  const { tiles } = time(page);
  assert.deepEqual(tiles.slice(0, 4).map(hrefs), [5, 6, 7, 8].map((n) => [`https://github.com/demo-org/demo-repo/pull/${n}`]));
  assert.equal(tiles[0], 'A change took 48.0 hours from opening to merge and 0 review rounds. (<a href="https://github.com/demo-org/demo-repo/pull/5">#5</a>)');
});

test("REQ-105 AC5: an unknown value reads not known yet in its tile, never a number or zero, and the estimate keeps its wording", async () => {
  const page = await html("kinds", (r) => {
    const totals = r.sections.cost[4];
    totals.hours = "unknown";
    totals.fix_verdicts = "unknown";
    totals.estimate = { within: 1, counted: 2 };
  });
  assert.deepEqual(time(page).tiles.slice(4).map(textOf), [
    "4 changes merged",
    "hours from opening to merge, in total: not known yet",
    "review rounds in total: not known yet",
    "2 declared as not changing behaviour",
    "estimate: 1 of 2 within range",
  ]);
  assert.doesNotMatch(time(page).tiles.slice(4).map(textOf).join(" "), /\b0 hours|unknown|NaN/);
});

test("REQ-105 AC5: the numbers are the item's fields, placed and not derived: the hours as the data's string, the counts as the data's integers, the singular for one", async () => {
  const page = await html("kinds", (r) => {
    const totals = r.sections.cost[4];
    totals.hours = "999.9";
    totals.merged = 1;
    totals.fix_verdicts = 1;
    totals.behaviour_unchanged = 7;
    r.sections.cost[0].hours = "1.0";
  });
  assert.deepEqual(time(page).tiles.slice(4).map(textOf), ["1 change merged", "999.9 hours from opening to merge, in total", "1 review round in total", "7 declared as not changing behaviour", "estimate: none declared this week"]);
  const many = await html("kinds", (r) => {
    r.sections.cost[4].merged = 40;
    r.sections.cost[4].fix_verdicts = 0;
  });
  assert.deepEqual(time(many).tiles.slice(4, 7).map(textOf), ["40 changes merged", "107.3 hours from opening to merge, in total", "0 review rounds in total"]);
});

test("REQ-105 AC3: a changed number changes only its own tile", async () => {
  const base = (await html("kinds")).split("\n");
  for (const [field, value] of [["merged", 9], ["hours", "5.5"], ["fix_verdicts", 6], ["behaviour_unchanged", 3]] as [string, unknown][]) {
    const changed = (await html("kinds", (r) => {
      r.sections.cost[4][field] = value;
    })).split("\n");
    assert.equal(changed.length, base.length, field);
    assert.equal(base.filter((l, i) => l !== changed[i]).length, 1, `${field}: exactly one line differs`);
  }
});

test("REQ-105 AC2: an item of kind unknown in the cost list is still one line in a tile, and an empty list says Nothing this week", async () => {
  const page = await html("kinds", (r) => {
    r.sections.cost = [{ kind: "unknown", what: "pull requests", links: [] }];
  });
  assert.deepEqual(time(page).tiles.map(textOf), ["Pull requests could not be read: not known yet."]);
  const none = await html("kinds", (r) => {
    r.sections.cost = [];
  });
  assert.match(none, /<div class="part time">\s*<h4>Time and review<\/h4>\s*<p>Nothing this week\.<\/p>/);
});
