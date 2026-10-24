// The This week section, third part: Proven, and Needs your decision (SPEC-0005 rules 2, 4, 5, 7, 8, 9 and 10, as amended).
// Both are rendered from the sections `proven` and `needs_you` of the report's data, in the data's order, with the fixed
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

// The part of the page under an <h4>: its text up to the next part.
function body(page: string, title: string): string | undefined {
  const at = page.indexOf(`<h4>${title}</h4>`);
  if (at < 0) return undefined;
  const rest = page.slice(at + `<h4>${title}</h4>`.length);
  const end = rest.search(/<h4>|<\/section>/);
  return end < 0 ? rest : rest.slice(0, end);
}
const lis = (b: string): string[] => [...b.matchAll(/<li[^>]*>(?:<span class="badge [a-z]+">[^<]*<\/span> )?(.*?)<\/li>/gs)].map((m) => m[1] as string);
const empty = (b: string | undefined): boolean => b !== undefined && /<p>Nothing this week\.<\/p>/.test(b) && lis(b).length === 0;
// The groups of Needs your decision: heading text and the lines under it.
function groups(page: string): { heading: string; lines: string[] }[] {
  const b = body(page, "Needs your decision") ?? "";
  return b
    .split("<h5>")
    .slice(1)
    .map((chunk) => ({ heading: textOf(chunk.slice(0, chunk.indexOf("</h5>"))), lines: lis(chunk) }));
}
const proven = (page: string): string[] => lis(body(page, "Proven") ?? "");

const FIXTURES = ["kinds", "busy", "quiet", "dirty-unknown", "empty"];
const FILE = (n: number, commit = "c0ffee0000000000000000000000000000000000"): string => `https://github.com/demo-org/demo-repo/blob/${commit}/docs/requirements.md#L${n}`;

test("REQ-105 AC1: the parts stand in the order of the spec: Delivered, Proven, Needs your decision, Time and review; At risk stands between them", async () => {
  const { html: page } = await html("kinds");
  const at = (s: string): number => page.indexOf(s);
  assert.ok(at("<h4>Delivered</h4>") < at("<h4>Proven</h4>") && at("<h4>Proven</h4>") < at("<h4>Needs your decision</h4>") && at("<h4>Needs your decision</h4>") < at("<h4>Time and review</h4>"));
  assert.ok(at("<h4>Needs your decision</h4>") < at("<h4>At risk</h4>") && at("<h4>At risk</h4>") < at("<h4>Time and review</h4>"));
  assert.equal((page.match(/<h4>/g) ?? []).length, 5);
});

test("REQ-105 AC2: every item of Proven and of Needs your decision appears once, in the data's order, with its identifier, number, date and links, for each fixture", async () => {
  for (const name of FIXTURES) {
    const { html: page, document } = await html(name);
    const data = document.sections.proven as Doc[];
    const lines = proven(page);
    assert.equal(lines.length, data.length, `${name}: one line per item`);
    data.forEach((item, i) => {
      const line = lines[i] as string;
      assert.deepEqual(hrefs(line), item.links.map((l: Doc) => l.url), `${name} #${i} the links`);
      if (item.id !== undefined) assert.ok(textOf(line).includes(item.id), `${name} #${i}`);
      if (item.kind === "planned-not-counted") assert.ok(textOf(line).startsWith(`${item.count} requirement`), `${name} #${i}`);
    });
    const needs = document.sections.needs_you as Doc[];
    const shown = groups(page);
    assert.equal(shown.length, needs.length, `${name}: one heading per group`);
    needs.forEach((group, g) => {
      const lines = (shown[g] as { lines: string[] }).lines;
      assert.equal(lines.length, group.items.length, `${name} group ${group.group}`);
      group.items.forEach((item: Doc, i: number) => {
        assert.deepEqual(hrefs(lines[i] as string), item.links.map((l: Doc) => l.url), `${name} ${group.group} #${i} the links`);
        if (item.id !== undefined) assert.ok(textOf(lines[i] as string).includes(item.id));
        if (item.number !== undefined) assert.ok(textOf(lines[i] as string).endsWith(`(#${item.number})`));
        if (item.due !== undefined) assert.ok(textOf(lines[i] as string).includes(item.due));
      });
    });
  }
});

test("REQ-105 AC2: the lines of Proven in the kinds fixture are the fixed phrases of SPEC-0005 rule 10, exactly", async () => {
  const { html: page } = await html("kinds");
  assert.deepEqual(proven(page).map(textOf), [
    "REQ-001 is proven (last change #5: proven).",
    "REQ-002 is not proven: AC2 has no test; the last change (#6) did not prove it: the new tests already pass without the change.",
    "REQ-003 is not proven: the last change (#7) has a proof that is not known yet: the test run took too long.",
    "REQ-004 is not proven: AC1 has no test; no merged change was found.",
    "REQ-005 is not proven: it lists no acceptance criteria; no merged change was found.",
    "REQ-006 is not proven: its acceptance criteria are not known yet.",
    "REQ-009 is proven (last change #8: skipped: declared as not changing behaviour).",
    "2 requirements are planned and not counted here. (the list)",
  ]);
  const first = proven(page)[0] as string;
  assert.equal(first, `<a href="${FILE(3)}">REQ-001</a> is proven (last change #5: proven).`);
});

test("REQ-105 AC2: the words of each proof code, an unlisted code shown as the code, and a missing code as reason not known yet", async () => {
  const words: Record<string, string> = {
    "green-on-base": "the new tests already pass without the change",
    "red-on-head": "the tests fail on the change itself",
    timeout: "the test run took too long",
    "no-project-tests": "no test command is configured",
    "no-test-files": "the change adds no test file",
  };
  for (const [code, text] of [...Object.entries(words), ["some-new-code", "some-new-code"], ["", "reason not known yet"]] as [string, string][]) {
    const { html: page } = await html("kinds", (r) => {
      r.sections.proven[1].reasons = [{ reason: "not-shown", number: 6, proof: "not-proven", why: code }];
      r.sections.proven[2].reasons = [{ reason: "unknown-proof", number: 7, proof: "unknown", why: code }];
    });
    const lines = proven(page).map(textOf);
    assert.equal(lines[1], `REQ-002 is not proven: the last change (#6) did not prove it: ${text}.`, code);
    assert.equal(lines[2], `REQ-003 is not proven: the last change (#7) has a proof that is not known yet: ${text}.`, code);
  }
});

test("REQ-105 AC3: a code from the data is escaped, and the reasons keep the data's order", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.proven[1].reasons = [{ reason: "no-merged-change" }, { reason: "not-shown", number: 6, proof: "x", why: "<b>x</b>" }, { reason: "no-test", ac: "AC<1>" }];
  });
  const line = proven(page)[1] as string;
  assert.ok(!page.includes("<b>x"), "escaped");
  assert.equal(textOf(line), "REQ-002 is not proven: no merged change was found; the last change (#6) did not prove it: <b>x</b>; AC<1> has no test.");
});

test("REQ-105 AC4: the closing line of planned requirements uses the singular for one", async () => {
  const { html: page } = await html("quiet");
  assert.deepEqual(proven(page).map(textOf), ["1 requirement is planned and not counted here. (the list)"]);
});

test("REQ-105 AC2: the groups of Needs your decision have the headings of rule 10 with their counts, in the data's order", async () => {
  const { html: page } = await html("kinds");
  assert.deepEqual(
    groups(page).map((g) => g.heading),
    ["Specification waiting for approval (1)", "Decision waiting (1)", "Questions waiting (2)", "Changes waiting for a review (2)", "Overdue items (2)", "Planned requirement with no specification (1)"],
  );
});

test("REQ-105 AC2: the lines of Needs your decision are the fixed phrases of rule 10, exactly, and no path, title or residual text is a sentence", async () => {
  const { html: page } = await html("kinds");
  const all = groups(page).map((g) => g.lines.map(textOf));
  assert.deepEqual(all, [
    ["A specification waits for approval. (SPEC-0002)"],
    ["A decision record waits for your approval. (ADR-0002)"],
    ["A question is waiting for your answer. (Q-X1-1)", "A question is waiting for your answer. (Q-X1-4)"],
    ["A change has waited 13 days for a review. (#9)", "A change has waited 2 days for a review. (#11)"],
    ["An item was due on 2026-09-01 and is overdue. (the item)", "An item was due on 2026-10-13 and is overdue. (the item)"],
    ["“Eta thing” is planned and no specification names it. (REQ-007)"],
  ]);
  for (const hidden of ["Draft one", "Proposed one", "Change number", "old item", "very long description", "spec-0002-notes", "0002-proposed.md"]) {
    assert.ok(!textOf(page).includes(hidden), `${hidden} is not shown as text (a path is only behind its link)`);
  }
});

test("REQ-105 AC2: the singular for a count of one, in the days of a waiting change", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.needs_you[3].items[1].days = 1;
    r.sections.needs_you[3].count = 1;
    r.sections.needs_you[3].items.pop();
    r.sections.needs_you[3].items[0].days = 1;
  });
  const g = groups(page)[3] as { heading: string; lines: string[] };
  assert.equal(g.heading, "Change waiting for a review (1)");
  assert.equal(textOf(g.lines[0] as string), "A change has waited 1 day for a review. (#9)");
});

test("REQ-105 AC5: a group count the data marks unknown is not known yet, and an unknown item says what could not be read", async () => {
  const { html: page } = await html("dirty-unknown");
  const shown = groups(page);
  assert.deepEqual(shown.map((g) => g.heading), [
    "Specification waiting for approval (1)",
    "Decision waiting (1)",
    "Questions waiting (not known yet)",
    "Changes waiting for a review (2)",
    "Overdue items (not known yet)",
    "Planned requirement with no specification (1)",
  ]);
  assert.deepEqual((shown[2] as { lines: string[] }).lines.map(textOf), ["Questions could not be read: not known yet. (the item)"]);
  assert.deepEqual((shown[4] as { lines: string[] }).lines.map(textOf), ["Residuals could not be read: not known yet. (the item)"]);
  assert.deepEqual(proven(page).map(textOf), ["Test markers could not be read: not known yet. (the item)"]);
  assert.ok(!/\(0\)/.test(page), "never zero");
});

test("REQ-105 AC4: an empty list says Nothing this week for the part and no other part does", async () => {
  for (const name of ["empty"]) {
    const { html: page } = await html(name);
    assert.ok(empty(body(page, "Proven")) && empty(body(page, "Needs your decision")), name);
    assert.equal((page.match(/Nothing this week\./g) ?? []).length, 5, `${name}: all five parts (At risk too: a housekeeping total of 0 with no open issue is no longer an item, agk SPEC-0026 rule 6)`);
  }
});

test("REQ-105 AC4: a part with items does not say Nothing this week", async () => {
  const { html: page } = await html("kinds");
  assert.ok(!page.includes("Nothing this week."));
  const oneEmpty = await html("kinds", (r) => {
    r.sections.needs_you = [];
  });
  assert.ok(empty(body(oneEmpty.html, "Needs your decision")));
  assert.ok(!empty(body(oneEmpty.html, "Proven")));
  assert.equal((oneEmpty.html.match(/Nothing this week\./g) ?? []).length, 1);
});

test("REQ-105 AC5: the page counts nothing: the heading shows the data's count, not the number of items", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.needs_you[2].count = 9;
    r.sections.proven[7].count = 5;
  });
  assert.equal(groups(page)[2]?.heading, "Questions waiting (9)");
  assert.equal(groups(page)[2]?.lines.length, 2);
  assert.equal(textOf(proven(page)[7] as string), "5 requirements are planned and not counted here. (the list)");
});

test("REQ-105 AC3: a title from the data is escaped, and addresses other than GitHub's leave the reference as text with the line kept", async () => {
  const hostile = '<img src=x onerror=alert(1)> "q" & <script>';
  const { html: page } = await html("kinds", (r) => {
    r.sections.needs_you[5].items[0].title = hostile;
    r.sections.needs_you[0].items[0].links = [{ to: "file", url: "https://evil.example/x" }];
    r.sections.proven[0].links = [{ to: "file", url: 'https://github.com/a"onclick="x' }];
  });
  assert.ok(!page.includes("<img") && !page.includes("<script") && !page.includes("evil") && !page.includes('onclick="x'));
  assert.ok(textOf((groups(page)[5]?.lines[0]) as string).startsWith(`“${hostile}” is planned`));
  assert.equal(groups(page)[0]?.lines[0], "A specification waits for approval. (SPEC-0002)");
  assert.equal(proven(page)[0], "REQ-001 is proven (last change #5: proven).");
});

test("REQ-105 AC5: the proven outcome of the data other than the two listed is shown as the code", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.proven[0].last_change.proof = "new-outcome";
  });
  assert.equal(textOf(proven(page)[0] as string), "REQ-001 is proven (last change #5: new-outcome).");
});

test("REQ-105 AC5: a requirement not proven whose data lists no reason says reason not known yet, never an empty sentence", async () => {
  const { html: page } = await html("kinds", (r) => {
    r.sections.proven[1].reasons = [];
  });
  assert.equal(textOf(proven(page)[1] as string), "REQ-002 is not proven: reason not known yet.");
});
