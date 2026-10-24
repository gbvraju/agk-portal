// The look of the page, as markup (SPEC-0008 rules 1, 4 to 9): classes and no style attribute, the logo and the title, the
// status badges (a word and a colour), only native controls, the parts in a grid with Time and review as tiles, the
// content changes (the title, the removed facts line, the kept week, the fold over 5) and no script. Markers REQ-108 AC1,
// AC4, AC5, AC6, AC7 and AC8. The data is this repository's own scripts/agk/product_report.py --json on the kit's fixtures;
// recorded GitHub answers and archives in memory, no network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SESSION_COOKIE, createApp, createCore, createGithubClient, factsCard, readFacts, sealSession, type Config, type ConfigName } from "../src/core/index.ts";
import { writeReport } from "./support/report-script.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));

async function card(fixture: string, change?: (report: Doc) => void, report = true): Promise<string> {
  const written = writeReport(fixture);
  const doc = clone(written.document);
  change?.(doc);
  const artifacts = { total_count: 1, artifacts: [{ id: 777, name: `agk-facts-${doc.week}`, expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] };
  const entries = [{ name: "facts.json", data: written.facts }, ...(report ? [{ name: "report.json", data: JSON.stringify(doc) }] : [])];
  const bytes = zip(entries);
  const routes: Record<string, () => Response> = {
    "https://api.github.com/repos/acme/api/actions/artifacts?per_page=100&page=1": () => new Response(JSON.stringify(artifacts)),
    "https://api.github.com/repos/acme/api/actions/artifacts/777/zip": () => new Response(null, { status: 302, headers: { location: SIGNED } }),
    [SIGNED]: () => new Response(bytes as BodyInit),
  };
  const github = createGithubClient({ fetch: async (url) => routes[url]?.() ?? new Response("{}", { status: 404 }) });
  return factsCard("acme/api", await readFacts(github, TOKEN, "acme/api", START));
}

const values: Record<ConfigName, string> = { GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid", GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value", SESSION_KEY: KEY, CALLBACK_URL: "https://portal.example/callback" };
const config: Config = { get: (name) => values[name] };
// The whole signed-in page around the given cards.
async function signedIn(cards: string[]): Promise<string> {
  const app = createApp(createCore({ config, now: () => START }), { projects: async () => cards });
  const cookie = await sealSession({ token: TOKEN, expiresAt: START + 3_600_000 }, KEY);
  const response = await app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  assert.equal(response.status, 200);
  return response.text();
}
async function signedOut(): Promise<string> {
  const app = createApp(createCore({ config, now: () => START }), {});
  return (await app(new Request("https://portal.example/"))).text();
}

const unescape = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const BADGE = /<span class="badge ([a-z]+)">(.*?)<\/span>/gs;
const textOf = (inner: string): string => unescape(inner.replace(BADGE, "").replace(/<[^>]*>/g, "")).trim();
const WORDS: Record<string, string> = { done: "Done", proven: "Proven", decide: "Needs you", risk: "At risk", none: "Not known yet" };

// The badges of a page: every one has text, and the text is the word of its colour. Returns the problems.
function badgeProblems(html: string): string[] {
  const problems: string[] = [];
  for (const m of html.matchAll(/<span class="badge[^"]*"[^>]*>(.*?)<\/span>/gs)) {
    const whole = m[0];
    const cls = /class="badge ([a-z]+)"/.exec(whole)?.[1];
    if (cls === undefined || WORDS[cls] === undefined) problems.push(`unknown colour: ${whole}`);
    else if ((m[1] ?? "").replace(/<[^>]*>/g, "").trim() === "") problems.push(`no text: ${whole}`);
    else if (m[1] !== WORDS[cls]) problems.push(`wrong word: ${whole}`);
  }
  return problems;
}
function body(page: string, title: string): string {
  const at = page.indexOf(`<h4>${title}</h4>`);
  assert.ok(at >= 0, `${title} is shown`);
  const rest = page.slice(at + `<h4>${title}</h4>`.length);
  const end = rest.search(/<h4>|<\/section>/);
  return end < 0 ? rest : rest.slice(0, end);
}
const lis = (b: string): string[] => [...b.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map((m) => m[1] as string);

test("REQ-108 AC1: no page carries a style attribute, and the head names the one stylesheet and nothing else", async () => {
  for (const page of [await signedIn([await card("kinds")]), await signedIn([]), await signedOut()]) {
    assert.doesNotMatch(page, /\sstyle\s*=/i);
    assert.deepEqual([...page.matchAll(/<link[^>]*>/g)].map((m) => m[0]), ['<link rel="stylesheet" href="/style.css">']);
    assert.doesNotMatch(page, /<style\b|<script\b|\son[a-z]+\s*=/i);
  }
});

test("REQ-108 AC7: the logo is the text AGK, there is no image, and an icon is inline SVG marked aria-hidden", async () => {
  for (const page of [await signedIn([await card("kinds")]), await signedOut()]) {
    assert.match(page, /<header class="top"><span class="logo">AGK<\/span><\/header>/);
    assert.doesNotMatch(page, /<img\b|<picture\b|<source\b|<video\b|<audio\b|<object\b|<embed\b|<iframe\b/i);
    for (const svg of page.matchAll(/<svg\b[^>]*>/g)) assert.match(svg[0], /aria-hidden="true"/);
  }
});

test("REQ-108 AC8: the signed-in page is titled Your projects, with the title as its heading, and the sign-out button stays", async () => {
  const page = await signedIn([await card("kinds")]);
  assert.match(page, /<title>Your projects<\/title>/);
  assert.match(page, /<h1>Your projects<\/h1>/);
  assert.match(page, /<form method="post" action="\/signout"><button type="submit">Sign out<\/button><\/form>/);
  assert.doesNotMatch(page, /<title>Portal<\/title>/);
});

test("REQ-108 AC8: a card that shows This week has no Facts read line, and a card without it keeps the week as Week {week}: not known yet: {reason}", async () => {
  const withWeek = await card("kinds");
  assert.doesNotMatch(withWeek, /Facts read for/);
  assert.match(withWeek, /Week 2026-W41: Monday/);
  const old = await card("kinds", undefined, false);
  assert.match(old, /<p>Week 2026-W41: not known yet: the artifact has no report \(made before kit 0\.39\.0\)\.<\/p>/);
  assert.doesNotMatch(old, /Facts read for|This week/);
  const unreadable = await card("kinds", (r) => {
    r.schema = 2;
  });
  assert.match(unreadable, /<p>Week 2026-W41: not known yet: the report could not be read\.<\/p>/);
  assert.doesNotMatch(unreadable, /Facts read for/);
});

test("REQ-108 AC4: a status is a word and a colour: Done, Proven, Needs you, At risk, Not known yet", async () => {
  const page = await card("kinds");
  assert.deepEqual(badgeProblems(page), []);
  const kinds = (part: string): string[] => lis(body(page, part)).map((l) => [...l.matchAll(BADGE)].map((m) => `${m[1]}:${m[2]}`).join(","));
  assert.deepEqual(kinds("Delivered"), ["done:Done", "done:Done", "done:Done", "done:Done", "done:Done", "done:Done", "done:Done", "done:Done", "done:Done"]);
  assert.deepEqual(kinds("Proven"), ["proven:Proven", "", "", "", "", "", "proven:Proven", ""]);
  assert.deepEqual(kinds("Needs your decision"), Array(9).fill("decide:Needs you"));
  assert.deepEqual(kinds("At risk"), Array(6).fill("risk:At risk"));
  assert.deepEqual(kinds("Time and review"), Array(9).fill(""));
  const unknown = await card("dirty-unknown");
  assert.deepEqual(badgeProblems(unknown), []);
  assert.ok(lis(body(unknown, "Proven")).some((l) => l.includes('<span class="badge none">Not known yet</span>')));
});

test("REQ-108 AC4: a badge with no text, a wrong word or an unknown colour fails the check", () => {
  assert.equal(badgeProblems('<span class="badge done">Done</span>').length, 0);
  assert.equal(badgeProblems('<span class="badge done"></span>').length, 1);
  assert.equal(badgeProblems('<span class="badge done"> </span>').length, 1);
  assert.equal(badgeProblems('<span class="badge risk">Done</span>').length, 1);
  assert.equal(badgeProblems('<span class="badge teal">Done</span>').length, 1);
});

test("REQ-108 AC4: the badge never changes the sentence: the line without its badge is the same fixed phrase", async () => {
  const page = await card("kinds");
  assert.equal(textOf(lis(body(page, "Delivered"))[5] as string), "A change was merged on 2026-10-08. (#5)");
  assert.equal(textOf(lis(body(page, "Needs your decision"))[0] as string), "A specification waits for approval. (SPEC-0002)");
});

test("REQ-108 AC5: only native controls are used: links, a button, details and summary; no tabindex, no role, no script", async () => {
  const page = await signedIn([await card("kinds", (r) => {
    r.sections.needs_you[2].items = Array.from({ length: 6 }, (_, i) => ({ kind: "question", id: `Q-X-${i}`, asked_in: "docs/a.md", links: [] }));
    r.sections.needs_you[2].count = 6;
  })]);
  assert.doesNotMatch(page, /\stabindex\s*=|\srole\s*=|<script\b|\sonclick\s*=/i);
  const tags = new Set([...page.matchAll(/<([a-z][a-z0-9]*)/g)].map((m) => m[1]));
  for (const interactive of ["input", "select", "textarea", "label", "dialog", "menu"]) assert.ok(!tags.has(interactive), `${interactive} is not used`);
  assert.ok(tags.has("details") && tags.has("summary") && tags.has("button") && tags.has("a"));
});

test("REQ-108 AC6: the four parts stand in one grid in the order of the spec, and Time and review follows as tiles", async () => {
  const page = await card("kinds");
  const grid = page.indexOf('<div class="parts">');
  const time = page.indexOf('<div class="part time">');
  assert.ok(grid > 0 && time > grid, "the grid, then the tiles");
  const inGrid = page.slice(grid, time);
  assert.deepEqual([...inGrid.matchAll(/<h4>(.*?)<\/h4>/g)].map((m) => m[1]), ["Delivered", "Proven", "Needs your decision", "At risk"]);
  assert.equal((inGrid.match(/<div class="part"/g) ?? []).length, 4);
  assert.doesNotMatch(inGrid, /Time and review/);
  const tiles = page.slice(time);
  assert.match(tiles, /<h4>Time and review<\/h4>\s*<ul class="tiles">/);
  assert.equal((tiles.match(/<li class="tile">/g) ?? []).length, 9);
  assert.deepEqual([...page.matchAll(/<h4>(.*?)<\/h4>/g)].map((m) => m[1]), ["Delivered", "Proven", "Needs your decision", "At risk", "Time and review"]);
});

test("REQ-108 AC6: an empty part stays in its place and says Nothing this week, in the grid and as tiles", async () => {
  const page = await card("empty");
  assert.equal((page.match(/<p>Nothing this week\.<\/p>/g) ?? []).length, 5, "all five parts: a housekeeping total of 0 with no open issue is no longer an item (agk SPEC-0026 rule 6)");
  assert.match(page, /<div class="part time">\s*<h4>Time and review<\/h4>\s*<p>Nothing this week\.<\/p>/);
});

test("REQ-108 AC8: a Needs your decision group of more than 5 items is folded in a details element, with the group's heading and count as its summary", async () => {
  const many = (n: number): ((r: Doc) => void) => (r) => {
    r.sections.needs_you[2].items = Array.from({ length: n }, (_, i) => ({ kind: "question", id: `Q-X-${i + 1}`, asked_in: "docs/a.md", links: [] }));
    r.sections.needs_you[2].count = n;
  };
  const six = body(await card("kinds", many(6)), "Needs your decision");
  assert.match(six, /<details class="fold"><summary>Questions waiting \(6\)<\/summary>\s*<ul>/);
  assert.equal((six.match(/<details/g) ?? []).length, 1, "only the group over 5");
  assert.equal(lis(six.slice(six.indexOf("<details"), six.indexOf("</details>"))).length, 6);
  assert.doesNotMatch(six, /<h5>Questions waiting/, "the summary is the heading");
  const five = body(await card("kinds", many(5)), "Needs your decision");
  assert.doesNotMatch(five, /<details/);
  assert.match(five, /<h5>Questions waiting \(5\)<\/h5>/);
});

test("REQ-108 AC8: the fold counts nothing: the summary shows the data's own count, and a group with an unknown count is folded by its items", async () => {
  const page = await card("kinds", (r) => {
    r.sections.needs_you[2].items = Array.from({ length: 7 }, (_, i) => ({ kind: "question", id: `Q-X-${i + 1}`, asked_in: "docs/a.md", links: [] }));
    r.sections.needs_you[2].count = 9;
  });
  assert.match(body(page, "Needs your decision"), /<summary>Questions waiting \(9\)<\/summary>/);
  const unknown = await card("kinds", (r) => {
    r.sections.needs_you[2].items = Array.from({ length: 6 }, (_, i) => ({ kind: "question", id: `Q-X-${i + 1}`, asked_in: "docs/a.md", links: [] }));
    r.sections.needs_you[2].count = "unknown";
  });
  assert.match(body(unknown, "Needs your decision"), /<summary>Questions waiting \(not known yet\)<\/summary>/);
});

test("REQ-108 AC8: the At risk lines are not folded", async () => {
  const page = await card("kinds", (r) => {
    r.sections.at_risk[2].entries = Array.from({ length: 8 }, (_, i) => ({ number: i + 1, days: 2 }));
    r.sections.at_risk[2].links = [];
  });
  assert.doesNotMatch(body(page, "At risk"), /<details/);
  assert.match(body(page, "At risk"), /Changes #1 \(2 days\), #2 \(2 days\)/);
});

test("REQ-108 AC8: every sentence is still the data's or a fixed phrase: a changed number changes only its own line", async () => {
  const base = (await card("kinds")).split("\n");
  const changed = (await card("kinds", (r) => {
    r.sections.at_risk[2].entries[0].days = 99;
  })).split("\n");
  assert.equal(changed.length, base.length);
  assert.equal(base.filter((l, i) => l !== changed[i]).length, 1);
});
