// The This week section, second part: Delivered and Time and review (SPEC-0005 rules 2, 3, 7, 8, 9 and 10, as amended).
// Both are rendered from the sections `delivered` and `cost` of the report's data, in the data's order, with the fixed
// phrases; the page computes no sum, no count and no date. The data is what this repository's own
// scripts/agk/product_report.py --json writes from the kit's fixture facts documents. Markers REQ-105 AC1, AC2, AC4, AC5
// and AC7. Recorded GitHub answers and archives in memory, no network.
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

async function html(fixture: string, change?: (report: Doc) => void): Promise<{ html: string; document: Doc }> {
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
  return { html: factsCard("acme/api", await readFacts(github, TOKEN, "acme/api", START)), document: report };
}

const unescape = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const textOf = (inner: string): string => unescape(inner.replace(/<[^>]*>/g, ""));

// The part of the page under a heading: its items (inner HTML) or the empty phrase.
function part(page: string, title: string): { items: string[]; empty: boolean } | undefined {
  const at = page.indexOf(`<h4>${title}</h4>`);
  if (at < 0) return undefined;
  const rest = page.slice(at + `<h4>${title}</h4>`.length);
  const end = rest.search(/<h4>|<\/section>/);
  const body = end < 0 ? rest : rest.slice(0, end);
  const items = [...body.matchAll(/<li[^>]*>(?:<span class="badge [a-z]+">[^<]*<\/span> )?(.*?)<\/li>/gs)].map((m) => m[1] as string);
  return { items, empty: /<p>Nothing this week\.<\/p>/.test(body) && items.length === 0 };
}
const hrefs = (inner: string): string[] => [...inner.matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1] as string));

const FIXTURES = ["kinds", "busy", "quiet", "dirty-unknown", "empty"];

test("REQ-105 AC1: Delivered and Time and review follow the opening and the notices, in that order, with the other parts between them", async () => {
  const { html: page } = await html("kinds");
  const at = (s: string): number => page.indexOf(s);
  assert.ok(at("Week 2026-W41:") < at("<h4>Delivered</h4>") && at("<h4>Delivered</h4>") < at("<h4>Time and review</h4>"));
  assert.equal((page.match(/<h4>/g) ?? []).length, 5);
});

test("REQ-105 AC2: every item of Delivered and of Time and review appears once, in the data's order, with its identifier, number, date, hours and link, for each fixture", async () => {
  for (const name of FIXTURES) {
    const { html: page, document } = await html(name);
    const delivered = part(page, "Delivered");
    const cost = part(page, "Time and review");
    assert.ok(delivered && cost, name);
    const dataDelivered = document.sections.delivered;
    const dataCost = document.sections.cost;
    assert.equal(delivered.items.length, dataDelivered.length, `${name}: one line per item`);
    assert.equal(cost.items.length, dataCost.reduce((n: number, item: Doc) => n + (item.kind === "week-totals" ? 5 : 1), 0), `${name}: one line per item, five tiles for the totals`);
    dataDelivered.forEach((item: Doc, i: number) => {
      const line = delivered.items[i] as string;
      const text = textOf(line);
      assert.deepEqual(hrefs(line), item.links.map((l: Doc) => l.url), `${name} #${i} the links`);
      if (item.kind === "requirement-done") assert.ok(text.includes(`(${item.id})`) && text.includes(`“${item.title}”`), `${name} #${i}: ${text}`);
      if (item.kind === "pull-request-merged") assert.ok(text.includes(item.merged_on) && text.endsWith(`(#${item.number})`), `${name} #${i}: ${text}`);
      if (item.kind === "pull-requests-merged") assert.ok(text.startsWith(`${item.count} changes were merged this week.`), `${name} #${i}: ${text}`);
    });
    let k = 0;
    dataCost.forEach((item: Doc, i: number) => {
      if (item.kind === "week-totals") {
        const tiles = cost.items.slice(k, k + 5).map(textOf);
        assert.ok(tiles[0]?.startsWith(`${item.merged} change`) && tiles[1]?.includes(`${item.hours} hours`), `${name} #${i}: ${tiles.join(" | ")}`);
        assert.deepEqual(hrefs(page.slice(page.indexOf("</ul>", page.indexOf("<h4>Time and review</h4>")))), item.links.map((l: Doc) => l.url), `${name} #${i} the link after the tiles`);
        k += 5;
        return;
      }
      const line = cost.items[k] as string;
      const text = textOf(line);
      assert.deepEqual(hrefs(line), item.links.map((l: Doc) => l.url), `${name} #${i} the links`);
      if (item.kind === "pull-request-cost") assert.ok(text.includes(`${item.hours} hours`) && text.endsWith(`(#${item.number})`), `${name} #${i}: ${text}`);
      k += 1;
    });
  }
});

test("REQ-105 AC2: the lines of the kinds fixture are the fixed phrases of SPEC-0005 rule 10, exactly", async () => {
  const { html: page } = await html("kinds");
  const delivered = (part(page, "Delivered")?.items ?? []).map(textOf);
  assert.deepEqual(delivered, [
    "“Alpha thing” is done: 2 acceptance criteria (AC1, AC2). (week it became done: not known yet) (REQ-001)",
    "“Beta thing” is done: 2 acceptance criteria (AC1, AC2). (week it became done: not known yet) (REQ-002)",
    "“Epsilon thing” is done: no acceptance criteria are listed. (week it became done: not known yet) (REQ-005)",
    "“Zeta thing” is done: its acceptance criteria are not known yet. (week it became done: not known yet) (REQ-006)",
    "“Iota thing” is done: 1 acceptance criterion (AC1). (week it became done: not known yet) (REQ-009)",
    "A change was merged on 2026-10-08. (#5)",
    "A change was merged on 2026-10-09. (#6)",
    "A change was merged on 2026-10-10. (#7)",
    "A change was merged on 2026-10-07. (#8)",
  ]);
  const cost = (part(page, "Time and review")?.items ?? []).map(textOf);
  assert.deepEqual(cost, [
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
  assert.ok(!/Change number|Alpha thing\b.*Alpha/.test(page.replace(/“Alpha thing”/g, "")), "no pull request title is shown");
});

test("REQ-105 AC2: a requirement that became done this week has no note, and the references are links to the item's own address", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.delivered[0].became_done = "this-week";
  });
  const first = (part(page, "Delivered")?.items ?? [])[0] as string;
  assert.equal(textOf(first), "“Alpha thing” is done: 2 acceptance criteria (AC1, AC2). (REQ-001)");
  assert.equal(first, '“Alpha thing” is done: 2 acceptance criteria (AC1, AC2). (<a href="https://github.com/demo-org/demo-repo/blob/c0ffee0000000000000000000000000000000000/docs/requirements.md#L3">REQ-001</a>)');
  const second = (part(page, "Delivered")?.items ?? [])[5] as string;
  assert.equal(second, 'A change was merged on 2026-10-08. (<a href="https://github.com/demo-org/demo-repo/pull/5">#5</a>)');
});

test("REQ-105 AC7: a busy week shows the one summary line with the week link and the totals, and no line per change", async () => {
  const { html: page, document } = await html("busy");
  const delivered = part(page, "Delivered")?.items ?? [];
  const summary = delivered.filter((l) => textOf(l).includes("changes were merged this week."));
  assert.equal(summary.length, 1);
  assert.equal(textOf(summary[0] as string), "12 changes were merged this week. (the week)");
  assert.deepEqual(hrefs(summary[0] as string), ["https://github.com/demo-org/demo-repo/pulls?q=is%3Apr+is%3Amerged+merged%3A2026-10-05..2026-10-11"]);
  assert.ok(!delivered.some((l) => /A change was merged on/.test(textOf(l))), "no per-change line");
  const cost = (part(page, "Time and review")?.items ?? []).map(textOf);
  assert.deepEqual(cost, ["12 changes merged", "124.3 hours from opening to merge, in total", "4 review rounds in total", "3 declared as not changing behaviour", "estimate: none declared this week"]);
  assert.equal(document.sections.cost[0].busy, true);
});

test("REQ-105 AC7: ten changes are lines and eleven are a summary, as the data says, and the page does not decide", async () => {
  const lines = await html("kinds");
  assert.equal((part(lines.html, "Delivered")?.items ?? []).filter((l) => /A change was merged on/.test(textOf(l))).length, 4);
  const busy = await html("kinds", (r) => {
    r.sections.delivered = [{ kind: "pull-requests-merged", count: 11, links: [{ to: "search", url: "https://github.com/demo-org/demo-repo/pulls" }] }];
    r.sections.cost = [r.sections.cost[4]];
    r.sections.cost[0].busy = true;
    r.sections.cost[0].merged = 11;
  });
  assert.deepEqual((part(busy.html, "Delivered")?.items ?? []).map(textOf), ["11 changes were merged this week. (the week)"]);
});

test("REQ-105 AC4: a week with nothing in these two parts says Nothing this week for each, and no part that is not built says anything", async () => {
  for (const [name, expected] of [["quiet", 4], ["empty", 5]] as const) {
    const { html: page } = await html(name);
    assert.deepEqual(part(page, "Delivered"), { items: [], empty: true }, name);
    assert.deepEqual(part(page, "Time and review"), { items: [], empty: true }, name);
    assert.equal((page.match(/Nothing this week\./g) ?? []).length, expected, `${name}: exactly the built parts that are empty`);
  }
  const { html: page } = await html("kinds");
  assert.ok(!page.includes("Nothing this week."), "a part with items does not say it");
  const oneEmpty = await html("kinds", (r) => {
    r.sections.cost = [];
  });
  assert.deepEqual(part(oneEmpty.html, "Time and review"), { items: [], empty: true });
  assert.ok((part(oneEmpty.html, "Delivered")?.items.length ?? 0) > 0);
  assert.equal((oneEmpty.html.match(/Nothing this week\./g) ?? []).length, 1, "only for the part that has no item");
});

test("REQ-105 AC5: a value the data marks unknown is not known yet, never a number or zero, and the page counts nothing", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.cost[0].hours = "unknown";
    r.sections.cost[1].fix_verdicts = "unknown";
    r.sections.cost[2].hours = "unknown";
    r.sections.cost[2].fix_verdicts = "unknown";
    const totals = r.sections.cost[4];
    totals.hours = "unknown";
    totals.fix_verdicts = "unknown";
    totals.estimate = { within: 1, counted: 2 };
  });
  const cost = (part(page, "Time and review")?.items ?? []).map(textOf);
  assert.deepEqual(cost, [
    "A change took hours not known yet from opening to merge and 0 review rounds. (#5)",
    "A change took 49.3 hours from opening to merge and review rounds not known yet. (#6)",
    "A change took hours not known yet from opening to merge and review rounds not known yet. (#7)",
    "A change took 0.0 hours from opening to merge and 0 review rounds. (#8)",
    "4 changes merged",
    "hours from opening to merge, in total: not known yet",
    "review rounds in total: not known yet",
    "2 declared as not changing behaviour",
    "estimate: 1 of 2 within range",
  ]);
  assert.ok(!/ of \d+ changes/.test(cost.join(" ")), "no count of changes that lack hours");
});

test("REQ-105 AC5: the unknown items of the closed list say what could not be read, in the place of the lines", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.delivered = [{ kind: "unknown", what: "requirements", links: [] }, { kind: "unknown", what: "the age limit for pull requests (inbox_hours)", links: [] }];
    r.sections.cost = [{ kind: "unknown", what: "pull requests", links: [] }];
  });
  assert.deepEqual((part(page, "Delivered")?.items ?? []).map(textOf), ["Requirements could not be read: not known yet.", "The age limit for pull requests (inbox_hours) could not be read: not known yet."]);
  assert.deepEqual((part(page, "Time and review")?.items ?? []).map(textOf), ["Pull requests could not be read: not known yet."]);
});

test("REQ-105 AC5: the hours are the data's strings, shown as they are: no sum, no rounding, no arithmetic", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.cost[4].hours = "999.9";
    r.sections.cost[0].hours = "-1.5";
    r.sections.cost[4].merged = 7;
  });
  const cost = (part(page, "Time and review")?.items ?? []).map(textOf);
  assert.equal(cost[4], "7 changes merged");
  assert.equal(cost[5], "999.9 hours from opening to merge, in total");
  assert.ok(cost[0]?.startsWith("A change took -1.5 hours from"), cost[0]);
});

test("REQ-105 AC2: a count of one uses the singular", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.cost[1].fix_verdicts = 1;
    r.sections.cost[4].merged = 1;
    r.sections.cost[4].fix_verdicts = 1;
    r.sections.delivered = [r.sections.delivered[4], { kind: "pull-requests-merged", count: 1, links: [] }];
  });
  const cost = (part(page, "Time and review")?.items ?? []).map(textOf);
  assert.ok(cost[1]?.includes("and 1 review round. (#6)"), cost[1]);
  assert.equal(cost[4], "1 change merged");
  assert.equal(cost[6], "1 review round in total");
  const delivered = (part(page, "Delivered")?.items ?? []).map(textOf);
  assert.ok(delivered[0]?.includes("1 acceptance criterion (AC1)"));
  assert.equal(delivered[1], "1 change was merged this week.");
});

test("REQ-105 AC3: no pull request title is shown, a requirement's title is escaped, and a title that looks like markup or an attribute renders as text", async () => {
  const hostile = '<img src=x onerror=alert(1)> style = x onclick = y "q" & <script>';
  const { html: page } = await html("kinds", (r) => {
    r.sections.delivered[0].title = hostile;
    r.sections.delivered[5].title = hostile + " PR TITLE";
    r.sections.cost[0].title = hostile + " COST TITLE";
  });
  assert.ok(!page.includes("<img") && !page.includes("<script"), "escaped");
  const first = (part(page, "Delivered")?.items ?? [])[0] as string;
  assert.ok(first.startsWith("“&lt;img src=x onerror=alert(1)&gt; style = x onclick = y &quot;q&quot; &amp; &lt;script&gt;” is done:"), first);
  assert.ok(!page.includes("PR TITLE") && !page.includes("COST TITLE"), "a pull request title is never shown");
});

test("REQ-105 AC2: a reference is a link only when the data gives an address on GitHub; any other address leaves the reference as text, and the line stays", async () => {
  const bad = ["https://evil.example/x", "https://github.com.evil.example/x", 'https://github.com/a"onclick="x', "https://github.com/a b", "https://github.com/a<b"];
  for (const url of bad) {
    const { html: page } = await html("kinds", (r) => {
      r.sections.delivered[0].links = [{ to: "file", url }];
      r.sections.delivered[5].links = [{ to: "pull-request", url }];
      r.sections.cost[0].links = [{ to: "pull-request", url }];
    });
    const delivered = (part(page, "Delivered")?.items ?? []).map((l) => l);
    assert.ok(delivered[0]?.endsWith("(REQ-001)") && !delivered[0].includes("<a"), `${url}: ${delivered[0]}`);
    assert.ok(delivered[5]?.endsWith("(#5)") && !delivered[5].includes("<a"));
    assert.ok(!(part(page, "Time and review")?.items[0] ?? "").includes("<a"));
    assert.ok(!page.includes("evil") && !page.includes("onclick=\"x"), url);
  }
  const none = await html("kinds", (r) => {
    r.sections.delivered[0].links = [];
  });
  assert.ok((part(none.html, "Delivered")?.items[0] ?? "").endsWith("(REQ-001)"), "no link, still the line");
});

test("REQ-105 AC6: the dirty notice and the two parts live together", async () => {
  const { html: page } = await html("dirty-unknown");
  assert.ok(page.includes("unsaved changes") && page.includes("<h4>Delivered</h4>") && page.includes("<h4>Time and review</h4>"));
});

test("REQ-105 AC2: an item with two addresses on GitHub links the reference to the first and the second follows as its own link", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.delivered[5].links = [{ to: "pull-request", url: "https://github.com/demo-org/demo-repo/pull/5" }, { to: "issue", url: "https://github.com/demo-org/demo-repo/issues/9" }, { to: "issue", url: "https://github.com/demo-org/demo-repo/issues/10" }];
  });
  const line = (part(page, "Delivered")?.items ?? [])[5] as string;
  assert.deepEqual(hrefs(line), ["https://github.com/demo-org/demo-repo/pull/5", "https://github.com/demo-org/demo-repo/issues/9", "https://github.com/demo-org/demo-repo/issues/10"]);
});
