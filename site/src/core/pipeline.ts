// The pipeline document of a project (SPEC-0010 rule 2): what waits for a person, in plain words, which agk's router
// publishes after every routing run as the artifact `agk-pipeline` holding `pipeline.json` (agk `kit/pipeline-schema.json`,
// schema 1). It is read with the person's own token as the facts are, the latest unexpired artifact, and checked against
// agk's closed list before anything in it is used; a document that departs from the list is refused whole, and every
// failure is that project's alone and says why.
import { ARCHIVE_REASON, REQUEST_FAILED_REASON, Stop, downloadArchive, listArtifacts } from "./facts.ts";
import type { GithubClient } from "./github.ts";
import { readEntries } from "./zip.ts";

export const NO_PIPELINE_REASON = "no pipeline document exists";
export const PIPELINE_UNREADABLE_REASON = "the pipeline document could not be read";
export const PIPELINE_SCHEMA_REASON = "the pipeline document has a schema this page does not read";

export interface PipelineReady {
  number: number;
  summary: string;
  url: string;
}
export interface PipelineApprove {
  number: number;
  spec: string;
  spec_title: string;
  url: string;
}
export const COUNT_LABELS = ["review", "fix", "ci-red", "conflict", "approve", "ready"] as const;
export interface PipelineDocument {
  schema: 1;
  as_of: string;
  ready: PipelineReady[];
  approve: PipelineApprove[];
  counts: Record<(typeof COUNT_LABELS)[number], number | "unknown">;
}

export type PipelineResult = { kind: "pipeline"; document: PipelineDocument } | { kind: "unknown"; reason: string };

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ARTIFACT = "agk-pipeline";
const FILE = "pipeline.json";

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const count = (v: unknown): boolean => int(v) && v >= 0;
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const address = (v: unknown): v is string => typeof v === "string" && /^https:\/\/.+$/.test(v);
const exactly = (value: Obj, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((k) => Object.hasOwn(value, k));

// The document, or undefined when it departs from agk's closed list in any way.
export function parsePipeline(value: unknown): PipelineDocument | undefined {
  if (!isObject(value) || !exactly(value, ["schema", "as_of", "ready", "approve", "counts"]) || value["schema"] !== 1) return undefined;
  const { as_of: asOf, ready, approve, counts } = value;
  if (typeof asOf !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(asOf)) return undefined;
  if (!Array.isArray(ready) || !ready.every((r) => isObject(r) && exactly(r, ["number", "summary", "url"]) && int(r["number"]) && text(r["summary"]) && address(r["url"]))) return undefined;
  if (!Array.isArray(approve) || !approve.every((a) => isObject(a) && exactly(a, ["number", "spec", "spec_title", "url"]) && int(a["number"]) && typeof a["spec"] === "string" && /^(SPEC-\d{4}|unknown)$/.test(a["spec"]) && text(a["spec_title"]) && address(a["url"]))) return undefined;
  if (!isObject(counts) || !exactly(counts, COUNT_LABELS) || !COUNT_LABELS.every((k) => count(counts[k]) || counts[k] === "unknown")) return undefined;
  return value as unknown as PipelineDocument;
}

function decode(content: Uint8Array): PipelineResult {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(content));
  } catch {
    return { kind: "unknown", reason: PIPELINE_UNREADABLE_REASON };
  }
  // A JSON object with an integer schema that is not 1 is said to be a schema this page does not read.
  if (isObject(value) && int(value["schema"]) && value["schema"] !== 1) return { kind: "unknown", reason: PIPELINE_SCHEMA_REASON };
  const document = parsePipeline(value);
  return document === undefined ? { kind: "unknown", reason: PIPELINE_UNREADABLE_REASON } : { kind: "pipeline", document };
}

// `repository` is an owner/name from the person's own listing; anything else is refused before any request.
export async function readPipeline(github: GithubClient, token: string, repository: string, now: number): Promise<PipelineResult> {
  if (!REPOSITORY.test(repository)) throw new Error("the request is not allowed (address)");
  try {
    const found = await listArtifacts(github, token, repository, now, (name) => (name === ARTIFACT ? "" : undefined));
    // The newest: the router writes one on every routing run.
    const chosen = found.reduce<(typeof found)[number] | undefined>((best, candidate) => (best === undefined || candidate.created > best.created ? candidate : best), undefined);
    if (chosen === undefined) return { kind: "unknown", reason: NO_PIPELINE_REASON };
    const entries = await readEntries(await downloadArchive(github, token, repository, chosen.id), [FILE]);
    const content = entries?.get(FILE);
    if (content === undefined) return { kind: "unknown", reason: ARCHIVE_REASON };
    return decode(content);
  } catch (error) {
    if (error instanceof Stop) return { kind: "unknown", reason: error.reason };
    return { kind: "unknown", reason: REQUEST_FAILED_REASON };
  }
}
