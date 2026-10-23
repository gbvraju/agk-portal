# Staging record: the first deployment and the first live sign-in

Date 2026-10-22 (from `date -u`). Written by the builder from the maintainers' words of 2026-10-22, in words only: no token, client id, secret, key, cookie or signed address was sent or is recorded here. It answers the runbook `docs/runs/deploy-cloudflare.md` (ADR-0016) and the `(verify)` marks that its section "Unconfirmed facts this deployment settles" lists. What the maintainers did not check is said as not checked, and stays open in `docs/runs/residuals.md`.

## What the maintainers did

- Connected Cloudflare Workers Builds to `gbvraju/agk-portal` from a computer: the Git connection does not complete from a phone browser (the runbook says its steps can be done from a phone; this one cannot).
- The Worker was first created by hand as `agk-portal` and renamed to `agk-portal-staging` to match `site/wrangler.toml`. Root directory `site`, deploy command `npx wrangler deploy`.
- A pull-request build on Cloudflare failed: it detected the root `pyproject.toml` and tried a Python package install at the repository root (setuptools: "multiple top-level packages"). The build of `main` after the merge of PR #30 succeeded. The maintainers recorded this in the agk repository as a kit defect (the kit's `pyproject.toml` sits at the root of every project).
- Signed in and read the page, as set out below.

## What happened, in order

1. First sign-in: GitHub's authorization succeeded and the return showed "Sign-in could not be completed".
2. After PR #30 (the `User-Agent: agk-portal` header on every request to GitHub, and the stage of a refused sign-in shown once), the stage read "GitHub's answer had no token (incorrect_client_credentials)".
3. The maintainers set the staging App's Client ID and a freshly generated client secret in Cloudflare. Sign-in then worked.
4. Signed in, the page showed two cards: `gbvraju/agk`: "Facts read for 2026-W42."; `gbvraju/agk-proof-private`: "Not known yet: no facts artifact exists for its latest week."
5. The `gbvraju/agk` card appeared only after the App's installation was given the repository `agk`: the installation had only `agk-proof-private` before.
6. Sign-out: the page showed "Page not found". Most likely cause, as the maintainers put it: with the pages' `Referrer-Policy: no-referrer` the browser serialises the Origin of a form POST as "null", so the Origin check added in PR #29 refused the person's own sign-out. It is browser behaviour the Node tests could not show, and the ruling Q-B6-1 missed it. The fix is PR #32 (the request is also answered when Origin is "null" or missing and the browser's `Sec-Fetch-Site` is `same-origin`).
7. Retry after the merge of PR #32 (maintainers, 2026-10-22): sign-out now returns to the sign-in page. The fix is confirmed at staging; the cause (Origin "null" under `Referrer-Policy: no-referrer`) is still the maintainers' reading, not read from the request.
8. Header scan (securityheaders.com, 2026-10-22): grade A. Strict-Transport-Security, Content-Security-Policy, Referrer-Policy, X-Frame-Options (derived from `frame-ancestors`) and X-Content-Type-Options pass; Permissions-Policy is missing. A change to send it was queued (PR #36).
9. Header scan after PR #36 (maintainers, 2026-10-22): securityheaders.com grades the staging address A+, with Permissions-Policy present. PR #36 is confirmed at staging.

## This week live (2026-10-23)

Date 2026-10-23 (from `date -u`). Written by the builder from the maintainers' words, in words only: no token, secret, cookie or signed address is recorded here.

- **The parts.** The This week section of the card is live on staging with all five parts of the fourth brief: the opening and the notices and the archive's `report.json` (PR #39), Delivered and Time and review (PR #40), Proven and Needs your decision (PR #41) and At risk (PR #42). Each part is rendered from the section of the same name in `report.json`, with the fixed phrases of SPEC-0005 rule 10.
- **The numbers.** The maintainers confirmed on staging, on 2026-10-23, that every At risk number and every Time and review number on the page matches agk's report for week 2026-W42. The record holds their statement, not the numbers: the builder did not see the page or the report.
- **The build Cloudflare missed.** Cloudflare's Git connection did not build `main` after the merge of PR #39: no build of `main` had run since PR #38, so staging did not show the section. The maintainers reconnected the Git connection from a computer and retried the build by hand; the retry succeeded and the later merges (#40 to #42) were confirmed on staging. This record does not hold the time of the missed build, the name Cloudflare showed for it or the retry's identifier, because the maintainers did not report them.
- **The staging gate.** The gate "staging before the next item" was waived for Item 3 only because of this (decisions log, 2026-10-22).
- **What stays open.** REQ-105 stays planned: AC5's "count of items lacking it" waits for agk's report to carry a count (Q-B13-6). Requirements and Trend wait for the next additions to agk's `report.json`. The first scheduled report with both files (Monday 2026-10-26) is still to be checked against the page.

## The runbook's checks

| Check | Result |
| --- | --- |
| 1 Signed out, the response headers (securityheaders.com or curl) | done: grade A with Permissions-Policy missing (finding); after PR #36, grade A+ with Permissions-Policy present |
| 2 Signed out, the page offers sign-in and shows no project name | not reported separately; the first sign-in started from the offer |
| 3 Sign in; return to the portal address | done: authorization succeeded; the return failed twice (see "What happened"), then worked after the credentials were corrected |
| 4 Signed in: the cards | done: the two cards above; a repository the person cannot read is not testable with one account (residual) |
| 5 Sign out | done: first "Page not found" (finding); after PR #32, the page returns to the sign-in page |
| 6 The 8-hour expiry | not checked |
| Another person signing in to an App installable only on its owner's account | not checked |

## What these results settle

Each row is a `(verify)` mark of the repository and what the words above show about it.

| Fact | Settled | By |
| --- | --- | --- |
| The web-flow authorization address and its parameters (SPEC-0002 residual) | yes | GitHub's authorization succeeded and returned to the callback |
| The token exchange address, its parameters and the answer's `access_token` field, and the error field and its name (`incorrect_client_credentials` is one of the allow-list) | yes | sign-in completed after the credentials were corrected; before that GitHub's answer carried the error name, read by the stage phrase |
| The name of the token answer's expiry field and the 8-hour lifetime | no | not checked |
| The installations listing and the repositories listing (shapes, paging by `page` and `per_page`) | yes | the page listed the repositories of the installation |
| The `permissions` field of an installation (SPEC-0004 residual) | yes | the installation, set to Actions read and Metadata read, passed the run-time permission check and was not refused |
| An installation on selected repositories only, and a repository added to the installation later | yes | the installation had one repository, then two; each card appeared when its repository was in the installation |
| The artifact listing (its fields and names), the 302 of the download with its `Location`, the signed download, the archive and the schema 1 document | yes | the card read "Facts read for 2026-W42." for `gbvraju/agk` |
| A repository with no `agk-facts-<week>` artifact | yes | the card read "no facts artifact exists for its latest week." for `gbvraju/agk-proof-private` |
| The Workers module shape `{ fetch(request, env, context) }`, a global `fetch` and `Date.now` inside a Worker, and secrets and variables arriving as text | yes | the Worker answered, called GitHub, and read and wrote the session cookie, which needs the clock and the session key |
| An env binding is an object (no binding is used by the portal) | no | not checked |
| Cloudflare Workers Builds: root directory, deploy command, build of `main`, the name that matches `wrangler.toml`, `workers_dev` and the compatibility date | yes | the build of `main` after PR #30 succeeded and the Worker answered at its address |
| `keep_vars`: that a deploy keeps the settings put in the dashboard | no | not reported (the credentials were set after the build) |
| The `User-Agent` header | partly | with the header the exchange reached GitHub and GitHub answered with its own error name; the credentials were wrong before and after PR #30, so the record cannot say that the missing header alone caused the first failure, nor that Workers' fetch sends none; the portal works with the header on Workers |
| The Origin header on a sign-out through Workers (PR #29) | corrected, then yes | the sign-out showed "Page not found": the Origin check of PR #29 refused the person's own request (most likely the browser sent Origin "null" under `Referrer-Policy: no-referrer`; not read directly); PR #32 answers it by `Sec-Fetch-Site`, and after its merge sign-out returns to the sign-in page |
| The security headers on the staging address | yes | securityheaders.com grade A (HSTS, CSP, Referrer-Policy, X-Frame-Options from `frame-ancestors` and X-Content-Type-Options pass; Permissions-Policy missing), then A+ with Permissions-Policy present after PR #36 |

## Findings that are not `(verify)` marks

- The installation must include each repository to be shown: a repository the App is not installed on is never listed (REQ-101 AC6 as designed). The runbook's step 3 should say "give the installation the repository, not only the App" if it does not (a later change; not made here).
- Cloudflare's pull-request builds read the repository root: the kit's `pyproject.toml` made the build try a Python install. The build root for Workers Builds is `site`, but the detection ran at the root for pull-request builds; the maintainers recorded it in agk as a kit defect. Until it is fixed, a pull-request build on Cloudflare can fail without meaning that the code is wrong.
- The Origin of a form POST is "null" when the page's Referrer-Policy is `no-referrer`, so an Origin-only check refuses the person's own sign-out. The reading of Q-B6-1 was corrected (decisions log, PR #32), and the retry confirmed the sign-out; a browser-only behaviour is found at staging and nowhere else, which is what the Node-vs-Workers-and-browsers residual says.
- The security headers were checked by a public scanner, as the runbook says for a phone: grade A. The missing Permissions-Policy was a gap in SPEC-0004 rule 1, which is Approved; it was changed through a proposed amendment applied by an ADR (PR #36), and the rescan graded A+.
- A misconfigured client id or secret is told apart from a code problem by the stage phrase added in PR #30; that worked as designed.

## What stays open

Listed in `docs/runs/residuals.md`: the 8-hour expiry and the expiry field name, `keep_vars`, an env binding as an object, the `User-Agent` isolation, another person signing in, and the residuals that were already open (a repository the tester cannot read; the differences between Node and Workers).
