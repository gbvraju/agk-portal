# ADR-0024: The report reader accepts schema 2 and shows the count of changes without known hours

- Status: Accepted
- Date: 2026-10-23
- Deciders: maintainers
- Related: ADR-0019, ADR-0023
- Requirements: REQ-105

## Context

agk v0.43.0 (agk SPEC-0024) makes `report.json` schema 2: the item of kind `week-totals` gains `hours_unknown`, an integer always present. The report of Monday 2026-10-26 is schema 2; the artifacts before it are schema 1. SPEC-0005 (Approved) fixes schema 1 in its intro, rule 13, a Tests line and a Residual bullet, and its rule 10 has no tile for the count. SPEC-0001 rule 4 is about `facts.json`, whose number stays 1.

## Decision

1. The report reader accepts schema 1 and schema 2, each with its own closed field list: schema 1 exactly as before; schema 2 the same plus `hours_unknown` (an integer from 0, required) on `week-totals`. Any other schema number, schema 2 without the field, or schema 1 with it makes This week absent, with the card's existing reason.
2. For schema 2 Time and review gains a sixth tile after the hours tile, "{hours_unknown} changes without known hours" ("1 change without known hours"), shown for every schema 2 report, 0 included. For schema 1 there is no sixth tile. The page places the field and computes nothing.
3. SPEC-0005 is amended by Amendment 9 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request: the intro, rule 13, the totals row of rule 10, a Tests line and the Residual bullet. SPEC-0001 is not changed.
4. The tests use the kit's own v0.43.0 goldens (busy, facts-ok, kinds) as schema 2 fixtures and this repository's script (kit 0.40.0) for schema 1.

## Consequences

- REQ-105 AC5's count of items lacking a value is met for the hours total; the other unknown values (review rounds, group counts, the housekeeping total) carry no count in `report.json`, so the clause stays partly open (decisions log).
- A later schema number needs a new amendment.

## Residual

None.
