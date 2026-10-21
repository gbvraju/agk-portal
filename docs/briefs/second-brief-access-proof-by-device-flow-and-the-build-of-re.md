# Brief: Second brief: access proof by device flow and the build of REQ-101 to REQ-104

Written in the architect role (`.claude/agents/architect.md`) in an ordinary session: its tool list and guard hook are not enforced here, only the rules of the file bind. Date 2026-10-21. It builds ADR-0006 (Accepted) and the Approved SPEC-0001 to SPEC-0004 for REQ-101 to REQ-104, and replaces Item 2 of the first brief (superseded; Item 1 of the first brief, the test runner of ADR-0005, stands). Each item is built later as its own pull request, branched from the default branch, tests first, one open pull request at a time, in the order below.

## Rules block

Operating rules that apply to every item (`constitution/principles.md` by number; `CLAUDE.md` for the short form):

- Principle 1: `.github/`, `agk.toml`, `constitution/` and `docs/requirements.md` are protected paths; a change to any of them carries an ADR in the same pull request that names each class.
- Principle 2 and 11: never merge, enable auto-merge, or bypass or weaken a check.
- Principle 3: one pull request per item, branched from `origin/main`, never stacked.
- Principle 5 and `CLAUDE.md` rule 4: tests first, shown failing on the base; every test carries its `REQ-nnn ACn` marker; nothing is marked done by the builder. The PR body never declares `Behaviour: unchanged` for an item that adds behaviour.
- Principle 7: a fact about GitHub, Cloudflare or a package that is not confirmed is marked `(verify)` in the file and in the pull request body; an unconfirmed fact is a question, not a guess.
- Principle 9 and `CLAUDE.md` rule 5: no secret anywhere, in the repository or in an agent session. Agents name secrets and never read or write a value. No personal access token; no network call in a check. The only values the maintainers put in GitHub are public (a repository variable holding a client id).
- Principle 10: dates from `date -u`; the pull request body states `Advances:`, `Size:` and `Expected:` copied from the item.
- No kit workflow (`.github/workflows/drift-audit.yml`, `governance.yml`, `metrics.yml`, `product-report.yml`, `proof.yml`) and no kit file (`.gitignore`, `Makefile`, `agk.mk`, `scripts/agk/`) is edited.
- The core (`site/src/core/`) imports only relative paths inside itself and has no runtime dependency (SPEC-0003); the server never writes to GitHub except the one sign-in exchange (SPEC-0004 rule 8).
- Principle 12: on ambiguity or a refusal, stop and report; do not widen the item.

## What the maintainers provide, and when

- Before Item 1 can be run: the GitHub App created by the maintainers by hand to match `github-app-manifest.json` once Item 5 exists, or for the proof only an App with "Enable Device Flow" on, Actions read and Metadata read, expiring user tokens on, installed on a private repository that has any recent artifact; the repository variable `APP_CLIENT_ID` set to the App's public client id; the name of that private repository handed to the run. No client secret is needed for Item 1.
- First needing the real App credentials: **Item 9**, the first live deployment: the client secret, the session key and the callback address set by the maintainers in Cloudflare's secret store, and the way the Worker is published (Q-B2-1). Items 1 to 8 use none: they run on fake configuration, recorded answers and the public client id.

## Items

### Item 1 — The access proof by device flow (SPEC-0001 rule 9, amended)

- Advances: REQ-101
- Scope: `.github/workflows/app-device-flow-proof.yml` (a new file), `site/tests/proof-workflow.test.ts`, `docs/adr/0010-app-device-flow-proof.md`. No other path.
- Needs: the App, the variable `APP_CLIENT_ID` and a private target repository, as above, to run it after the merge.
- Acceptance:
  1. Tests first: `site/tests/proof-workflow.test.ts` reads the workflow file as text and fails when: the trigger is anything but `workflow_dispatch`; any `secrets.` reference appears; the client id is not read from `vars.APP_CLIENT_ID`; `permissions` is anything but empty or `contents: read`; the target repository is hard coded rather than an input; any `curl -v`, `--trace`, `set -x` or `echo` of a token variable appears; the `::add-mask::` line for a token or device code does not come before the first line that uses it; a GitHub API call uses a method other than GET, or a POST goes to an address other than the two device-flow addresses; or a printed line is not one of the allowed forms. It carries the markers `REQ-101 AC8` and `REQ-101 AC7`. It uses no network.
  2. The workflow is new, its header says it is throwaway and that it is removed in the pull request that builds the real data step (ruling Q-B1-3), and no kit workflow is edited. It runs on `workflow_dispatch` with the target `OWNER/REPO` as an input.
  3. It requests a device code from the App (`POST https://github.com/login/device/code` with the client id only), prints only the user code and the verification address, masks the device code at once, and polls the token address at the interval given until it gets a token or an end state (`authorization_pending`, `slow_down`, `expired_token`, `access_denied`) (verify: addresses, parameters and error names are from memory). It masks the token with `::add-mask::` before any use and keeps it in memory only: an environment variable of the step, never a file, an output or an artifact.
  4. With the token it calls `GET /repos/{owner}/{repo}/actions/artifacts` (list), picks the first unexpired artifact, then `GET /repos/{owner}/{repo}/actions/artifacts/{id}/zip` (download), without following the redirect on the first hop. It prints each call as `METHOD path -> HTTP status`, and for the redirect the host only, never the signed address. It then fetches the redirect target without the token, saves the file under the runner's temporary directory and prints the file name and its size and nothing of its contents. As a control it repeats the list call without a token and prints the status.
  5. It uses no secret and no personal access token and never prints the token, the device code, the signed address or the artifact's contents. The workflow's own `GITHUB_TOKEN` is not used.
  6. Stop rule: if the list or the download with the user token returns 401, 403 or 404, the run ends, the builder stops, adds no secret and no workaround, and raises a question; the maintainers decide the fallback. Whether such a token can list and download a private repository's artifact stays `(verify)` until a 200 is recorded.
  7. ADR-0010 is Proposed, names `.github/`, and sits in the same pull request.
- Branch: chore/app-device-flow-proof
- Size: M
- Expected: 2-4 hours

### Item 2 — The access record

- Advances: REQ-101
- Scope: `docs/runs/app-access-proof.md`. No other path. Docs only.
- Needs: Item 1 merged and the maintainers' run of the workflow (they enter the user code on github.com themselves).
- Acceptance:
  1. The record holds: the date from `date -u`, the run URL, the target repository, the App's permissions as installed, each call with its method, path and HTTP status, the redirect host, the file name and size, the control call and its status, and what failed. The lines are copied from the run log, which holds no token.
  2. If every call with the token returned its expected status (200 on the list, 302 then 200 on the download), the record says the access is proven for a private repository and the `(verify)` of SPEC-0001 rule 9 is closed in a decisions-log row. If any returned 401, 403 or 404, the record says so, no item after this one starts, and the builder raises a question for the maintainers.
- Branch: docs/app-access-record
- Size: S
- Expected: 0.5-1 hours

### Item 3 — The portable core boundary (REQ-103 AC1 to AC6)

- Advances: REQ-103
- Scope: `site/tsconfig.core.json`, `site/src/core/` (the `Config` interface, the documented names, the injected clock and the refusal that names a missing setting), `site/tests/core-boundary.test.ts`, and, only if Item 3's check of the compiler API finds it absent, `site/package.json` and its lock file with `docs/adr/0011-import-scan-parser.md`. No kit file.
- Needs: nothing.
- Acceptance:
  1. Tests first, shown failing on the base: the compile check (`tsc -p site/tsconfig.core.json` exits 0 on the core; temporary files using `process` and `Buffer` make it fail and name the file), the import scan (a syntax-tree allow-list of relative imports that stay inside `site/src/core/`, covering `import`, `import type`, `export ... from`, dynamic `import()` and `import x = require()`; fixtures importing `node:fs`, `cloudflare:workers`, a package, an absolute path, a path leaving the core, each fail the scan and name the file and the specifier), the check that `site/package.json` has no `dependencies`, the `Config` spy (only documented names), and the refusal naming a missing setting and never its value.
  2. First step of the item: check (verify) whether TypeScript 7.0.2 offers the JavaScript compiler API that the scan reads syntax trees through, and whether the web-worker library and options of the core's configuration compile under it. If the API is absent, name a pinned parser as a `devDependency`, or a pinned 5.x `typescript` used only for the scan, by ADR-0011, and say which; do not change the core.
  3. The markers are `REQ-103 AC1` to `REQ-103 AC6`. The core has no runtime dependency and no host-specific import or global.
- Branch: chore/portable-core
- Size: M
- Expected: 3-5 hours

### Item 4 — Secure responses, the one guard for GitHub calls and the declared permissions (REQ-104 AC1 to AC6 and AC8)

- Advances: REQ-104
- Scope: `site/src/core/` (the function that sets the four headers and the policy, the fixed pages, the stylesheet route, the single outbound function that allows GET and the one sign-in POST), `github-app-manifest.json` (no secret), `site/tests/security.test.ts`. No other path.
- Needs: nothing.
- Acceptance:
  1. Tests first, shown failing on the base: every response (page, stylesheet, redirect, refusal) carries the exact policy with no `unsafe-` keyword, `X-Content-Type-Options`, `Referrer-Policy` and `Strict-Transport-Security`; signed-in and sign-in responses carry `Cache-Control: no-store`; pages have no script, event handler, inline style or `<style>`; the callback answers 303 and leaves no code or state in a URL; `console` is spied during the paths and no fixture token, code, cookie or key appears; no URL, link, redirect or form action holds one; the manifest declares exactly `actions: read` and `metadata: read`, `expire_user_authorization_tokens: true` and no secret; the outbound function sends a GET and the one allowed POST and refuses a PUT, a DELETE, a PATCH and a POST to another address before any request is made, and a scan finds no other use of `fetch` to GitHub in the core.
  2. The markers are `REQ-104 AC1` to `REQ-104 AC6` and `REQ-104 AC8`. `REQ-104 AC7` (the run-time permission check) is built in Item 7, where the installation listing is fetched.
- Branch: chore/secure-responses
- Size: M
- Expected: 3-5 hours

### Item 5 — Sign-in: the OAuth flow and the state (REQ-102 AC1 to AC3)

- Advances: REQ-102
- Scope: `site/src/core/` (the sign-in offer, the `__Host-state` cookie, the redirect to GitHub, the callback's comparison in constant time and its refusal), `site/tests/signin.test.ts`. No other path.
- Needs: nothing (fake `Config` and recorded GitHub answers).
- Acceptance:
  1. Tests first, shown failing on the base: a visitor with no cookie sees only the fixed offer and no project name; the redirect carries a random state of at least 128 bits and sets the `__Host-state` cookie (10 minutes, `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`); a missing or different state, a missing cookie and a missing code each give the fixed refusal with no request to GitHub and no session cookie.
  2. The markers are `REQ-102 AC1`, `REQ-102 AC2` and `REQ-102 AC3`.
- Branch: chore/signin-flow
- Size: M
- Expected: 3-5 hours

### Item 6 — The stateless session and sign-out (REQ-102 AC4 to AC8)

- Advances: REQ-102
- Scope: `site/src/core/` (the token exchange through the guard, the `__Host-session` cookie with AES-256-GCM, the lifetime, the bad-cookie handling, the POST-only sign-out, the empty-list phrase), `site/tests/session.test.ts`. No other path.
- Needs: nothing (fake session key).
- Acceptance:
  1. Tests first, shown failing on the base: a recorded token answer gives one cookie whose plaintext is the token and its expiry only, with the flags, the smaller of 8 hours and the token's expiry, and no refresh token even when the answer holds one; a cookie made by one instance is read by a second instance that shares only the key, and no storage is touched; an expired cookie, a cookie with one flipped byte, a missing cookie and a cookie under another key each give the fixed expiry phrase, the cleared cookie and no token use; a POST signs out and calls nothing at GitHub, a GET does not sign out; an empty list gives the fixed phrase and no project name.
  2. The markers are `REQ-102 AC4` to `REQ-102 AC8`. The GitHub answers' addresses and field names are confirmed against recorded answers and any gap stays `(verify)`.
- Branch: chore/session
- Size: M
- Expected: 3-5 hours

### Item 7 — The data step: the per-person list and the facts (REQ-101 AC1 to AC7 and REQ-104 AC7)

- Advances: REQ-101
- Scope: `site/src/core/` (the installation and repository listing with the user token, the artifact list and download, the schema check, the cards "not known yet" with their reasons, the local failure of one repository, the run-time permission check), `site/tests/facts.test.ts`, recorded GitHub answers under `site/tests/fixtures/`. The throwaway workflow `.github/workflows/app-device-flow-proof.yml` is removed in this pull request, as ruled (Q-B1-3), with `docs/adr/0012-remove-device-flow-proof.md` naming `.github/`.
- Needs: the access record of Item 2 showing a 200 (otherwise stop).
- Acceptance:
  1. Tests first, shown failing on the base, one group per criterion of REQ-101 AC1 to AC7 and of REQ-104 AC7: listing keeps only unexpired `agk-facts-<week>` and downloads the latest week with the person's token; schema 1 reaches the page unchanged, with or without `kit_version`; a schema other than 1, a missing schema and invalid JSON give "not known yet" with that reason; no artifact gives "not known yet" with the no-artifact reason; a 403, a 404 and a 500 on one repository give that card its status while the others are read and the page does not fail; a repository the person cannot read is never listed, named or counted; no write call and no other credential; an installation with an extra or a write permission refuses that person with the fixed phrase.
  2. Fixtures hold recorded answers with no token and no signed address. The field name of the permissions in the installation listing stays `(verify)` until a recorded answer shows it.
  3. The markers are `REQ-101 AC1` to `REQ-101 AC7` and `REQ-104 AC7`. `REQ-101 AC8` is the record of Item 2.
- Branch: chore/facts-data-step
- Size: L
- Expected: 6-10 hours

### Item 8 — The Cloudflare adapter (REQ-103 AC7 and AC8)

- Advances: REQ-103
- Scope: `site/src/adapters/cloudflare/`, `site/tests/adapter-cloudflare.test.ts`. No other path.
- Needs: nothing (fake `env` and request, in Node).
- Acceptance:
  1. Tests first, shown failing on the base: the adapter's `fetch` handler fills `Config` from a fake `env` (the secrets and variables), passes the request to the core and returns the core's response unchanged; it hands the core no `env`, no binding and no context; a missing setting gives the core's refusal naming the setting and not the value.
  2. The markers are `REQ-103 AC7` and `REQ-103 AC8`. The AWS Lambda/Node adapter is not built and no test depends on its absence.
- Branch: chore/cloudflare-adapter
- Size: S
- Expected: 1-2 hours

### Item 9 — The first live deployment

- Advances: REQ-101
- Scope: `site/wrangler.toml` (or the host's equivalent; names no secret), `docs/runs/deploy-cloudflare.md` (the steps and the commands the maintainers run by hand), `docs/adr/0013-deploy-cloudflare-workers.md`. No other path. No deploy workflow and no deploy credential in this item.
- Needs: the real App credentials and the session key set by the maintainers in Cloudflare's secret store, the callback address, the App created to match `github-app-manifest.json`, and the deployment decision of Q-B2-1.
- Acceptance:
  1. The runbook lists each secret and variable by name only, the commands for the first deploy, and how to check the response headers of the live page against SPEC-0004 rule 1.
  2. After the maintainers deploy, the record of what they read on the live page (headers, the sign-in offer and no project name when signed out) is added by them or by a docs-only pull request the builder writes from their words.
- Branch: chore/deploy-cloudflare
- Size: M
- Expected: 2-4 hours

## Open questions

- Q-B2-1 How is the Worker published? The reading chosen: no deploy workflow and no deploy credential in this brief; the maintainers run the first deploy by hand from the runbook of Item 9. The alternatives are a workflow in `.github/` that runs the host's deploy command with a Cloudflare token that the maintainers store as a GitHub secret (a secret in GitHub, which ADR-0006 does not yet decide), or the host's own Git integration. The maintainers decide; an ADR follows either way.
- Q-B2-2 The sections of milestone M2 (This week, Requirements, Trend, All projects), the cost, and the trend over several weeks are not covered by REQ-101 to REQ-104, which hold the data and the access only. They enter by their own one-sentence intakes after Item 7, questions first. The reading chosen: they are not items of this brief.
- Q-B2-3 Item 1 can only be run after it is merged, because a `workflow_dispatch` workflow must exist on the default branch to be started. The reading chosen: Item 1 merges first, the maintainers run it, and Item 2 records the result; no item after Item 2 starts without a 200 on the record.

## Report format

The PR body for each item contains:

- Advances: REQ-nnn
- Build-state row: Date | Change | REQs
- Decisions taken: one line each, with the brief section it came from
- Brief: <path>#<item>, with the item's Size: and Expected: lines copied unchanged
- Questions: the Q list
- Verified: commands run and their results, verbatim counts
