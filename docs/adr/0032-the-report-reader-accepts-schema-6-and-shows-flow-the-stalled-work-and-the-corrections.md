# ADR-0032: The report reader accepts schema 6 and shows Flow, the stalled work and the corrections

- Status: Proposed
- Date: 2026-10-25
- Deciders: maintainers
- Related: ADR-0019, ADR-0030, ADR-0031
- Requirements: REQ-105

## Context

agk #208 (REQ-041 build d with REQ-040 c2 and REQ-039 e2) makes `report.json` schema 6: `sections` gains a sixth key `flow` (required, after `cost`) whose items are `flow-figures` or `unknown`; `at_risk` gains the kinds `pull-requests-stalled`, `briefs-idle` and `requirements-without-brief`; `week-totals` gains `corrections` (an integer or `unknown`). The first weekly report written after #208 merges would not be read by this page. The brief of issue #62 asks for schema 6 to be added to the closed lists, Flow to be shown after Time and review in agk's words, and the new At risk kinds and the corrections to be shown the same way; agk #208 merges only after this reader is merged and deployed.

## Decision

1. The reader accepts schema 6: schema 5's lists plus the key `flow` (required; `flow-figures` with exactly `open_builders`, `max_builders`, `taken_to_pull_request`, `to_first_verdict`, `verdict_to_cleared`, `cleared_to_merge`, `conflicts`, `renumbers` and `retakes`, or `unknown`), the three At risk kinds and `corrections`; nothing else is accepted for 6, a schema 6 report lacking `flow` or `corrections` is refused, and schemas 1 to 5 refuse the key, the kinds and the field.
2. The page shows Flow as a part after Time and review, one line in agk's words with `none` and `unknown` as written; the three At risk kinds as grouped lines of the existing form without any title (a brief's number links to its issue, a requirement is named by its identifier, the fold over 5 uses the data's `count`); and `corrections` as a tile after the review-rounds tiles ("{n} corrections", "corrections: unknown", 0 shown). The page places the data's numbers and computes none. Schemas 1 to 5 show none of them.
3. A report whose `schema` is an integer that is not 1 to 6 still reads "the report has a schema this page does not read". The start page needs no change (it places a report of schema 3 or later by its counts).
4. SPEC-0005 is amended by Amendment 16 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request. The wording that agk's markdown does not fix for this page (the At risk lines without titles, the corrections tile) is Q-B21-1 on issue #62, answered "accepted as written".
5. The fixtures are the goldens of agk #208 (`busy`, `facts-ok` and `kinds` report.json), copied unchanged at head 151e057, which the conductor named on issue #62 before the clearance of #208; they are refreshed from the cleared head in one commit before this pull request is cleared.

## Consequences

- The page reads the first report written by agk #208, and a later schema is said, not shown as an empty week.

## Residual

None.
