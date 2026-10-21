# SPEC-0001: The build reads each project's latest facts artifact

- Status: Draft
- Owner: maintainers
- Requirements: REQ-101

Status is `Draft` or `Approved`. An Approved spec is owned by its reviewer group; agents propose patches.
Written by the intake of one sentence, as data: "The build reads the latest agk-facts-<week> artifact of each project in the config file with the workflow's own token, and a project whose facts cannot be read shows 'not known yet' with a named reason without failing the site." It is milestone M1 of ADR-0002. The maintainers answered three questions on 2026-10-21: the requirement id is REQ-101 (the kit reserves REQ-001 to REQ-099; the intake script does not know that, a kit defect reported to agk), the tests are TypeScript `*.test.ts` files run by an npm command set in `agk.toml` without editing a kit workflow, and the format is taken from agk SPEC-0009, SPEC-0019 and `kit/facts-schema.json` (read on 2026-10-21 at agk commit b7707ac), never guessed. SPEC-0019 is Draft in the agk repository (verify before the build).

## Rules

1. **The list.** One config file lists the projects as `OWNER/REPO` of public repositories: first `gbvraju/agk`, then `gbvraju/cors` (Q-S0001-3). The build reads no repository that is not in it.
2. **The artifact.** For each project the build lists the repository's workflow artifacts with the GitHub REST API, keeps those named `agk-facts-<week>` that have not expired, takes the latest week (Q-S0001-2), and downloads it. The archive holds one file, `facts.json`, which is the facts document of agk SPEC-0009 byte for byte (agk SPEC-0019 rules 1 and 2, verify).
3. **The workflow's own token only.** The build authenticates with the token the workflow is given, `GITHUB_TOKEN`, with the narrowest permissions that can read; it uses no secret, no personal access token, no App and no stored credential. Whether that token can list and download an artifact of another public repository is unconfirmed (verify): rule 9 proves it before anything depends on it.
4. **Schema 1 only.** The build reads `schema` first. A document whose `schema` is the integer `1` is accepted; any other value, a missing `schema`, or a file that is not JSON makes that project's card "not known yet" with the reason (Q-S0001-1 for the optional `kit_version` key). Nothing is filtered, renamed or completed; an `"unknown"` in the facts stays `"unknown"` and is shown as "not known yet" by a later milestone.
5. **No artifact.** A project with no unexpired `agk-facts-<week>` artifact (none published yet, expired after the 90 days of agk SPEC-0019, or the repository has no workflow run) has the card "not known yet" with the reason that no artifact exists for its latest week. The site builds.
6. **A failure is local.** A refused or failed listing or download (a status other than 200 and the redirect of the download) makes only that project's card "not known yet", with the HTTP status of the call as the reason. The other projects are still read. The build fails only when the build itself is broken, never because a project could not be read.
7. **Read-only.** The build writes nothing to GitHub, stores nothing outside its own output, holds no secret and uses no model. The workflow's permissions grant no write beyond what publishing the static site to GitHub Pages needs, and the data step has none.
8. **Tests.** The tests are TypeScript files named `*.test.ts` under `tests/`, run by the npm command in `agk.toml` `project_tests`, each carrying the marker `REQ-101 ACn` it proves. They use recorded API responses and no network.
9. **The proof.** Before any other item, a throwaway workflow in this repository lists and downloads one artifact of another public repository with the workflow's own token and no secret, first on a public repository with a recent artifact (for example `actions/upload-artifact`'s own CI, if it has one), then on `gbvraju/agk` once its `agk-facts-<week>` exists. It records each API call, the HTTP status of each, and what failed, in `docs/runs/`. If access is refused it stops and raises a question; the maintainers decide the fallback; no secret is added.

## Tests

- Rule 2: listing keeps only unexpired `agk-facts-<week>` and downloads the latest week; REQ-101 AC1.
- Rule 4: schema 1 reaches the page unchanged; REQ-101 AC2.
- Rule 4: schema 2, a missing schema and invalid JSON each give 'not known yet' with that reason and do not fail the build; REQ-101 AC3.
- Rule 5: no artifact, and only expired artifacts, give 'not known yet' with the no-artifact reason and the site builds; REQ-101 AC4.
- Rule 6: a 403, a 404 and a 500 on one project give that card the status as the reason while the other project is read and the build does not fail; REQ-101 AC5.
- Rules 3 and 7: the workflow files hold no secret reference other than the workflow's own token, no personal access token, and no write permission in the data step; REQ-101 AC6.
- Rule 9: the proof workflow exists, calls only the artifact list and download endpoints, and its record names each call and status; REQ-101 AC7.

## Proof

REQ-101 AC1 and AC2: *a project's facts reach the page as published.* Rules 2 and 4. REQ-101 AC3 to AC5: *what cannot be read is said, never hidden, and never stops the site.* Rules 4 to 6. REQ-101 AC6: *no secret and no write.* Rules 3 and 7. REQ-101 AC7: *the access is proven, or the work stops.* Rule 9. The maintainers read the record in `docs/runs/` before the build item that depends on it.

## Residual

- 2026-10-21: agk SPEC-0019 is Approved and being built; a project has the artifact only after it upgrades to that kit version, so `gbvraju/cors` shows 'not known yet' until then (due 2026-11-30).
- 2026-10-21: the proof on `gbvraju/agk` waits for its first `agk-facts-<week>` artifact (due 2026-11-30).
- 2026-10-21: the kit's REQ-004 defect was fixed in agk 0.32.0 (ADR-0004); intake.py check passed on REQ-101 (closed).

## Open questions

- Q-S0001-1 The schema file allows an optional `kit_version` key that the key list of agk SPEC-0009 rule 3 does not name. The criteria assume the build accepts schema 1 documents with or without it and ignores keys it does not use.
  Ruled 2026-10-21 by the maintainers: as read. Schema 1 documents are accepted with or without `kit_version`; keys the build does not use are ignored.
- Q-S0001-2 "The latest" artifact is not defined for the site. The criteria assume the highest `<week>` label among unexpired `agk-facts-<week>` artifacts (an ISO week such as 2026-W42), and, among artifacts of the same name, the newest by creation time (agk SPEC-0019 rule 5).
  Ruled 2026-10-21 by the maintainers: as read. The latest artifact is the highest `<week>` label among unexpired `agk-facts-<week>` artifacts, then the newest by creation time among artifacts of the same name.
- Q-S0001-3 The name and shape of the config file are not given. The criteria assume a JSON file `projects.json` at the repository root holding a list of `OWNER/REPO` strings, `gbvraju/agk` first and `gbvraju/cors` second.
  Ruled 2026-10-21 by the maintainers: as read. The config file is `projects.json` at the repository root, a list of `OWNER/REPO` strings, `gbvraju/agk` first.
