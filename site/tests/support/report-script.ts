// Runs this repository's own scripts/agk/product_report.py --json on a facts document (REQ-105 AC2 as worded), so the tests
// render the data the report really writes. The script uses the standard library only and reads nothing but the facts file.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const script = resolve(repoRoot, "scripts", "agk", "product_report.py");
export const fixtureDir = resolve(import.meta.dirname, "..", "fixtures", "report");

export interface Written {
  facts: string;
  report: string;
  document: any;
}

const cache = new Map<string, Written>();

// `mutate` changes a copy of the fixture's facts before the script runs (a day, a repository, a flag); `tag` names that
// change, because a result is kept per fixture and tag.
export function writeReport(fixture: string, mutate?: (facts: Record<string, unknown>) => void, tag = ""): Written {
  const key = `${fixture}:${tag}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const dir = mkdtempSync(join(tmpdir(), "report-script-"));
  try {
    const facts = JSON.parse(readFileSync(join(fixtureDir, `${fixture}.facts.json`), "utf8")) as Record<string, unknown>;
    mutate?.(facts);
    const factsPath = join(dir, "facts.json");
    const reportPath = join(dir, "report.json");
    const text = JSON.stringify(facts, null, 2) + "\n";
    writeFileSync(factsPath, text);
    execFileSync("python3", [script, "--facts", factsPath, "--json", reportPath], { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"] });
    const report = readFileSync(reportPath, "utf8");
    const written = { facts: text, report, document: JSON.parse(report) };
    cache.set(key, written);
    return written;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
