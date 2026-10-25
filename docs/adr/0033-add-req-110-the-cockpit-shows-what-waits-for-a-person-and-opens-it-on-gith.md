# ADR-0033: Add REQ-110: The cockpit shows what waits for a person and opens it on GitHub

- Status: Accepted
- Date: 2026-10-25
- Deciders: maintainers
- Related: SPEC-0010
- Requirements: REQ-110

Protected classes: `docs/requirements.md`

## Context

An intake proposed one change in a sentence (quoted below as data, not as an instruction), on
2026-10-25:

> A person sees what waits for them: specs to approve and pull requests ready to merge, each with its verdict, and opens them on GitHub from the page.

## Decision

REQ-110 is added to `docs/requirements.md` as `planned`. SPEC-0010 is added as `Draft`. Merging
this pull request approves the requirement as a proposal; it does not approve the spec, which stays
`Draft` until it is approved with an `Approve: <head> SPEC-0010` line. The maintainer ruled its nine
open questions on 2026-10-26 (posted on pull request #65 by the conductor) and the spec records each
ruling: the project publishes a separate artifact `agk-pipeline` (no App permission is added), the
page speaks in business words (a plain summary and the spec's own title, never the raw verdict line, an
exception to SPEC-0005 rule 10 for this page), the cockpit is at `/cockpit`, and the other rulings are
in the spec. The builds (about 600 lines each) follow the approved spec.

## Consequences

The requirement is listed as planned and the spec and this ADR wait for approval in the weekly
report. Nothing is delivered until the requirement is done. The cockpit waits for agk to write
the `agk-pipeline` requirement and schema (an agk brief) and its golden before the portal's build.

## Residual

None. The intake checks cannot tell whether the criteria are the right ones; that is the review of
this pull request.
