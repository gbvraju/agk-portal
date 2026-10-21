// The per-person list of projects (SPEC-0001 rule 1) and the run-time permission check (SPEC-0004 rule 7), read from
// the installations GitHub lists for the signed-in person with the person's own token. The list is never a file, and a
// repository that GitHub does not return for this person is never listed, named or counted.
import type { GithubClient } from "./github.ts";

export const PERMISSIONS_REFUSED_PHRASE = "This GitHub App has more access than this portal allows. Ask your administrator to review it.";
export const PROJECTS_UNREADABLE_PHRASE = "Projects could not be read: not known yet.";

const PER_PAGE = 100;
const MAX_PAGES = 10;
const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export type Listing = { kind: "ok"; repositories: string[] } | { kind: "permissions" } | { kind: "unknown" };

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
    if (items.length === 0 || (typeof total === "number" && collected.length >= total)) break;
  }
  return collected;
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
  for (const installation of installations) {
    if (typeof installation !== "object" || installation === null) return { kind: "unknown" };
    const { id, permissions } = installation as Record<string, unknown>;
    if (typeof id !== "number" || !Number.isInteger(id)) return { kind: "unknown" };
    if (!onlyTheTwoReads(permissions)) return { kind: "permissions" };
    ids.push(id);
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
  return { kind: "ok", repositories: [...names].sort() };
}

// The cards of the page. The facts of each project arrive with the next item; until then a card says "Not known yet."
export async function listProjectCards(github: GithubClient, token: string): Promise<readonly string[]> {
  const listing = await listReadableRepositories(github, token);
  if (listing.kind === "permissions") return [`<p>${PERMISSIONS_REFUSED_PHRASE}</p>`];
  if (listing.kind === "unknown") return [`<p>${PROJECTS_UNREADABLE_PHRASE}</p>`];
  return listing.repositories.map(
    (name) => `<section><h2><a href="https://github.com/${name}">${name}</a></h2><p>Not known yet.</p></section>`,
  );
}
