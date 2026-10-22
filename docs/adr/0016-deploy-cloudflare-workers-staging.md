# ADR-0016: The portal is published to a staging Worker by Cloudflare's Git integration

- Status: Proposed
- Date: 2026-10-22
- Deciders: maintainers
- Related: ADR-0006, ADR-0010, ADR-0015
- Requirements: REQ-101

## Context

ADR-0006 chose Cloudflare Workers as the first host, with a portable core and one thin adapter (built, REQ-103). The ruling on Q-B2-1 (recorded in ADR-0010) chose the host's own Git integration (Workers Builds) from `main`, set up by the maintainers in the Cloudflare dashboard, with no deploy token in GitHub and the secrets set in Cloudflare. The second brief put the first live deployment (Item 9) after the page sections. The maintainers moved it forward on 2026-10-22: the page sections (REQ-105 to REQ-107) will render data that agk publishes with the facts, which is not yet available, and the unconfirmed facts about GitHub's and Cloudflare's behaviour (`(verify)` in the specs, ADRs and residuals) are better settled early, on a staging deployment, than after the sections are built on them. The brief named this ADR 0013; that number was taken by the REQ-107 intake, so the next free number is used.

## Decision

1. The Worker is named `agk-portal-staging` and is published on its `workers.dev` address. It is a staging deployment: anyone with a GitHub account may sign in (ruling on Q-B5-1, 2026-10-22), and sees only the repositories where the App is installed and that they can read; the page is behind sign-in, shows the cards as they are (a repository's name and "Facts read for {week}." or "Not known yet" with its reason), and has no section yet.
2. It is published by Cloudflare Workers Builds from the `main` branch only, root directory `site`, no build command, the default deploy command `npx wrangler deploy`, configured by the maintainers in the dashboard. Builds for other branches are off.
3. `site/wrangler.toml` holds the name, the entry file (the Cloudflare adapter), a compatibility date, `workers_dev` and `keep_vars`, and nothing else: no secret, no setting name, no binding, no route, no account.
4. The two secrets (`GITHUB_APP_CLIENT_SECRET`, `SESSION_KEY`) and the two variables (`GITHUB_APP_CLIENT_ID`, `CALLBACK_URL`) are set by the maintainers in Cloudflare. No agent reads or writes a value. No workflow of this repository deploys, and no Cloudflare token is stored in GitHub.
5. `docs/runs/deploy-cloudflare.md` lists, by name only, what the maintainers do in Cloudflare and in GitHub, the checks they run on the response headers and on a sign-in, the facts the deployment settles, what to send back and how to undo it. The result is recorded by a docs-only pull request written from their words.
6. A later production deployment is a separate decision (name, address, App); this ADR does not make the staging Worker the product.

## Consequences

- A merge to `main` publishes the Worker; there is no review step between a merge and the live staging page except the review of the pull request.
- The first sign-in on the staging address confirms or corrects the `(verify)` facts; each correction is a pull request with a test.
- The throwaway workflow is already gone (ADR-0015), so no repository variable is needed; `APP_CLIENT_ID` may be deleted in the repository settings.

## Residual

- 2026-10-22: Workers Builds' settings, the `wrangler.toml` keys `workers_dev` and `keep_vars` and the compatibility date are from memory of Cloudflare's documentation (verify); the first build settles them (due 2026-12-31).
- 2026-10-22: anyone with a GitHub account may sign in to staging and sees only what GitHub lets them read in the repositories where the App is installed; the App is installed only where the maintainers choose (due 2026-12-31).
- 2026-10-22: a repository that the tester cannot read, which must never be listed, named or counted (REQ-101 AC6), is not testable with one account on staging; the test of it stays the recorded-answer test in `site/tests/projects.test.ts` (due 2026-12-31).
