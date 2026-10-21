# Vision

## What this is for

A consulting firm's engagement lead and its client cannot read pull requests, verdicts or a markdown report issue. The AGK portal gives
them one page per project in plain business words: what was delivered this week, what is proven, what needs their decision, what is at
risk, what it cost, and how the requirements stand. People sign in with GitHub through a GitHub App that the maintainers create and the
client installs, and a small server reads, for each request, only the AGK facts document that each project's weekly report publishes. It
writes nothing, stores nothing but the sign-in session, holds no Claude credential and uses no model.

## Who it serves

The engagement lead of a consulting firm and the client of that firm, whose projects live in private repositories (public repositories work
the same way). Each person reads only what GitHub already lets them read; neither reads pull requests, verdicts or a markdown report
issue.

## How success is measured

- Every repository a person can read, among those the App is installed on, has a card that either shows its facts or says "not known yet"
  with a named reason; a repository the person cannot read is never shown.
- Every sentence on the page is a requirement's own sentence or a fixed phrase over a facts number, and every line links to its evidence
  on GitHub.
- A session lasts at most 8 hours, and the page is live and usable at phone width.

## Out of scope

- Non-goals: writes of any kind, any model, any stored data beyond the session.
- Not in this slice: action buttons, creating projects, SSO beyond GitHub, theming.

## Project rules

- The portal is read-only: it makes no write call to GitHub. <!-- project-specific -->
- Each person reads only what GitHub lets them read: the server uses the person's own user-to-server token of a GitHub App whose permissions are Actions read and Metadata read, nothing else. <!-- project-specific -->
- Nothing is stored but the sign-in session: no database, no key-value store, no host storage. <!-- project-specific -->
- The server holds no Claude credential and uses no model. <!-- project-specific -->
- Every sentence is a requirement's own sentence or a fixed phrase over a facts number. <!-- project-specific -->
- An unknown in the facts is shown as "not known yet", never hidden. <!-- project-specific -->
- Pages are designed mobile first. <!-- project-specific -->
- Portable core with host adapters, stateless, secure by default. <!-- project-specific -->
  - The core is a module written only against web-standard APIs (fetch, Request/Response, Web Crypto, URL) and imports nothing host-specific; a test fails if any core file imports a host-specific module or global. <!-- project-specific -->
  - There is one thin adapter per host: the Cloudflare Workers adapter is built first, an AWS Lambda/Node adapter is named as the next and is not built. <!-- project-specific -->
  - Secrets and configuration reach the core through one small interface that the adapter fills from the host's own secret store. <!-- project-specific -->
  - The session is an encrypted, signed, expiring cookie (Web Crypto), so any instance answers any request and moving hosts needs no migration. <!-- project-specific -->
  - Security by default, each with a test where it can be tested: App permissions limited to Actions read and Metadata read; an OAuth state parameter against CSRF; session expiry; tokens never logged and never put in a URL; a strict Content-Security-Policy and secure cookie flags; no write call to GitHub. <!-- project-specific -->
