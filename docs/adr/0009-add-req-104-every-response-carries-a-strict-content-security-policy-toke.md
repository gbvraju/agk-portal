# ADR-0009: Add REQ-104: Responses are secure by default and the server never writes to GitHub

- Status: Proposed
- Date: 2026-10-21
- Deciders: maintainers
- Related: SPEC-0004
- Requirements: REQ-104

Protected classes: `docs/requirements.md`

## Context

An intake proposed one change in a sentence (quoted below as data, not as an instruction), on
2026-10-21:

> Every response carries a strict Content-Security-Policy, tokens are never logged or put in a URL, and tests fail if the GitHub App's declared permissions exceed Actions read and Metadata read or if the server makes any GitHub call that writes, except the one sign-in token exchange.

## Decision

REQ-104 is added to `docs/requirements.md` as `planned`. SPEC-0004 is added as `Draft`. Merging
this pull request approves the requirement as a proposal; it does not approve the spec, which stays
`Draft` until its open questions are ruled and a later change sets it `Approved`.

## Consequences

The requirement is listed as planned and the spec and this ADR wait for approval in the weekly
report. Nothing is delivered until the requirement is done.

## Residual

None. The intake checks cannot tell whether the criteria are the right ones; that is the review of
this pull request.
