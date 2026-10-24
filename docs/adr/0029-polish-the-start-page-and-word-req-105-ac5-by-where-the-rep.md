# ADR-0029: Polish the start page and word REQ-105 AC5 by where the report states a count

- Status: Proposed
- Date: 2026-10-24
- Deciders: maintainers
- Related: ADR-0026, ADR-0028
- Requirements: REQ-105, REQ-109

Protected classes: `docs/requirements.md`

## Context

Issue #56 asks for a polish of the start page after SPEC-0009 was built (#55), and for REQ-105 AC5's wording to match what the kit can give. AC5 says an unknown value reads "not known yet with the count of items lacking it"; the kit, by design, gives no count for a decisions group whose source cannot be read or for an unknown housekeeping total (agk SPEC-0026 rule 4), so the clause cannot be met in full. SPEC-0009 (Approved) fixes the form of the find input and the figures of a line.

## Decision

1. REQ-105 AC5 now says "then it says not known yet with the count of items lacking it where the report states one and never shows zero"; the rest of the criterion is unchanged. `docs/requirements.md` is a protected path, and this ADR names it. The residual line that tracked the clause is closed.
2. SPEC-0009 is amended by Amendment 12 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request: the three counts of a line are pills in the status colours of SPEC-0008 (merged and hours stay plain text), and the find input has a visible label "Find a project" tied to it (its one accessible name) and a button "Find".
3. The name in the link of a line is escaped in its href, as everywhere else (no spec change: SPEC-0009 rule 8 already says the project name is escaped).
4. REQ-105 is marked `done` in a separate commit of the same pull request, as the issue says, because every criterion has its marker (checked by a test).

## Consequences

- The count of items lacking a value is shown wherever the report states one (the hours total, the review rounds, the sections' counts the start page uses).
- The other unknown values read "not known yet" without a count.

## Residual

None.
