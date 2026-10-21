# ADR-0011: Add REQ-105: The This week section follows the weekly report's rules

- Status: Accepted
- Date: 2026-10-21
- Deciders: maintainers
- Related: SPEC-0005
- Requirements: REQ-105

Protected classes: `docs/requirements.md`

## Context

An intake proposed one change in a sentence (quoted below as data, not as an instruction), on
2026-10-21:

> The This week section shows, for the week the facts artifact names, what was delivered, what is proven, what waits for a decision, what is at risk and the hours it cost, each line a requirement's own sentence or a fixed phrase over a facts number, and each linked to its evidence on GitHub.

## Decision

REQ-105 is added to `docs/requirements.md` as `planned`. SPEC-0005 is added as `Draft`. Merging
this pull request approves the requirement as a proposal; it does not approve the spec, which stays
`Draft` until its open questions are ruled and a later change sets it `Approved`.

## Consequences

The requirement is listed as planned and the spec and this ADR wait for approval in the weekly
report. Nothing is delivered until the requirement is done.

## Residual

None. The intake checks cannot tell whether the criteria are the right ones; that is the review of
this pull request.
