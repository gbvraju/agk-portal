// The report's data (agk SPEC-0022, schema 1) as the page receives it, and the check of it against the closed list of
// kinds and fields before anything in it is used (SPEC-0005 rule 13). A document that departs from the list in any way is
// refused whole: an extra or missing key, kind or field, a wrong type, a date that is not a date, `unknown` where the
// list does not allow it. The page renders what passes and computes nothing from it.
type Check = (value: unknown) => boolean;
export type Record_ = Record<string, unknown>;
export interface ReportLink {
  to: string;
  url: string;
}
export interface ReportItem extends Record_ {
  kind: string;
  links: ReportLink[];
}
export interface ReportGroup {
  group: string;
  count: number | "unknown";
  items: ReportItem[];
}
export interface ReportDocument {
  schema: 1 | 2 | 3 | 4;
  week: string;
  opening: { first: string; last: string; as_of: string };
  sections: { delivered: ReportItem[]; proven: ReportItem[]; needs_you: ReportGroup[]; at_risk: ReportItem[]; cost: ReportItem[] };
  notices: ReportItem[];
}

const isObject = (v: unknown): v is Record_ => typeof v === "object" && v !== null && !Array.isArray(v);
const str: Check = (v) => typeof v === "string";
const int: Check = (v) => typeof v === "number" && Number.isInteger(v);
const bool: Check = (v) => typeof v === "boolean";
const date: Check = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const hours: Check = (v) => typeof v === "string" && /^(-?\d+\.\d|unknown)$/.test(v);
const one = (...values: unknown[]): Check => (v) => values.includes(v);
const either = (...checks: Check[]): Check => (v) => checks.some((c) => c(v));
const intOrUnknown = either(int, one("unknown"));
const list = (item: Check): Check => (v) => Array.isArray(v) && v.every(item);

// An object with exactly these keys (the optional ones may be absent), each of the right type.
function shape(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  return (v) => {
    if (!isObject(v)) return false;
    const keys = Object.keys(v);
    return (
      keys.every((k) => Object.hasOwn(required, k) || Object.hasOwn(optional, k)) &&
      Object.keys(required).every((k) => Object.hasOwn(v, k) && (required[k] as Check)(v[k])) &&
      Object.keys(optional).every((k) => !Object.hasOwn(v, k) || (optional[k] as Check)(v[k]))
    );
  };
}

const link = shape({ to: one("pull-request", "file", "directory", "issue", "search"), url: (v) => typeof v === "string" && v.startsWith("https://") });
const links = list(link);

// An item of a section: a kind of the list, its fields and its links, and nothing else.
function kinds(table: Record<string, Record<string, Check>>): Check {
  const checks = Object.fromEntries(Object.entries(table).map(([kind, fields]) => [kind, shape({ kind: one(kind), links, ...fields })]));
  return (v) => isObject(v) && typeof v["kind"] === "string" && Object.hasOwn(checks, v["kind"]) && (checks[v["kind"]] as Check)(v);
}

const UNKNOWN = { unknown: { what: str } };
const reason = (name: string, fields: Record<string, Check> = {}): Check => shape({ reason: one(name), ...fields });

const delivered = kinds({
  "requirement-done": { id: str, title: str, criteria: either(list(str), one("unknown")), became_done: one("this-week", "unknown") },
  "pull-request-merged": { number: int, title: str, merged_on: date },
  "pull-requests-merged": { count: int },
  ...UNKNOWN,
});
const proven = kinds({
  "requirement-proven": { id: str, last_change: shape({ number: int, proof: str }) },
  "requirement-not-proven": {
    id: str,
    reasons: list(
      either(
        reason("criteria-unknown"),
        reason("no-criteria"),
        reason("no-test", { ac: str }),
        reason("no-merged-change"),
        reason("not-shown", { number: int, proof: str, why: str }),
        reason("unknown-proof", { number: int, proof: str, why: str }),
      ),
    ),
  },
  "planned-not-counted": { count: int },
  ...UNKNOWN,
});
// The Needs your decision items of each schema. Schema 4 (agk #184, REQ-037 part c) adds the kind `pull-request-ready` with
// exactly number, title and links, in the group `ready`.
const needsItemOf = (extra: Record<string, Record<string, Check>>): Check =>
  kinds({
    ...extra,
    "draft-spec": { id: str, title: str },
    "proposed-adr": { id: str, title: str },
    question: { id: str, asked_in: str },
    "pull-request-no-verdict": { number: int, title: str, days: int },
    "overdue-residual": { due: date, text: str },
    "unspecced-requirement": { id: str, title: str },
    ...UNKNOWN,
});
const GROUPS = ["spec", "adr", "question", "pull-request", "residual", "requirement"] as const;
const needsOf = (item: Check, groups: readonly string[]): Check => shape({ group: one(...groups), count: intOrUnknown, items: list(item) });
// The At risk list of each schema. Schema 3 (agk SPEC-0026, kit 0.50.0) adds `count`, an integer from 0, to the four grouped kinds.
const atRiskOf = (grouped: Record<string, Check>): Check =>
  kinds({
    "residual-overdue": { due: date, days: int, text: str },
    "pull-requests-open-long": { entries: list(shape({ number: int, days: int }, { title: str })), ...grouped },
    "pull-requests-sent-back": { entries: list(shape({ number: int, times: int }, { title: str })), ...grouped },
    "pull-requests-merged-no-verdict": { entries: list(shape({ number: int })), ...grouped },
    "pull-requests-merged-not-cleared": { entries: list(shape({ number: int })), ...grouped },
    "drift-audit": { total: intOrUnknown, counts: isObject, open_issue: either(int, one("none", "unknown")) },
    ...UNKNOWN,
  });
// The cost list of each schema. Schema 2 (agk SPEC-0024, kit 0.43.0) adds hours_unknown to the week-totals item: an integer
// from 0, always present.
const count: Check = (v) => int(v) && (v as number) >= 0;
const costOf = (extra: Record<string, Check>, afterRounds: Record<string, Check> = {}): Check =>
  kinds({
    "pull-request-cost": { number: int, title: str, hours, fix_verdicts: intOrUnknown },
    "week-totals": { merged: int, hours, ...extra, fix_verdicts: intOrUnknown, ...afterRounds, behaviour_unchanged: int, estimate: either(shape({ within: int, counted: int }), one("none-declared")), busy: bool },
    ...UNKNOWN,
  });
const issueState = one("found", "none-found", "unknown");
const notice = (name: string, fields: Record<string, Check>, optional: Record<string, Check> = {}): [string, Check] => [name, shape({ kind: one(name), links, ...fields }, optional)];
const notices: Check = (() => {
  const checks = Object.fromEntries([
    notice("facts-commit", { commit: str }),
    notice("kit-version", { version: str }),
    notice("working-tree-modified", { dirty: str }),
    notice("metrics-issue", { state: issueState }, { number: int, title: str }),
    notice("drift-audit-issue", { state: issueState }, { number: int, title: str }),
  ]);
  return (v) => isObject(v) && typeof v["kind"] === "string" && Object.hasOwn(checks, v["kind"]) && (checks[v["kind"]] as Check)(v);
})();

const countOrUnknown: Check = either((v) => int(v) && (v as number) >= 0, one("unknown"));
// The number of each section and the lists of the schema; `counts` (schema 3) has exactly the four keys.
const documentOf = (schema: 1 | 2 | 3 | 4, lists: { needs: Check; atRisk: Check; cost: Check }, counts: Record<string, Check> = {}): Check =>
  shape({
    schema: one(schema),
    ...counts,
    week: (v) => typeof v === "string" && /^\d{4}-W\d{2}$/.test(v),
    opening: shape({ first: date, last: date, as_of: date }),
    sections: shape({
      delivered: list(delivered),
      proven: list(proven),
      needs_you: list(lists.needs),
      at_risk: list(lists.atRisk),
      cost: list(lists.cost),
    }),
    notices: list(notices),
  });
// Each schema has its own closed list; any other number is not read.
const needs1 = needsOf(needsItemOf({}), GROUPS);
const needs4 = needsOf(needsItemOf({ "pull-request-ready": { number: int, title: str } }), ["ready", ...GROUPS]);
const countsOf = { counts: shape({ delivered: countOrUnknown, proven: countOrUnknown, needs_you: countOrUnknown, at_risk: countOrUnknown }) };
const documents: Record<number, Check> = {
  1: documentOf(1, { needs: needs1, atRisk: atRiskOf({}), cost: costOf({}) }),
  2: documentOf(2, { needs: needs1, atRisk: atRiskOf({}), cost: costOf({ hours_unknown: count }) }),
  3: documentOf(3, { needs: needs1, atRisk: atRiskOf({ count }), cost: costOf({ hours_unknown: count }, { fix_verdicts_unknown: count }) }, countsOf),
  4: documentOf(4, { needs: needs4, atRisk: atRiskOf({ count }), cost: costOf({ hours_unknown: count }, { fix_verdicts_unknown: count }) }, countsOf),
};

// The document, or undefined when the text is not JSON or departs from the closed list.
// The schema number of a text that is a JSON object with an integer `schema` this page does not read: said on the card, not
// shown as an empty week. Anything else that departs from the lists is "could not be read".
export function hasUnknownSchema(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    const schema = isObject(value) ? value["schema"] : undefined;
    return typeof schema === "number" && Number.isInteger(schema) && !Object.hasOwn(documents, schema);
  } catch {
    return false;
  }
}

export function parseReport(text: string): ReportDocument | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  const schema = isObject(value) ? value["schema"] : undefined;
  const check = typeof schema === "number" ? documents[schema] : undefined;
  return check !== undefined && check(value) ? (value as ReportDocument) : undefined;
}
