// Renders the signed-in page of the fixture reports to a directory (index.html and style.css), for the screenshots of the
// build pull request. Not a test; run with: npx tsx tests/support/render-page.ts OUTDIR
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SESSION_COOKIE, createApp, createCore, createGithubClient, factsCard, readFacts, sealSession, stylesheet, type Config, type ConfigName } from "../../src/core/index.ts";
import { writeReport } from "./report-script.ts";
import { zip } from "./zip.ts";

const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const SIGNED = "https://blob.example.net/signed/archive?sig=SIGNED";
const out = resolve(process.argv[2] ?? "render-out");

async function card(name: string, fixture: string, change?: (report: any) => void): Promise<string> {
  const written = writeReport(fixture);
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
  return factsCard(name, await readFacts(github, "token", name, START));
}

const values: Record<ConfigName, string> = { GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid", GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value", SESSION_KEY: KEY, CALLBACK_URL: "https://portal.example/callback" };
const config: Config = { get: (n) => values[n] };
const cards = [
  await card("demo-org/busy-week", "busy", (r) => {
    r.sections.needs_you[2].items = Array.from({ length: 7 }, (_, i) => ({ kind: "question", id: `Q-X-${i + 1}`, asked_in: "docs/a.md", links: [] }));
    r.sections.needs_you[2].count = 7;
  }),
  await card("demo-org/dirty-week", "dirty-unknown"),
  await card("demo-org/quiet-week", "quiet"),
];
const app = createApp(createCore({ config, now: () => START }), { projects: async () => cards });
const cookie = await sealSession({ token: "token", expiresAt: START + 3_600_000 }, KEY);
const page = await (await app(new Request("https://portal.example/", { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } }))).text();
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "index.html"), page.replace('href="/style.css"', 'href="style.css"'));
writeFileSync(resolve(out, "style.css"), await stylesheet().text());
console.log(`rendered ${page.length} bytes to ${out}`);
