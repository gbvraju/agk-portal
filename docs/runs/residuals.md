# Residuals register

Accepted ADRs and Approved specs change only their Status line, so the due dates of their `## Residual` bullets are kept here.
Each open line is `- <source> | <text> | (due YYYY-MM-DD) | open`. The source is the file and the date of the bullet.

## Open

- docs/runs/app-access-proof.md 2026-10-21 | a client must grant the App Actions read and accept it on the installation, or the page reads 403 for the repositories (as run 2 did); the setup guide says so | (due 2026-12-31) | open
- docs/runs/app-access-proof.md 2026-10-21 | the test installation is on All repositories; a client installs on selected repositories only (least access), which these runs did not test (verify) | (due 2026-12-31) | open
- docs/requirements.md 2026-10-21 | REQ-107 AC2 names the measure "changes sent back or merged late"; that is a label only, the heading rule of SPEC-0007 ("Changes sent back or merged before review") governs, and no requirement text is changed | (due 2026-12-31) | open
- site/src/core/responses.ts 2026-10-21 | assertAllowed scans the whole page text, so plain text such as a requirement title containing "style =" or " onX=" would refuse a legitimate page; the check should inspect tags and attributes, not escaped text | (due 2026-12-31) | open
- site/src/core/app.ts 2026-10-21 | POST /signout does not check that the request came from this site, so another site can sign a visitor out (no data exposed); check the Origin header on POST | (due 2026-12-31) | open
- site/src/core/facts.ts 2026-10-21 | each repository costs at least two calls to GitHub plus the download, all in one request of the page; a person with many repositories can exceed a host's limit on outgoing requests per request (for Cloudflare Workers, 50 on the free plan: verify), and a repository whose reading the host refuses would show as the fixed request-failed reason; measure at the first live sign-in (Item 9) and decide a limit by an ADR | (due 2026-12-31) | open
- site/src/core/facts.ts 2026-10-21 | the page reads the artifacts of every repository on every request, with no cache, because the server holds no storage (SPEC-0002 rule 5); a per-person cache would need its own ruling | (due 2026-12-31) | open

## Closed (not findings)

| Source | Text | Why it is closed |
| --- | --- | --- |
