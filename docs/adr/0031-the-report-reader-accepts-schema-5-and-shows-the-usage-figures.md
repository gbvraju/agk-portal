# ADR-0031: The report reader accepts schema 5 and shows the usage figures

- Status: Accepted
- Date: 2026-10-25
- Deciders: maintainers
- Related: ADR-0019, ADR-0030
- Requirements: REQ-105

## Context

agk #198 (REQ-040 part c1) makes `report.json` schema 5: the kind `pull-request-cost` gains `usage` (a whole number of tokens, `not-reported` or `unknown`) and the kind `week-totals` gains `usage` (the same) and `usage_reported` (a whole number); no other field changes. The first weekly report written after #198 merges would not be read by this page ("the report has a schema this page does not read"). The brief of issue #60 asks for schema 5 to be added to the closed lists and the figures to be rendered as the other cost figures are.

## Decision

1. The reader accepts schema 5: schema 4's lists plus `usage` on both cost kinds (a whole number from 0, `not-reported` or `unknown`) and `usage_reported` (an integer from 0) on the totals; nothing else is accepted for 5, a schema 5 report lacking a field is refused, and schemas 1 to 4 refuse the three fields.
2. The page shows each per-change line with the sentence "Usage: {u} tokens." and the totals with two tiles after the estimate tile, "usage in total: {usage} tokens" and "{usage_reported} pull requests reported a usage figure", with the singular for one, `not reported` for `not-reported` and `unknown` for `unknown`, 0 shown as 0 and never a number for a missing figure. The page places the data's numbers and computes none. Schemas 1 to 4 show no usage.
3. A report whose `schema` is an integer that is not 1 to 5 still reads "the report has a schema this page does not read". The start page needs no change (it places a report of schema 3 or later by its counts).
4. SPEC-0005 is amended by Amendment 15 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request. The wording of the sentence and the tiles is Q-B20-1 on issue #60; the conductor accepted the words as written on issue #60.
5. The fixtures are the goldens of agk #198 at its cleared head, copied unchanged into `site/tests/fixtures/report-schema-5` (busy, facts-ok and kinds, at head a34c56f named on issue #60).

## Consequences

- The page reads the first report written by agk #198, and a later schema is said, not shown as an empty week.

## Residual

None.
