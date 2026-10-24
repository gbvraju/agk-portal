# ADR-0026: The report reader accepts schema 3, with the new tile and the At risk fold

- Status: Proposed
- Date: 2026-10-24
- Deciders: maintainers
- Related: ADR-0019, ADR-0024, ADR-0022
- Requirements: REQ-105, REQ-108

## Context

agk v0.50.0 (agk SPEC-0026) makes `report.json` schema 3: `counts` on the report, `count` on the four grouped At risk kinds, `fix_verdicts_unknown` on the totals, and one `unknown` item for open pull requests whose verdicts could not be read. The report of Monday 2026-10-26 is schema 3; the page reads schemas 1 and 2, so its card would read "not known yet". SPEC-0005 (Approved) fixes the schemas it reads in its intro, rule 13, a Tests line and a Residual bullet, and the fixed phrases in rule 10; SPEC-0008 (Approved) left the At risk fold out until the data carried a count (its Residual).

## Decision

1. The report reader accepts schema 3 with its own closed field list: schema 2 plus `counts` (`delivered`, `proven`, `needs_you`, `at_risk`, each an integer from 0 or "unknown"), `count` (an integer from 0) on `pull-requests-open-long`, `-sent-back`, `-merged-no-verdict` and `-merged-not-cleared`, and `fix_verdicts_unknown` (an integer from 0) on `week-totals`. Schemas 1 and 2 are read exactly as before, and each schema refuses the fields of a later one.
2. For schema 3, Time and review gains a tile after the review-rounds tile, "{fix_verdicts_unknown} changes without known review rounds" ("1 change without known review rounds"), 0 included. This meets the review-rounds part of REQ-105 AC5's count clause.
3. A grouped At risk line whose `count` is above 5 reads "{n} changes have been open.", "{n} changes were sent back.", "{n} changes were merged without a review." or "{n} changes were merged before their final review." with the data's count and its changes in a details element; a count of 5 or fewer, and every line of schemas 1 and 2, stay as before. The page counts nothing.
4. The unknown items for open pull requests whose verdicts could not be read use the existing unknown line with their links; no new phrase.
5. SPEC-0005 is amended by Amendment 10 and SPEC-0008 by Amendment 11 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request. The page does not show the four `counts` of the sections.

## Consequences

- REQ-105 AC5's count clause is met for the hours total and the review rounds; the unreadable decisions groups and the housekeeping total carry no count by the kit's design (agk SPEC-0026 rule 4), recorded in the residuals register.
- A later schema number needs a new amendment.

## Residual

None.
