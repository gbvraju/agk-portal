# ADR-0002: Project charter of the AGK portal

- Status: Proposed
- Date: 2026-10-21
- Deciders: maintainers
- Related: ADR-0001
- Requirements: REQ-001

Protected classes: constitution/

## Context

A consulting firm's engagement lead and its client cannot read pull requests, verdicts or a markdown report issue. They need a page per
project in plain business words. Each project's weekly report already publishes an AGK facts document as a workflow artifact named
`agk-facts-<week>`. This slice is read-only, covers public repositories only, and starts with `gbvraju/agk` and `gbvraju/cors` listed
in one config file. It is TypeScript, a static site built by a GitHub Actions workflow and published to GitHub Pages. The ruleset for
the default branch is the one ADR-0001 records; this charter neither restates nor changes it.

One fact is unconfirmed (verify): that a workflow's own token can list and download an artifact of another public repository.
The first brief item proves it with a throwaway workflow before anything depends on it; no secret is added in any case.

## Decision

1. **Milestones**
   - M1: the build reads the facts artifact of each listed project, and a project with no artifact for its latest week, or any other failure, shows "not known yet" with a named reason on its card while one project's failure never fails the whole site; exit: for each of the 2 projects either its facts are read or its card shows "not known yet" with a named reason, and 0 failures of the site build.
   - M2: the four sections This week, Requirements, Trend and All projects render from the facts, each line linking to its evidence on GitHub; exit: zero sentences that are not a requirement's own sentence or a fixed phrase over a facts number, and every unknown in the facts shown as "not known yet".
   - M3: the site is published to GitHub Pages and works on a phone; exit: the page is live and has no horizontal scroll at 360 px width.
2. **Non-goals**
   - Writes of any kind, any model or generated prose, any server, holding any secret.
   - Not in this slice (later slices of ADR-0025 decision 5 in the agk repository): sign-in, private repositories, the GitHub App, action buttons, creating projects, SSO, theming.
3. **Done means**
   - Every milestone exit holds on the deployed site, and every requirement of this slice is `done` with its tests.
   - The throwaway proof of cross-repository artifact access is recorded with its exact API calls and the HTTP status of each: first on a public repository with a recent artifact, then on `gbvraju/agk` once its `agk-facts-<week>` exists.

## Consequences

- `constitution/vision.md` states what the portal is for and its project rules; they bind every later spec and brief.
- If the proof fails, work stops and the maintainers decide the fallback; no secret is added.
- Artifacts expire, so a project may have no artifact for its latest week; the site shows that as "not known yet" and does not fail.

## Residual

- 2026-10-21: workflow-token access to another public repository's artifacts is unconfirmed (verify); the throwaway proof settles it.
- 2026-10-21: `gbvraju/agk` does not publish `agk-facts-<week>` until its own build lands; the second proof waits for it.
- 2026-10-21: ADR-0001 is still Proposed; the maintainers accept it in a pull request of its own.
