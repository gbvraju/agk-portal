// The facts of each project (SPEC-0001 rules 2 and 4 to 7): the artifact listing and choice, the download through the
// redirect, the archive, the schema check, the cards and the local failure of one repository. Markers REQ-101 AC1 to AC7
// are in the test names. Recorded GitHub answers and archives built in memory, no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  ARCHIVE_REASON,
  LISTING_INCOMPLETE_REASON,
  MALFORMED_LIST_REASON,
  NO_ARTIFACT_REASON,
  REQUEST_FAILED_REASON,
  SESSION_COOKIE,
  createApp,
  createCore,
  createGithubClient,
  readFacts,
  sealSession,
  statusReason,
  type Config,
  type ConfigName,
} from "../src/core/index.ts";
import { zip } from "./support/zip.ts";

const fixtures = resolve(import.meta.dirname, "fixtures", "github");
const fixture = (name: string): string => readFileSync(resolve(fixtures, `${name}.json`), "utf8");

const TOKEN = "ghu_fixture_user_token_0123456789";
const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const values: Record<ConfigName, string> = {
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
  SESSION_KEY: KEY,
  CALLBACK_URL: "https://portal.example/callback",
};
const config: Config = { get: (name) => values[name] };
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED_SECRET_VALUE";

type Answer = { status?: number; body?: string | Uint8Array | ReadableStream<Uint8Array>; location?: string } | Error;
type Routes = Record<string, Answer>;

function harness(routes: Routes) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const github = createGithubClient({
    fetch: async (url, init) => {
      calls.push({ url, init });
      const answer = routes[url.replace("https://api.github.com", "")] ?? routes[url];
      if (answer instanceof Error) throw answer;
      if (answer === undefined) return new Response("{}", { status: 404 });
      const headers = answer.location === undefined ? undefined : { location: answer.location };
      return new Response(answer.body === undefined ? null : (answer.body as BodyInit), { status: answer.status ?? 200, headers });
    },
  });
  const app = createApp(createCore({ config, now: () => START }), { github });
  return { app, github, calls };
}

async function home(app: (r: Request) => Promise<Response>): Promise<string> {
  const cookie = await sealSession({ token: TOKEN, expiresAt: START + 3_600_000 }, KEY);
  const response = await app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }));
  assert.equal(response.status, 200, "the page does not fail");
  return response.text();
}

const FACTS = { schema: 1, kit_version: "0.32.0", repo: "acme/api", unknown_key_kept: { a: [1, 2, 3] }, value: "unknown" };
const archive = (document: unknown = FACTS): Uint8Array => zip([{ name: "facts.json", data: typeof document === "string" ? document : JSON.stringify(document) }]);

const LIST = "/repos/acme/api/actions/artifacts?per_page=100&page=1";
const ZIP = (id: number): string => `/repos/acme/api/actions/artifacts/${id}/zip`;
const readable = (id = 505, bytes: Uint8Array = archive()): Routes => ({
  [LIST]: { body: fixture("artifacts-weeks") },
  [ZIP(id)]: { status: 302, location: SIGNED },
  [SIGNED]: { body: bytes },
});
const factsOf = (routes: Routes) => readFacts(harness(routes).github, TOKEN, "acme/api", START);

const listing: Routes = {
  "/user/installations?per_page=100&page=1": { body: fixture("installations-ok") },
  "/user/installations/1001/repositories?per_page=100&page=1": { body: fixture("repositories-1001-page1") },
  "/user/installations/1001/repositories?per_page=100&page=2": { body: fixture("repositories-1001-page2") },
  "/user/installations/1002/repositories?per_page=100&page=1": { body: fixture("repositories-1002-page1") },
};

test("REQ-101 AC1: the listing keeps only unexpired agk-facts-<week>, takes the latest week, then the newest of that week, and downloads it with the person's token", async () => {
  const { github, calls } = harness(readable());
  const result = await readFacts(github, TOKEN, "acme/api", START);
  assert.equal(result.kind, "facts");
  if (result.kind === "facts") assert.equal(result.week, "2026-W42", "W43 is past its expiry, W44 is expired, other names are ignored");
  assert.deepEqual(
    calls.map((c) => c.url),
    ["https://api.github.com" + LIST, "https://api.github.com" + ZIP(505), SIGNED],
    "505 is the newest of week 42; the signed address is fetched last",
  );
  for (const call of calls.slice(0, 2)) {
    assert.equal(new Headers(call.init?.headers).get("authorization"), `Bearer ${TOKEN}`);
    assert.equal(call.init?.redirect, "manual");
  }
  assert.equal(calls[2]!.init?.headers, undefined, "the signed address is fetched without any header");
});

test("REQ-101 AC1: the artifact list is read page by page until the count GitHub states", async () => {
  const page = (id: number, name: string): string => JSON.stringify({ total_count: 2, artifacts: [{ id, name, expired: false, created_at: "2026-10-19T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] });
  const { github, calls } = harness({
    [LIST]: { body: page(1, "agk-facts-2026-W41") },
    "/repos/acme/api/actions/artifacts?per_page=100&page=2": { body: page(2, "agk-facts-2026-W42") },
    [ZIP(2)]: { status: 302, location: SIGNED },
    [SIGNED]: { body: archive() },
  });
  const result = await readFacts(github, TOKEN, "acme/api", START);
  assert.equal(result.kind === "facts" && result.week, "2026-W42", "the latest week is on the second page");
  assert.equal(calls.length, 4);
});

test("REQ-101 AC1: a listing the page cap ends before the stated count is not known, never a guess at the latest week", async () => {
  const routes: Routes = { [ZIP(1)]: { status: 302, location: SIGNED }, [SIGNED]: { body: archive() } };
  for (let n = 1; n <= 12; n += 1) {
    routes[`/repos/acme/api/actions/artifacts?per_page=100&page=${n}`] = { body: JSON.stringify({ total_count: 25, artifacts: [{ id: n, name: "agk-facts-2026-W41", expired: false, created_at: "2026-10-19T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] }) };
  }
  assert.deepEqual(await factsOf(routes), { kind: "unknown", reason: LISTING_INCOMPLETE_REASON });
});

test("REQ-101 AC2: a document with schema 1 reaches the page unchanged, with or without kit_version, with every key kept", async () => {
  for (const document of [FACTS, { schema: 1, repo: "acme/api", unknown_key_kept: { a: [1, 2, 3] } }, { schema: 1 }]) {
    const result = await factsOf(readable(505, archive(document)));
    assert.equal(result.kind, "facts");
    if (result.kind === "facts") assert.deepEqual(result.document, document, "nothing filtered, renamed or completed");
  }
  const html = await home(harness({ ...listing, "/repos/acme/api/actions/artifacts?per_page=100&page=1": { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location: SIGNED }, [SIGNED]: { body: archive() } }).app);
  assert.match(html, /<h2><a href="https:\/\/github\.com\/acme\/api">acme\/api<\/a><\/h2>\s*<p>Facts read for 2026-W42\.<\/p>/);
});

test("REQ-101 AC2: an archive stored without compression is read the same", async () => {
  const stored = zip([{ name: "facts.json", data: JSON.stringify(FACTS), method: 0 }]);
  const result = await factsOf(readable(505, stored));
  assert.equal(result.kind === "facts" && JSON.stringify(result.document), JSON.stringify(FACTS));
});

test("REQ-101 AC3: a schema other than 1, a missing schema and invalid JSON each give 'not known yet' with that reason, and the page still renders", async () => {
  const cases: [string, unknown, string][] = [
    ["schema 2", { schema: 2 }, "the schema is not 1"],
    ["schema as text", { schema: "1" }, "the schema is not 1"],
    ["schema true", { schema: true }, "the schema is not 1"],
    ["schema 1.5", { schema: 1.5 }, "the schema is not 1"],
    ["schema null", { schema: null }, "the schema is not 1"],
    ["no schema", { repo: "acme/api" }, "the schema is missing"],
    ["a list", [1], "the schema is missing"],
    ["a number", "7", "the schema is missing"],
    ["not JSON", "{not json", "the file is not valid JSON"],
    ["empty", "", "the file is not valid JSON"],
  ];
  for (const [name, document, reason] of cases) {
    assert.deepEqual(await factsOf(readable(505, archive(document))), { kind: "unknown", reason }, name);
  }
  const bad = zip([{ name: "facts.json", data: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) }]);
  assert.deepEqual(await factsOf(readable(505, bad)), { kind: "unknown", reason: "the file is not valid JSON" }, "invalid UTF-8");
  const dirty = zip([{ name: "facts.json", data: new Uint8Array([...new TextEncoder().encode('{"schema":1,"x":"'), 0xff, ...new TextEncoder().encode('"}')]) }]);
  assert.deepEqual(await factsOf(readable(505, dirty)), { kind: "unknown", reason: "the file is not valid JSON" }, "invalid UTF-8 inside a string is not repaired");
  const html = await home(harness({ ...listing, [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location: SIGNED }, [SIGNED]: { body: archive({ schema: 2 }) } }).app);
  assert.match(html, /<h2><a href="https:\/\/github\.com\/acme\/api">acme\/api<\/a><\/h2>\s*<p>Not known yet: the schema is not 1\.<\/p>/);
  assert.ok(html.includes("beta-co/app") && html.includes('action="/signout"'), "the page still renders");
});

test("REQ-101 AC3: an archive that is not exactly one facts.json, or is damaged or too large, gives 'not known yet' with the archive reason", async () => {
  const big = new Uint8Array(2 * 1024 * 1024);
  const cases: [string, Uint8Array][] = [
    ["not an archive", new TextEncoder().encode("hello")],
    ["empty", new Uint8Array(0)],
    ["no end record", zip([{ name: "facts.json", data: "{}" }], { omitEnd: true })],
    ["another name", zip([{ name: "other.json", data: JSON.stringify(FACTS) }])],
    ["a path", zip([{ name: "../facts.json", data: JSON.stringify(FACTS) }])],
    ["two files", zip([{ name: "facts.json", data: JSON.stringify(FACTS) }, { name: "extra.txt", data: "x" }])],
    ["no file", zip([])],
    ["encrypted", zip([{ name: "facts.json", data: JSON.stringify(FACTS), flags: 1 }])],
    ["wrong checksum", zip([{ name: "facts.json", data: JSON.stringify(FACTS), crc: 1 }])],
    ["wrong size", zip([{ name: "facts.json", data: JSON.stringify(FACTS), declaredSize: 3 }])],
    ["truncated stream", zip([{ name: "facts.json", data: JSON.stringify(FACTS), raw: new Uint8Array(deflateRawSync(JSON.stringify(FACTS))).slice(0, 4) }])],
    ["wrong size, stored", zip([{ name: "facts.json", data: JSON.stringify(FACTS), method: 0, declaredSize: 3 }])],
    ["declared larger than the stream", zip([{ name: "facts.json", data: JSON.stringify(FACTS), declaredSize: JSON.stringify(FACTS).length + 5 }])],
    ["too large", zip([{ name: "facts.json", data: big, raw: new Uint8Array(deflateRawSync(big)), declaredSize: big.length }])],
    ["a bomb that lies about its size", zip([{ name: "facts.json", data: "x".repeat(10), raw: new Uint8Array(deflateRawSync(big)), declaredSize: 10 }])],
    ["another method", zip([{ name: "facts.json", data: "{}", method: 12 }])],
  ];
  for (const [name, bytes] of cases) {
    assert.deepEqual(await factsOf(readable(505, bytes)), { kind: "unknown", reason: ARCHIVE_REASON }, name);
  }
});

test("REQ-101 AC3: an answer larger than any facts archive is not read to its end", async () => {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      if (pulled > 50) controller.close();
      else controller.enqueue(new Uint8Array(1024 * 1024));
    },
  });
  const routes: Routes = { [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location: SIGNED }, [SIGNED]: { body } };
  assert.deepEqual(await factsOf(routes), { kind: "unknown", reason: ARCHIVE_REASON });
  assert.ok(pulled <= 5, `the download stops at the limit (pulled ${pulled} megabytes)`);
  const empty: Routes = { [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location: SIGNED }, [SIGNED]: {} };
  assert.deepEqual(await factsOf(empty), { kind: "unknown", reason: ARCHIVE_REASON }, "an answer with no body is an unreadable archive");
});

test("REQ-101 AC4: a readable repository with no unexpired agk-facts artifact says that no artifact exists for its latest week, and the page renders", async () => {
  for (const name of ["artifacts-empty", "artifacts-only-expired"]) {
    assert.deepEqual(await factsOf({ [LIST]: { body: fixture(name) } }), { kind: "unknown", reason: NO_ARTIFACT_REASON }, name);
  }
  assert.equal(NO_ARTIFACT_REASON, "no facts artifact exists for its latest week");
  const html = await home(harness({ ...listing, [LIST]: { body: fixture("artifacts-empty") } }).app);
  assert.match(html, /<h2><a href="https:\/\/github\.com\/acme\/api">acme\/api<\/a><\/h2>\s*<p>Not known yet: no facts artifact exists for its latest week\.<\/p>/);
});

test("REQ-101 AC4: an artifact entry that is not in the expected form reads as not known, never as no artifact", async () => {
  for (const entry of ['{"id":"x","name":"agk-facts-2026-W42","expired":false}', '{"id":1,"name":"agk-facts-2026-W42"}', '{"id":1,"name":"agk-facts-2026-W42","expired":"no","created_at":"2026-10-19T08:00:00Z"}', '{"id":1,"name":"agk-facts-2026-W42","expired":false,"created_at":"yesterday"}']) {
    const body = `{"total_count":1,"artifacts":[${entry}]}`;
    assert.deepEqual(await factsOf({ [LIST]: { body } }), { kind: "unknown", reason: MALFORMED_LIST_REASON }, entry);
  }
  for (const body of ["not json", "[]", '{"artifacts":"x"}']) {
    assert.deepEqual(await factsOf({ [LIST]: { body } }), { kind: "unknown", reason: MALFORMED_LIST_REASON }, body);
  }
});

test("REQ-101 AC5: a 403, a 404 and a 500 on one repository give that card the status while the others are read and the page does not fail", async () => {
  assert.equal(statusReason(403), "GitHub answered 403");
  const BAD = "https://blob.example.net/bad/archive?sig=OTHER_SIGNED_SECRET";
  const stages: [string, (status: number) => Routes][] = [
    ["listing", (status) => ({ [LIST]: { status, body: "{}" } })],
    ["download", (status) => ({ [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status, body: "{}" } })],
    ["signed address", (status) => ({ [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location: BAD }, [BAD]: { status, body: "{}" } })],
  ];
  for (const [stage, make] of stages) {
    for (const status of [403, 404, 500]) {
      assert.deepEqual(await factsOf(make(status)), { kind: "unknown", reason: `GitHub answered ${status}` }, `${stage} ${status}`);
      const other: Routes = {
        "/repos/acme/web/actions/artifacts?per_page=100&page=1": { body: fixture("artifacts-weeks") },
        "/repos/acme/web/actions/artifacts/505/zip": { status: 302, location: SIGNED },
        [SIGNED]: { body: archive() },
      };
      const html = await home(harness({ ...listing, ...other, ...make(status) }).app);
      assert.match(html, /acme\/web<\/a><\/h2>\s*<p>Facts read for 2026-W42\.<\/p>/, `${stage} ${status}: the next repository is read`);
      assert.match(html, new RegExp(`acme/api</a></h2>\\s*<p>Not known yet: GitHub answered ${status}\\.</p>`), `${stage} ${status}`);
    }
  }
});

test("REQ-101 AC5: a failed request, a download that does not redirect and an unusable redirect are local to the repository", async () => {
  assert.deepEqual(await factsOf({ [LIST]: new Error("network down") }), { kind: "unknown", reason: REQUEST_FAILED_REASON });
  assert.deepEqual(await factsOf({ [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: new Error("reset") }), { kind: "unknown", reason: REQUEST_FAILED_REASON });
  assert.deepEqual(await factsOf({ [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location: SIGNED }, [SIGNED]: new Error("reset") }), { kind: "unknown", reason: REQUEST_FAILED_REASON });
  assert.deepEqual(await factsOf({ [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 200, body: archive() } }), { kind: "unknown", reason: statusReason(200) }, "a download that does not redirect");
  for (const location of [undefined, "", "http://blob.example.net/x", "/relative", "https://user:pass@blob.example.net/x", "not a url"]) {
    const routes: Routes = { [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location } };
    assert.deepEqual(await factsOf(routes), { kind: "unknown", reason: REQUEST_FAILED_REASON }, String(location));
  }
});

test("REQ-101 AC5: no failure shows a signed address, a token or an error detail, and one failing repository does not stop the others", async () => {
  const routes: Routes = {
    ...listing,
    [LIST]: { body: fixture("artifacts-weeks") },
    [ZIP(505)]: { status: 302, location: SIGNED },
    [SIGNED]: new Error(`failed ${SIGNED} ${TOKEN}`),
    "/repos/acme/web/actions/artifacts?per_page=100&page=1": new Error(`boom ${TOKEN}`),
    "/repos/beta-co/app/actions/artifacts?per_page=100&page=1": { body: fixture("artifacts-empty") },
  };
  const html = await home(harness(routes).app);
  for (const secret of [SIGNED, "SIGNED_SECRET_VALUE", "blob.example.net", TOKEN, "boom", "network"]) assert.ok(!html.includes(secret), secret);
  assert.equal((html.match(/Not known yet: /g) ?? []).length, 3, "each of the three repositories has its own card");
});

test("REQ-101 AC6: a repository the person cannot read is never requested, listed, named or counted", async () => {
  const { app, calls } = harness({ ...listing, [LIST]: { body: fixture("artifacts-empty") } });
  const html = await home(app);
  assert.ok(!html.includes("acme/secret"));
  assert.ok(!calls.some((c) => c.url.includes("acme/secret")), "no call names it");
  const requested = new Set(calls.map((c) => /\/repos\/([^/]+\/[^/]+)\//.exec(c.url)?.[1]).filter(Boolean));
  assert.deepEqual([...requested].sort(), ["acme/api", "acme/web", "beta-co/app"], "only the repositories GitHub listed for the person");
});

test("REQ-101 AC7: every request is a GET, the token is only in the Authorization header on the API, the signed address carries no credential, and no write call is made", async () => {
  const routes: Routes = { ...listing };
  for (const name of ["acme/api", "acme/web", "beta-co/app"]) {
    routes[`/repos/${name}/actions/artifacts?per_page=100&page=1`] = { body: fixture("artifacts-weeks") };
    routes[`/repos/${name}/actions/artifacts/505/zip`] = { status: 302, location: SIGNED };
  }
  routes[SIGNED] = { body: archive() };
  const { app, calls } = harness(routes);
  await home(app);
  assert.ok(calls.length >= 4 + 9);
  for (const { url, init } of calls) {
    assert.equal((init?.method ?? "GET").toUpperCase(), "GET", url);
    assert.equal(init?.body, undefined, url);
    assert.ok(!url.includes(TOKEN), "no token in an address");
    const headers = new Headers(init?.headers);
    if (url.startsWith("https://api.github.com/")) {
      assert.equal(headers.get("authorization"), `Bearer ${TOKEN}`);
      assert.equal(init?.redirect, "manual");
      assert.deepEqual([...headers.keys()].sort(), ["accept", "authorization", "user-agent", "x-github-api-version"]);
    } else {
      assert.equal(url, SIGNED);
      assert.deepEqual([...headers.keys()], [], "no credential and no header for the signed address");
    }
  }
});

test("REQ-101 AC7: the download address is built only from the validated repository name and a numeric artifact id", async () => {
  const hostile = '{"total_count":1,"artifacts":[{"id":505.5,"name":"agk-facts-2026-W42","expired":false,"created_at":"2026-10-19T08:00:00Z"}]}';
  const { github, calls } = harness({ [LIST]: { body: hostile } });
  assert.deepEqual(await readFacts(github, TOKEN, "acme/api", START), { kind: "unknown", reason: MALFORMED_LIST_REASON });
  assert.equal(calls.length, 1, "nothing is downloaded for an id that is not an integer");
  await assert.rejects(readFacts(github, TOKEN, "../../user", START), /not allowed/, "a name that is not owner/name is refused before any request");
  assert.equal(calls.length, 1);
});

// From kit 0.39.0 agk publishes two files in agk-facts-<week>: facts.json and report.json (the computed sections). The
// reader accepts facts.json alone (older artifacts) or with report.json, in any order; report.json is checked (size,
// checksum, method) and not read. Anything else is refused whole.
const REPORT = JSON.stringify({ sections: ["Delivered"], anything: "not read yet" });
const factsEntry = { name: "facts.json", data: JSON.stringify(FACTS) };
const reportEntry = { name: "report.json", data: REPORT };

test("REQ-101 AC2: an archive of facts.json and report.json, in either order, reads facts.json unchanged", async () => {
  for (const entries of [[factsEntry, reportEntry], [reportEntry, factsEntry]]) {
    const result = await factsOf(readable(505, zip(entries)));
    assert.equal(result.kind, "facts");
    if (result.kind === "facts") assert.deepEqual(result.document, FACTS, "facts.json as today");
  }
  const mixed = zip([{ ...factsEntry, method: 0 }, reportEntry]);
  assert.equal((await factsOf(readable(505, mixed))).kind, "facts", "stored and deflated entries mix");
  const html = await home(harness({ ...listing, [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location: SIGNED }, [SIGNED]: { body: zip([reportEntry, factsEntry]) } }).app);
  assert.match(html, /acme\/api<\/a><\/h2>\s*<p>Facts read for 2026-W42\.<\/p>/);
});

test("REQ-101 AC2: report.json is not read: whatever its bytes are, it does not change what the page gets, and it is not parsed", async () => {
  for (const data of ["not json at all", "", "{", "[1,2,3]", new Uint8Array([0xff, 0xfe, 0x00])]) {
    const result = await factsOf(readable(505, zip([factsEntry, { name: "report.json", data }])));
    assert.equal(result.kind, "facts", String(data));
    if (result.kind === "facts") assert.deepEqual(result.document, FACTS);
  }
});

test("REQ-101 AC3: an archive with report.json but no facts.json, a duplicate, a third entry or an odd name is refused whole", async () => {
  const other = { name: "other.json", data: "{}" };
  const cases: [string, Uint8Array][] = [
    ["report.json alone", zip([reportEntry])],
    ["report.json twice", zip([reportEntry, reportEntry])],
    ["facts.json twice", zip([factsEntry, factsEntry])],
    ["facts.json twice and report.json", zip([factsEntry, factsEntry, reportEntry])],
    ["report.json twice and facts.json", zip([factsEntry, reportEntry, reportEntry])],
    ["a third entry", zip([factsEntry, reportEntry, other])],
    ["a third entry first", zip([other, factsEntry, reportEntry])],
    ["facts.json and another name", zip([factsEntry, other])],
    ["report.json and another name", zip([reportEntry, other])],
    ["a directory entry", zip([factsEntry, reportEntry, { name: "dir/", data: "" }])],
    ["upper case", zip([factsEntry, { name: "Report.json", data: REPORT }])],
    ["a path", zip([factsEntry, { name: "dir/report.json", data: REPORT }])],
    ["a parent path", zip([factsEntry, { name: "../report.json", data: REPORT }])],
    ["a trailing slash", zip([factsEntry, { name: "report.json/", data: REPORT }])],
    ["a trailing space", zip([factsEntry, { name: "report.json ", data: REPORT }])],
    ["a different extension", zip([factsEntry, { name: "report.json.txt", data: REPORT }])],
  ];
  for (const [name, bytes] of cases) {
    assert.deepEqual(await factsOf(readable(505, bytes)), { kind: "unknown", reason: ARCHIVE_REASON }, name);
  }
});

test("REQ-101 AC3: each entry keeps its own checks: a report.json that is damaged, encrypted, too large or lies about its size refuses the archive, and so does a damaged facts.json beside a good report.json", async () => {
  const big = new Uint8Array(2 * 1024 * 1024);
  const cases: [string, Uint8Array][] = [
    ["wrong checksum", zip([factsEntry, { ...reportEntry, crc: 1 }])],
    ["wrong declared size", zip([factsEntry, { ...reportEntry, declaredSize: 3 }])],
    ["wrong declared size, stored", zip([factsEntry, { ...reportEntry, method: 0, declaredSize: 3 }])],
    ["declared larger than the stream", zip([factsEntry, { ...reportEntry, declaredSize: REPORT.length + 5 }])],
    ["encrypted", zip([factsEntry, { ...reportEntry, flags: 1 }])],
    ["another method", zip([factsEntry, { ...reportEntry, method: 12 }])],
    ["too large", zip([factsEntry, { name: "report.json", data: big, raw: new Uint8Array(deflateRawSync(big)), declaredSize: big.length }])],
    ["a bomb that lies about its size", zip([factsEntry, { name: "report.json", data: "x".repeat(10), raw: new Uint8Array(deflateRawSync(big)), declaredSize: 10 }])],
    ["truncated stream", zip([factsEntry, { ...reportEntry, raw: new Uint8Array(deflateRawSync(REPORT)).slice(0, 4) }])],
    ["facts.json with a wrong checksum", zip([{ ...factsEntry, crc: 1 }, reportEntry])],
    ["facts.json too large", zip([{ name: "facts.json", data: big, raw: new Uint8Array(deflateRawSync(big)), declaredSize: big.length }, reportEntry])],
  ];
  for (const [name, bytes] of cases) {
    assert.deepEqual(await factsOf(readable(505, bytes)), { kind: "unknown", reason: ARCHIVE_REASON }, name);
  }
});

test("REQ-101 AC3: two entries of the largest size each fit in the archive limit, and an archive past the limit is not read to its end", async () => {
  const factsBig = new TextEncoder().encode(`{"schema":1,"pad":"${"a".repeat(1024 * 1024 - 40)}"}`);
  assert.ok(factsBig.length <= 1024 * 1024);
  const full = zip([{ name: "facts.json", data: factsBig, method: 0 }, { name: "report.json", data: new Uint8Array(1024 * 1024).fill(0x61), method: 0 }]);
  assert.ok(full.length > 2 * 1024 * 1024 && full.length <= 3 * 1024 * 1024, `the largest allowed archive is ${full.length} bytes`);
  const result = await factsOf(readable(505, full));
  assert.equal(result.kind, "facts", "two entries of the largest allowed size are read");
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      if (pulled > 50) controller.close();
      else controller.enqueue(new Uint8Array(1024 * 1024));
    },
  });
  assert.deepEqual(await factsOf({ [LIST]: { body: fixture("artifacts-weeks") }, [ZIP(505)]: { status: 302, location: SIGNED }, [SIGNED]: { body } }), { kind: "unknown", reason: ARCHIVE_REASON });
  assert.ok(pulled <= 5, `the download stops at the limit (pulled ${pulled} megabytes)`);
});
