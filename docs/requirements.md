# Requirements

Each requirement is a `### REQ-nnn` section with a `- Status:` line (planned | in-progress | done).
Only the Status line may change without an ADR. `done` requires at least one test marker `REQ-nnn` in a
`test_*.py` file under `tests/`.

`REQ-001`..`REQ-099` are reserved for requirements defined by the kit. Add this project's requirements from
`REQ-101`.

### REQ-001 — Protected paths change only with an ADR in the same PR

- Acceptance: AC1 check fails without an ADR that names the path class; AC2 Status-only change in requirements exempt; AC3 message names the path class
- Status: planned

### REQ-002 — Agents never merge or bypass checks

- Acceptance: AC1 branch rules documented in ADR-0001; AC2 settings deny force-push and hard reset; AC3 stop hook blocks on red governance
- Status: planned

### REQ-003 — Every requirement is traceable to tests

- Acceptance: AC1 matrix generated; AC2 done requires a marker; AC3 matrix never committed
- Status: planned

### REQ-101 — The build reads each project's latest facts artifact

- Acceptance: AC1 Given a project listed in the config file that has an unexpired agk-facts-<week> artifact, when the build runs, then it lists that repository's artifacts and downloads the one with the latest week using only the workflow's own token; AC2 Given a downloaded artifact that holds facts.json with schema 1, when the build reads it, then the facts reach the page unchanged; AC3 Given a facts document whose schema is not 1 or that cannot be parsed, when the build reads it, then the card shows 'not known yet' with that reason and the build does not fail; AC4 Given a listed project with no unexpired agk-facts artifact, when the build runs, then its card shows 'not known yet' with the reason that no artifact exists for its latest week and the site still builds; AC5 Given the listing or the download of one project is refused or fails, when the build runs, then only that project's card shows 'not known yet' with the HTTP status as the reason, the other projects are still read, and the build does not fail; AC6 Given the build workflow, when it reads any project, then it uses no secret, no personal access token and no stored credential, and its permissions grant no write access; AC7 Given the throwaway proof workflow run against a public repository other than this one, when it lists and downloads one artifact, then it records each API call with its HTTP status and what failed, and if access is refused it stops and adds no secret
- Status: planned
