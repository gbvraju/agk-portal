// The per-person list of projects (SPEC-0001 rule 1) and the run-time permission check (SPEC-0004 rule 7), read from
// the installations GitHub lists for the signed-in person with the person's own token. The list is never a file, and a
// repository that GitHub does not return for this person is never listed, named or counted.
import { readFacts, type FactsResult } from "./facts.ts";
import { readPipeline, type PipelineResult } from "./pipeline.ts";
import { UNKNOWN_REPOSITORY_REASON, thisWeekSection } from "./thisweek.ts";
import type { GithubClient } from "./github.ts";

const ACCOUNT = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

// The fixed line for one installation that grants more than the two reads (SPEC-0004 rule 7, read per installation).
export function permissionsRefusedLine(account: string): string {
  return `The GitHub App installed on ${account} has more access than this portal allows. Ask its administrator to review it.`;
}
export const PROJECTS_UNREADABLE_PHRASE = "Projects could not be read: not known yet.";

const PER_PAGE = 100;
const MAX_PAGES = 10;
const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

// `refused` lists the accounts of the installations that were not read because they grant more than the two reads.
export type Listing = { kind: "ok"; repositories: string[]; refused: string[] } | { kind: "unknown" };

// Every page of a listing until the count GitHub states is reached or a page is empty. Anything else is unknown.
async function allPages(github: GithubClient, token: string, path: string, key: string): Promise<unknown[] | undefined> {
  const collected: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let body: unknown;
    try {
      const response = await github.get(`${path}?per_page=${PER_PAGE}&page=${page}`, token);
      if (!response.ok) return undefined;
      body = await response.json();
    } catch {
      return undefined;
    }
    if (typeof body !== "object" || body === null) return undefined;
    const record = body as Record<string, unknown>;
    const items = record[key];
    if (!Array.isArray(items)) return undefined;
    collected.push(...items);
    const total = record["total_count"];
    if (items.length === 0 || (typeof total === "number" && collected.length >= total)) return collected;
  }
  // The cap ended the listing before the count GitHub states: it is not known, never a partial list.
  return undefined;
}

// Exactly Actions read and Metadata read, and nothing else (the field name is from memory: verify).
function onlyTheTwoReads(permissions: unknown): boolean {
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) return false;
  const entries = Object.entries(permissions as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
  return entries.length === 2 && entries[0]![0] === "actions" && entries[0]![1] === "read" && entries[1]![0] === "metadata" && entries[1]![1] === "read";
}

export async function listReadableRepositories(github: GithubClient, token: string): Promise<Listing> {
  const installations = await allPages(github, token, "/user/installations", "installations");
  if (installations === undefined) return { kind: "unknown" };
  const ids: number[] = [];
  const refused: string[] = [];
  for (const installation of installations) {
    if (typeof installation !== "object" || installation === null) return { kind: "unknown" };
    const { id, permissions, account } = installation as Record<string, unknown>;
    if (typeof id !== "number" || !Number.isInteger(id)) return { kind: "unknown" };
    if (onlyTheTwoReads(permissions)) {
      ids.push(id);
      continue;
    }
    // An over-granted installation contributes no repository, and its repositories are not fetched.
    const login = typeof account === "object" && account !== null ? (account as Record<string, unknown>)["login"] : undefined;
    if (typeof login !== "string" || !ACCOUNT.test(login)) return { kind: "unknown" };
    refused.push(login);
  }
  const names = new Set<string>();
  for (const id of ids) {
    const repositories = await allPages(github, token, `/user/installations/${id}/repositories`, "repositories");
    if (repositories === undefined) return { kind: "unknown" };
    for (const repository of repositories) {
      const name = typeof repository === "object" && repository !== null ? (repository as Record<string, unknown>)["full_name"] : undefined;
      if (typeof name !== "string" || !FULL_NAME.test(name)) return { kind: "unknown" };
      names.add(name);
    }
  }
  return { kind: "ok", repositories: [...names].sort(), refused: [...new Set(refused)].sort() };
}

// The card of one project. Its parts arrive with their own items; until then a card says which week's facts were read and,
// from the report's data, opens the This week section; or says "Not known yet" with the reason, and nothing is shown as a
// number that is not known.
export function factsCard(name: string, result: FactsResult): string {
  const heading = `<h2><a href="https://github.com/${name}">${name}</a></h2>`;
  if (result.kind === "unknown") return `<section class="card">${heading}<p>Not known yet: ${result.reason}.</p></section>`;
  let rest: string;
  if (result.document["repo"] === "unknown") rest = `<p>Week ${result.week}: not known yet: ${UNKNOWN_REPOSITORY_REASON}.</p>`;
  else if (result.report.kind === "report") rest = thisWeekSection(result.report.document);
  else rest = `<p>Week ${result.week}: not known yet: ${result.report.reason}.</p>`;
  return `<section class="card">${heading}${rest}</section>`;
}

// The projects of the page: the facts of every repository the person can read, each read on its own so that one failure is
// that project's alone. `notices` are the fixed lines of the installations that were not read (SPEC-0004 rule 7), as HTML.
export type ProjectList = { kind: "unreadable" } | { kind: "ok"; notices: string[]; projects: { name: string; result: FactsResult }[] };

export async function listProjects(github: GithubClient, token: string, now: number): Promise<ProjectList> {
  const listing = await listReadableRepositories(github, token);
  if (listing.kind === "unknown") return { kind: "unreadable" };
  const notices = listing.refused.map((account) => `<p>${permissionsRefusedLine(account)}</p>`);
  const projects = await Promise.all(listing.repositories.map(async (name) => ({ name, result: await readFacts(github, token, name, now) })));
  return { kind: "ok", notices, projects };
}

// One project of the person's list (SPEC-0009 rule 5): the list is read, and the facts of this project only when it is in it.
export type ProjectLookup = { kind: "found"; result: FactsResult } | { kind: "missing" } | { kind: "unreadable" };

export async function findProject(github: GithubClient, token: string, name: string, now: number): Promise<ProjectLookup> {
  const listing = await listReadableRepositories(github, token);
  if (listing.kind === "unknown") return { kind: "unreadable" };
  if (!listing.repositories.includes(name)) return { kind: "missing" };
  return { kind: "found", result: await readFacts(github, token, name, now) };
}

// The cards of the page: one card for each project, and the notices before them.
export async function listProjectCards(github: GithubClient, token: string, now: number): Promise<readonly string[]> {
  const list = await listProjects(github, token, now);
  if (list.kind === "unreadable") return [`<p>${PROJECTS_UNREADABLE_PHRASE}</p>`];
  return [...list.notices, ...list.projects.map((p) => factsCard(p.name, p.result))];
}

// The projects of the cockpit (SPEC-0010 rule 1): the pipeline document of every repository the person can read, each read on
// its own so that one failure is that project's alone.
export type CockpitProjects = { kind: "unreadable" } | { kind: "ok"; notices: string[]; projects: { name: string; result: PipelineResult }[] };

export async function listCockpit(github: GithubClient, token: string, now: number): Promise<CockpitProjects> {
  const listing = await listReadableRepositories(github, token);
  if (listing.kind === "unknown") return { kind: "unreadable" };
  const notices = listing.refused.map((account) => `<p>${permissionsRefusedLine(account)}</p>`);
  const projects = await Promise.all(listing.repositories.map(async (name) => ({ name, result: await readPipeline(github, token, name, now) })));
  return { kind: "ok", notices, projects };
}
