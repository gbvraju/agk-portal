// The This week section, fourth part: At risk, and the page of all five parts (SPEC-0005 rules 2, 6, 8, 9 and 10, as
// amended). At risk is rendered from the section `at_risk` of the report's data, in the data's order, with the fixed
// phrases; the page computes no count, no date and no reason. The data is what this repository's own
// scripts/agk/product_report.py --json writes from the kit's fixture facts documents. Markers REQ-105 AC1, AC2, AC3, AC4
// and AC5. Recorded GitHub answers and archives in memory, no network.
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
const hrefs = (inner: string): string[] => [...inner.matchAll(/href="([^"]*)"/g)].map((m) => unescape(m[1] as string));
function body(page: string, title: string): string | undefined {
  const at = page.indexOf(`<h4>${title}</h4>`);
  if (at < 0) return undefined;
  const rest = page.slice(at + `<h4>${title}</h4>`.length);
  const end = rest.search(/<h4>|<\/section>/);
  return end < 0 ? rest : rest.slice(0, end);
}
const lis = (b: string): string[] => [...b.matchAll(/<li[^>]*>(?:<span class="badge [a-z]+">[^<]*<\/span> )?(.*?)<\/li>/gs)].map((m) => m[1] as string);
const risk = (page: string): string[] => lis(body(page, "At risk") ?? "");
const FIXTURES = ["kinds", "busy", "quiet", "dirty-unknown", "empty"];
const PR = (n: number): string => `https://github.com/demo-org/demo-repo/pull/${n}`;
const link = (to: string, url: string): Doc => ({ to, url });

test("REQ-105 AC1: the five parts stand in the spec's order, and each fixture's page holds every item of the data and nothing else", async () => {
  for (const name of FIXTURES) {
    const { html: page, document } = await html(name);
    const titles = [...page.matchAll(/<h4>(.*?)<\/h4>/g)].map((m) => m[1]);
    assert.deepEqual(titles, ["Delivered", "Proven", "Needs your decision", "At risk", "Time and review"], name);
    const s = document.sections;
    const expected = s.delivered.length + s.proven.length + s.needs_you.reduce((n: number, g: Doc) => n + g.items.length, 0) + s.at_risk.length + s.cost.reduce((n: number, i: Doc) => n + (i.kind === "week-totals" ? 5 : 1), 0);
    assert.equal((page.match(/<li[ >]/g) ?? []).length, expected, `${name}: one line per item of the data, no other line`);
    assert.equal(risk(page).length, s.at_risk.length, name);
  }
});

test("REQ-105 AC2: the lines of At risk in the kinds fixture are the fixed phrases of SPEC-0005 rule 10, exactly", async () => {
  const { html: page } = await html("kinds");
  assert.deepEqual(risk(page).map(textOf), [
    "Overdue since 2026-09-01 (43 days). (the item)",
    "Overdue since 2026-10-13 (1 day). (the item)",
    "Changes #9 (13 days) and #13 (12 days) have been open.",
    "Changes #6 (2 times) and #12 (1 time) were sent back.",
    "Housekeeping checks: 4 issues found. (the issue)",
    "A change was merged before its final review. (#8)",
  ]);
  const lines = risk(page);
  assert.deepEqual(hrefs(lines[2] as string), [PR(9), PR(13)]);
  assert.deepEqual(hrefs(lines[3] as string), [PR(6), PR(12)]);
  assert.equal(lines[2], `Changes <a href="${PR(9)}">#9</a> (13 days) and <a href="${PR(13)}">#13</a> (12 days) have been open.`);
  assert.deepEqual(hrefs(lines[4] as string), ["https://github.com/demo-org/demo-repo/issues/4"]);
  assert.ok(!/D[1-7]/.test(textOf(page)), "the codes are not shown");
});

test("REQ-105 AC2: a kind with one pull request is the single phrase, and three or more are listed with commas and 'and' in the data's order", async () => {
  const { html: page } = await html("busy");
  assert.deepEqual(risk(page).slice(2).map(textOf), [
    "Changes #9 (13 days) and #13 (12 days) have been open.",
    "Changes #6 (2 times), #12 (1 time) and #26 (2 times) were sent back.",
    "Housekeeping checks: 4 issues found. (the issue)",
    "A change was merged before its final review. (#8)",
    "A change was merged without a review. (#27)",
  ]);
  const one = await html("kinds", (r) => {
    const open = r.sections.at_risk[2];
    open.entries = [{ number: 9, days: 1 }];
    open.links = [link("pull-request", PR(9))];
    const back = r.sections.at_risk[3];
    back.entries = [{ number: 6, times: 1 }];
    back.links = [link("pull-request", PR(6))];
  });
  assert.deepEqual(risk(one.html).slice(2, 4).map(textOf), ["A change has been open for 1 day. (#9)", "A change was sent back 1 time. (#6)"]);
  const many = await html("kinds", (r) => {
    r.sections.at_risk[2].entries = [{ number: 1, days: 41 }, { number: 2, days: 30 }, { number: 3, days: 9 }, { number: 4, days: 2 }];
    r.sections.at_risk[5].entries = [{ number: 5 }, { number: 6 }, { number: 7 }];
    r.sections.at_risk.push({ kind: "pull-requests-merged-no-verdict", entries: [{ number: 5 }, { number: 6 }], links: [] });
    r.sections.at_risk.push({ kind: "pull-requests-merged-no-verdict", entries: [{ number: 8 }], links: [] });
  });
  const lines = risk(many.html).map(textOf);
  assert.equal(lines[2], "Changes #1 (41 days), #2 (30 days), #3 (9 days) and #4 (2 days) have been open.");
  assert.equal(lines[5], "Changes #5, #6 and #7 were merged before their final review.");
  assert.equal(lines[6], "Changes #5 and #6 were merged without a review.");
  assert.equal(lines[7], "A change was merged without a review. (#8)");
});

test("REQ-105 AC2: the housekeeping line has its three forms and shows no code", async () => {
  const forms: [Doc, string][] = [
    [{ total: 4, open_issue: 4 }, "Housekeeping checks: 4 issues found. (the issue)"],
    [{ total: 1, open_issue: 4 }, "Housekeeping checks: 1 issue found. (the issue)"],
    [{ total: 4, open_issue: "none", links: [] }, "Housekeeping checks: 4 issues found. No issue is open for them."],
    [{ total: 4, open_issue: "unknown", links: [] }, "Housekeeping checks: 4 issues found. Issues not known yet."],
    [{ total: "unknown", open_issue: "unknown", links: [] }, "Housekeeping checks: the number of issues found is not known yet. Issues not known yet."],
    [{ total: 0, open_issue: "none", links: [] }, "Housekeeping checks: 0 issues found. No issue is open for them."],
  ];
  for (const [change, expected] of forms) {
    const { html: page } = await html("kinds", (r) => {
      Object.assign(r.sections.at_risk[4], change);
    });
    assert.equal(textOf(risk(page)[4] as string), expected);
    assert.ok(!/D[1-7]/.test(textOf(page)));
  }
});

test("REQ-105 AC5: unknown values are not known yet, never a number, and an unknown item says what could not be read", async () => {
  const { html: page } = await html("dirty-unknown");
  const lines = risk(page).map(textOf);
  assert.equal(lines[0], "Residuals could not be read: not known yet. (the item)");
  assert.equal(lines[3], "Housekeeping checks: the number of issues found is not known yet. (the issue)");
  assert.ok(lines[4]?.startsWith("Changes #5, #6, #7 and #8 were merged before their final review."), lines[4]);
  assert.ok(!/ 0 issues/.test(lines.join(" ")));
});

test("REQ-105 AC4: an empty At risk says Nothing this week, and a part with items does not", async () => {
  const none = await html("kinds", (r) => {
    r.sections.at_risk = [];
  });
  assert.match(body(none.html, "At risk") ?? "", /<p>Nothing this week\.<\/p>/);
  assert.equal(risk(none.html).length, 0);
  const { html: page } = await html("kinds");
  assert.doesNotMatch(body(page, "At risk") ?? "", /Nothing this week/);
});

test("REQ-105 AC3: a number changed in the data changes only the line that depends on it", async () => {
  const base = (await html("kinds")).html.split("\n");
  const changed = (await html("kinds", (r) => {
    r.sections.at_risk[2].entries[0].days = 99;
  })).html.split("\n");
  assert.equal(changed.length, base.length);
  const differing = base.map((l, i) => (l === changed[i] ? -1 : i)).filter((i) => i >= 0);
  assert.equal(differing.length, 1, "exactly one line differs");
  assert.ok(textOf(changed[differing[0] as number] as string).includes("#9 (99 days)"));
  const again = (await html("kinds", (r) => {
    r.sections.at_risk[4].total = 7;
  })).html.split("\n");
  assert.equal(base.map((l, i) => (l === again[i] ? -1 : i)).filter((i) => i >= 0).length, 1);
});

test("REQ-105 AC3: the text of a residual is never shown, and an address other than GitHub's leaves the number as text with the line kept", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.at_risk[2].links = [link("pull-request", "https://evil.example/x"), link("pull-request", PR(13))];
    r.sections.at_risk[0].links = [link("file", 'https://github.com/a"onclick="x')];
    r.sections.at_risk[0].text = "<script>alert(1)</script>";
  });
  assert.ok(!page.includes("evil") && !page.includes("<script") && !page.includes('onclick="x') && !textOf(page).includes("old item"));
  const lines = risk(page);
  assert.equal(textOf(lines[2] as string), "Changes #9 (13 days) and #13 (12 days) have been open.");
  assert.deepEqual(hrefs(lines[2] as string), [PR(13)], "only the pull request that has a GitHub address is a link");
  assert.equal(lines[0], "Overdue since 2026-09-01 (43 days). (the item)");
});

test("REQ-105 AC2: a grouped entry of one day reads 1 day", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.at_risk[2].entries = [{ number: 9, days: 1 }, { number: 13, days: 12 }];
  });
  assert.equal(textOf(risk(page)[2] as string), "Changes #9 (1 day) and #13 (12 days) have been open.");
});

test("REQ-105 AC2: the overdue residual line carries the data's date and days, escaped and checked, and its link", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.at_risk[0].days = 7;
    r.sections.at_risk[1].days = 1;
  });
  const lines = risk(page);
  assert.equal(textOf(lines[0] as string), "Overdue since 2026-09-01 (7 days). (the item)");
  assert.equal(textOf(lines[1] as string), "Overdue since 2026-10-13 (1 day). (the item)");
  assert.deepEqual(hrefs(lines[0] as string), ["https://github.com/demo-org/demo-repo/blob/c0ffee0000000000000000000000000000000000/docs/adr/0001-accepted.md"]);
});
