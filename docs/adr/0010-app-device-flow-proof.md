# ADR-0010: The access proof is a throwaway workflow using the App's device flow

- Status: Accepted
- Date: 2026-10-21
- Deciders: maintainers
- Related: ADR-0006, ADR-0009
- Requirements: REQ-101

Protected classes: `.github/`

## Context

SPEC-0001 rule 9 (amended by ADR-0006) requires a proof, before anything depends on it, that a user-to-server token of the GitHub App, with only Actions read and Metadata read, can list and download an artifact of a private repository. The proof must need no secret and no agent may read a credential. The App's device flow needs only the public client id, so a maintainer can authorize a short-lived token by entering a code on github.com while the workflow holds the token in memory.

## Decision

1. A new workflow, `.github/workflows/app-device-flow-proof.yml`, is added. No kit workflow is edited. It runs only on `workflow_dispatch`, with the private target `OWNER/REPO` as an input, with empty `permissions`, no secret, no action and no use of the workflow's own token. The client id comes from the repository variable `APP_CLIENT_ID`, which the maintainers set.
2. It requests a device code from the App, prints only the user code and the verification address, masks the device code with `::add-mask::` at once and polls until the maintainer has authorized it. It masks the user token before any use and keeps it in memory only.
3. With the token it lists the target's artifacts and downloads the first unexpired one without following the redirect, prints each call as `METHOD path -> HTTP status` and the redirect host only, fetches the redirect target without the token, and prints the file name and size and nothing of its contents. A control call without a token prints its status.
4. A 401, 403 or 404 for the list or the download stops the run, adds no secret and no personal access token, and raises a question for the maintainers.
5. `site/tests/proof-workflow.test.ts` reads the workflow as text and fails if the trigger, the permissions, any credential, any method or address, the masking order or any printed line departs from this decision (markers `REQ-101 AC7` and `REQ-101 AC8`). It uses no network.
6. The workflow is throwaway: it is removed in the pull request that builds the real data step (ruling Q-B1-3).

## Consequences

- The proof runs only after this pull request is merged, because a `workflow_dispatch` workflow must exist on the default branch; the maintainers start it by hand and enter the user code themselves.
- The result is recorded in `docs/runs/app-access-proof.md` by the next item. No later item starts without a 200 on that record.
- Rulings recorded with this change: Q-B2-1, deployment is by Cloudflare's Git integration (Workers Builds) from `main` only, configured by the maintainers in the Cloudflare dashboard, with no deploy token in GitHub and secrets set in Cloudflare (ADR of Item 9 records it; the deploy step stays outside the core); Q-B2-2, the page sections of milestone M2 enter by one-sentence intakes right after the access record, This week first, then Requirements, then Trend, approved before the data step lands; Q-B2-3, the workflow merges first.

## Residual

- 2026-10-21: the device-flow addresses, parameters, error names and the shape of the token answer are from memory of GitHub's documentation, which was not read here (verify); the run confirms them (due 2026-11-30).
- 2026-10-21: that `jq` is preinstalled on the runner image, and that GitHub's masking hides the signed address while the redirect host alone is still printed, are unconfirmed (verify) (due 2026-11-30).
- 2026-10-21: that a user-to-server token with Actions read and Metadata read can list and download a private repository's artifact is unconfirmed (verify); this proof settles it (due 2026-11-30).
