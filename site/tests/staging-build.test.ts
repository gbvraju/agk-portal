// The staging build (ADR-0016, ADR-0037): the hosting provider builds every pull request. Measured from its build logs (issue #72):
// the build of a pull request ran a Python install at the repository root, which the kit's `pyproject.toml` made fail until agk
// 0.56.0 brought a build system and an empty package list to it, and then its deploy command `npx wrangler preview` stopped with
// "Your Wrangler configuration is missing a `previews` block to run this command". These tests read the two files only: no
// network and no Python run. Marker REQ-101.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "..", "..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");
// The lines of a TOML table, from its header to the next one.
function table(text: string, name: string): string | undefined {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => l.trim() === `[${name}]`);
  if (at < 0) return undefined;
  const next = lines.findIndex((l, i) => i > at && /^\s*\[/.test(l));
  return lines.slice(at + 1, next < 0 ? undefined : next).join("\n");
}

test("REQ-101: the Worker's configuration has a previews table, which the build of a pull request needs to run wrangler preview", () => {
  const previews = table(read("site/wrangler.toml"), "previews");
  assert.notEqual(previews, undefined, "a [previews] table is in site/wrangler.toml");
  assert.doesNotMatch((previews as string).replace(/#.*$/gm, ""), /\S/, "the table is empty: it names no binding, no route and no account");
});

test("REQ-101: the Worker's configuration keeps what the main build deploys: the name, the entry point and the variables", () => {
  const text = read("site/wrangler.toml");
  assert.match(text, /^name\s*=\s*"agk-portal-staging"/m);
  assert.match(text, /^main\s*=\s*"src\/adapters\/cloudflare\/index\.ts"/m);
  assert.match(text, /^keep_vars\s*=\s*true/m);
  assert.doesNotMatch(text.replace(/#.*$/gm, ""), /account_id|routes?\s*=|\[\[|secret|token/i, "no account, no route, no binding and no secret in the file");
});

test("REQ-101: the root pyproject.toml names a build system and an empty package list, so a Python install of the repository root succeeds", () => {
  const text = read("pyproject.toml");
  const build = table(text, "build-system");
  assert.match(build ?? "", /^requires\s*=\s*\[\s*"setuptools[^"]*"\s*\]/m);
  assert.match(build ?? "", /^build-backend\s*=\s*"setuptools\.build_meta"/m);
  assert.match(table(text, "tool.setuptools") ?? "", /^packages\s*=\s*\[\s*\]/m);
});
