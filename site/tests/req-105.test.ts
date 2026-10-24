// REQ-105 AC5's wording and the markers of its eight criteria (ADR-0029). The count of items lacking a value is shown where the
// report states one: the kit gives no count for a decisions group whose source cannot be read or for an unknown housekeeping
// total (agk SPEC-0026 rule 4). Markers REQ-105 AC5 and AC8.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "..", "..");
const requirement = (id: string): string => {
  const text = readFileSync(resolve(root, "docs", "requirements.md"), "utf8");
  const start = text.indexOf(`### ${id} `);
  assert.ok(start >= 0, `${id} exists`);
  const next = text.indexOf("\n### ", start + 4);
  return next < 0 ? text.slice(start) : text.slice(start, next);
};

test("REQ-105 AC5: the criterion says the count is shown where the report states one, and nothing else of it changed", () => {
  const text = requirement("REQ-105");
  assert.match(text, /AC5 Given a value that the facts mark unknown, when the page is shown, then it says not known yet with the count of items lacking it where the report states one and never shows zero, and a sum with an unknown term is not shown as a number;/);
  assert.doesNotMatch(text, /count of items lacking it and never shows zero/, "the old wording is gone");
  for (const n of [1, 2, 3, 4, 6, 7, 8]) assert.match(text, new RegExp(`AC${n} Given`), `AC${n} is still there`);
});

test("REQ-105 AC8: each of the eight criteria of REQ-105 has a test with its marker", () => {
  const dir = resolve(import.meta.dirname);
  const sources = readdirSync(dir).filter((f) => f.endsWith(".test.ts")).map((f) => readFileSync(resolve(dir, f), "utf8"));
  for (let n = 1; n <= 8; n += 1) assert.ok(sources.some((s) => new RegExp(`REQ-105 AC${n}\\b`).test(s)), `REQ-105 AC${n} has a marker`);
});

test("REQ-105 AC5: the residual that tracked the count is closed", () => {
  const text = readFileSync(resolve(root, "docs", "runs", "residuals.md"), "utf8");
  const open = text.slice(text.indexOf("## Open"), text.indexOf("## Closed"));
  assert.doesNotMatch(open, /REQ-105 AC5's "count of items lacking it"/);
  assert.match(text.slice(text.indexOf("## Closed")), /REQ-105 AC5's "count of items lacking it"/);
});
