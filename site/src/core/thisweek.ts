// The This week section of a card (SPEC-0005): rendered from the report's data, which the page has already checked
// (report.ts). This part is the shell: the opening line, the notice of a modified working tree and the facts commit. The
// parts follow with their own items. Every value from the data is escaped; an address is shown only if it is GitHub's.
import type { ReportDocument } from "./report.ts";
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
  return `<section>\n<h3>This week</h3>\n${lines.join("\n")}\n</section>`;
}
