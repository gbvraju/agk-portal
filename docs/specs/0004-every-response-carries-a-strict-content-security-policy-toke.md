# SPEC-0004: Responses are secure by default and the server never writes to GitHub

- Status: Approved
- Owner: maintainers
- Requirements: REQ-104

Status is `Draft` or `Approved`. An Approved spec is owned by its reviewer group; agents propose patches.
Written by the intake of one sentence, as data: "Every response carries a strict Content-Security-Policy, tokens are never logged or put in a URL, and tests fail if the GitHub App's declared permissions exceed Actions read and Metadata read or if the server makes any GitHub call that writes, except the one sign-in token exchange." It follows ADR-0006 decision 7 and is the third of the three intakes of ADR-0006 decision 10; milestone M3 waits for this spec and SPEC-0002. The maintainers answered three questions on 2026-10-21: the page has no script at all (server-rendered HTML, one same-origin stylesheet, sign-out as a POST form), under the policy written below with no `unsafe-*` and no inline style, and a later slice that needs script amends it by ADR; the four response headers below go on every response, with `Cache-Control: no-store` on every signed-in and sign-in response and the 303 redirect from the callback; the App's declared permissions are a committed file, `github-app-manifest.json` with no secret, that the maintainers match by hand in GitHub's settings (no manifest-flow code exchange, which would return secrets to the code), and the run-time check reads the permissions from the installation listing the server already fetches for the person and adds no GitHub call. The state parameter and the cookie flags are in SPEC-0002 and are not repeated here. The fixed phrases below are proposed wording for review.

## Rules

1. **The policy and the headers.** Every response of the server, including the stylesheet, a redirect and a refusal, carries these headers: `Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`, with no `unsafe-inline`, `unsafe-eval` or any other `unsafe-` keyword; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`; `Strict-Transport-Security: max-age=31536000; includeSubDomains`; and `Permissions-Policy`, which denies every browser feature of the current list with an empty allowlist (`feature=()`, for example `camera=()`, `microphone=()`, `geolocation=()`, `payment=()`, `usb=()`), the page using none; the list is the W3C Permissions Policy features list (standardized, proposed and experimental) as read on 2026-10-22, held in `site/src/core/responses.ts`, without the client-hint family `ch-ua*` and without `interest-cohort`, which is no longer on the list. One function in the core sets them, so no response is built without them.
2. **No script, no inline style.** The pages are server-rendered HTML with no `<script>`, no event-handler attribute, no inline `style` attribute and no `<style>` element. The one stylesheet is served from the same origin. Sign-out is a POST form. Every signed-in and sign-in response also carries `Cache-Control: no-store`.
3. **The callback leaves no code behind.** The OAuth callback, whether it completes the sign-in or refuses it (SPEC-0002 rules 3 and 4), answers with a 303 redirect to the home page. The `code` and the `state` of the request are in no URL the server sends, and `Referrer-Policy: no-referrer` keeps them from any other site.
4. **Nothing secret is logged.** The core never calls `console` or any logger. The adapter may log only a fixed event name from a short list and nothing taken from a request. An unhandled error produces a fixed page ("Something went wrong. Please try again.") with no detail and no stack. A token, a code, a cookie value and the session key appear in no output.
5. **Nothing secret is in a URL.** No token, code or cookie value is put in any URL the server sends, in a link, a redirect or a form action, or in the address of an outbound request. Calls to GitHub carry the token only in the `Authorization` header.
6. **The declared permissions.** The repository holds `github-app-manifest.json`, with no secret. It declares the App's `permissions` as exactly `{ "actions": "read", "metadata": "read" }` and `expire_user_authorization_tokens` as `true`, and its callback address. The maintainers create the App by hand to match it in GitHub's settings; the file is the declared source, not input to a flow. The shape of the file is this project's own, not GitHub's manifest format (see the residuals).
7. **The run-time permission check.** The installation listing the server fetches for the person (REQ-101 rule 1) carries each installation's `permissions` (the field name is from memory, verify). The server serves a person only the installations whose `permissions` are exactly `actions: read` and `metadata: read`. When an installation grants anything beyond them, or any write, the server shows no project and shows the fixed phrase "This GitHub App has more access than this portal allows. Ask your administrator to review it." It adds no GitHub call for this check.
8. **Reads only.** Every request the server makes to GitHub goes through one function in the core, which checks the method and the address before sending and refuses otherwise (fail closed). It allows GET, and exactly one POST: the code-for-token exchange of SPEC-0002 rule 4, at its exact address (verify, see SPEC-0002 residuals). No other method and no other POST address is allowed. A test scans the core for any other use of `fetch` to GitHub.
9. **Tests.** The tests are TypeScript files named `*.test.ts` under `site/tests/`, run by the npm command in `agk.toml` `project_tests`, each carrying the marker `REQ-104 ACn` it proves. They use fixture tokens, codes and a session key, recorded GitHub answers and no network; they capture `console`, response headers and bodies, and the outbound requests.

## Tests

- Rule 1: every response of the page, the stylesheet, a redirect and a refusal carries the five headers with the exact policy and no `unsafe-` keyword, the Permissions-Policy denying each feature of the list with an empty allowlist; REQ-104 AC1.
- Rule 2: signed-in and sign-in responses carry `Cache-Control: no-store`, and no page holds a script, an event handler, an inline style or a `<style>` element; REQ-104 AC2.
- Rule 3: a completed callback and a refused callback each answer 303 to the home page, with the code and the state in no URL sent; REQ-104 AC3.
- Rule 4: the whole sign-in, session, sign-out and failure paths run with fixture tokens, codes and a key; no console output holds any of them and no error detail reaches the response; REQ-104 AC4.
- Rule 5: no URL, link, redirect or form action of a response, and no outbound request address, holds a token, a code or a cookie value, and each GitHub call carries the token only in `Authorization`; REQ-104 AC5.
- Rule 6: `github-app-manifest.json` declares exactly `actions: read` and `metadata: read`, `expire_user_authorization_tokens: true`, and holds no secret; REQ-104 AC6.
- Rule 7: an installation with an extra permission, and one with a write permission, make the server refuse that person with the fixed phrase and show no project, with no added GitHub call; REQ-104 AC7.
- Rule 8: a GET is sent, the one allowed POST is sent, and a PUT, a DELETE, a PATCH and a POST to another address are each refused before any request is made; REQ-104 AC8.

## Proof

REQ-104 AC1 to AC3: *every response is locked down, carries no script, and the callback leaves nothing in the address bar.* Rules 1 to 3. REQ-104 AC4 and AC5: *no secret is logged or put in a URL.* Rules 4 and 5. REQ-104 AC6 and AC7: *the App has only the two read permissions, declared and checked.* Rules 6 and 7. REQ-104 AC8: *the server never writes to GitHub, except the one sign-in exchange.* Rule 8. The maintainers read the headers of a live response and the manifest against GitHub's settings before milestone M3 is built.

## Residual

- 2026-10-21: the field name and shape of the permissions in the installation listing are from memory of GitHub's documentation, which was not read here (verify) (due 2026-11-30).
- 2026-10-21: `github-app-manifest.json` is this project's own declaration, not GitHub's app-manifest format; whether GitHub's settings can express "expire user authorization tokens" as stated is checked by the maintainers when they create the App (verify) (due 2026-11-30).
- 2026-10-21: the maintainers match the App's settings in GitHub by hand to the file; nothing proves GitHub's settings equal the file except the run-time check of rule 7 on the permissions (due 2026-12-31).
- 2026-10-21: the host's own runtime may log unhandled errors outside the core's control; the adapter catches errors and answers with the fixed page, and the deployment brief checks the host's logs (due 2026-11-30).
- 2026-10-21: a later slice that needs script amends the Content-Security-Policy by ADR (due 2026-12-31).

## Open questions

none

Ruled 2026-10-21 by the maintainers: the fixed phrases of rules 4 and 7 are accepted as written.
