# ADR-0035: The report reader accepts schema 7 and shows the shadow review's catch rate

- Status: Accepted
- Date: 2026-10-26
- Deciders: maintainers
- Related: ADR-0019, ADR-0031, ADR-0032
- Requirements: REQ-105

## Context

agk #228 (REQ-042 build c) makes `report.json` schema 7: the item `week-totals` gains one required field, `shadow`, either `"not-running"` or `"unknown"`, or an object with `week` and `total` (each exactly the eight counts `heads`, `right_conductor_only`, `right_shadow_only`, `right_both`, `wrong_conductor`, `wrong_shadow`, `unmarked_heads` and `unmarked_findings`, and a `catch_rate`, `none` or `R/T (P%)`), `unpaired` and `unread`. The first weekly report written after #228 merges would not be read by this page; agk #228 merges only after this reader is merged and deployed. The brief of issue #69 asks for schema 7 to be added to the closed lists and shown as a tile of Time and review in plain words.

## Decision

1. The reader accepts schema 7: schema 6's lists plus `shadow` on the totals with exactly the keys above; nothing else is accepted for 7, a schema 7 report lacking `shadow` or with a malformed one is refused, and schemas 1 to 6 refuse the field.
2. The page shows, last in Time and review, "Conductor catch rate this week: {catch_rate} ({heads} changes reviewed twice)" and "Conductor catch rate in total: {catch_rate} ({heads} changes reviewed twice)" (singular for one, 0 shown, `none` as written and never 0), or "Second review: not running" for `not-running` and "Second review: not known yet" for `unknown`. `unpaired` and `unread` are checked and not shown. The page places the data and computes nothing. Schemas 1 to 6 show none of it. The qualifiers "this week" and "in total" are Q-B23-1 on issue #69.
3. A report whose `schema` is an integer that is not 1 to 7 still reads "the report has a schema this page does not read". The start page needs no change.
4. SPEC-0005 is amended by Amendment 17 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request.
5. The fixtures are the goldens of agk #228 (`busy`, `facts-ok` and `kinds` report.json), copied unchanged from head d8fafc6, the head the conductor named on issue #69 (byte-identical to 362bf06), into `site/tests/fixtures/report-schema-7/`.

## Consequences

- The page reads the first report written by agk #228, and a later schema is said, not shown as an empty week.

## Residual

None.
