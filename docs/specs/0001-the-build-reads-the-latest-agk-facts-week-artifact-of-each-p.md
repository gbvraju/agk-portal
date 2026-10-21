# SPEC-0001: The build reads each project's latest facts artifact

- Status: Approved
- Owner: maintainers
- Requirements: REQ-101

Status is `Draft` or `Approved`. An Approved spec is owned by its reviewer group; agents propose patches.
Written by the intake of one sentence, as data: "The build reads the latest agk-facts-<week> artifact of each project in the config file with the workflow's own token, and a project whose facts cannot be read shows 'not known yet' with a named reason without failing the site." It is milestone M1 of ADR-0002. The maintainers answered three questions on 2026-10-21: the requirement id is REQ-101 (the kit reserves REQ-001 to REQ-099; the intake script does not know that, a kit defect reported to agk), the tests are TypeScript `*.test.ts` files run by an npm command set in `agk.toml` without editing a kit workflow, and the format is taken from agk SPEC-0009, SPEC-0019 and `kit/facts-schema.json` (read on 2026-10-21 at agk commit b7707ac), never guessed. SPEC-0019 is Draft in the agk repository (verify before the build).

## Rules

1. **The list.** The list of projects is per person and is derived on each request from GitHub: the repositories on which the GitHub App is installed and that the signed-in person can read, listed with the person's own user-to-server token (the installations and repositories the token can access). Public repositories work the same way for anyone signed in. No file names a customer repository, and a repository the person cannot read is never listed, named or counted (the ruling on Q-S0001-3 is superseded by ADR-0006).
2. **The artifact.** For each repository of rule 1 the server, on each request, lists the repository's workflow artifacts with the GitHub REST API, keeps those named `agk-facts-<week>` that have not expired, takes the latest week (Q-S0001-2), and downloads it. The archive holds one file, `facts.json`, which is the facts document of agk SPEC-0009 byte for byte (agk SPEC-0019 rules 1 and 2, verify).
3. **The person's own token only.** The server calls GitHub only with the signed-in person's user-to-server token of a GitHub App whose permissions are Actions read and Metadata read, nothing else. It makes no write call to GitHub and uses no personal access token and no other credential for GitHub. The App's credentials are secrets that the maintainers set in the host's secret store; an agent names them and never reads or writes a value. Whether such a token can list and download an artifact of a private repository is unconfirmed (verify): rule 9 proves it before anything depends on it.
4. **Schema 1 only.** The server reads `schema` first. A document whose `schema` is the integer `1` is accepted; any other value, a missing `schema`, or a file that is not JSON makes that repository's card "not known yet" with the reason (Q-S0001-1 for the optional `kit_version` key). Nothing is filtered, renamed or completed; an `"unknown"` in the facts stays `"unknown"` and is shown as "not known yet" by a later milestone.
5. **No artifact.** A readable repository with no unexpired `agk-facts-<week>` artifact (none published yet, expired after the 90 days of agk SPEC-0019, or the repository has no workflow run) has the card "not known yet" with the reason that no artifact exists for its latest week. The page renders.
6. **A failure is local.** A refused or failed listing or download (a status other than 200 and the redirect of the download) makes only that repository's card "not known yet", with the HTTP status of the call as the reason. The other repositories are still read. The page does not fail because a repository could not be read. Sign-in, the session and its expiry are specified by their own requirement, not here.
7. **Read-only.** The server makes no write call to GitHub, stores nothing but the sign-in session, holds no Claude credential and uses no model. How the portal is deployed is outside this spec.
8. **Tests.** The tests are TypeScript files named `*.test.ts` under `tests/`, run by the npm command in `agk.toml` `project_tests`, each carrying the marker `REQ-101 ACn` it proves. They use recorded API responses and no network.
9. **The proof.** Before any other item, a throwaway proof signs in with the GitHub App (Actions read, Metadata read) and, with the resulting user-to-server token, lists and downloads one artifact of a private repository that has an `agk-facts-<week>` artifact, provided by the maintainers (verify), then of a public repository. It records each API call, its HTTP status (the redirect of the download and the final 200, the redirect host only and never the signed URL) and what failed, and the control calls without a token, in `docs/runs/`. Any secret involved is set by the maintainers in the host's secret store and is never read by an agent. If access is refused it stops and raises a question; the maintainers decide the fallback; no personal access token is added.

## Tests

- Rule 2: listing keeps only unexpired `agk-facts-<week>` and downloads the latest week with the person's token; REQ-101 AC1.
- Rule 4: schema 1 reaches the page unchanged; REQ-101 AC2.
- Rule 4: schema 2, a missing schema and invalid JSON each give 'not known yet' with that reason and the page still renders; REQ-101 AC3.
- Rule 5: no artifact, and only expired artifacts, give 'not known yet' with the no-artifact reason and the page renders; REQ-101 AC4.
- Rule 6: a 403, a 404 and a 500 on one repository give that card the status as the reason while the other repository is read and the page does not fail; REQ-101 AC5.
- Rule 1: the list is derived from the installations and repositories the token can access, no file names a repository, and a repository the person cannot read is never listed, named or counted; REQ-101 AC6.
- Rules 3 and 7: the server code makes only GET calls to GitHub, uses only the person's token, no personal access token, no write call, no Claude credential and no model; REQ-101 AC7.
- Rule 9: the access proof record names each call, its status and the control calls; REQ-101 AC8.

## Proof

REQ-101 AC1 and AC2: *a person's projects' facts reach the page as published.* Rules 1, 2 and 4. REQ-101 AC3 to AC5: *what cannot be read is said, never hidden, and never stops the page.* Rules 4 to 6. REQ-101 AC6: *a person sees only what GitHub lets them read.* Rule 1. REQ-101 AC7: *no write and no other credential.* Rules 3 and 7. REQ-101 AC8: *the access is proven, or the work stops.* Rule 9. The maintainers read the record in `docs/runs/` before the item that depends on it.

## Residual

- 2026-10-21: agk SPEC-0019 is Approved and being built; a project has the artifact only after it upgrades to that kit version, so a readable repository such as `gbvraju/cors` shows 'not known yet' until then (due 2026-11-30).
- 2026-10-21: the proof needs a private repository with an `agk-facts-<week>` artifact, which the maintainers provide (due 2026-11-30).
- 2026-10-21: the kit's REQ-004 defect was fixed in agk 0.32.0 (ADR-0004); intake.py check passed on REQ-101 (closed).

## Open questions

- Q-S0001-1 The schema file allows an optional `kit_version` key that the key list of agk SPEC-0009 rule 3 does not name. The criteria assume the build accepts schema 1 documents with or without it and ignores keys it does not use.
  Ruled 2026-10-21 by the maintainers: as read. Schema 1 documents are accepted with or without `kit_version`; keys the build does not use are ignored.
- Q-S0001-2 "The latest" artifact is not defined for the site. The criteria assume the highest `<week>` label among unexpired `agk-facts-<week>` artifacts (an ISO week such as 2026-W42), and, among artifacts of the same name, the newest by creation time (agk SPEC-0019 rule 5).
  Ruled 2026-10-21 by the maintainers: as read. The latest artifact is the highest `<week>` label among unexpired `agk-facts-<week>` artifacts, then the newest by creation time among artifacts of the same name.
- Q-S0001-3 The name and shape of the config file are not given. The criteria assume a JSON file `projects.json` at the repository root holding a list of `OWNER/REPO` strings, `gbvraju/agk` first and `gbvraju/cors` second.
  Ruled 2026-10-21 by the maintainers: as read. The config file is `projects.json` at the repository root, a list of `OWNER/REPO` strings, `gbvraju/agk` first.
  Superseded 2026-10-21 by ADR-0006: the list is per person, derived from GitHub; `projects.json` is dropped.
