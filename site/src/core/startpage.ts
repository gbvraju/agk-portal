// The start page and a project's page (SPEC-0009): one line for each project, grouped by whether it needs attention, from the
// report's own counts and totals. The only rule over numbers is the placement of rule 2; the page adds up, compares and
// rounds nothing. Every value from the data is escaped.
import type { FactsResult } from "./facts.ts";
import { PROJECTS_UNREADABLE_PHRASE, factsCard, type ProjectList } from "./projects.ts";
import { escapeText } from "./responses.ts";
import { UNKNOWN_REPOSITORY_REASON } from "./thisweek.ts";

export const EMPTY_LIST_PHRASE = "No projects are available to you yet.";
export const NO_COUNTS_REASON = "the report has no counts (made by an older kit)";
export const NO_MATCH_PHRASE = "No project matches.";
export const staleReason = (week: string): string => `the latest report is for week ${week}`;
export const MAX_QUERY = 100;
const NOT_KNOWN = "not known yet";
const WEEK_MS = 7 * 86_400_000;

// The ISO week label (YYYY-Www) of the UTC day of a time: the week of its Thursday.
export function isoWeekLabel(ms: number): string {
  const d = new Date(ms);
  const monday0 = (d.getUTCDay() + 6) % 7;
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - monday0 + 3);
  const year = new Date(thursday).getUTCFullYear();
  const january4 = new Date(Date.UTC(year, 0, 4));
  const firstThursday = Date.UTC(year, 0, 4 - ((january4.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((thursday - firstThursday) / WEEK_MS);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

type Group = "attention" | "track" | "unknown";
interface Placed {
  name: string;
  group: Group;
  line: string;
}

const link = (name: string): string => `<a href="/p/${escapeText(name)}">${escapeText(name)}</a>`;
const week = (label: string): string => `<span class="weeklabel">Week ${escapeText(label)}</span>`;
const knownYet = (name: string, label: string | undefined, reason: string): Placed => ({
  name,
  group: "unknown",
  line: `<li class="project">${link(name)}${label === undefined ? "" : ` ${week(label)}`} <span class="reason">Not known yet: ${escapeText(reason)}.</span></li>`,
});

// A figure of the report. A count is a pill in the status colours of SPEC-0008 (none when it is not known yet); merged and
// hours are plain text. A 0 is the one the stylesheet mutes on a wide screen and hides on a phone.
type Pill = "done" | "decide" | "risk";
function figure(label: string, value: unknown, pill?: Pill): string {
  const unknown = value === "unknown" || value === undefined;
  const shown = unknown ? NOT_KNOWN : escapeText(String(value));
  const status = pill === undefined ? "" : ` pill ${unknown ? "none" : pill}`;
  return `<span class="figure${status}${value === 0 ? " zero" : ""}">${label}: ${shown}</span>`;
}

function place(name: string, result: FactsResult, now: number): Placed {
  if (result.kind === "unknown") return knownYet(name, undefined, result.reason);
  if (result.document["repo"] === "unknown") return knownYet(name, result.week, UNKNOWN_REPOSITORY_REASON);
  if (result.report.kind !== "report") return knownYet(name, result.week, result.report.reason);
  if (result.week !== isoWeekLabel(now) && result.week !== isoWeekLabel(now - WEEK_MS)) return knownYet(name, result.week, staleReason(result.week));
  const report = result.report.document;
  const counts = (report as { counts?: Record<string, unknown> }).counts;
  if (report.schema < 3 || counts === undefined) return knownYet(name, result.week, NO_COUNTS_REASON);
  const totals = report.sections.cost.find((item) => item.kind === "week-totals");
  const attention = [counts["needs_you"], counts["at_risk"]].some((c) => c === "unknown" || (typeof c === "number" && c > 0));
  const line =
    `<li class="project">${link(name)} ${week(result.week)} ` +
    [figure("delivered", counts["delivered"], "done"), figure("needs you", counts["needs_you"], "decide"), figure("at risk", counts["at_risk"], "risk"), figure("merged", totals?.["merged"]), figure("hours", totals?.["hours"])].join(" ") +
    "</li>";
  return { name, group: attention ? "attention" : "track", line };
}

const GROUPS: [Group, string][] = [
  ["attention", "Needs your attention"],
  ["track", "On track"],
  ["unknown", "Not known yet"],
];

const COCKPIT_LINK = '<p class="back"><a href="/cockpit">Cockpit</a></p>';
const SIGN_OUT = '<form method="post" action="/signout"><button type="submit">Sign out</button></form>';

// The query of the find form: trimmed, cut at MAX_QUERY characters, compared ignoring case.
export function cleanQuery(raw: string | null): string {
  return (raw ?? "").trim().slice(0, MAX_QUERY);
}

export function startPageBody(list: ProjectList, now: number, rawQuery: string | null): string {
  const query = cleanQuery(rawQuery);
  const find =
    `<form method="get" action="/" class="find">\n<label for="q">Find a project</label>\n<input type="text" id="q" name="q" value="${escapeText(query)}" maxlength="${MAX_QUERY}">\n` +
    `<button type="submit">Find</button>\n</form>`;
  const head = `<h1>Your projects</h1>\n${COCKPIT_LINK}`;
  if (list.kind === "unreadable") return `${head}\n<p>${PROJECTS_UNREADABLE_PHRASE}</p>\n${SIGN_OUT}`;
  const notices = list.notices.join("\n");
  // A refused installation is said, and is not an empty list.
  if (list.projects.length === 0) return `${head}\n${notices}${list.notices.length === 0 ? `\n<p>${EMPTY_LIST_PHRASE}</p>` : ""}\n${SIGN_OUT}`;
  const wanted = query.toLowerCase();
  const placed = list.projects.filter((p) => p.name.toLowerCase().includes(wanted)).map((p) => place(p.name, p.result, now));
  const sections = GROUPS.flatMap(([group, heading]) => {
    const lines = placed.filter((p) => p.group === group).map((p) => p.line);
    return lines.length === 0 ? [] : [`<section class="group">\n<h2>${heading}</h2>\n<ul class="projects">\n${lines.join("\n")}\n</ul>\n</section>`];
  });
  const body = placed.length === 0 ? `<p>${NO_MATCH_PHRASE}</p>` : sections.join("\n");
  return `${head}\n${notices}\n${find}\n${body}\n${SIGN_OUT}`;
}

// The page of one project: its This week (today's card) and the link back to the list (SPEC-0009 rule 5).
export function projectPageBody(name: string, result: FactsResult): string {
  return `<p class="back"><a href="/">All projects</a></p>\n${COCKPIT_LINK}\n${factsCard(name, result)}\n${SIGN_OUT}`;
}
