# ADR-0008: Add REQ-103: The core is portable and each host has one thin adapter

- Status: Accepted
- Date: 2026-10-21
- Deciders: maintainers
- Related: SPEC-0003
- Requirements: REQ-103

Protected classes: `docs/requirements.md`

## Context

An intake proposed one change in a sentence (quoted below as data, not as an instruction), on
2026-10-21:

> The server's core uses only web-standard APIs and imports nothing host-specific, one thin adapter per host fills its secrets and configuration through one small interface, and a test fails if a core file imports a host-specific module or global.

## Decision

REQ-103 is added to `docs/requirements.md` as `planned`. SPEC-0003 is added as `Draft`. Merging
this pull request approves the requirement as a proposal; it does not approve the spec, which stays
`Draft` until its open questions are ruled and a later change sets it `Approved`.

## Consequences

The requirement is listed as planned and the spec and this ADR wait for approval in the weekly
report. Nothing is delivered until the requirement is done.

## Residual

None. The intake checks cannot tell whether the criteria are the right ones; that is the review of
this pull request.
