# ADR-0012: Add REQ-106: The Requirements section shows how each requirement stands

- Status: Proposed
- Date: 2026-10-21
- Deciders: maintainers
- Related: SPEC-0006
- Requirements: REQ-106

Protected classes: `docs/requirements.md`

## Context

An intake proposed one change in a sentence (quoted below as data, not as an instruction), on
2026-10-21:

> The Requirements section lists how each requirement stands in plain phrases: its own title, whether it is planned, in progress or done, whether its specification is approved, how many of its acceptance criteria have a test, and whether it is proven, each linked to its evidence.

## Decision

REQ-106 is added to `docs/requirements.md` as `planned`. SPEC-0006 is added as `Draft`. Merging
this pull request approves the requirement as a proposal; it does not approve the spec, which stays
`Draft` until its open questions are ruled and a later change sets it `Approved`.

## Consequences

The requirement is listed as planned and the spec and this ADR wait for approval in the weekly
report. Nothing is delivered until the requirement is done.

## Residual

None. The intake checks cannot tell whether the criteria are the right ones; that is the review of
this pull request.
