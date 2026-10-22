// The This week section of a card (SPEC-0005): rendered from the report's data, which the page has already checked
// (report.ts). This part is the shell: the opening line, the notice of a modified working tree and the facts commit. The
// parts follow with their own items. Every value from the data is escaped; an address is shown only if it is GitHub's.
import type { ReportDocument, ReportGroup, ReportItem } from "./report.ts";
import { escapeText } from "./responses.ts";

export const DIRTY_NOTICE_PHRASE = "These numbers were made from a copy with unsaved changes; treat them with care.";
export const NO_REPORT_REASON = "the artifact has no report (made before kit 0.39.0)";
export const REPORT_UNREADABLE_REASON = "the report could not be read";
export const UNKNOWN_REPOSITORY_REASON = "its repository is not known";

export function openingPhrase(report: Pick<ReportDocument, "week" | "opening">): string {
  return `Week ${report.week}: Monday ${report.opening.first} to Sunday ${report.opening.last} (UTC). What waits for you is as of ${report.opening.as_of}.`;
}

// An address from the data is shown only if it is on github.com and holds nothing that could end an attribute or a tag.
function githubAddress(url: unknown): string | undefined {
  return typeof url === "string" && url.startsWith("https://github.com/") && /^[A-Za-z0-9._~:/?#@!$&()*+,;=%\[\]-]+$/.test(url) ? url : undefined;
}

const NOT_KNOWN = "not known yet";
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const rounds = (v: unknown): string => (typeof v === "number" ? plural(v, "review round", "review rounds") : `review rounds ${NOT_KNOWN}`);

// The reference at the end of a line: linked to the first address of the item that is GitHub's, else plain text; any other
// valid address follows as a second link. A line of an item with no link has no reference of its own.
function anchor(item: ReportItem, text: string): string {
  const addresses = item.links.map((l) => githubAddress(l.url)).filter((u): u is string => u !== undefined);
  const first = addresses[0];
  const shown = first === undefined ? escapeText(text) : `<a href="${escapeText(first)}">${escapeText(text)}</a>`;
  const more = addresses.slice(1).map((u) => ` <a href="${escapeText(u)}">link</a>`).join("");
  return `${shown}${more}`;
}
const reference = (item: ReportItem, text: string): string => `(${anchor(item, text)})`;

function deliveredLine(item: ReportItem): string {
  switch (item.kind) {
    case "requirement-done": {
      const criteria = item["criteria"];
      const list = Array.isArray(criteria) ? (criteria as string[]) : undefined;
      const detail =
        list === undefined ? `its acceptance criteria are ${NOT_KNOWN}.` : list.length === 0 ? "no acceptance criteria are listed." : `${plural(list.length, "acceptance criterion", "acceptance criteria")} (${list.map(escapeText).join(", ")}).`;
      const note = item["became_done"] === "this-week" ? "" : ` (week it became done: ${NOT_KNOWN})`;
      return `“${escapeText(String(item["title"]))}” is done: ${detail}${note} ${reference(item, String(item["id"]))}`;
    }
    case "pull-request-merged":
      return `A change was merged on ${escapeText(String(item["merged_on"]))}. ${reference(item, `#${item["number"]}`)}`;
    case "pull-requests-merged": {
      const n = item["count"] as number;
      return `${n} ${n === 1 ? "change was" : "changes were"} merged this week.${item.links.length === 0 ? "" : ` ${reference(item, "the week")}`}`;
    }
    default:
      return unreadable(item);
  }
}

function costLine(item: ReportItem): string {
  const hours = (v: unknown, tail: string): string => (v === "unknown" ? `hours ${NOT_KNOWN} ${tail}` : `${escapeText(String(v))} hours ${tail}`);
  switch (item.kind) {
    case "pull-request-cost":
      return `A change took ${hours(item["hours"], "from opening to merge")} and ${rounds(item["fix_verdicts"])}. ${reference(item, `#${item["number"]}`)}`;
    case "week-totals": {
      const total = item["hours"] === "unknown" ? NOT_KNOWN : `${escapeText(String(item["hours"]))} hours in total`;
      const roundsTotal = item["fix_verdicts"] === "unknown" ? NOT_KNOWN : String(item["fix_verdicts"]);
      const estimate = item["estimate"];
      const range = typeof estimate === "object" && estimate !== null ? `${(estimate as Record<string, number>)["within"]} of ${(estimate as Record<string, number>)["counted"]} within range` : "none declared this week";
      const merged = item["merged"] as number;
      return `This week: ${merged} ${merged === 1 ? "change" : "changes"} merged; time from opening to merge: ${total}; review rounds in total: ${roundsTotal}; declared as not changing behaviour: ${item["behaviour_unchanged"]}; estimate: ${range}.${item.links.length === 0 ? "" : ` ${reference(item, "the week")}`}`;
    }
    default:
      return unreadable(item);
  }
}

function unreadable(item: ReportItem): string {
  return `${escapeText(sentence(String(item["what"])))} could not be read: ${NOT_KNOWN}.${item.links.length === 0 ? "" : ` ${reference(item, "the item")}`}`;
}

const PROOF_WORDS: Record<string, string> = {
  "green-on-base": "the new tests already pass without the change",
  "red-on-head": "the tests fail on the change itself",
  timeout: "the test run took too long",
  "no-project-tests": "no test command is configured",
  "no-test-files": "the change adds no test file",
};
const proofWords = (code: unknown): string => (typeof code !== "string" || code === "" ? "reason not known yet" : Object.hasOwn(PROOF_WORDS, code) ? (PROOF_WORDS[code] as string) : escapeText(code));

function reasonWords(reason: Record<string, unknown>): string {
  const change = `the last change (#${reason["number"]})`;
  switch (reason["reason"]) {
    case "no-test":
      return `${escapeText(String(reason["ac"]))} has no test`;
    case "no-criteria":
      return "it lists no acceptance criteria";
    case "no-merged-change":
      return "no merged change was found";
    case "not-shown":
      return `${change} did not prove it: ${proofWords(reason["why"])}`;
    case "unknown-proof":
      return `${change} has a proof that is not known yet: ${proofWords(reason["why"])}`;
    default:
      return `its acceptance criteria are ${NOT_KNOWN}`;
  }
}

function provenLine(item: ReportItem): string {
  switch (item.kind) {
    case "requirement-proven": {
      const last = item["last_change"] as Record<string, unknown>;
      const outcome = last["proof"] === "skipped" ? "skipped: declared as not changing behaviour" : escapeText(String(last["proof"]));
      return `${anchor(item, String(item["id"]))} is proven (last change #${last["number"]}: ${outcome}).`;
    }
    case "requirement-not-proven": {
      const reasons = (item["reasons"] as Record<string, unknown>[]).map(reasonWords);
      return `${anchor(item, String(item["id"]))} is not proven: ${reasons.length === 0 ? "reason not known yet" : reasons.join("; ")}.`;
    }
    case "planned-not-counted": {
      const n = item["count"] as number;
      return `${n} ${n === 1 ? "requirement is" : "requirements are"} planned and not counted here.${item.links.length === 0 ? "" : ` ${reference(item, "the list")}`}`;
    }
    default:
      return unreadable(item);
  }
}

const HEADINGS: Record<string, [string, string]> = {
  spec: ["Specification waiting for approval", "Specifications waiting for approval"],
  adr: ["Decision waiting", "Decisions waiting"],
  question: ["Question waiting", "Questions waiting"],
  "pull-request": ["Change waiting for a review", "Changes waiting for a review"],
  residual: ["Overdue item", "Overdue items"],
  requirement: ["Planned requirement with no specification", "Planned requirements with no specification"],
};

function needsLine(item: ReportItem): string {
  const id = (): string => reference(item, String(item["id"]));
  switch (item.kind) {
    case "draft-spec":
      return `A specification waits for approval. ${id()}`;
    case "proposed-adr":
      return `A decision record waits for your approval. ${id()}`;
    case "question":
      return `A question is waiting for your answer. ${id()}`;
    case "pull-request-no-verdict":
      return `A change has waited ${plural(item["days"] as number, "day", "days")} for a review. ${reference(item, `#${item["number"]}`)}`;
    case "overdue-residual":
      return `An item was due on ${escapeText(String(item["due"]))} and is overdue.${item.links.length === 0 ? "" : ` ${reference(item, "the item")}`}`;
    case "unspecced-requirement":
      return `“${escapeText(String(item["title"]))}” is planned and no specification names it. ${id()}`;
    default:
      return unreadable(item);
  }
}

function needsPart(groups: ReportGroup[]): string {
  if (groups.length === 0) return `<h4>Needs your decision</h4>\n<p>Nothing this week.</p>`;
  const shown = groups.map((g) => {
    const [one, many] = HEADINGS[g.group] as [string, string];
    const heading = g.count === "unknown" ? `${many} (${NOT_KNOWN})` : `${g.count === 1 ? one : many} (${g.count})`;
    const items = g.items.length === 0 ? "" : `\n<ul>\n${g.items.map((i) => `<li>${needsLine(i)}</li>`).join("\n")}\n</ul>`;
    return `<h5>${heading}</h5>${items}`;
  });
  return `<h4>Needs your decision</h4>\n${shown.join("\n")}`;
}

function part(title: string, items: ReportItem[], line: (item: ReportItem) => string): string {
  const body = items.length === 0 ? "<p>Nothing this week.</p>" : `<ul>\n${items.map((i) => `<li>${line(i)}</li>`).join("\n")}\n</ul>`;
  return `<h4>${title}</h4>\n${body}`;
}

export function thisWeekSection(report: ReportDocument): string {
  const lines = [`<p>${escapeText(openingPhrase(report))}</p>`];
  if (report.notices.some((n) => n.kind === "working-tree-modified")) {
    lines.push(`<p>${DIRTY_NOTICE_PHRASE}</p>`);
    const commit = report.notices.find((n) => n.kind === "facts-commit");
    if (commit !== undefined) {
      const address = githubAddress(commit.links.map((l) => l.url).find((u) => githubAddress(u) !== undefined));
      const text = escapeText(String(commit["commit"]));
      lines.push(`<p>Facts commit: ${address === undefined ? text : `<a href="${escapeText(address)}">${text}</a>`}</p>`);
    }
  }
  lines.push(part("Delivered", report.sections.delivered, deliveredLine), part("Proven", report.sections.proven, provenLine), needsPart(report.sections.needs_you), part("Time and review", report.sections.cost, costLine));
  return `<section>\n<h3>This week</h3>\n${lines.join("\n")}\n</section>`;
}
