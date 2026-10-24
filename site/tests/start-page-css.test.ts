// The stylesheet rules of the start page (SPEC-0009 rules 4 and 8): a zero count muted on a wide screen and hidden on a phone,
// the find form as native controls at least 44 px high, and no colour outside the tokens (the theme test reads the whole
// stylesheet). Markers REQ-109 AC4 and AC8.
import assert from "node:assert/strict";
import { test } from "node:test";
import { stylesheet } from "../src/core/index.ts";

const css = await stylesheet().text();
const rules = (text: string): { selector: string; body: string }[] => [...text.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ selector: (m[1] as string).trim(), body: m[2] as string }));
function media(width: string): string {
  const at = css.search(new RegExp(`@media\\s*\\(max-width:\\s*${width}\\)\\s*\\{`));
  assert.ok(at >= 0, `a media query for ${width}`);
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error("unbalanced");
}

test("REQ-109 AC4: a zero figure is muted on a wide screen and hidden below 600 px", () => {
  const base = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  assert.ok(rules(base).some((r) => r.selector.split(",").map((s) => s.trim()).includes(".zero") && /color:\s*var\(--muted\)/.test(r.body)), "muted by the token");
  assert.ok(rules(media("599px")).some((r) => r.selector.split(",").map((s) => s.trim()).includes(".zero") && /display:\s*none/.test(r.body)), "hidden on a phone");
  assert.ok(!rules(base).some((r) => r.selector.split(",").map((s) => s.trim()).includes(".zero") && /display:\s*none/.test(r.body)), "not hidden on a wide screen");
  assert.ok(!/\.figure\b[^{]*\{[^}]*display:\s*none/.test(media("599px")), "a figure that is not zero is never hidden");
});

test("REQ-109 AC8: the text input is a native control at least 44 px high with the token colours and a visible focus ring", () => {
  const input = rules(css).filter((r) => r.selector.split(",").map((s) => s.trim()).includes("input"));
  assert.ok(input.length > 0 && input.some((r) => /min-height:\s*44px/.test(r.body)), "44 px");
  assert.ok(input.some((r) => /border:[^;]*var\(--border\)/.test(r.body) && /background:\s*var\(--surface\)/.test(r.body) && /color:\s*var\(--text\)/.test(r.body)), "tokens");
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*[^;}]*var\(--accent\)/);
});
