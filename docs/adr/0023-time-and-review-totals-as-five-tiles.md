# ADR-0023: The totals of Time and review are shown as five tiles

- Status: Proposed
- Date: 2026-10-23
- Deciders: maintainers
- Related: ADR-0019, ADR-0022
- Requirements: REQ-105

## Context

The approved mockup shows one tile per number of the week's totals. SPEC-0005 rule 10 fixed one sentence for the totals line ("This week: {n} changes merged; ..."), and the page showed it as one tile (residual of 2026-10-23). The totals item of `report.json` holds the five numbers as separate fields.

## Decision

1. The totals row of SPEC-0005 rule 10 is replaced by the five tile phrases of Amendment 8 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request: "{merged} changes merged"; "{hours} hours from opening to merge, in total"; "{fix_verdicts} review rounds in total"; "{behaviour_unchanged} declared as not changing behaviour"; "estimate: {estimate}", with the link "(the week)" once after the tiles.
2. Each tile places one field of the totals item; the page computes nothing. An unknown value reads "not known yet" in its tile.
3. The per-change cost lines are unchanged. The schema stays 1; a field for hours not known is a separate pull request after the kit's v0.43.0.

## Consequences

- The tests of Time and review compare the five tiles instead of the sentence.
- A later change of these words needs a new amendment.

## Residual

None.
