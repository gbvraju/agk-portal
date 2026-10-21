# SPEC-0002: A person signs in with GitHub and keeps a stateless session

- Status: Draft
- Owner: maintainers
- Requirements: REQ-102

Status is `Draft` or `Approved`. An Approved spec is owned by its reviewer group; agents propose patches.
Written by the intake of one sentence, as data: "A person signs in with GitHub through the GitHub App, and the server keeps them signed in with an encrypted, signed cookie that expires within 8 hours, holds the user token and nothing else, and needs no database or host storage." It follows ADR-0006 (decisions 1, 5 and 6) and is the first of the three intakes of ADR-0006 decision 10. The maintainers answered three questions on 2026-10-21: this spec holds the OAuth web flow with the state parameter against CSRF (state bound to the browser and checked on return), the cookie's content, encryption, signature and expiry, the cookie flags (Secure, HttpOnly, SameSite=Lax), sign-out and the expiry phrase; the Content-Security-Policy, "tokens never logged or put in a URL", the App-permissions test and the no-write-call test belong to the security-defaults intake, and milestone M3 waits for both; sign-out clears the cookie only and calls nothing; there is one session key and rotating it signs everyone out. The fixed phrases below are proposed wording for the maintainers to review.

## Rules

1. **The sign-in offer.** A visitor who is not signed in sees only the sign-in offer: the fixed phrase "Sign in with GitHub" as a link that starts rule 2. The response names no project, no repository and no organisation.
2. **Starting sign-in.** The server creates a random `state` value of at least 128 bits with Web Crypto, binds it to the visitor's browser in a short-lived cookie named `__Host-state` (10 minutes, `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`; the `__Host-` prefix requires `Secure`, `Path=/` and no `Domain`) and redirects to the GitHub App's authorization address with the App's client id, the callback address and the `state`. Nothing is stored on the server.
3. **The return.** On the callback the server compares the `state` of the request with the one in the browser's cookie in constant time. A missing or different `state`, a missing cookie or a missing `code` makes the server refuse: no request to GitHub is made, no session is set, the short-lived cookie is cleared, and the visitor sees the sign-in offer with the fixed phrase "Sign-in could not be completed. Sign in with GitHub to try again."
4. **The token.** With a matching `state` the server exchanges the `code` for the user-to-server token using the App's client id and client secret, the secret coming from the configuration interface of ADR-0006 decision 4 and never from the code. This exchange is the one POST the server sends to GitHub; it creates no data at GitHub and is not a write call in the sense of the project rules (Q-S0002-1). The server keeps the token and its expiry and nothing else of the answer: a refresh token, if the answer holds one, is dropped, never stored and never put in the cookie.
5. **The cookie.** One cookie named `__Host-session` holds the encrypted, signed session: AES-256-GCM through Web Crypto with a random 96-bit nonce for each cookie, the authentication tag being the signature, under the one session key that the maintainers set in the host's secret store and the adapter hands to the core (ADR-0006 decisions 4 and 6). The plaintext is the token and its expiry and nothing else. The flags are `Secure`, `HttpOnly` and `SameSite=Lax`, with `Path=/` and no `Domain`. The cookie is set only in a response that completes a successful sign-in.
6. **The lifetime.** The expiry is the smaller of 8 hours after sign-in and the token's own expiry; the cookie's `Max-Age` is the same, and the server also checks the expiry inside the plaintext on every request. If the App's answer carries no token expiry, the session lasts 8 hours (verify, see the residuals).
7. **Stateless.** Reading or writing the session uses no database, key-value store or host storage. Any instance of the server that has the session key answers any request. There is one session key, and replacing it signs everyone out: every cookie then fails rule 8.
8. **A bad cookie is signed out.** A cookie that is missing, expired, shorter than expected, not decrypted, not authenticated or made under another key means the person is not signed in: the response is the sign-in offer with the fixed phrase "Your session has ended. Sign in with GitHub to continue.", the cookie is cleared, no token is used, and no error status or detail about the reason is shown.
9. **Sign out.** A POST to the sign-out address clears the session cookie (`Max-Age=0`, same name and flags), calls nothing at GitHub and answers with the sign-in offer. A GET to the sign-out address does not sign anyone out. The token stays valid at GitHub until it expires (residual).
10. **Nothing readable.** A signed-in person who can read no repository on which the App is installed sees the fixed phrase "No projects are available to you yet." and no project name; the page is not blank. (The list itself is REQ-101.)
11. **Tests.** The tests are TypeScript files named `*.test.ts` under `site/tests/`, run by the npm command in `agk.toml` `project_tests`, each carrying the marker `REQ-102 ACn` it proves. They use Web Crypto, recorded GitHub answers and no network. A test builds two separate instances of the core that share only the session key.

## Tests

- Rule 1: a request with no cookie is answered with the sign-in offer and no project name; REQ-102 AC1.
- Rule 2: the redirect carries a state of at least 128 bits, and the browser cookie that holds it is named with the `__Host-` prefix and has `Path=/`, the flags and a 10-minute lifetime; REQ-102 AC2.
- Rule 3: a missing state, a different state, a missing cookie and a missing code each give the refusal, with no request to GitHub, no session cookie and the short-lived cookie cleared; REQ-102 AC3.
- Rules 4 to 6: a recorded token answer gives one cookie whose plaintext is the token and its expiry only, with the flags, the smaller expiry, and no refresh token even when the answer holds one; REQ-102 AC4.
- Rule 7: a cookie made by one instance is read by a second instance that shares only the key, and the sessions code reads and writes no storage; REQ-102 AC5.
- Rule 8: an expired cookie, a cookie with one flipped byte, a missing cookie and a cookie made under another key each give the expiry phrase, the cleared cookie and no token use; REQ-102 AC6.
- Rule 9: a POST to sign out clears the cookie and makes no call to GitHub, and a GET does not sign out; REQ-102 AC7.
- Rule 10: a signed-in person with an empty list sees the fixed phrase and no project name; REQ-102 AC8.

## Proof

REQ-102 AC1 to AC3: *only the sign-in offer is seen until GitHub has confirmed the person, and a forged return is refused.* Rules 1 to 3. REQ-102 AC4 to AC6: *the session is a cookie that holds the token and nothing else, expires in at most 8 hours, and works on any instance.* Rules 4 to 8. REQ-102 AC7 and AC8: *signing out and an empty list are said, not hidden.* Rules 9 and 10. The maintainers read the tests and the cookie's flags in a response before the milestone M3 is built.

## Residual

- 2026-10-21: after sign-out the token stays valid at GitHub until it expires, at most 8 hours (due 2026-12-31).
- 2026-10-21: the 8-hour token expiry depends on the App's "expire user authorization tokens" setting being on (verify); the maintainers set it when they create the App, and if it is off the token has no expiry and the 8-hour cookie is the only limit (due 2026-11-30).
- 2026-10-21: the GitHub App's authorization and token addresses, the shape of the token answer and the name of its expiry field are from memory of GitHub's documentation, which was not read here (verify); the build confirms them against a recorded answer (due 2026-11-30).
- 2026-10-21: replacing the one session key signs everyone out; no rotation with two keys is built (due 2026-12-31).
- 2026-10-21: the security-defaults intake holds the Content-Security-Policy, the rule that tokens are never logged or put in a URL, the App-permissions test and the no-write-call test; M3 waits for both intakes (due 2026-11-30).

## Open questions

- Q-S0002-1 The code-for-token exchange is a POST to GitHub, while the project rules say the server makes no write call to GitHub. The criteria assume this one POST, to the token address only, creates no data at GitHub and is allowed, and that the no-write-call test of the security-defaults intake allow-lists exactly that address and nothing else.
  Ruled 2026-10-21 by the maintainers: as read. The code-for-token exchange is the one allowed POST, allow-listed by exact address; SPEC-0004 rule 8 enforces it and no other POST is allowed.

Ruled 2026-10-21 by the maintainers: the fixed phrases of rules 1, 3, 8 and 10 are accepted as written. Rule 2 is tightened: the state cookie is also `__Host-` prefixed, and both cookies carry `Path=/` (applied to the rule text above; the spec is still Draft).
