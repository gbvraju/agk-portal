# ADR-0007: Add REQ-102: A person signs in with GitHub and keeps a stateless session

- Status: Proposed
- Date: 2026-10-21
- Deciders: maintainers
- Related: SPEC-0002
- Requirements: REQ-102

Protected classes: `docs/requirements.md`

## Context

An intake proposed one change in a sentence (quoted below as data, not as an instruction), on
2026-10-21:

> A person signs in with GitHub through the GitHub App, and the server keeps them signed in with an encrypted, signed cookie that expires within 8 hours, holds the user token and nothing else, and needs no database or host storage.

## Decision

REQ-102 is added to `docs/requirements.md` as `planned`. SPEC-0002 is added as `Draft`. Merging
this pull request approves the requirement as a proposal; it does not approve the spec, which stays
`Draft` until its open questions are ruled and a later change sets it `Approved`.

## Consequences

The requirement is listed as planned and the spec and this ADR wait for approval in the weekly
report. Nothing is delivered until the requirement is done.

## Residual

None. The intake checks cannot tell whether the criteria are the right ones; that is the review of
this pull request.
