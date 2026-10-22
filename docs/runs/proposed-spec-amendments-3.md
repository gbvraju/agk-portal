# Proposed spec amendments 3 (SPEC-0004)

Date: 2026-10-22 (from `date -u`). Approved specs are changed only through a proposal like this one (principle 6), applied by an ADR (ADR-0018). SPEC-0004 is `docs/specs/0004-every-response-carries-a-strict-content-security-policy-toke.md`.

## Amendment 5 — rule 1, the policy and the headers

**Reason.** The header scan of the staging address (securityheaders.com, 2026-10-22, grade A) found the Permissions-Policy header missing. The page uses no browser feature (no script, no embedded content, no media), so every feature can be denied.

**Old text.** 1. **The policy and the headers.** Every response of the server, including the stylesheet, a redirect and a refusal, carries these headers: `Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`, with no `unsafe-inline`, `unsafe-eval` or any other `unsafe-` keyword; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`; and `Strict-Transport-Security: max-age=31536000; includeSubDomains`. One function in the core sets them, so no response is built without them.

**New text.**

> 1. **The policy and the headers.** Every response of the server, including the stylesheet, a redirect and a refusal, carries these headers: `Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`, with no `unsafe-inline`, `unsafe-eval` or any other `unsafe-` keyword; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`; `Strict-Transport-Security: max-age=31536000; includeSubDomains`; and `Permissions-Policy`, which denies every browser feature of the current list with an empty allowlist (`feature=()`, for example `camera=()`, `microphone=()`, `geolocation=()`, `payment=()`, `usb=()`), the page using none; the list is the W3C Permissions Policy features list (standardized, proposed and experimental) as read on 2026-10-22, held in `site/src/core/responses.ts`, without the client-hint family `ch-ua*` and without `interest-cohort`, which is no longer on the list. One function in the core sets them, so no response is built without them.

**Tests.** Tests: rule 1 (REQ-104 AC1), in `site/tests/permissions-policy.test.ts`.
