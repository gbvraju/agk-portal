// The report's schema 6 (agk #208, REQ-041 build d with REQ-040 c2 and REQ-039 e2): `sections` gains `flow` (required, after
// `cost`) whose items are `flow-figures` or `unknown`; `at_risk` gains the kinds `pull-requests-stalled`, `briefs-idle` and
// `requirements-without-brief`; `week-totals` gains `corrections`; nothing else changes. The reader accepts schemas 1 to 6,
// each with its own closed list, and a schema above 6 is still said not to be read. The page places the data and computes
// nothing. The documents here are the schema 5 goldens of agk #198 raised to schema 6 in the test; the goldens of agk #208 are
// tested in the last tests of this file (tests/fixtures/report-schema-6). Markers REQ-105 AC2, AC5 and AC8. No network.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { SESSION_COOKIE, UNKNOWN_SCHEMA_REASON, createApp, createCore, createGithubClient, factsCard, parseReport, readFacts, sealSession, type Config, type ConfigName } from "../src/core/index.ts";
import { fixtureDir } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const WEEK42 = Date.UTC(2026, 9, 14, 12);
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
const dir5 = resolve(import.meta.dirname, "fixtures", "report-schema-5");
const dir6 = resolve(import.meta.dirname, "fixtures", "report-schema-6");
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));
const read = (path: string): string => readFileSync(path, "utf8");
const REPO = "https://github.com/acme/api";
const pr = (n: number) => ({ to: "pull-request", url: `${REPO}/pull/${n}` });
const issue = (n: number) => ({ to: "issue", url: `${REPO}/issues/${n}` });
const FLOW = { kind: "flow-figures", open_builders: 2, max_builders: 3, taken_to_pull_request: "1.5", to_first_verdict: "0.5", verdict_to_cleared: "none", cleared_to_merge: "unknown", conflicts: 1, renumbers: 0, retakes: 4, links: [] };

// A schema 6 document: the schema 5 golden raised, with a Flow item, a corrections figure and the three new At risk kinds.
function schema6(): { facts: string; document: Doc } {
  const document = JSON.parse(read(resolve(dir5, "busy.report.json")));
  document.schema = 6;
  totals(document).corrections = 3;
  document.sections.flow = [clone(FLOW)];
  document.sections.at_risk.push(
    { kind: "pull-requests-stalled", entries: [{ number: 14, title: "A secret title" }], count: 1, links: [pr(14)] },
    { kind: "briefs-idle", entries: [{ number: 21, title: "Brief title", days: 4 }], count: 1, links: [issue(21)] },
    { kind: "requirements-without-brief", entries: [{ id: "REQ-050" }], count: 1, links: [] },
  );
  return { facts: read(resolve(fixtureDir, "busy.facts.json")), document };
}
const totals = (doc: Doc): Doc => doc.sections.cost.find((i: Doc) => i.kind === "week-totals");
const risk = (doc: Doc, kind: string): Doc => doc.sections.at_risk.find((i: Doc) => i.kind === kind);

async function resultOf(facts: string, report: unknown): Promise<Awaited<ReturnType<typeof readFacts>>> {
  const doc = report as Doc;
  const artifacts = { total_count: 1, artifacts: [{ id: 777, name: `agk-facts-${doc.week}`, expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] };
  const bytes = zip([{ name: "facts.json", data: facts }, { name: "report.json", data: JSON.stringify(report) }]);
  const routes: Record<string, () => Response> = {
    "https://api.github.com/repos/acme/api/actions/artifacts?per_page=100&page=1": () => new Response(JSON.stringify(artifacts)),
    "https://api.github.com/repos/acme/api/actions/artifacts/777/zip": () => new Response(null, { status: 302, headers: { location: SIGNED } }),
    [SIGNED]: () => new Response(bytes as BodyInit),
  };
  const github = createGithubClient({ fetch: async (url) => routes[url]?.() ?? new Response("{}", { status: 404 }) });
  return readFacts(github, TOKEN, "acme/api", START);
}
const cardOf = async (facts: string, report: unknown): Promise<string> => factsCard("acme/api", await resultOf(facts, report));
const unescape = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const textOf = (inner: string): string => unescape(inner.replace(/<span class="badge [a-z]+">.*?<\/span>/gs, "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
function tiles(page: string): string[] {
  const at = page.indexOf('<div class="part time">');
  assert.ok(at >= 0, "Time and review is shown");
  const rest = page.slice(at);
  return [...rest.slice(0, rest.indexOf("</ul>")).matchAll(/<li class="tile">(.*?)<\/li>/gs)].map((m) => textOf(m[1] as string));
}
// The raw items (as html) of a part, by its heading.
function part(page: string, heading: string): string[] {
  const at = page.indexOf(`<h4>${heading}</h4>`);
  assert.ok(at >= 0, `${heading} is shown`);
  const rest = page.slice(at);
  const end = rest.search(/<\/div>/);
  return [...rest.slice(0, end).matchAll(/<li>(.*?)<\/li>/gs)].map((m) => m[1] as string);
}
const READABLE = "<h3>This week</h3>";
const UNREADABLE = /not known yet: the report could not be read\./;

test("REQ-105 AC8: the reader accepts schema 6 and still schemas 1 to 5", async () => {
  const { facts, document } = schema6();
  assert.notEqual(parseReport(JSON.stringify(document)), undefined, "schema 6 reads");
  assert.ok((await cardOf(facts, document)).includes(READABLE));
  for (const dir of ["report-schema-2", "report-schema-3", "report-schema-4", "report-schema-5"]) {
    const old = JSON.parse(read(resolve(import.meta.dirname, "fixtures", dir, "busy.report.json")));
    assert.notEqual(parseReport(JSON.stringify(old)), undefined, `${dir} still reads`);
  }
});

test("REQ-105 AC8: schema 6 is schema 5's closed list plus flow, the three At risk kinds and corrections, and nothing else", async () => {
  const { facts, document } = schema6();
  const flow = (d: Doc): Doc => d.sections.flow[0];
  const bad: [string, (d: Doc) => void][] = [
    ["the flow key missing", (d) => delete d.sections.flow],
    ["corrections missing", (d) => delete totals(d).corrections],
    ["corrections as a numeral string", (d) => (totals(d).corrections = "3")],
    ["corrections as a fraction", (d) => (totals(d).corrections = 1.5)],
    ["corrections as not-reported", (d) => (totals(d).corrections = "not-reported")],
    ["corrections as null", (d) => (totals(d).corrections = null)],
    ["an extra field on the totals", (d) => (totals(d).extra = 1)],
    ["a flow figure missing", (d) => delete flow(d).retakes],
    ["a flow figure extra", (d) => (flow(d).extra = 1)],
    ["open_builders as text", (d) => (flow(d).open_builders = "2")],
    ["open_builders as another word", (d) => (flow(d).open_builders = "none")],
    ["median hours as a number", (d) => (flow(d).taken_to_pull_request = 1.5)],
    ["median hours without a decimal", (d) => (flow(d).to_first_verdict = "2")],
    ["median hours as another word", (d) => (flow(d).cleared_to_merge = "n/a")],
    ["conflicts as none", (d) => (flow(d).conflicts = "none")],
    ["a flow kind with another name", (d) => (flow(d).kind = "flow-figure")],
    ["flow as an object", (d) => (d.sections.flow = flow(d))],
    ["a stalled entry with days", (d) => (risk(d, "pull-requests-stalled").entries[0].days = 3)],
    ["a stalled entry without a number", (d) => delete risk(d, "pull-requests-stalled").entries[0].number],
    ["a stalled item without count", (d) => delete risk(d, "pull-requests-stalled").count],
    ["a briefs-idle entry without a title", (d) => delete risk(d, "briefs-idle").entries[0].title],
    ["a briefs-idle entry without days", (d) => delete risk(d, "briefs-idle").entries[0].days],
    ["a briefs-idle entry with days as text", (d) => (risk(d, "briefs-idle").entries[0].days = "4")],
    ["a requirements entry without an id", (d) => delete risk(d, "requirements-without-brief").entries[0].id],
    ["a requirements entry with a number", (d) => (risk(d, "requirements-without-brief").entries[0].number = 1)],
    ["a requirements item without count", (d) => delete risk(d, "requirements-without-brief").count],
    ["the schema as text", (d) => (d.schema = "6")],
  ];
  for (const [name, mutate] of bad) {
    const doc = clone(document);
    mutate(doc);
    assert.equal(parseReport(JSON.stringify(doc)), undefined, name);
    assert.match(await cardOf(facts, doc), UNREADABLE, name);
  }
  const good = clone(document);
  flow(good).open_builders = "unknown";
  flow(good).max_builders = "unknown";
  flow(good).conflicts = "unknown";
  flow(good).taken_to_pull_request = "unknown";
  flow(good).to_first_verdict = "none";
  flow(good).verdict_to_cleared = "-0.5";
  totals(good).corrections = "unknown";
  risk(good, "pull-requests-stalled").entries[0] = { number: 14 };
  assert.notEqual(parseReport(JSON.stringify(good)), undefined, "the words the list allows");
  const unknownFlow = clone(document);
  unknownFlow.sections.flow = [{ kind: "unknown", what: "the flow figures", links: [] }];
  assert.notEqual(parseReport(JSON.stringify(unknownFlow)), undefined, "a flow item of kind unknown");
  const empty = clone(document);
  empty.sections.flow = [];
  assert.notEqual(parseReport(JSON.stringify(empty)), undefined, "an empty flow list");
});

test("REQ-105 AC8: the new fields belong to schema 6 only: schemas 1 to 5 refuse them, and a schema above 6 is said not to be read", async () => {
  const { facts, document } = schema6();
  for (const schema of [1, 2, 3, 4, 5]) {
    const doc = clone(document);
    doc.schema = schema;
    assert.equal(parseReport(JSON.stringify(doc)), undefined, `schema ${schema} with the schema 6 fields`);
  }
  const strip: [string, (d: Doc) => void][] = [
    ["flow", (d) => delete d.sections.flow],
    ["corrections", (d) => delete totals(d).corrections],
    ["the At risk kinds", (d) => (d.sections.at_risk = d.sections.at_risk.filter((i: Doc) => !["pull-requests-stalled", "briefs-idle", "requirements-without-brief"].includes(i.kind)))],
  ];
  for (const [keep] of strip) {
    const doc = clone(document);
    for (const [name, remove] of strip) if (name !== keep) remove(doc);
    doc.schema = 5;
    assert.equal(parseReport(JSON.stringify(doc)), undefined, `schema 5 with ${keep}`);
  }
  const plain = JSON.parse(read(resolve(dir5, "busy.report.json")));
  plain.schema = 6;
  assert.equal(parseReport(JSON.stringify(plain)), undefined, "schema 5's content under the number 6 lacks the new fields");
  const seven = clone(document);
  seven.schema = 7;
  assert.equal(parseReport(JSON.stringify(seven)), undefined);
  assert.match(await cardOf(facts, seven), new RegExp(`not known yet: ${UNKNOWN_SCHEMA_REASON}\\.`));
});

test("REQ-105 AC5: Flow is a part after Time and review, one line in agk's words, none and unknown as written", async () => {
  const { facts, document } = schema6();
  const page = await cardOf(facts, document);
  assert.ok(page.indexOf('<div class="part time">') < page.indexOf("<h4>Flow</h4>"), "Flow comes after Time and review");
  assert.deepEqual(part(page, "Flow").map(textOf), ["Builders: 2 of 3 pull requests open; median hours: taken to pull request 1.5, pull request to first verdict 0.5, verdict to cleared none, cleared to merge unknown; conflicts 1, renumbers 0, retakes 4"]);
  const unknown = clone(document);
  Object.assign(unknown.sections.flow[0], { open_builders: "unknown", max_builders: "unknown", conflicts: "unknown", renumbers: "unknown", retakes: "unknown" });
  assert.match(textOf(part(await cardOf(facts, unknown), "Flow")[0] as string), /^Builders: unknown of unknown pull requests open;.*conflicts unknown, renumbers unknown, retakes unknown$/);
  const bad = clone(document);
  bad.sections.flow = [{ kind: "unknown", what: "the flow figures", links: [] }];
  assert.deepEqual(part(await cardOf(facts, bad), "Flow").map(textOf), ["The flow figures could not be read: not known yet."]);
  const none = clone(document);
  none.sections.flow = [];
  assert.deepEqual(await cardOf(facts, none).then((p) => p.match(/<h4>Flow<\/h4>\s*<p>(.*?)<\/p>/)?.[1]), "Nothing this week.");
});

test("REQ-105 AC5: Flow places the data and computes nothing: only its own line changes", async () => {
  const { facts, document } = schema6();
  const base = (await cardOf(facts, document)).split("\n");
  const changed = clone(document);
  changed.sections.flow[0].retakes = 9;
  const after = (await cardOf(facts, changed)).split("\n");
  assert.equal(after.length, base.length);
  assert.equal(base.filter((l, i) => l !== after[i]).length, 1, "exactly one line differs");
});

test("REQ-105 AC5: corrections is a tile after the review-rounds tiles: the count, 0 shown, the word unknown as written, singular for one", async () => {
  const { facts, document } = schema6();
  const at = (page: string[]): string[] => page.slice(page.findIndex((t) => /review rounds in total/.test(t)));
  assert.deepEqual(at(tiles(await cardOf(facts, document))).slice(0, 4), ["4 review rounds in total", "0 changes without known review rounds", "3 corrections", "3 declared as not changing behaviour"]);
  for (const [value, line] of [[1, "1 correction"], [0, "0 corrections"], ["unknown", "corrections: unknown"]] as [unknown, string][]) {
    const doc = clone(document);
    totals(doc).corrections = value;
    assert.equal(at(tiles(await cardOf(facts, doc)))[2], line, String(value));
  }
  const five = JSON.parse(read(resolve(dir5, "busy.report.json")));
  assert.doesNotMatch(await cardOf(facts, five), /correction|<h4>Flow/);
});

test("REQ-105 AC2: a stalled pull request reads as a grouped line without its title, several are one sentence, over 5 they fold", async () => {
  const { facts, document } = schema6();
  const lines = async (doc: Doc): Promise<string[]> => part(await cardOf(facts, doc), "At risk").filter((l) => /stalled/.test(l));
  const [one] = await lines(document);
  assert.equal(textOf(one as string), "A change is stalled on its builder. (#14)");
  assert.match(one as string, /<a href="https:\/\/github\.com\/acme\/api\/pull\/14">#14<\/a>/);
  assert.doesNotMatch(await cardOf(facts, document), /A secret title/);
  const many = clone(document);
  Object.assign(risk(many, "pull-requests-stalled"), { entries: [{ number: 14 }, { number: 15 }], count: 2, links: [pr(14), pr(15)] });
  assert.equal(textOf((await lines(many))[0] as string), "Changes #14 and #15 are stalled on their builders.");
  const folded = clone(document);
  const numbers = [1, 2, 3, 4, 5, 6];
  Object.assign(risk(folded, "pull-requests-stalled"), { entries: numbers.map((number) => ({ number })), count: 6, links: numbers.map(pr) });
  const [fold] = await lines(folded);
  assert.match(fold as string, /^<span class="badge risk">At risk<\/span> <details class="fold"><summary>6 changes are stalled on their builders\.<\/summary>/);
});

test("REQ-105 AC2: an idle brief reads as a grouped line without its title and with its days, several are one sentence, over 5 they fold", async () => {
  const { facts, document } = schema6();
  const lines = async (doc: Doc): Promise<string[]> => part(await cardOf(facts, doc), "At risk").filter((l) => /no pull request/.test(l));
  const [one] = await lines(document);
  assert.equal(textOf(one as string), "A brief has had no pull request for 4 days. (#21)");
  assert.match(one as string, /<a href="https:\/\/github\.com\/acme\/api\/issues\/21">#21<\/a>/);
  assert.doesNotMatch(await cardOf(facts, document), /Brief title/);
  const single = clone(document);
  risk(single, "briefs-idle").entries[0].days = 1;
  assert.equal(textOf((await lines(single))[0] as string), "A brief has had no pull request for 1 day. (#21)");
  const many = clone(document);
  Object.assign(risk(many, "briefs-idle"), { entries: [{ number: 21, title: "a", days: 4 }, { number: 22, title: "b", days: 1 }], count: 2, links: [issue(21), issue(22)] });
  assert.equal(textOf((await lines(many))[0] as string), "Briefs #21 (4 days) and #22 (1 day) have had no pull request.");
  const folded = clone(document);
  const numbers = [1, 2, 3, 4, 5, 6];
  Object.assign(risk(folded, "briefs-idle"), { entries: numbers.map((number) => ({ number, title: "t", days: 2 })), count: 6, links: numbers.map(issue) });
  assert.match((await lines(folded))[0] as string, /<details class="fold"><summary>6 briefs have had no pull request\.<\/summary>/);
});

test("REQ-105 AC2: requirements without a brief name their identifiers, escaped, singular and plural, over 5 they fold", async () => {
  const { facts, document } = schema6();
  const lines = async (doc: Doc): Promise<string[]> => part(await cardOf(facts, doc), "At risk").filter((l) => /no open brief/.test(l));
  assert.equal(textOf((await lines(document))[0] as string), "REQ-050 has no open brief.");
  const many = clone(document);
  Object.assign(risk(many, "requirements-without-brief"), { entries: [{ id: "REQ-050" }, { id: "REQ-051" }, { id: "REQ-<b>" }], count: 3 });
  const [line] = await lines(many);
  assert.equal(textOf(line as string), "REQ-050, REQ-051 and REQ-<b> have no open brief.");
  assert.doesNotMatch(line as string, /<b>/);
  const folded = clone(document);
  Object.assign(risk(folded, "requirements-without-brief"), { entries: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `REQ-0${n}` })), count: 6 });
  assert.match((await lines(folded))[0] as string, /<details class="fold"><summary>6 requirements have no open brief\.<\/summary>/);
});

test("REQ-109 AC3: the start page places a schema 6 report by its counts, as it does a schema 5 one", async () => {
  const six = schema6();
  const calm = clone(six.document);
  calm.counts.needs_you = 0;
  calm.counts.at_risk = 0;
  const results = [await resultOf(six.facts, six.document), await resultOf(six.facts, calm)];
  const app = createApp(createCore({ config: { get: (n: ConfigName) => ({ GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid", GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value", SESSION_KEY: KEY, CALLBACK_URL: "https://portal.example/callback" })[n] } as Config, now: () => WEEK42 }), {
    projects: async () => ({ kind: "ok", notices: [], projects: [{ name: "acme/api", result: results[0]! }, { name: "acme/web", result: results[1]! }] }),
  });
  const cookie = await sealSession({ token: TOKEN, expiresAt: WEEK42 + 3_600_000 }, KEY);
  const html = await (await app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }))).text();
  const sections = [...html.matchAll(/<section class="group">\s*<h2>(.*?)<\/h2>\s*<ul class="projects">(.*?)<\/ul>/gs)].map((m) => [m[1], textOf(m[2] as string)]);
  assert.deepEqual(sections.map((s) => s[0]), ["Needs your attention", "On track"]);
  assert.match(sections[0]?.[1] as string, /^acme\/api Week 2026-W41 delivered: 5 needs you: 10 at risk: 7 merged: 12 hours: 124\.3$/);
  assert.match(sections[1]?.[1] as string, /^acme\/web Week 2026-W41 delivered: 5/);
});

// The goldens of agk #208 (tests/kit/fixtures/report/golden/{busy,facts-ok,kinds}/report.json), copied unchanged.
const factsOf = (name: string): string => read(name === "facts-ok" ? resolve(import.meta.dirname, "fixtures", "report-schema-3", "facts-ok.facts.json") : resolve(fixtureDir, `${name}.facts.json`));
const golden = (name: string): Doc => JSON.parse(read(resolve(dir6, `${name}.report.json`)));

test("REQ-105 AC8: the goldens of agk #208 (busy, facts-ok, kinds) are schema 6, hold no token and no signed address, and read", { skip: !existsSync(dir6) }, async () => {
  for (const name of ["busy", "facts-ok", "kinds"]) {
    const text = read(resolve(dir6, `${name}.report.json`));
    assert.doesNotMatch(text, /ghu_|ghs_|github_pat_|sig=|token/i, name);
    assert.equal(JSON.parse(text).schema, 6, name);
    assert.notEqual(parseReport(text), undefined, `${name}: reads`);
    assert.ok((await cardOf(factsOf(name), golden(name))).includes(READABLE), `${name}: the card shows This week`);
  }
});

test("REQ-105 AC5: the goldens place Flow and corrections as the data holds them", { skip: !existsSync(dir6) }, async () => {
  for (const name of ["busy", "facts-ok", "kinds"]) {
    const doc = golden(name);
    const page = await cardOf(factsOf(name), doc);
    const item = doc.sections.flow[0];
    if (item.kind === "flow-figures") {
      const expected = `Builders: ${item.open_builders} of ${item.max_builders} pull requests open; median hours: taken to pull request ${item.taken_to_pull_request}, pull request to first verdict ${item.to_first_verdict}, verdict to cleared ${item.verdict_to_cleared}, cleared to merge ${item.cleared_to_merge}; conflicts ${item.conflicts}, renumbers ${item.renumbers}, retakes ${item.retakes}`;
      assert.deepEqual(part(page, "Flow").map(textOf), [expected], name);
    }
    const corrections = totals(doc).corrections;
    const tile = corrections === "unknown" ? "corrections: unknown" : `${corrections} ${corrections === 1 ? "correction" : "corrections"}`;
    assert.ok(tiles(page).includes(tile), `${name}: ${tile}`);
  }
});

test("REQ-105 AC2: the golden of facts-ok shows its requirements without a brief by their identifiers and nothing else of the kind", { skip: !existsSync(dir6) }, async () => {
  const doc = golden("facts-ok");
  const item = risk(doc, "requirements-without-brief");
  const ids: string[] = item.entries.map((e: Doc) => e.id);
  const lines = part(await cardOf(factsOf("facts-ok"), doc), "At risk").filter((l) => /no open brief/.test(l)).map(textOf);
  assert.equal(lines.length, 1);
  for (const id of ids) assert.ok((lines[0] as string).includes(id), id);
  assert.match(lines[0] as string, ids.length === 1 ? /has no open brief\.$/ : /have no open brief\.$/);
});

