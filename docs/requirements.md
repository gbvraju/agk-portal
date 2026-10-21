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

### REQ-102 — A person signs in with GitHub and keeps a stateless session

- Acceptance: AC1 Given a visitor who is not signed in, when the page is requested, then the response offers sign-in and shows no project name; AC2 Given a visitor who starts sign-in, when the server redirects to GitHub, then the redirect carries a random state value that is bound to the visitor's browser; AC3 Given a return from GitHub whose state value is missing or does not match the one bound to the browser, when the server handles it, then the sign-in is refused, no token is requested and no session is set; AC4 Given a return with a matching state and a code, when the server obtains the user token, then it sets one cookie that is encrypted and signed, holds the token and its expiry and nothing else, has the flags Secure and HttpOnly and SameSite=Lax, lasts the smaller of 8 hours and the token's expiry, and holds no refresh token; AC5 Given a valid cookie, when a request arrives at any instance of the server, then the person is signed in and no database, key-value store or host storage is read or written; AC6 Given a cookie that is expired or tampered with or missing, when the page is requested, then the person is not signed in, the fixed expiry phrase is shown with an offer to sign in, and no token is used; AC7 Given a signed-in person who signs out, when the server answers, then it clears the cookie, makes no call to GitHub and offers sign-in; AC8 Given a signed-in person with no readable repository on which the App is installed, when the page is requested, then a fixed phrase says so, the page is not blank and no project name is shown
- Status: planned

### REQ-103 — The core is portable and each host has one thin adapter

- Acceptance: AC1 Given the core's own TypeScript configuration with the web-worker libraries and no Node types, when the compiler checks site/src/core without emitting, then it succeeds with 0 errors; AC2 Given a core file that uses a Node-only global such as process or Buffer, when the same check runs, then it fails and names the file; AC3 Given every file under site/src/core, when the import scan reads its syntax tree, then every import and every re-export and every dynamic import is a relative path that resolves inside site/src/core and the core has no runtime dependency; AC4 Given a core file that imports a Node module or a Cloudflare module or a package, when the import scan runs, then it fails and names the file and the specifier; AC5 Given a core that needs a secret or a setting, when it runs under a test configuration, then it asks only through the configuration interface for names on the one documented list and reads no environment variable, binding or global for it; AC6 Given a setting missing from the configuration, when the core needs it, then it refuses with a message that names the setting and never its value; AC7 Given the Cloudflare adapter with a fake environment and a fake request, when it handles the request, then it fills the configuration from the fake environment's secrets and variables, passes the request to the core and returns the core's response unchanged; AC8 Given the Cloudflare adapter, when it hands anything to the core, then it hands no environment object and no Cloudflare binding, only the request and the configuration interface
- Status: planned
