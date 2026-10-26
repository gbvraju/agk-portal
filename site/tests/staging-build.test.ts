// The staging build (ADR-0016, ADR-0037): the hosting provider builds every pull request, and its build may try a Python install
// of the repository root. The root `pyproject.toml` has a `[project]` table, so without a build system and an explicit, empty
// package list that install fails on setuptools' flat-layout discovery ("Multiple top-level packages discovered") and the check
// of every pull request reads failed. These tests read the file only; no network and no Python run. Marker REQ-101.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const text = readFileSync(resolve(import.meta.dirname, "..", "..", "pyproject.toml"), "utf8");
const table = (name: string): string => {
  const at = text.indexOf(`\n[${name}]`);
  assert.ok(at >= 0 || text.startsWith(`[${name}]`), `[${name}] is in the root pyproject.toml`);
  const rest = text.slice(at < 0 ? 0 : at + 1);
  const next = rest.slice(1).search(/^\[/m);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

test("REQ-101: the root pyproject.toml names a build system, so a Python install of the repository root has a backend", () => {
  const build = table("build-system");
  assert.match(build, /^requires\s*=\s*\[\s*"setuptools[^"]*"\s*\]/m);
  assert.match(build, /^build-backend\s*=\s*"setuptools\.build_meta"/m);
});

test("REQ-101: the root pyproject.toml lists no package, so that install finds none to discover and installs nothing", () => {
  assert.match(table("tool.setuptools"), /^packages\s*=\s*\[\s*\]/m);
  assert.doesNotMatch(table("tool.setuptools"), /py-modules|package-dir|packages\s*=\s*\[\s*"/);
});

test("REQ-101: the file still keeps what the kit's checks read: the [project] table and the pytest and ruff settings", () => {
  assert.match(table("project"), /^name\s*=\s*"agk-portal"/m);
  assert.match(table("tool.pytest.ini_options"), /^testpaths\s*=\s*\["tests"\]/m);
  assert.match(table("tool.ruff"), /^line-length\s*=\s*100/m);
});
