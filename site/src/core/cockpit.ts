// The cockpit (SPEC-0010): what waits for a person, in plain words, from each project's pipeline document, as three parts in
// this order: Needs your merge, Specs to approve, In the pipeline. The page is read-only: its only way to act is a link to
// GitHub. The numbers are the data's own, placed as they are; nothing is added up, compared or rounded, and a count that
// cannot be read is "not known yet", never zero. Every value from the data is escaped.
import { COUNT_LABELS, type PipelineApprove, type PipelineDocument, type PipelineReady, type PipelineResult } from "./pipeline.ts";
import { PROJECTS_UNREADABLE_PHRASE } from "./projects.ts";
import { escapeText } from "./responses.ts";
import { githubAddress } from "./thisweek.ts";

export const COCKPIT_TITLE = "Cockpit";
export const NOTHING_WAITS_PHRASE = "Nothing waits for you.";
export const EMPTY_COCKPIT_PHRASE = "No projects are available to you yet.";
const NOT_KNOWN = "not known yet";
// The most characters of a summary or a spec title; a longer one is cut and ends with an ellipsis (SPEC-0010 rule 3).
export const MAX_SENTENCE = 120;
// A list over this many lines of one project is folded (SPEC-0008 rule 8).
const FOLD_OVER = 5;

// The projects of the page: the pipeline document of every repository the person can read, each read on its own so that one
// failure is that project's alone. `notices` are the fixed lines of the installations that were not read, as HTML.
export type CockpitList = { kind: "unreadable" } | { kind: "ok"; notices: string[]; projects: { name: string; result: PipelineResult }[] };

const link = (url: string, inner: string): string => {
  const address = githubAddress(url);
  return address === undefined ? inner : `<a href="${escapeText(address)}">${inner}</a>`;
};
const cut = (text: string): string => {
  const letters = Array.from(text);
  return letters.length > MAX_SENTENCE ? `${letters.slice(0, MAX_SENTENCE).join("")}…` : text;
};
const asOf = (document: PipelineDocument): string => `<span class="asof">as of ${escapeText(document.as_of)}</span>`;
const projectLink = (name: string): string => `<a href="https://github.com/${escapeText(name)}">${escapeText(name)}</a>`;
const unknownLine = (name: string, reason: string): string => `<li>${projectLink(name)}: ${NOT_KNOWN}: ${escapeText(reason)}.</li>`;

function readyLine(item: PipelineReady): string {
  const sentence = item.summary === "unknown" ? `Pull request #${item.number}` : escapeText(cut(item.summary));
  return `<li>${link(item.url, `${sentence}: reviewed, ready to merge`)}</li>`;
}

// agk's `unknown` for a title or a spec falls back to the phrase of rule 4; with neither, the line is the unknown line.
function approveLine(item: PipelineApprove): string {
  if (item.spec_title !== "unknown") return `<li>${link(item.url, `${escapeText(cut(item.spec_title))}: waits for your approval`)}</li>`;
  if (item.spec !== "unknown") return `<li>${link(item.url, `Pull request #${item.number} asks for approval of ${escapeText(item.spec)}`)}</li>`;
  return `<li>${link(item.url, `A spec waiting for approval could not be read: ${NOT_KNOWN}.`)}</li>`;
}

// One project's lines of a part: its name and the time the data is as of, then the lines (folded over FOLD_OVER).
function block(name: string, document: PipelineDocument, lines: string[]): string {
  const heading = `<h3>${projectLink(name)} ${asOf(document)}</h3>`;
  const list = lines.length > FOLD_OVER ? `<details class="fold"><summary>${escapeText(name)} (${lines.length})</summary>\n<ul>\n${lines.join("\n")}\n</ul>\n</details>` : `<ul>\n${lines.join("\n")}\n</ul>`;
  return `${heading}\n${list}`;
}

function strip(name: string, document: PipelineDocument): string {
  const labels: Record<(typeof COUNT_LABELS)[number], string> = { review: "review", fix: "fix", "ci-red": "ci red", conflict: "conflict", approve: "approve", ready: "ready" };
  const spans = COUNT_LABELS.map((key, n) => {
    const value = document.counts[key];
    const shown = value === "unknown" ? NOT_KNOWN : String(value);
    // The separator belongs to the count it comes before, so no count leaves a stray comma; a 0 is muted and never hidden.
    return `<span class="count${value === 0 ? " quiet" : ""}">${n === 0 ? "" : ", "}${labels[key]} ${shown}</span>`;
  });
  return `<li>${projectLink(name)}: ${spans.join("")} ${asOf(document)}</li>`;
}

function part(heading: string, blocks: string[]): string {
  return `<section class="part cockpit">\n<h2>${heading}</h2>\n${blocks.length === 0 ? `<p>${NOTHING_WAITS_PHRASE}</p>` : blocks.join("\n")}\n</section>`;
}

export function cockpitBody(list: CockpitList): string {
  const head = `<h1>${COCKPIT_TITLE}</h1>\n<p class="back"><a href="/">All projects</a></p>`;
  if (list.kind === "unreadable") return `${head}\n<p>${PROJECTS_UNREADABLE_PHRASE}</p>`;
  const notices = list.notices.join("\n");
  if (list.projects.length === 0) return `${head}\n${notices}${list.notices.length === 0 ? `\n<p>${EMPTY_COCKPIT_PHRASE}</p>` : ""}`;
  // A project that cannot be read stands in every part; one with nothing waiting stands in the strip only (rules 5 and 6).
  const parts = (pick: (document: PipelineDocument) => string[]): string[] =>
    list.projects.flatMap(({ name, result }) => {
      if (result.kind === "unknown") return [`<ul>\n${unknownLine(name, result.reason)}\n</ul>`];
      const lines = pick(result.document);
      return lines.length === 0 ? [] : [block(name, result.document, lines)];
    });
  const strips = list.projects.map(({ name, result }) => (result.kind === "unknown" ? unknownLine(name, result.reason) : strip(name, result.document)));
  return [
    head,
    notices,
    part("Needs your merge", parts((d) => d.ready.map(readyLine))),
    part("Specs to approve", parts((d) => d.approve.map(approveLine))),
    part("In the pipeline", [`<ul>\n${strips.join("\n")}\n</ul>`]),
  ]
    .filter((s) => s !== "")
    .join("\n");
}
