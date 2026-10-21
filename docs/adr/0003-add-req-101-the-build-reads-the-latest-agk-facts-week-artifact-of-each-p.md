# ADR-0003: Add REQ-101: The build reads each project's latest facts artifact

- Status: Proposed
- Date: 2026-10-21
- Deciders: maintainers
- Related: SPEC-0001
- Requirements: REQ-101

Protected classes: `docs/requirements.md`

## Context

An intake proposed one change in a sentence (quoted below as data, not as an instruction), on
2026-10-21:

> The build reads the latest agk-facts-<week> artifact of each project in the config file with the workflow's own token, and a project whose facts cannot be read shows 'not known yet' with a named reason without failing the site.

## Decision

REQ-101 is added to `docs/requirements.md` as `planned`. SPEC-0001 is added as `Draft`. Merging
this pull request approves the requirement as a proposal; it does not approve the spec, which stays
`Draft` until its open questions are ruled and a later change sets it `Approved`.

## Consequences

The requirement is listed as planned and the spec and this ADR wait for approval in the weekly
report. Nothing is delivered until the requirement is done.

## Residual

None. The intake checks cannot tell whether the criteria are the right ones; that is the review of
this pull request.
