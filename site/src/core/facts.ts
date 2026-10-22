// The facts of one project (SPEC-0001 rules 2 and 4 to 6): list the repository's artifacts with the person's own token,
// keep the unexpired `agk-facts-<week>` ones, take the latest week and, within it, the newest, download it through the
// redirect, read `facts.json` and accept schema 1 only. Every failure is local to the repository and says why.
import type { GithubClient } from "./github.ts";
import { MAX_FACTS_BYTES, readFactsFile } from "./zip.ts";

export const NO_ARTIFACT_REASON = "no facts artifact exists for its latest week";
export const REQUEST_FAILED_REASON = "the request to GitHub failed";
export const LISTING_INCOMPLETE_REASON = "its artifacts could not be listed completely";
export const MALFORMED_LIST_REASON = "the artifact list was not in the expected form";
export const ARCHIVE_REASON = "the archive could not be read";
export const statusReason = (status: number): string => `GitHub answered ${status}`;

export type FactsResult =
  | { kind: "facts"; week: string; document: Record<string, unknown> }
  | { kind: "unknown"; reason: string };

const unknown = (reason: string): FactsResult => ({ kind: "unknown", reason });

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const FACTS_NAME = /^agk-facts-(\d{4}-W\d{2})$/;
const PER_PAGE = 100;
const MAX_PAGES = 10;
// The archive of the facts document and the report is small (two entries of at most one megabyte each, and their headers); a larger answer is not read.
const MAX_ARCHIVE_BYTES = 3 * MAX_FACTS_BYTES;

class Stop extends Error {
  constructor(readonly result: FactsResult) {
    super("stop");
  }
}

interface Candidate {
  id: number;
  week: string;
  created: number;
}

async function send<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch {
    throw new Stop(unknown(REQUEST_FAILED_REASON));
  }
}

async function candidates(github: GithubClient, token: string, repository: string, now: number): Promise<Candidate[]> {
  const found: Candidate[] = [];
  let seen = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await send(() => github.get(`/repos/${repository}/actions/artifacts?per_page=${PER_PAGE}&page=${page}`, token));
    if (!response.ok) throw new Stop(unknown(statusReason(response.status)));
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Stop(unknown(MALFORMED_LIST_REASON));
    }
    if (typeof body !== "object" || body === null) throw new Stop(unknown(MALFORMED_LIST_REASON));
    const record = body as Record<string, unknown>;
    const items = record["artifacts"];
    if (!Array.isArray(items)) throw new Stop(unknown(MALFORMED_LIST_REASON));
    seen += items.length;
    for (const item of items) {
      const entry = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      const week = typeof entry["name"] === "string" ? FACTS_NAME.exec(entry["name"])?.[1] : undefined;
      if (week === undefined) continue;
      const created = typeof entry["created_at"] === "string" ? Date.parse(entry["created_at"]) : Number.NaN;
      const expires = entry["expires_at"] === undefined ? Number.POSITIVE_INFINITY : typeof entry["expires_at"] === "string" ? Date.parse(entry["expires_at"]) : Number.NaN;
      const id = entry["id"];
      if (typeof entry["expired"] !== "boolean" || typeof id !== "number" || !Number.isInteger(id) || Number.isNaN(created) || Number.isNaN(expires)) {
        throw new Stop(unknown(MALFORMED_LIST_REASON));
      }
      if (!entry["expired"] && expires > now) found.push({ id, week, created });
    }
    const total = record["total_count"];
    if (items.length === 0 || (typeof total === "number" && seen >= total)) return found;
  }
  throw new Stop(unknown(LISTING_INCOMPLETE_REASON));
}

// The latest week, then the newest artifact of that week (Q-S0001-2).
function latest(found: Candidate[]): Candidate | undefined {
  let best: Candidate | undefined;
  for (const candidate of found) {
    if (best === undefined || candidate.week > best.week || (candidate.week === best.week && candidate.created > best.created)) best = candidate;
  }
  return best;
}

async function download(github: GithubClient, token: string, repository: string, id: number): Promise<Uint8Array> {
  const redirect = await send(() => github.get(`/repos/${repository}/actions/artifacts/${id}/zip`, token));
  if (redirect.status !== 302) throw new Stop(unknown(statusReason(redirect.status)));
  const location = redirect.headers.get("location");
  let target: URL;
  try {
    target = new URL(location ?? "");
  } catch {
    throw new Stop(unknown(REQUEST_FAILED_REASON));
  }
  // The signed address is fetched without any credential; the guard refuses anything but a plain https address.
  const answer = await send(() => github.getSigned(target.href));
  if (!answer.ok) throw new Stop(unknown(statusReason(answer.status)));
  const bytes = await send(() => readLimited(answer, MAX_ARCHIVE_BYTES));
  if (bytes === undefined) throw new Stop(unknown(ARCHIVE_REASON));
  return bytes;
}

// The body of a response, read no further than `max` bytes; undefined when it is larger.
async function readLimited(response: Response, max: number): Promise<Uint8Array | undefined> {
  if (response.body === null) return new Uint8Array(0);
  const reader = response.body.getReader();
  const out = new Uint8Array(max);
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out.slice(0, length);
    if (length + value.length > max) {
      await reader.cancel();
      return undefined;
    }
    out.set(value, length);
    length += value.length;
  }
}

function parse(content: Uint8Array): { document: Record<string, unknown> } | { reason: string } {
  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(content));
  } catch {
    return { reason: "the file is not valid JSON" };
  }
  const schema = typeof document === "object" && document !== null && !Array.isArray(document) ? (document as Record<string, unknown>)["schema"] : undefined;
  if (schema === undefined) return { reason: "the schema is missing" };
  if (schema !== 1) return { reason: "the schema is not 1" };
  return { document: document as Record<string, unknown> };
}

// `repository` is an owner/name from the person's own listing; anything else is refused before any request.
export async function readFacts(github: GithubClient, token: string, repository: string, now: number): Promise<FactsResult> {
  if (!REPOSITORY.test(repository)) throw new Error("the request is not allowed (address)");
  try {
    const chosen = latest(await candidates(github, token, repository, now));
    if (chosen === undefined) return unknown(NO_ARTIFACT_REASON);
    const content = await readFactsFile(await download(github, token, repository, chosen.id));
    if (content === undefined) return unknown(ARCHIVE_REASON);
    const parsed = parse(content);
    return "reason" in parsed ? unknown(parsed.reason) : { kind: "facts", week: chosen.week, document: parsed.document };
  } catch (error) {
    if (error instanceof Stop) return error.result;
    return unknown(REQUEST_FAILED_REASON);
  }
}
