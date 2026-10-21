# ADR-0015: The throwaway access-proof workflow is removed

- Status: Accepted
- Date: 2026-10-21
- Deciders: maintainers
- Related: ADR-0006, ADR-0010
- Requirements: REQ-101

Protected classes: `.github/`

## Context

ADR-0010 added `.github/workflows/app-device-flow-proof.yml` as a throwaway and ruled (Q-B1-3) that it is removed in the pull request that builds the real data step. Its run 5 (id 39591232745) proved that a user-to-server token of the GitHub App with Actions read and Metadata read lists and downloads an artifact of a private repository, and the result is kept in `docs/runs/app-access-proof.md` (Item 2). Item 7b builds the data step: the artifact choice, the download through the redirect, the archive and the schema check.

The brief named this record `docs/adr/0012-remove-device-flow-proof.md`; the number 0012 was taken by the REQ-106 intake, so the next free number is used.

## Decision

1. `.github/workflows/app-device-flow-proof.yml` is deleted. No other file under `.github/` changes.
2. `site/tests/proof-workflow.test.ts`, which read that workflow as text, is deleted with it. Its marker `REQ-101 AC7` is carried by the tests of the data step in `site/tests/facts.test.ts`, and its marker `REQ-101 AC8` by `site/tests/access-record.test.ts`, which keeps the record honest: each call with its status, the refusal that stopped run 2, the control call, and no token, device code or signed address.
3. The record `docs/runs/app-access-proof.md` and ADR-0010 stay as written. The repository variable `APP_CLIENT_ID` that the workflow read is no longer used by anything; the maintainers may delete it in the repository settings.

## Consequences

- The repository no longer holds a workflow that can print a device code or use a user token. The only workflows are the kit's.
- The proof cannot be re-run from this repository; the record is the evidence. A later check of the access is the first live sign-in (Item 9).

## Residual

- 2026-10-21: the repository variable `APP_CLIENT_ID` is left in the settings for the maintainers to delete (due 2026-11-30).
