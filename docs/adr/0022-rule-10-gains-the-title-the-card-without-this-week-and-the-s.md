# ADR-0022: SPEC-0005 rule 10 gains the page title, the card without This week and the status words

- Status: Accepted
- Date: 2026-10-23
- Deciders: maintainers
- Related: ADR-0019, ADR-0021
- Requirements: REQ-108

## Context

SPEC-0008 (Approved by ADR-0021) gives the portal page a themed, accessible, responsive look and three wording changes. SPEC-0005 (Approved) fixes the sentences the page shows in rule 10, "and no other sentence". The maintainers ruled on the intake pull request of REQ-108 that the wording changes are made by `docs/runs/proposed-spec-amendments-5.md`, applied by an ADR in the build pull request.

## Decision

1. SPEC-0005 rule 10 gains three rows, exactly as Amendment 7 of `docs/runs/proposed-spec-amendments-5.md` words them: the page title "Your projects"; the card without This week, "Week {label}: not known yet: {reason}.", with the line "Facts read for {week}." no longer shown; and the five status words of a badge.
2. This ADR applies the amendment in the same pull request that builds REQ-108: the table of rule 10 in `docs/specs/0005-the-this-week-section-shows-for-the-week-the-facts-artifact.md` is changed by those three rows and nothing else.
3. No requirement text, no security rule and no other phrase of rule 10 changes. The grouped At risk fold is not part of this decision (the report carries no count for a grouped item; SPEC-0008 Residual).

4. The maintainers ruled Q-B18-1 on the build pull request (verdict "fix list 8bb40c8"): the builder's reading stands, so a Delivered line is Done, a requirement proven is Proven, every Needs your decision line is Needs you, every At risk line is At risk and every unknown item is Not known yet, while a requirement not proven, the planned-not-counted line and the Time and review tiles carry no badge.
5. The maintainers ruled Q-B18-2 on the same pull request: the 44 px targets of links by padding and a negative margin are accepted, and the screenshots are the rendered check.

## Consequences

- The tests of SPEC-0005 that compared the card's facts line now compare the new card wording.
- A later change of these words needs a new amendment.

## Residual

- 2026-10-23: the status words are not yet in the weekly report's own wording; they are the portal's (due 2026-12-31).
