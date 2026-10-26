// The cockpit (SPEC-0010, REQ-110): /cockpit shows, for each of a person's projects, the pull requests ready to merge and the
// specs waiting for approval in plain words, and a count of pull requests in each state, each linked to GitHub. The data is
// agk's pipeline document (schema 1, `kit/pipeline-schema.json`), read from the latest unexpired artifact `agk-pipeline` with
// the person's own token as the facts are. Fixtures are pipeline documents of agk's shape (tests/fixtures/pipeline) and
// recorded GitHub answers in memory, no network. Markers REQ-110 AC1 to AC8.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { SESSION_COOKIE, createApp, createCore, createGithubClient, readPipeline, sealSession, type CockpitList, type Config, type ConfigName, type PipelineResult } from "../src/core/index.ts";
import { zip } from "./support/zip.ts";

const TOKEN = "ghu_fixture_user_token_0123456789";
const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const NOW = Date.UTC(2026, 9, 26, 12);
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";
const dir = resolve(import.meta.dirname, "fixtures", "pipeline");
type Doc = any;
const clone = (doc: Doc): Doc => JSON.parse(JSON.stringify(doc));
const read = (path: string): string => readFileSync(path, "utf8");
const fixture = (name: string): Doc => JSON.parse(read(resolve(dir, `${name}.pipeline.json`)));
const values: Record<ConfigName, string> = { GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid", GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value", SESSION_KEY: KEY, CALLBACK_URL: "https://portal.example/callback" };
const config: Config = { get: (name) => values[name] };

interface Artifact {
  id: number;
  name: string;
  expired?: boolean;
  created: string;
  entries?: { name: string; data: string }[];
}
// A GitHub that answers the artifact routes of one repository, counting what is asked of it.
function githubWith(artifacts: Artifact[], repository = "acme/api", log: string[] = []) {
  const list = { total_count: artifacts.length, artifacts: artifacts.map((a) => ({ id: a.id, name: a.name, expired: a.expired ?? false, created_at: a.created, expires_at: "2027-03-01T00:00:00Z" })) };
  return createGithubClient({
    fetch: async (url, init) => {
      log.push(`${init?.method ?? "GET"} ${url}`);
      if (url === `https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=1`) return new Response(JSON.stringify(list));
      const match = new RegExp(`^https://api\\.github\\.com/repos/${repository}/actions/artifacts/(\\d+)/zip$`).exec(url);
      if (match !== null) return new Response(null, { status: 302, headers: { location: `${SIGNED}&id=${match[1]}` } });
      if (url.startsWith(SIGNED)) {
        const id = Number(new URL(url).searchParams.get("id"));
        const artifact = artifacts.find((a) => a.id === id);
        return new Response(zip(artifact?.entries ?? []) as BodyInit);
      }
      return new Response("{}", { status: 404 });
    },
  });
}
const pipelineArtifact = (id: number, doc: unknown, created = "2026-10-26T07:13:00Z", name = "agk-pipeline"): Artifact => ({ id, name, created, entries: [{ name: "pipeline.json", data: typeof doc === "string" ? doc : JSON.stringify(doc) }] });
const readOf = (artifacts: Artifact[]): Promise<PipelineResult> => readPipeline(githubWith(artifacts), TOKEN, "acme/api", NOW);

const unescape = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const textOf = (inner: string): string => unescape(inner.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const ok = (projects: { name: string; result: PipelineResult }[], notices: string[] = []): CockpitList => ({ kind: "ok", notices, projects });
const found = (document: Doc): PipelineResult => ({ kind: "pipeline", document });
const NOT_THERE: PipelineResult = { kind: "unknown", reason: "no pipeline document exists" };

async function cockpit(list: CockpitList, init: RequestInit = {}): Promise<Response> {
  const app = createApp(createCore({ config, now: () => NOW }), { cockpit: async () => list });
  const cookie = await sealSession({ token: TOKEN, expiresAt: NOW + 3_600_000 }, KEY);
  return app(new Request("https://portal.example/cockpit", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` }, ...init }));
}
const pageOf = async (list: CockpitList): Promise<string> => {
  const response = await cockpit(list);
  assert.equal(response.status, 200);
  return response.text();
};
// The part with this heading: its html, up to the next part.
function part(page: string, heading: string): string {
  const at = page.indexOf(`<h2>${heading}</h2>`);
  assert.ok(at >= 0, `${heading} is shown`);
  const rest = page.slice(at + 4 + heading.length + 5);
  const end = rest.search(/<h2>|<\/main>|<\/section>\s*$/);
  return end < 0 ? rest : rest.slice(0, end);
}
const lines = (html: string): string[] => [...html.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map((m) => m[1] as string);

test("REQ-110 AC6: the pipeline document is the latest unexpired artifact agk-pipeline, read with the person's token, and nothing else is asked", async () => {
  const log: string[] = [];
  const older = fixture("quiet");
  const github = githubWith([pipelineArtifact(1, older, "2026-10-25T07:00:00Z"), pipelineArtifact(2, fixture("busy"), "2026-10-26T07:13:00Z"), pipelineArtifact(3, older, "2026-10-26T08:00:00Z", "agk-facts-2026-W43"), { ...pipelineArtifact(4, older, "2026-10-26T09:00:00Z"), expired: true }], "acme/api", log);
  const result = await readPipeline(github, TOKEN, "acme/api", NOW);
  assert.equal(result.kind, "pipeline");
  assert.deepEqual((result as Extract<PipelineResult, { kind: "pipeline" }>).document, fixture("busy"), "the newest unexpired agk-pipeline, not an agk-facts one, not an expired one");
  assert.ok(log.every((l) => l.startsWith("GET ")), "only reads");
  assert.equal(log.filter((l) => l.includes("/zip")).length, 1, "one download");
});

test("REQ-110 AC4: no artifact, a failed listing and an unreadable archive each give not known yet with a reason, never a document", async () => {
  assert.deepEqual(await readOf([]), { kind: "unknown", reason: "no pipeline document exists" });
  assert.deepEqual(await readOf([pipelineArtifact(1, fixture("busy"), "2026-10-26T07:13:00Z", "agk-facts-2026-W43")]), { kind: "unknown", reason: "no pipeline document exists" });
  assert.deepEqual(await readOf([{ ...pipelineArtifact(1, fixture("busy")), expired: true }]), { kind: "unknown", reason: "no pipeline document exists" });
  const refused = createGithubClient({ fetch: async () => new Response("{}", { status: 403 }) });
  assert.deepEqual(await readPipeline(refused, TOKEN, "acme/api", NOW), { kind: "unknown", reason: "GitHub answered 403" });
  const broken = createGithubClient({ fetch: async () => { throw new Error("offline"); } });
  assert.equal((await readPipeline(broken, TOKEN, "acme/api", NOW)).kind, "unknown");
  for (const entries of [[], [{ name: "facts.json", data: "{}" }], [{ name: "pipeline.json", data: JSON.stringify(fixture("busy")) }, { name: "extra.json", data: "{}" }]]) {
    const result = await readOf([{ id: 1, name: "agk-pipeline", created: "2026-10-26T07:13:00Z", entries }]);
    assert.deepEqual(result, { kind: "unknown", reason: "the archive could not be read" }, JSON.stringify(entries.map((e) => e.name)));
  }
  await assert.rejects(readPipeline(githubWith([]), TOKEN, "not a repository", NOW), /not allowed/);
});

test("REQ-110 AC6: the document is checked against agk's closed list: an extra or missing key, a wrong type or a schema it does not read is refused whole", async () => {
  const bad: [string, (d: Doc) => void][] = [
    ["an extra key", (d) => (d.extra = 1)],
    ["schema missing", (d) => delete d.schema],
    ["as_of missing", (d) => delete d.as_of],
    ["ready missing", (d) => delete d.ready],
    ["approve missing", (d) => delete d.approve],
    ["counts missing", (d) => delete d.counts],
    ["as_of not a time", (d) => (d.as_of = "2026-10-26")],
    ["as_of with an offset", (d) => (d.as_of = "2026-10-26T07:13:00+02:00")],
    ["a ready item with an extra key", (d) => (d.ready[0].title = "x")],
    ["a ready item without a summary", (d) => delete d.ready[0].summary],
    ["a ready number as text", (d) => (d.ready[0].number = "7")],
    ["a ready number as a fraction", (d) => (d.ready[0].number = 7.5)],
    ["an empty summary", (d) => (d.ready[0].summary = "")],
    ["a summary as a number", (d) => (d.ready[0].summary = 1)],
    ["a ready url that is not https", (d) => (d.ready[0].url = "http://github.com/a/b/pull/7")],
    ["a ready url missing", (d) => delete d.ready[0].url],
    ["an approve item with an extra key", (d) => (d.approve[0].sha = "abc")],
    ["an approve spec of another shape", (d) => (d.approve[0].spec = "SPEC-36")],
    ["an approve spec as lower case", (d) => (d.approve[0].spec = "spec-0036")],
    ["an empty spec title", (d) => (d.approve[0].spec_title = "")],
    ["an approve url that is not https", (d) => (d.approve[0].url = "ftp://x")],
    ["a seventh count", (d) => (d.counts.extra = 0)],
    ["a count missing", (d) => delete d.counts.fix],
    ["a count as text", (d) => (d.counts.review = "2")],
    ["a fractional count", (d) => (d.counts.review = 0.5)],
    ["a negative count", (d) => (d.counts.review = -1)],
    ["a count as another word", (d) => (d.counts.ready = "none")],
    ["a count as null", (d) => (d.counts.ready = null)],
    ["ready as an object", (d) => (d.ready = {})],
    ["approve as text", (d) => (d.approve = "none")],
  ];
  for (const [name, mutate] of bad) {
    const doc = clone(fixture("busy"));
    mutate(doc);
    const result = await readOf([pipelineArtifact(1, doc)]);
    assert.deepEqual(result, { kind: "unknown", reason: "the pipeline document could not be read" }, name);
  }
  for (const text of ["not json", "[]", "null", '"x"']) assert.deepEqual(await readOf([pipelineArtifact(1, text)]), { kind: "unknown", reason: "the pipeline document could not be read" }, text);
  for (const schema of [2, 0, 99]) {
    const doc = clone(fixture("busy"));
    doc.schema = schema;
    assert.deepEqual(await readOf([pipelineArtifact(1, doc)]), { kind: "unknown", reason: "the pipeline document has a schema this page does not read" }, `schema ${schema}`);
  }
  for (const schema of ["1", 1.5, null]) {
    const doc = clone(fixture("busy"));
    doc.schema = schema;
    assert.deepEqual(await readOf([pipelineArtifact(1, doc)]), { kind: "unknown", reason: "the pipeline document could not be read" }, `schema ${String(schema)}`);
  }
  for (const name of ["busy", "quiet", "unreadable", "many"]) assert.equal((await readOf([pipelineArtifact(1, fixture(name))])).kind, "pipeline", name);
  const word = clone(fixture("busy"));
  word.counts.review = "unknown";
  word.ready[0].summary = "unknown";
  word.approve[0].spec = "unknown";
  assert.equal((await readOf([pipelineArtifact(1, word)])).kind, "pipeline", "the word unknown where agk allows it");
});

test("REQ-110 AC1: Needs your merge: one line per item, the plain summary then reviewed, ready to merge, linked, in the data's order, with the fallback for an unknown summary", async () => {
  const page = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(fixture("busy")) }]));
  const items = lines(part(page, "Needs your merge"));
  assert.deepEqual(items.map(textOf), ["A person can see the queue.: reviewed, ready to merge", "Pull request #8: reviewed, ready to merge"]);
  assert.match(items[0] as string, /<a href="https:\/\/github\.com\/demo-org\/demo-repo\/pull\/7">/);
  assert.match(items[1] as string, /<a href="https:\/\/github\.com\/demo-org\/demo-repo\/pull\/8">/);
  assert.match(part(page, "Needs your merge"), /demo-org\/demo-repo/, "grouped under the project's name");
  assert.doesNotMatch(page, /Verdict|cleared [0-9a-f]{7}|\b[0-9a-f]{7,40}\b/, "no verdict text and no commit identifier");
});

test("REQ-110 AC1: the summary is escaped and cut at 120 characters with an ellipsis, and no title of a pull request is shown", async () => {
  const doc = clone(fixture("busy"));
  doc.ready[0].summary = '<b onclick="x">Tidy</b> & "quote"';
  doc.ready[1].summary = "x".repeat(121);
  doc.ready.push({ number: 9, summary: "y".repeat(120), url: "https://github.com/demo-org/demo-repo/pull/9" });
  const items = lines(part(await pageOf(ok([{ name: "demo-org/demo-repo", result: found(doc) }])), "Needs your merge"));
  assert.doesNotMatch(items[0] as string, /<b onclick/);
  assert.equal(textOf(items[0] as string), '<b onclick="x">Tidy</b> & "quote": reviewed, ready to merge');
  assert.equal(textOf(items[1] as string), `${"x".repeat(120)}…: reviewed, ready to merge`);
  assert.equal(textOf(items[2] as string), `${"y".repeat(120)}: reviewed, ready to merge`, "120 exactly is not cut");
});

test("REQ-110 AC2: Specs to approve: the spec's own title then waits for your approval, linked, with the fallbacks for an unknown title and an unknown spec", async () => {
  const page = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(fixture("busy")) }]));
  const items = lines(part(page, "Specs to approve"));
  assert.deepEqual(items.map(textOf), ["A plain title: waits for your approval", "Pull request #9 asks for approval of SPEC-0037"]);
  assert.match(items[0] as string, /<a href="https:\/\/github\.com\/demo-org\/demo-repo\/pull\/9">/);
  const doc = clone(fixture("busy"));
  doc.approve = [
    { number: 9, spec: "unknown", spec_title: "Named anyway", url: "https://github.com/demo-org/demo-repo/pull/9" },
    { number: 10, spec: "unknown", spec_title: "unknown", url: "https://github.com/demo-org/demo-repo/pull/10" },
    { number: 11, spec: "SPEC-0040", spec_title: "<i>Title</i> & more", url: "https://github.com/demo-org/demo-repo/pull/11" },
  ];
  const odd = lines(part(await pageOf(ok([{ name: "demo-org/demo-repo", result: found(doc) }])), "Specs to approve"));
  assert.deepEqual(odd.map(textOf), ["Named anyway: waits for your approval", "A spec waiting for approval could not be read: not known yet.", "<i>Title</i> & more: waits for your approval"]);
  assert.match(odd[1] as string, /pull\/10/, "the unknown line keeps its link");
  assert.doesNotMatch(odd[2] as string, /<i>/);
});

test("REQ-110 AC3: In the pipeline: one strip per project with the six counts in order, a count and never a list, an unknown count as not known yet", async () => {
  const page = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(fixture("busy")) }, { name: "demo-org/other", result: found(fixture("unreadable")) }]));
  const strips = lines(part(page, "In the pipeline")).map(textOf);
  assert.deepEqual(strips, ["demo-org/demo-repo: review 2, fix 1, ci red 0, conflict 0, approve 1, ready 2 as of 2026-10-26T07:13:00Z", "demo-org/other: review not known yet, fix not known yet, ci red not known yet, conflict not known yet, approve not known yet, ready not known yet as of 2026-10-26T07:13:00Z"]);
  assert.doesNotMatch(part(page, "In the pipeline"), /pull\/\d+/, "a count, not a list");
});

test("REQ-110 AC3: a count of 0 is a known value, shown muted on every width, and a count above 0 or unknown is never muted", async () => {
  const page = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(fixture("busy")) }, { name: "demo-org/other", result: found(fixture("unreadable")) }]));
  const strip = lines(part(page, "In the pipeline"))[0] as string;
  const spans = [...strip.matchAll(/<span class="count( quiet)?">(.*?)<\/span>/g)].map((m) => [m[1] !== undefined, (m[2] as string).replace(/&nbsp;/g, " ")]);
  assert.deepEqual(spans, [[false, "review 2"], [false, ", fix 1"], [true, ", ci red 0"], [true, ", conflict 0"], [false, ", approve 1"], [false, ", ready 2"]], "each separator belongs to the count it comes before");
  const unknown = lines(part(page, "In the pipeline"))[1] as string;
  assert.doesNotMatch(unknown, /class="count quiet"/);
  const css = await (await createApp(createCore({ config, now: () => NOW }))(new Request("https://portal.example/style.css"))).text();
  assert.match(css, /\.quiet\{color:var\(--muted\)\}/, "muted by the stylesheet");
  assert.doesNotMatch(strip, /class="[^"]*\bzero\b/, "the strip's zeros are never the class the stylesheet hides on a phone");
});

test("REQ-110 AC3: no stray punctuation: a 0 as the first or the last count leaves no leading or trailing comma, in the text or in the markup", async () => {
  for (const [name, counts] of [["last", { review: 3, fix: 2, "ci-red": 1, conflict: 4, approve: 5, ready: 0 }], ["first", { review: 0, fix: 2, "ci-red": 1, conflict: 4, approve: 5, ready: 6 }], ["all", { review: 0, fix: 0, "ci-red": 0, conflict: 0, approve: 0, ready: 0 }]] as const) {
    const doc = clone(fixture("quiet"));
    doc.counts = counts;
    const strip = lines(part(await pageOf(ok([{ name: "demo-org/demo-repo", result: found(doc) }])), "In the pipeline"))[0] as string;
    const text = textOf(strip);
    assert.doesNotMatch(text, /,\s*as of|,\s*,|:\s*,/, `${name}: no comma before as of, doubled or after the colon`);
    const hidden = [...strip.matchAll(/<span class="[^"]*\bzero\b[^"]*">/g)];
    assert.equal(hidden.length, 0, `${name}: nothing in the strip is hidden, so nothing can leave a separator behind`);
  }
});

test("REQ-110 AC4: when nothing waits each empty part says so, and a project with nothing waiting is in the strip only", async () => {
  const quiet = await pageOf(ok([{ name: "demo-org/quiet", result: found(fixture("quiet")) }]));
  assert.equal(textOf(part(quiet, "Needs your merge")), "Nothing waits for you.");
  assert.equal(textOf(part(quiet, "Specs to approve")), "Nothing waits for you.");
  assert.equal(lines(part(quiet, "In the pipeline")).length, 1);
  const mixed = await pageOf(ok([{ name: "demo-org/quiet", result: found(fixture("quiet")) }, { name: "demo-org/demo-repo", result: found(fixture("busy")) }]));
  assert.doesNotMatch(part(mixed, "Needs your merge"), /demo-org\/quiet/, "not named in the parts it has nothing in");
  assert.doesNotMatch(part(mixed, "Specs to approve"), /demo-org\/quiet/);
  assert.match(part(mixed, "In the pipeline"), /demo-org\/quiet/);
  assert.doesNotMatch(mixed, /Nothing waits for you\./, "a part with lines does not say it");
});

test("REQ-110 AC4: a project with no readable pipeline data stands under each part with not known yet and its reason, never as zero or as an empty part", async () => {
  const page = await pageOf(ok([{ name: "demo-org/gone", result: NOT_THERE }, { name: "demo-org/quiet", result: found(fixture("quiet")) }]));
  const gone = "demo-org/gone: not known yet: no pipeline document exists.";
  assert.deepEqual(lines(part(page, "Needs your merge")).map(textOf), [gone]);
  assert.deepEqual(lines(part(page, "Specs to approve")).map(textOf), [gone]);
  assert.deepEqual(lines(part(page, "In the pipeline")).map(textOf), [gone, "demo-org/quiet: review 0, fix 0, ci red 0, conflict 0, approve 0, ready 0 as of 2026-10-26T07:13:00Z"]);
  assert.doesNotMatch(page, /Nothing waits for you\./, "an unknown project is not nothing");
  assert.doesNotMatch(part(page, "In the pipeline").split(gone)[1]?.split("</li>")[0] ?? "", /\b0\b/, "no number of the unknown project");
});

test("REQ-110 AC7: each project's block states the time the data is as of, placed as it is, and no age is computed or limit applied", async () => {
  const old = clone(fixture("busy"));
  old.as_of = "2020-01-02T03:04:05Z";
  const page = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(old) }]));
  assert.equal((page.match(/as of 2020-01-02T03:04:05Z/g) ?? []).length, 3, "in each part the project stands in");
  assert.doesNotMatch(page, /ago|stale|old|days/i);
  assert.match(part(page, "Needs your merge"), /reviewed, ready to merge/, "old data is still shown");
});

test("REQ-110 AC1: a list over 5 lines of one project folds in a details element, its summary the project and the number of lines; 5 lines do not fold", async () => {
  const many = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(fixture("many")) }]));
  const ready = part(many, "Needs your merge");
  assert.match(ready, /<details class="fold"><summary>demo-org\/demo-repo \(7\)<\/summary>/);
  assert.equal(lines(ready).length, 7);
  assert.match(part(many, "Specs to approve"), /<summary>demo-org\/demo-repo \(6\)<\/summary>/);
  const five = clone(fixture("many"));
  five.ready = five.ready.slice(0, 5);
  five.approve = five.approve.slice(0, 5);
  const page = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(five) }]));
  assert.doesNotMatch(page, /<details/);
});

test("REQ-110 AC5: a link is shown only for an address on GitHub, any other address leaves the line as text, and every text from the data is escaped", async () => {
  const doc = clone(fixture("busy"));
  doc.ready[0].url = "https://evil.example/pull/7";
  doc.ready[1].url = 'https://github.com/demo-org/demo-repo/pull/8"onmouseover="x';
  doc.approve[0].url = "https://github.com/demo-org/demo-repo/pull/9 x";
  const page = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(doc) }]));
  assert.deepEqual(lines(part(page, "Needs your merge")).map(textOf), ["A person can see the queue.: reviewed, ready to merge", "Pull request #8: reviewed, ready to merge"]);
  assert.doesNotMatch(page, /evil\.example|onmouseover|pull\/9 x/);
  assert.match(lines(part(page, "Specs to approve"))[0] as string, /^A plain title: waits for your approval$/);
});

test("REQ-110 AC5: the cockpit is read-only: no form, no button, no script, no style attribute, no event handler and no token, and the only actions are links", async () => {
  const page = await pageOf(ok([{ name: "demo-org/demo-repo", result: found(fixture("busy")) }]));
  assert.doesNotMatch(page, /<form|<button|<input|<script|<style|style=|\bon[a-z]+=|tabindex|role=/i);
  assert.doesNotMatch(page, new RegExp(TOKEN));
  assert.match(page, /<h1>Cockpit<\/h1>/);
  assert.match(page, /<a href="\/">All projects<\/a>/);
  const response = await cockpit(ok([]));
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/, "SPEC-0004's headers are unchanged");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("REQ-110 AC5: only GET reaches the cockpit, a visitor with no cookie sees the offer, and an invalid cookie is signed out", async () => {
  const app = createApp(createCore({ config, now: () => NOW }), { cockpit: async () => ok([]) });
  assert.equal((await app(new Request("https://portal.example/cockpit", { method: "POST" }))).status, 404);
  const offer = await app(new Request("https://portal.example/cockpit"));
  assert.match(await offer.text(), /Sign in with GitHub/);
  const stale = await app(new Request("https://portal.example/cockpit", { headers: { cookie: `${SESSION_COOKIE}=garbage` } }));
  assert.match(await stale.text(), /sign in/i);
  assert.match(stale.headers.get("set-cookie") ?? "", /Max-Age=0|expires/i);
});

test("REQ-110 AC6: the cockpit reads only the person's list: a project the person cannot read is never named, and a failure of one project stops no other", async () => {
  const installations = { total_count: 1, installations: [{ id: 5, permissions: { actions: "read", metadata: "read" }, account: { login: "acme" } }] };
  const repositories = { total_count: 2, repositories: [{ full_name: "acme/api" }, { full_name: "acme/web" }] };
  const log: string[] = [];
  const github = createGithubClient({
    fetch: async (url, init) => {
      log.push(`${init?.method ?? "GET"} ${url}`);
      if (url.startsWith("https://api.github.com/user/installations?")) return new Response(JSON.stringify(installations));
      if (url.startsWith("https://api.github.com/user/installations/5/repositories?")) return new Response(JSON.stringify(repositories));
      if (url.startsWith("https://api.github.com/repos/acme/api/actions/artifacts?")) return new Response(JSON.stringify({ total_count: 1, artifacts: [{ id: 1, name: "agk-pipeline", expired: false, created_at: "2026-10-26T07:13:00Z", expires_at: "2027-03-01T00:00:00Z" }] }));
      if (url === "https://api.github.com/repos/acme/api/actions/artifacts/1/zip") return new Response(null, { status: 302, headers: { location: SIGNED } });
      if (url === SIGNED) return new Response(zip([{ name: "pipeline.json", data: JSON.stringify(fixture("busy")) }]) as BodyInit);
      return new Response("{}", { status: 500 });
    },
  });
  const app = createApp(createCore({ config, now: () => NOW }), { github });
  const cookie = await sealSession({ token: TOKEN, expiresAt: NOW + 3_600_000 }, KEY);
  const page = await (await app(new Request("https://portal.example/cockpit", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }))).text();
  assert.match(part(page, "Needs your merge"), /acme\/api/);
  assert.ok(lines(part(page, "Needs your merge")).map(textOf).includes("acme/web: not known yet: GitHub answered 500."), "the failing project is its own line");
  assert.doesNotMatch(page, /acme\/secret/);
  assert.ok(log.every((l) => l.startsWith("GET ")), "reads only");
  assert.equal(log.filter((l) => l.includes("acme/api/actions/artifacts?")).length, 1, "one listing for each project");
});

test("REQ-110 AC6: a person whose projects cannot be listed, and one with none, read the existing phrases", async () => {
  assert.match(await pageOf({ kind: "unreadable" }), /Projects could not be read: not known yet\./);
  assert.match(await pageOf(ok([])), /No projects are available to you yet\./);
  const refused = await pageOf(ok([], ["<p>The GitHub App installed on acme has more access than this portal allows. Ask its administrator to review it.</p>"]));
  assert.match(refused, /has more access than this portal allows/);
  assert.doesNotMatch(refused, /No projects are available/);
});

test("REQ-110 AC8: the cockpit is linked from the start page and from a project's page, and its title and heading are Cockpit", async () => {
  const app = createApp(createCore({ config, now: () => NOW }), {
    projects: async () => ({ kind: "ok", notices: [], projects: [] }),
    project: async () => ({ kind: "found", result: { kind: "unknown", reason: "no facts artifact exists for its latest week" } }),
  });
  const cookie = await sealSession({ token: TOKEN, expiresAt: NOW + 3_600_000 }, KEY);
  const get = async (path: string): Promise<string> => (await app(new Request(`https://portal.example${path}`, { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }))).text();
  assert.match(await get("/"), /<a href="\/cockpit">Cockpit<\/a>/);
  assert.match(await get("/p/acme/api"), /<a href="\/cockpit">Cockpit<\/a>/);
  const page = await pageOf(ok([]));
  assert.match(page, /<title>Cockpit<\/title>/);
});
