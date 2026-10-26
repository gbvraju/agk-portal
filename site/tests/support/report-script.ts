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

// What the script writes, as it writes it: the report of the installed kit (kit 0.55.0, schema 6). `mutate` changes a copy of the fixture's facts before the script runs (a day, a repository, a flag); `tag`
// names that change, because a result is kept per fixture and tag.
export function writeReportKit(fixture: string, mutate?: (facts: Record<string, unknown>) => void, tag = ""): Written {
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

// A report in its schema 1 form: the number 1 and none of the fields of schemas 2 to 6 (hours_unknown, counts, count,
// fix_verdicts_unknown, the group ready, usage, usage_reported, corrections, the key flow, the three At risk kinds of schema
// 6 and the unknown items that kit 0.55.0 adds for facts the old fixtures do not carry). The tests of schema 1 (the reader's
// first list, the five tiles) take their data from here; the kit's goldens and writeReportKit cover the later schemas.
export function schema1Form(source: any): any {
  const document = JSON.parse(JSON.stringify(source));
  document.schema = 1;
  delete document.counts;
  for (const item of document.sections.cost) {
    for (const key of ["hours_unknown", "fix_verdicts_unknown", "usage", "usage_reported", "corrections", "shadow"]) delete item[key];
  }
  const later = ["pull-requests-stalled", "briefs-idle", "requirements-without-brief"];
  const laterUnknown = ["open briefs", "stalled pull requests", "requirements without a brief"];
  document.sections.at_risk = document.sections.at_risk.filter((item: { kind: string; what?: string }) => !later.includes(item.kind) && !(item.kind === "unknown" && laterUnknown.includes(String(item.what))));
  for (const item of document.sections.at_risk) delete item.count;
  document.sections.needs_you = document.sections.needs_you.filter((group: { group: string }) => group.group !== "ready");
  delete document.sections.flow;
  return document;
}

// The same report in its schema 1 form (schema1Form), for the tests of schema 1.
export function writeReport(fixture: string, mutate?: (facts: Record<string, unknown>) => void, tag = ""): Written {
  const kit = writeReportKit(fixture, mutate, tag);
  const document = schema1Form(JSON.parse(kit.report));
  return { facts: kit.facts, report: JSON.stringify(document, null, 2) + "\n", document };
}
