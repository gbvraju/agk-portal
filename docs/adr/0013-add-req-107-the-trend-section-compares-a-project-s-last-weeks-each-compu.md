# ADR-0013: Add REQ-107: The Trend section shows how each measure moves week by week

- Status: Proposed
- Date: 2026-10-21
- Deciders: maintainers
- Related: SPEC-0007
- Requirements: REQ-107

Protected classes: `docs/requirements.md`

## Context

An intake proposed one change in a sentence (quoted below as data, not as an instruction), on
2026-10-21:

> The Trend section compares a project's last weeks, each computed from that week's facts artifact by the weekly report's own rules, showing each measure per week with a fixed phrase for whether it rose, fell or stayed the same, a week without facts shown as not known yet, each linked to its evidence.

## Decision

REQ-107 is added to `docs/requirements.md` as `planned`. SPEC-0007 is added as `Draft`. Merging
this pull request approves the requirement as a proposal; it does not approve the spec, which stays
`Draft` until its open questions are ruled and a later change sets it `Approved`.

## Consequences

The requirement is listed as planned and the spec and this ADR wait for approval in the weekly
report. Nothing is delivered until the requirement is done.

## Residual

None. The intake checks cannot tell whether the criteria are the right ones; that is the review of
this pull request.
