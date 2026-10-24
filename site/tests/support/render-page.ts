// Renders the signed-in page of the fixture reports to a directory (index.html and style.css), for the screenshots of the
// build pull request. Not a test; run with: npx tsx tests/support/render-page.ts OUTDIR [FIXTURE...]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SESSION_COOKIE, createApp, createCore, createGithubClient, readFacts, sealSession, stylesheet, type Config, type ConfigName, type FactsResult } from "../../src/core/index.ts";
import { writeReport } from "./report-script.ts";
import { zip } from "./zip.ts";

const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED";
const out = resolve(process.argv[2] ?? "render-out");

// A fixture named schema2:NAME is the kit's v0.43.0 golden report.json (schema 2) with the facts it was made from.
function load(fixture: string): { facts: string; document: any } {
  if (fixture.startsWith("schema3:")) {
    // The kit's v0.50.0 golden (schema 3); "-fold" is the busy golden with one grouped At risk line over the count of 5.
    const fold = fixture.endsWith("-fold");
    const name = fixture.slice("schema3:".length).replace(/-fold$/, "");
    const dir = resolve(import.meta.dirname, "..", "fixtures");
    const own = name === "facts-ok" || name === "facts-pr-states";
    const facts = readFileSync(resolve(own ? resolve(dir, "report-schema-3") : resolve(dir, "report"), `${name}.facts.json`), "utf8");
    const document = JSON.parse(readFileSync(resolve(dir, "report-schema-3", `${name}.report.json`), "utf8"));
    if (fold) {
      const item = document.sections.at_risk.find((i: any) => i.kind === "pull-requests-open-long");
      item.entries = Array.from({ length: 8 }, (_, i) => ({ number: 30 + i, days: 20 - i }));
      item.count = 8;
      item.links = item.entries.map((e: any) => ({ to: "pull-request", url: `https://github.com/demo-org/demo-repo/pull/${e.number}` }));
    }
    return { facts, document };
  }
  if (!fixture.startsWith("schema2:")) return writeReport(fixture);
  const name = fixture.slice("schema2:".length);
  const dir = resolve(import.meta.dirname, "..", "fixtures");
  const facts = readFileSync(resolve(dir, name === "facts-ok" ? "report-schema-2/facts-ok.facts.json" : `report/${name}.facts.json`), "utf8");
  return { facts, document: JSON.parse(readFileSync(resolve(dir, `report-schema-2/${name}.report.json`), "utf8")) };
}

async function project(name: string, fixture: string, change?: (report: any) => void): Promise<{ name: string; result: FactsResult }> {
  const written = load(fixture);
  const doc = JSON.parse(JSON.stringify(written.document));
  change?.(doc);
  const artifacts = { total_count: 1, artifacts: [{ id: 777, name: `agk-facts-${doc.week}`, expired: false, created_at: "2026-10-14T08:00:00Z", expires_at: "2027-03-01T00:00:00Z" }] };
  const bytes = zip([{ name: "facts.json", data: written.facts }, { name: "report.json", data: JSON.stringify(doc) }]);
  const routes: Record<string, () => Response> = {
    [`https://api.github.com/repos/${name}/actions/artifacts?per_page=100&page=1`]: () => new Response(JSON.stringify(artifacts)),
    [`https://api.github.com/repos/${name}/actions/artifacts/777/zip`]: () => new Response(null, { status: 302, headers: { location: SIGNED } }),
    [SIGNED]: () => new Response(bytes as BodyInit),
  };
  const github = createGithubClient({ fetch: async (url) => routes[url]?.() ?? new Response("{}", { status: 404 }) });
  return { name, result: await readFacts(github, "token", name, START) };
}

const values: Record<ConfigName, string> = { GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid", GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value", SESSION_KEY: KEY, CALLBACK_URL: "https://portal.example/callback" };
const config: Config = { get: (n) => values[n] };
// The clock is a day of 2026-W42: the goldens' week 2026-W41 is the previous week.
const NOW = Date.UTC(2026, 9, 14, 12);
// Arguments after the directory: the fixtures to render, one project each, and the flags --project (render the page of the
// first project) and --q=TEXT (the find query of the start page). With none, a mixed list of nine projects.
const args = process.argv.slice(3);
const flags = args.filter((a) => a.startsWith("--"));
const fixtures = args.filter((a) => !a.startsWith("--"));
const query = flags.find((f) => f.startsWith("--q="))?.slice(4) ?? "";
const foldBusy = (r: any): void => {
  r.sections.needs_you[2].items = Array.from({ length: 7 }, (_, i) => ({ kind: "question", id: `Q-X-${i + 1}`, asked_in: "docs/a.md", links: [] }));
  r.sections.needs_you[2].count = 7;
};
const calm = (r: any): void => {
  r.counts.needs_you = 0;
  r.counts.at_risk = 0;
};
const projects =
  fixtures.length > 0
    ? await Promise.all(fixtures.map((fixture) => project(`demo-org/${fixture.replace(/^schema[23]:/, "")}-week`, fixture)))
    : [
        await project("acme/api", "schema3:busy", foldBusy),
        await project("acme/web", "schema3:kinds", calm),
        await project("acme/app", "schema3:facts-ok"),
        await project("acme/lib", "schema3:kinds", (r) => ((r.counts.needs_you = "unknown"), (r.counts.at_risk = 0))),
        await project("acme/quiet", "schema3:kinds", (r) => ((r.counts.delivered = 0), calm(r), (r.sections.cost.find((i: any) => i.kind === "week-totals").merged = 0))),
        await project("beta-co/old-kit", "schema2:kinds"),
        await project("beta-co/stale", "schema3:kinds", (r) => (r.week = "2026-W38")),
        await project("beta-co/pr-states", "schema3:facts-pr-states"),
        await project("gamma/dirty", "dirty-unknown"),
      ];
const app = createApp(createCore({ config, now: () => NOW }), {
  projects: async () => ({ kind: "ok", notices: [], projects }),
  project: async (_token, name) => {
    const found = projects.find((p) => p.name === name);
    return found === undefined ? { kind: "missing" } : { kind: "found", result: found.result };
  },
});
const cookie = await sealSession({ token: "token", expiresAt: NOW + 3_600_000 }, KEY);
const path = flags.includes("--project") ? `/p/${(projects[0] as { name: string }).name}` : `/${query === "" ? "" : `?q=${encodeURIComponent(query)}`}`;
const page = await (await app(new Request(`https://portal.example${path}`, { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }))).text();
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "index.html"), page.replace('href="/style.css"', 'href="style.css"'));
writeFileSync(resolve(out, "style.css"), await stylesheet().text());
console.log(`rendered ${page.length} bytes to ${out}`);
