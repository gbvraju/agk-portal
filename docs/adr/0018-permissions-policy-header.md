# ADR-0018: Every response carries a Permissions-Policy that denies every browser feature

- Status: Proposed
- Date: 2026-10-22
- Deciders: maintainers
- Related: ADR-0006, ADR-0016
- Requirements: REQ-104

## Context

SPEC-0004 rule 1 lists the headers that every response carries. The header scan of the staging address (securityheaders.com, 2026-10-22) graded it A and found the Permissions-Policy header missing. The page uses no browser feature, so none needs to be allowed.

## Decision

1. Every response carries `Permissions-Policy` with each feature of the current list set to an empty allowlist, `feature=()`. The list is the W3C Permissions Policy features list (standardized, proposed and experimental) as read on 2026-10-22: 68 names, from `accelerometer` to `xr-spatial-tracking`, held in one constant in `site/src/core/responses.ts` that the one function building every response uses. The client-hint family `ch-ua*` (hints the page never asks for) and `interest-cohort` (removed from browsers, not on the list) are not in it.
2. SPEC-0004 rule 1 and its tests line are amended by `docs/runs/proposed-spec-amendments-3.md` (Amendment 5), applied by this ADR in the same pull request. Requirement text does not change: REQ-104 AC1 names the headers it requires and a further header does not contradict it.
3. `Referrer-Policy` stays `no-referrer`; nothing else about the headers changes.

## Consequences

- A browser that does not know a name ignores it (Chrome's developer tools may note an unrecognised name); a name that a browser knows is denied to the page and to any frame, which the page does not use.
- The list changes when the specification changes; a later change is a new amendment with the date it was read.
- The runbook's header check lists the new header (`docs/runs/deploy-cloudflare.md`).

## Residual

- 2026-10-22: the list was read from the W3C features list at one date; browsers differ in the names they know, and developer tools may warn about unknown names (verify at staging); the staging scan after the merge confirms the header is seen (due 2026-12-31).
- 2026-10-22: the names of the `ch-ua*` family and `interest-cohort` were left out by the builder's reading; the maintainers may ask for them (due 2026-12-31).
