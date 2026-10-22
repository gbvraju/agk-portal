# Residuals register

Accepted ADRs and Approved specs change only their Status line, so the due dates of their `## Residual` bullets are kept here.
Each open line is `- <source> | <text> | (due YYYY-MM-DD) | open`. The source is the file and the date of the bullet.

## Open

- docs/runs/app-access-proof.md 2026-10-21 | a client must grant the App Actions read and accept it on the installation, or the page reads 403 for the repositories (as run 2 did); the setup guide says so | (due 2026-12-31) | open
- docs/requirements.md 2026-10-21 | REQ-107 AC2 names the measure "changes sent back or merged late"; that is a label only, the heading rule of SPEC-0007 ("Changes sent back or merged before review") governs, and no requirement text is changed | (due 2026-12-31) | open
- site/src/core/responses.ts 2026-10-21 | assertAllowed scans the whole page text, so plain text such as a requirement title containing "style =" or " onX=" would refuse a legitimate page; the check should inspect tags and attributes, not escaped text | (due 2026-12-31) | open
- site/src/core/facts.ts 2026-10-21 | each repository costs at least two calls to GitHub plus the download, all in one request of the page; a person with many repositories can exceed a host's limit on outgoing requests per request (for Cloudflare Workers, 50 on the free plan: verify), and a repository whose reading the host refuses would show as the fixed request-failed reason; measure at the first live sign-in (Item 9) and decide a limit by an ADR | (due 2026-12-31) | open
- site/src/core/facts.ts 2026-10-21 | the page reads the artifacts of every repository on every request, with no cache, because the server holds no storage (SPEC-0002 rule 5); a per-person cache would need its own ruling | (due 2026-12-31) | open
- docs/runs/deploy-cloudflare.md 2026-10-22 | a repository the tester cannot read, which must never be listed, named or counted (REQ-101 AC6), is not testable with one account on staging; the recorded-answer test covers it; a second GitHub account would test it live | (due 2026-12-31) | open
- docs/runs/deploy-cloudflare.md 2026-10-22 | the staging App is installable only on the maintainers' account (least access); opening installation to other accounts is a production decision, and whether another person can sign in to an App installable only on its owner's account is unconfirmed (verify) | (due 2026-12-31) | open
- docs/runs/staging-record.md 2026-10-22 | the response headers of the staging address (Content-Security-Policy, nosniff, no-referrer, HSTS, no-store) were not checked (runbook check 1) | (due 2026-12-31) | open
- docs/runs/staging-record.md 2026-10-22 | the name of the token answer's expiry field and the 8-hour lifetime of a session were not checked (runbook check 6; SPEC-0002 residual on the App's "expire user authorization tokens" setting) (verify) | (due 2026-12-31) | open
- docs/runs/staging-record.md 2026-10-22 | `keep_vars` (that a deploy keeps the settings put in the dashboard) was not checked (verify) | (due 2026-12-31) | open
- docs/runs/staging-record.md 2026-10-22 | that an env binding is an object while a secret and a variable are text was not checked; the portal uses no binding | (due 2026-12-31) | open
- docs/runs/staging-record.md 2026-10-22 | the User-Agent was not isolated as the cause of the first failed sign-in (the credentials were also wrong), and whether Workers' fetch sends none by default is not shown; the portal works with the header (verify) | (due 2026-12-31) | open
- docs/runs/staging-record.md 2026-10-22 | what the page showed after sign-out was not reported, so the Origin check of POST /signout (PR #29) is not confirmed through Workers (verify) | (due 2026-12-31) | open
- docs/runs/staging-record.md 2026-10-22 | Cloudflare pull-request builds fail on the kit's root pyproject.toml (a kit defect recorded in agk by the maintainers); a failed pull-request build there does not mean the code is wrong | (due 2026-12-31) | open
- site/src/adapters/cloudflare/index.ts 2026-10-22 | the differences between Node, where the tests run, and Cloudflare Workers, where the portal runs, that tests cannot show: headers added or not added by default (the missing User-Agent was the first), redirect and body handling, the global objects present, limits on outgoing requests and on time; the staging record (docs/runs/staging-record.md) is where they are found, and each one found becomes a test with a double that does not add what Node adds | (due 2026-12-31) | open

## Closed (not findings)

| Source | Text | Why it is closed |
| --- | --- | --- |
| site/src/adapters/cloudflare/index.ts 2026-10-21 | the Workers module shape, a global `fetch` and `Date.now` inside a Worker, and secrets and variables as text were run only in Node (verify) | closed 2026-10-22 by docs/runs/staging-record.md (the Worker answered, called GitHub and sealed a session on Cloudflare); the binding-as-object part stays open below |
| docs/runs/app-access-proof.md 2026-10-21 | an installation on selected repositories only (least access) was not tested (verify) | closed 2026-10-22 by docs/runs/staging-record.md (the staging installation had selected repositories; each card appeared when its repository was in the installation) |
| docs/specs/0004-every-response-carries-a-strict-content-security-policy-toke.md 2026-10-21 | the field name and shape of the permissions in the installation listing are from memory (verify) | closed 2026-10-22 by docs/runs/staging-record.md (the installation passed the run-time permission check) |
| docs/specs/0002-a-person-signs-in-with-github-through-the-github-app-and-the.md 2026-10-21 | the authorization and token addresses and the shape of the token answer are from memory (verify) | closed 2026-10-22 by docs/runs/staging-record.md (sign-in completed); the expiry field name stays open below |
| docs/adr/0016-deploy-cloudflare-workers-staging.md 2026-10-22 | Workers Builds' settings, `workers_dev` and the compatibility date are from memory (verify) | closed 2026-10-22 by docs/runs/staging-record.md (the build of main succeeded and the Worker answered); `keep_vars` stays open below |
| site/src/core/app.ts 2026-10-21 | POST /signout does not check that the request came from this site, so another site can sign a visitor out (no data exposed); check the Origin header on POST | closed 2026-10-22 by the pull request that checks the Origin header of POST /signout against the origin of CALLBACK_URL (site/tests/signout-origin.test.ts) |
