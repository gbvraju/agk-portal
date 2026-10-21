# ADR-0006: Access model: GitHub App sign-in, a small server and a portable core

- Status: Accepted
- Date: 2026-10-21
- Deciders: maintainers
- Related: ADR-0001, ADR-0003, ADR-0005
- Amends: ADR-0002
- Requirements: REQ-101

Protected classes: `constitution/`, `docs/requirements.md`

## Context

ADR-0002 chartered a read-only static site over public repositories, built by a workflow with its own token and published to GitHub Pages, and listed sign-in, private repositories, the GitHub App and holding a secret as non-goals. The customers are consulting firms and their clients, and their repositories are private. A static build with the workflow's own token cannot read another repository's private artifacts, and a page built for everyone cannot show each person only what GitHub lets them read. ADR-0001 and ADR-0002 are accepted in the first commit of the pull request that carries this ADR.

## Decision

1. **Access.** People sign in with GitHub through a GitHub App that the maintainers create and the client installs. Each person reads only what GitHub already lets them read: the server uses the person's user-to-server token. The App's permissions are Actions read and Metadata read, nothing else. Public repositories work the same way for anyone signed in.
2. **The list is per person.** The projects shown are the repositories on which the App is installed that the signed-in person can read, listed from GitHub with the person's token. `projects.json` is dropped and no file names a customer repository. A readable repository with no `agk-facts-<week>` artifact shows "not known yet" with that reason; a repository the person cannot read is never shown. The ruling on Q-S0001-3 (`projects.json`) is superseded by this decision.
3. **A small server.** On each request the server fetches each project's `agk-facts-<week>` artifact and renders the page. It stores nothing but the sign-in session, makes no write call to GitHub, holds no Claude credential and uses no model.
4. **Portable core, host adapters.** The core is a module written only against web-standard APIs (fetch, Request/Response, Web Crypto, URL) and imports nothing host-specific. There is one thin adapter per host. The Cloudflare Workers adapter is built first and is the hosting of this slice. An AWS Lambda/Node adapter is the next and is not built. Secrets and configuration reach the core through one small interface that the adapter fills from the host's own secret store. A test fails if any core file imports a host-specific module or global.
5. **Stateless session.** The session is an encrypted, signed, expiring cookie (Web Crypto). There is no KV store, no database and no host storage, so any instance answers any request and moving hosts needs nothing. A session lasts at most 8 hours (the smaller of 8 hours and the token's expiry). No refresh token is kept in the cookie. On expiry the page says so in a fixed phrase and offers sign-in.
6. **Secrets.** The App's credentials (its client secret and the key that encrypts and signs the session) are secrets that the maintainers set in the host's secret store. Agents only name them and never read or write a value. No personal access token is used.
7. **Security by default,** each with a test where it can be tested: App permissions limited to Actions read and Metadata read; an OAuth state parameter against CSRF; session expiry; tokens never logged and never put in a URL; a strict Content-Security-Policy and secure cookie flags; no write call to GitHub.
8. **The charter is amended.** The milestones of ADR-0002 become: M1, the server reads, on each request and with the person's own token, the facts of each repository the person can read, a readable repository without an artifact shows "not known yet" with that reason, and one repository's failure never fails the page; exit: for each of 2 repositories either its facts are read or its card shows "not known yet" with a named reason, 0 page failures, and 0 repositories shown that the person cannot read. M2 is unchanged (the four sections, zero sentences that are not a requirement's own sentence or a fixed phrase over a facts number). M3, the portal is live on Cloudflare Workers behind sign-in and works on a phone; exit: 0 project names are shown to a person who is not signed in, and the page has no horizontal scroll at 360 px width. Non-goals: writes of any kind, any model, any stored data beyond the session. Not in this slice: action buttons, creating projects, SSO beyond GitHub, theming. "Static site built by a workflow and published to GitHub Pages" no longer holds.
9. **The vision and the spec.** `constitution/vision.md` records the project rules, among them "portable core with host adapters, stateless, secure by default". `docs/runs/proposed-spec-amendments-1.md` changes SPEC-0001 rules 1, 3, 5, 6, 7 and 9, and rewords what follows from them (rules 2 and 4, Tests, Proof, Residual); this ADR applies it. REQ-101 is rewritten to the data behaviour only (the server reads the facts per person, shows "not known yet", is read-only).
10. **Requirements enter by intake.** Sign-in and the stateless session, the portable core and adapter boundary, and the security defaults each come as their own one-sentence intake after this pull request merges, questions first, and the maintainers approve the three specs in one rulings pull request. Until then these rules bind through the vision and this ADR and carry no requirement marker of their own.
11. **The brief.** Item 2 of the first brief is superseded (a new brief follows). Item 1, the TypeScript test runner of ADR-0005, stands.

## Consequences

- The portal needs a server, a GitHub App and three secrets set by the maintainers; none is read or written by an agent.
- The deployment mechanism for Cloudflare Workers (and the credential it needs, if any) is decided in the brief that builds it.
- The TypeScript tests of ADR-0005 run under Node; the core's tests must also show it runs without Node-only APIs, and the Workers adapter needs its own runtime test (brief).
- ADR-0002 stays Accepted; this ADR amends it, and the Accepted text of ADR-0002 is not edited.

## Residual

- 2026-10-21: that a GitHub App user-to-server token with Actions read and Metadata read can list and download an artifact of a private repository is unconfirmed (verify); the proof of SPEC-0001 rule 9 needs a private repository with an `agk-facts-<week>` artifact, which the maintainers provide (due 2026-11-30).
- 2026-10-21: the deploy secret and the way the Cloudflare Workers adapter is published are not decided (due 2026-11-30).
- 2026-10-21: the three intakes (sign-in and session, portable core, security defaults) are not yet requirements (due 2026-11-30).
- 2026-10-21: the server fetches every readable repository's artifact on each request; with many projects the page may be slow or meet GitHub's rate limit for the person's token. Measure on the first live page; any cache must still store nothing beyond the session (due 2026-12-31).
