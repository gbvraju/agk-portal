// The look of the page, as the one same-origin stylesheet (SPEC-0008 rules 1 to 3, 5, 6 and 7): one theme of named colours in
// one place, the listed tokens in a light and a dark set, the contrast of every pair, the focus ring and the touch targets,
// the layout from 360 px to a wide screen, and no image, font file or script. Markers REQ-108 AC1, AC2, AC3, AC5, AC6 and
// AC7. The stylesheet is read as text from the core; no network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { stylesheet } from "../src/core/index.ts";

const css = await stylesheet().text();

// The text of the block that opens at `start` (balanced braces), without its braces.
function block(text: string, start: RegExp): string {
  const at = text.search(start);
  assert.ok(at >= 0, `block ${start} exists`);
  const open = text.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced block");
}
const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "");
const THEME_BLOCKS = [/:root\s*\{/, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/];

// The stylesheet without its two theme blocks: the light set under :root and the dark set under the media query.
function outsideTheme(text: string): string {
  let rest = stripComments(text);
  for (const start of THEME_BLOCKS) {
    const at = rest.search(start);
    const open = rest.indexOf("{", at);
    const inner = block(rest, start);
    rest = rest.slice(0, at) + rest.slice(open + inner.length + 2);
  }
  return rest;
}

const NAMED = "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen currentcolor".split(" ");
const COLOUR = new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\\(|\\b(?:${NAMED.join("|")})\\b`, "i");
// A colour value in the text, or undefined.
const colourIn = (text: string): string | undefined => text.match(COLOUR)?.[0];

const TOKENS: Record<string, [string, string]> = {
  bg: ["#F5F6F8", "#0E1116"],
  surface: ["#FFFFFF", "#161A21"],
  "surface-2": ["#F0F2F5", "#1D222B"],
  border: ["#E1E4EA", "#2A303B"],
  text: ["#141820", "#E7EAF0"],
  muted: ["#566070", "#A0A9B7"],
  accent: ["#2B55C9", "#8EA9FF"],
  "accent-ink": ["#FFFFFF", "#0E1116"],
  "done-bg": ["#E3F3E9", "#13301F"],
  "done-fg": ["#1B6138", "#8BD9AA"],
  "proven-bg": ["#E6ECFB", "#18234A"],
  "proven-fg": ["#22439E", "#AFC2FF"],
  "decide-bg": ["#FFF1DC", "#3A2710"],
  "decide-fg": ["#7F4500", "#FFC27A"],
  "risk-bg": ["#FCE8E5", "#3E1714"],
  "risk-fg": ["#9C271C", "#FF9E94"],
  "none-bg": ["#ECEEF1", "#232833"],
  "none-fg": ["#4A5361", "#B8C0CC"],
};

function tokensOf(text: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const m of text.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+);/g)) found[m[1] as string] = (m[2] as string).trim().toUpperCase();
  return found;
}
const light = tokensOf(block(stripComments(css), THEME_BLOCKS[0] as RegExp));
const dark = tokensOf(block(block(stripComments(css), THEME_BLOCKS[1] as RegExp), /:root\s*\{/));

test("REQ-108 AC1: every colour value of the stylesheet is in the theme blocks, and a colour anywhere else fails the test", () => {
  assert.equal(colourIn(outsideTheme(css)), undefined, "no colour value outside the two theme blocks");
  for (const set of [block(stripComments(css), THEME_BLOCKS[0] as RegExp), block(block(stripComments(css), THEME_BLOCKS[1] as RegExp), /:root\s*\{/)]) {
    const declarations = set.split(";").map((d) => d.trim()).filter((d) => d !== "");
    assert.ok(declarations.every((d) => /^--[a-z0-9-]+\s*:/.test(d)), "a theme block holds custom properties only");
  }
  for (const bad of ["a{color:#fff}", "a{color:rgb(1,2,3)}", "a{background:hsl(1 2% 3%)}", "p{border:1px solid red}", "p{color:White}", "p{fill:currentColor}", "p{background:#0b57d0}"]) {
    assert.notEqual(colourIn(outsideTheme(`${css}\n${bad}`)), undefined, `${bad} is caught`);
  }
});

test("REQ-108 AC1: the stylesheet takes its colours from the tokens only, in every rule", () => {
  const rules = outsideTheme(css);
  const used = [...rules.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1] as string);
  assert.ok(used.length > 10, "the rules use the tokens");
  for (const name of used) assert.ok(Object.hasOwn(TOKENS, name), `${name} is a named token`);
});

test("REQ-108 AC2: the light and the dark set define each token with the listed value", () => {
  assert.deepEqual(Object.keys(light).sort(), Object.keys(TOKENS).sort());
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(TOKENS).sort());
  for (const [name, [l, d]] of Object.entries(TOKENS)) {
    assert.equal(light[name], l, `light ${name}`);
    assert.equal(dark[name], d, `dark ${name}`);
  }
});

// The WCAG 2 contrast ratio of two #RRGGBB colours.
function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
const PAIRS: [string, string][] = [
  ...["text", "muted", "accent"].flatMap((fg) => ["bg", "surface", "surface-2"].map((bg): [string, string] => [fg, bg])),
  ["accent-ink", "accent"],
  ...["done", "proven", "decide", "risk", "none"].map((s): [string, string] => [`${s}-fg`, `${s}-bg`]),
];
const lowPairs = (set: Record<string, string>): string[] => PAIRS.filter(([fg, bg]) => ratio(set[fg] as string, set[bg] as string) < 4.5).map(([fg, bg]) => `${fg} on ${bg}`);

test("REQ-108 AC3: every text and background pair of the theme has a contrast ratio of at least 4.5 to 1 in both sets", () => {
  assert.deepEqual(lowPairs(light), [], "light");
  assert.deepEqual(lowPairs(dark), [], "dark");
  assert.equal(PAIRS.length, 14);
});

test("REQ-108 AC3: a pair below 4.5 to 1 fails the test, and the ratio is the WCAG one", () => {
  assert.deepEqual(lowPairs({ ...light, muted: "#9AA3AF" }), ["muted on bg", "muted on surface", "muted on surface-2"]);
  assert.deepEqual(lowPairs({ ...dark, "risk-fg": "#3E1714", "risk-bg": "#3E1714" }), ["risk-fg on risk-bg"]);
  assert.ok(Math.abs(ratio("#000000", "#FFFFFF") - 21) < 1e-9);
  assert.ok(Math.abs(ratio("#767676", "#FFFFFF") - 4.54) < 0.01);
});

test("REQ-108 AC1: the dark set is chosen by prefers-color-scheme and the page declares both schemes", () => {
  assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)/);
  assert.match(css, /color-scheme:\s*light dark/);
});

test("REQ-108 AC5: every link, button and summary has a visible focus ring in the accent colour and a target at least 44 px high", () => {
  const rules = outsideTheme(css);
  assert.match(rules, /:focus-visible\s*\{[^}]*outline:\s*[^;}]*var\(--accent\)/);
  for (const selector of ["a", "button", "summary"]) {
    const rule = rules.split("}").find((r) => r.split("{")[0]?.split(",").map((s) => s.trim()).includes(selector));
    assert.ok(rule !== undefined, `${selector} has a rule`);
    assert.match(rule, /min-height:\s*44px/, `${selector}: 44 px`);
  }
  assert.doesNotMatch(css, /outline:\s*(?:none|0)\b/, "the ring is never removed");
});

test("REQ-108 AC6: one column below the breakpoint, two columns from about 900 px, a readable maximum width, and long words wrap", () => {
  const rules = outsideTheme(css);
  const media = block(rules, /@media\s*\(min-width:\s*900px\)\s*\{/);
  assert.match(media, /\.parts\s*\{[^}]*grid-template-columns:\s*(?:repeat\(2,\s*minmax\(0,\s*1fr\)\)|minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\))/);
  const base = rules.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  assert.match(base, /\.parts\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*[;}]/, "one column by default");
  assert.match(base, /max-width:\s*\d+(?:\.\d+)?(?:rem|ch|em)/, "a maximum width");
  assert.match(base, /overflow-wrap:\s*anywhere/);
  assert.match(base, /\.tiles\s*\{[^}]*display:\s*grid/);
  assert.doesNotMatch(css, /overflow-x\s*:\s*(?:scroll|auto)/);
  for (const m of base.matchAll(/(?<![-\w])width:\s*(\d+)px/g)) assert.ok(Number(m[1]) <= 360, `no fixed width above 360 px: ${m[0]}`);
});

test("REQ-108 AC7: no font file, no font face, no image and no import; the font is the system stack", () => {
  assert.doesNotMatch(css, /@font-face|@import|url\(|\.woff|\.ttf|\.otf/i);
  const fonts = [...css.matchAll(/font(?:-family)?:\s*([^;}]+)/g)].map((m) => m[1] as string);
  assert.ok(fonts.some((f) => /system-ui/.test(f) && /sans-serif/.test(f)), "the system font stack");
  for (const f of fonts.filter((f) => /[A-Za-z]{3,}/.test(f.replace(/system-ui|sans-serif|monospace|ui-monospace|\d+(?:\.\d+)?(?:px|rem|em)|\/|bold|normal|italic|var\([^)]*\)|inherit|\d+/g, "")))) {
    assert.fail(`a named font family: ${f}`);
  }
});

test("REQ-108 AC7: the logo is the text on the accent colour", () => {
  const rules = outsideTheme(css);
  const logo = rules.split("}").find((r) => r.split("{")[0]?.includes(".logo"));
  assert.ok(logo !== undefined);
  assert.match(logo, /background:\s*var\(--accent\)/);
  assert.match(logo, /color:\s*var\(--accent-ink\)/);
});
