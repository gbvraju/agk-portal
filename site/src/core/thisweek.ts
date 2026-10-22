// The This week section of a card (SPEC-0005): rendered from the report's data, which the page has already checked
// (report.ts). This part is the shell: the opening line, the notice of a modified working tree and the facts commit. The
// parts follow with their own items. Every value from the data is escaped; an address is shown only if it is GitHub's.
import type { ReportDocument, ReportItem } from "./report.ts";
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
function reference(item: ReportItem, text: string): string {
  const addresses = item.links.map((l) => githubAddress(l.url)).filter((u): u is string => u !== undefined);
  const first = addresses[0];
  const shown = first === undefined ? escapeText(text) : `<a href="${escapeText(first)}">${escapeText(text)}</a>`;
  const more = addresses.slice(1).map((u) => ` <a href="${escapeText(u)}">link</a>`).join("");
  return `(${shown}${more})`;
}

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
  return `${escapeText(sentence(String(item["what"])))} could not be read: ${NOT_KNOWN}.`;
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
  lines.push(part("Delivered", report.sections.delivered, deliveredLine), part("Time and review", report.sections.cost, costLine));
  return `<section>\n<h3>This week</h3>\n${lines.join("\n")}\n</section>`;
}
