// Placeholder: shows the kit's marker scan finds acceptance markers in *.test.ts files (agk.toml test_patterns).
// The marker text is assembled from parts so that no tracked file carries a literal marker: a marker in a
// comment or a string counts, and a literal here would claim a criterion this test does not prove.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const req = ["REQ", "101"].join("-");
const scan = [
  "import json, sys",
  `sys.path.insert(0, ${JSON.stringify(join(repoRoot, "scripts", "agk"))})`,
  "from pathlib import Path",
  "import common",
  'print(json.dumps(common.find_ac_markers(Path("."), ["tests"], ["*.test.ts"], [])))',
].join("\n");

let fixture = "";

before(() => {
  fixture = mkdtempSync(join(tmpdir(), "marker-scan-"));
  execFileSync("git", ["init", "-q", fixture]);
  mkdirSync(join(fixture, "tests"));
  writeFileSync(join(fixture, "tests", "fixture.test.ts"), `// ${req} AC1\n`);
  writeFileSync(join(fixture, "tests", "test_other.py"), `# ${req} AC2\n`);
  writeFileSync(join(fixture, "tests", "plain.ts"), `// ${req} AC3\n`);
});

after(() => {
  rmSync(fixture, { recursive: true, force: true });
});

test("the marker scan finds an acceptance marker in a *.test.ts file", () => {
  const out = execFileSync("python3", ["-I", "-c", scan], { cwd: fixture, encoding: "utf8" });
  const markers = JSON.parse(out) as { req: string; ac: string | null; file: string; line: number }[];
  assert.deepEqual(markers, [{ req, ac: "AC1", file: "tests/fixture.test.ts", line: 1 }]);
});
