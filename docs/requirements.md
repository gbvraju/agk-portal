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

### REQ-101 — The portal reads each person's project facts, read-only

- Acceptance: AC1 Given a signed-in person and a repository the GitHub App is installed on that the person can read, when the page is requested, then the server lists that repository's artifacts and downloads the latest unexpired agk-facts-<week> artifact with the person's own token; AC2 Given a downloaded artifact that holds facts.json with schema 1, when the server reads it, then the facts reach the page unchanged; AC3 Given a facts document whose schema is not 1 or that cannot be parsed, when the server reads it, then the card shows 'not known yet' with that reason and the page still renders; AC4 Given a readable repository with no unexpired agk-facts artifact, when the page is requested, then its card shows 'not known yet' with the reason that no artifact exists for its latest week; AC5 Given the listing or the download of one repository is refused or fails, when the page is requested, then only that repository's card shows 'not known yet' with the HTTP status as the reason, the other repositories are still read, and the page does not fail; AC6 Given a repository the signed-in person cannot read, when the page is requested, then it is never listed, named or counted; AC7 Given any request, when the server calls GitHub, then it makes no write call, uses no token other than the person's own, holds no Claude credential and uses no model; AC8 Given the access proof with a GitHub App user token on a private repository, when it lists and downloads one artifact, then it records each call with its HTTP status and what failed, and if access is refused it stops and adds no personal access token
- Status: planned
