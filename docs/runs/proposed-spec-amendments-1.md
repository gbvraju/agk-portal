# Proposed spec amendments 1 (SPEC-0001)

Date: 2026-10-21 (from `date -u`). Approved specs are changed only through a proposal like this one (principle 6). SPEC-0001 is `docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md`.

## Amendment 1 — rule 1, the list

**Reason.** ADR-0006: the customers use private repositories; people sign in with GitHub through a GitHub App and a small server reads the facts per request with the person's own token.

**Old text.** 1. **The list.** One config file lists the projects as `OWNER/REPO` of public repositories: first `gbvraju/agk`, then `gbvraju/cors` (Q-S0001-3). The build reads no repository that is not in it.

**New text.**

> 1. **The list.** The list of projects is per person and is derived on each request from GitHub: the repositories on which the GitHub App is installed and that the signed-in person can read, listed with the person's own user-to-server token (the installations and repositories the token can access). Public repositories work the same way for anyone signed in. No file names a customer repository, and a repository the person cannot read is never listed, named or counted (the ruling on Q-S0001-3 is superseded by ADR-0006).

**Tests.** Tests: rule 1 (REQ-101 AC6).

## Amendment 2 — rule 3, the token

**Reason.** ADR-0006: the customers use private repositories; people sign in with GitHub through a GitHub App and a small server reads the facts per request with the person's own token.

**Old text.** 3. **The workflow's own token only.** The build authenticates with the token the workflow is given, `GITHUB_TOKEN`, with the narrowest permissions that can read; it uses no secret, no personal access token, no App and no stored credential. Whether that token can list and download an artifact of another public repository is unconfirmed (verify): rule 9 proves it before anything depends on it.

**New text.**

> 3. **The person's own token only.** The server calls GitHub only with the signed-in person's user-to-server token of a GitHub App whose permissions are Actions read and Metadata read, nothing else. It makes no write call to GitHub and uses no personal access token and no other credential for GitHub. The App's credentials are secrets that the maintainers set in the host's secret store; an agent names them and never reads or writes a value. Whether such a token can list and download an artifact of a private repository is unconfirmed (verify): rule 9 proves it before anything depends on it.

**Tests.** Tests: rules 3 and 7 (REQ-101 AC7).

## Amendment 3 — rule 5, no artifact

**Reason.** ADR-0006: the customers use private repositories; people sign in with GitHub through a GitHub App and a small server reads the facts per request with the person's own token.

**Old text.** 5. **No artifact.** A project with no unexpired `agk-facts-<week>` artifact (none published yet, expired after the 90 days of agk SPEC-0019, or the repository has no workflow run) has the card "not known yet" with the reason that no artifact exists for its latest week. The site builds.

**New text.**

> 5. **No artifact.** A readable repository with no unexpired `agk-facts-<week>` artifact (none published yet, expired after the 90 days of agk SPEC-0019, or the repository has no workflow run) has the card "not known yet" with the reason that no artifact exists for its latest week. The page renders.

**Tests.** Tests: rule 5 (REQ-101 AC4).

## Amendment 4 — rule 6, a failure is local

**Reason.** ADR-0006: the customers use private repositories; people sign in with GitHub through a GitHub App and a small server reads the facts per request with the person's own token.

**Old text.** 6. **A failure is local.** A refused or failed listing or download (a status other than 200 and the redirect of the download) makes only that project's card "not known yet", with the HTTP status of the call as the reason. The other projects are still read. The build fails only when the build itself is broken, never because a project could not be read.

**New text.**

> 6. **A failure is local.** A refused or failed listing or download (a status other than 200 and the redirect of the download) makes only that repository's card "not known yet", with the HTTP status of the call as the reason. The other repositories are still read. The page does not fail because a repository could not be read. Sign-in, the session and its expiry are specified by their own requirement, not here.

**Tests.** Tests: rule 6 (REQ-101 AC5).

## Amendment 5 — rule 7, read-only

**Reason.** ADR-0006: the customers use private repositories; people sign in with GitHub through a GitHub App and a small server reads the facts per request with the person's own token.

**Old text.** 7. **Read-only.** The build writes nothing to GitHub, stores nothing outside its own output, holds no secret and uses no model. The workflow's permissions grant no write beyond what publishing the static site to GitHub Pages needs, and the data step has none.

**New text.**

> 7. **Read-only.** The server makes no write call to GitHub, stores nothing but the sign-in session, holds no Claude credential and uses no model. How the portal is deployed is outside this spec.

**Tests.** Tests: rules 3 and 7 (REQ-101 AC7).

## Amendment 6 — rule 9, the proof

**Reason.** ADR-0006: the customers use private repositories; people sign in with GitHub through a GitHub App and a small server reads the facts per request with the person's own token.

**Old text.** 9. **The proof.** Before any other item, a throwaway workflow in this repository lists and downloads one artifact of another public repository with the workflow's own token and no secret, first on a public repository with a recent artifact (for example `actions/upload-artifact`'s own CI, if it has one), then on `gbvraju/agk` once its `agk-facts-<week>` exists. It records each API call, the HTTP status of each, and what failed, in `docs/runs/`. If access is refused it stops and raises a question; the maintainers decide the fallback; no secret is added.

**New text.**

> 9. **The proof.** Before any other item, a throwaway proof signs in with the GitHub App (Actions read, Metadata read) and, with the resulting user-to-server token, lists and downloads one artifact of a private repository that has an `agk-facts-<week>` artifact, provided by the maintainers (verify), then of a public repository. It records each API call, its HTTP status (the redirect of the download and the final 200, the redirect host only and never the signed URL) and what failed, and the control calls without a token, in `docs/runs/`. Any secret involved is set by the maintainers in the host's secret store and is never read by an agent. If access is refused it stops and raises a question; the maintainers decide the fallback; no personal access token is added.

**Tests.** Tests: rule 9 (REQ-101 AC8).

## Amendment 7 — consequential wording (rules 2 and 4, Tests, Proof, Residual)

**Reason.** The six amendments above change who reads and when (a server, per request, for a signed-in person), so the words "the build", "project" and "the site builds" in the rules and sections that depend on them are brought into line. This amendment goes beyond the six rules the maintainers named; strike it and the spec reads inconsistently.

**Old text (rule 2).** 2. **The artifact.** For each project the build lists the repository's workflow artifacts with the GitHub REST API, keeps those named `agk-facts-<week>` that have not expired, takes the latest week (Q-S0001-2), and downloads it. The archive holds one file, `facts.json`, which is the facts document of agk SPEC-0009 byte for byte (agk SPEC-0019 rules 1 and 2, verify).

**New text (rule 2).**

> 2. **The artifact.** For each repository of rule 1 the server, on each request, lists the repository's workflow artifacts with the GitHub REST API, keeps those named `agk-facts-<week>` that have not expired, takes the latest week (Q-S0001-2), and downloads it. The archive holds one file, `facts.json`, which is the facts document of agk SPEC-0009 byte for byte (agk SPEC-0019 rules 1 and 2, verify).

**Old text (rule 4).** 4. **Schema 1 only.** The build reads `schema` first. A document whose `schema` is the integer `1` is accepted; any other value, a missing `schema`, or a file that is not JSON makes that project's card "not known yet" with the reason (Q-S0001-1 for the optional `kit_version` key). Nothing is filtered, renamed or completed; an `"unknown"` in the facts stays `"unknown"` and is shown as "not known yet" by a later milestone.

**New text (rule 4).**

> 4. **Schema 1 only.** The server reads `schema` first. A document whose `schema` is the integer `1` is accepted; any other value, a missing `schema`, or a file that is not JSON makes that repository's card "not known yet" with the reason (Q-S0001-1 for the optional `kit_version` key). Nothing is filtered, renamed or completed; an `"unknown"` in the facts stays `"unknown"` and is shown as "not known yet" by a later milestone.

**Tests, Proof, Residual.** The Tests and Proof sections are rewritten to the new rules and the REQ-101 AC1 to AC8 of the rewritten requirement; the first two Residual bullets are reworded (a readable repository such as `gbvraju/cors`; the proof needs a private repository with an artifact that the maintainers provide). A note under Q-S0001-3 records that it is superseded by ADR-0006.

**Status.** Applied to `docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md` on the maintainers' instruction, in the same PR as this file. Recorded in ADR-0006.
