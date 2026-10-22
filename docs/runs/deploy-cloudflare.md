# Runbook: the staging deployment on Cloudflare Workers

Date 2026-10-22. ADR-0016 (Proposed). This is what the maintainers do by hand. An agent never reads or writes a secret, and nothing here puts a value in a file, a pull request or a chat. There is no deploy workflow and no Cloudflare token in GitHub.

The Worker is `agk-portal-staging`. Its address is `https://agk-portal-staging.<your-subdomain>.workers.dev`, where `<your-subdomain>` is the workers.dev subdomain of your Cloudflare account (you see it in the dashboard).

## The four settings

| Name | Kind | Set in | Value |
| --- | --- | --- | --- |
| `GITHUB_APP_CLIENT_ID` | variable (public) | Cloudflare, Worker settings, Variables and Secrets | the App's client id (shown on the App's settings page) |
| `CALLBACK_URL` | variable (public) | Cloudflare, Worker settings, Variables and Secrets | the Worker's address followed by `/callback` |
| `GITHUB_APP_CLIENT_SECRET` | secret | Cloudflare, Worker settings, Variables and Secrets (type: Secret) | a client secret generated on the App's settings page |
| `SESSION_KEY` | secret | Cloudflare, Worker settings, Variables and Secrets (type: Secret) | a random text of at least 32 characters that you generate yourselves |

Generate the session key on your own computer, for example with `openssl rand -base64 48`, and paste it only into Cloudflare. If the key is lost or changed, everyone is signed out; that is all.

## In GitHub

1. Create the GitHub App from `github-app-manifest.json` (Settings, Developer settings, GitHub Apps, New GitHub App): name for example "AGK portal (staging)"; permissions: Repository permissions, Actions: Read-only, Metadata: Read-only, and nothing else; Optional: leave "Expire user authorization tokens" ON; Callback URL: the `CALLBACK_URL` value above; Webhook: inactive; Device Flow: off; "Request user authorization (OAuth) during installation": off; Where can this App be installed: only on this account. (verify: the labels of these settings.)
2. On the App's page, copy the Client ID into the Cloudflare variable `GITHUB_APP_CLIENT_ID`, then Generate a new client secret and paste it straight into the Cloudflare secret `GITHUB_APP_CLIENT_SECRET`. The secret is shown once.
3. Install the App on the repositories to test, choosing Only select repositories: one private repository that has an `agk-facts-<week>` artifact (for example `gbvraju/agk-proof-private`), one that has none, and one that the test person cannot read.
4. In this repository's settings, Secrets and variables, Actions, Variables: the variable `APP_CLIENT_ID` is no longer used and may be deleted (ADR-0015).

## In Cloudflare

1. Workers & Pages, Create, import a repository (Workers Builds): connect GitHub and choose `gbvraju/agk-portal`.
2. Worker name: `agk-portal-staging` (it must equal the `name` in `site/wrangler.toml`). Production branch: `main`. Root directory: `site`. Build command: empty. Deploy command: `npx wrangler deploy`. Turn off builds for non-production branches. (verify: the names of these fields.)
3. In the Worker's settings keep the `workers.dev` route on and read the address.
4. Add the four settings of the table above. Until all four are set, the Worker answers 500 with a line naming the missing setting; that is expected and shows the refusal works.
5. If the first build ran before the merge of this pull request or before the settings existed, trigger a deployment from `main` (Deployments, retry, or push a docs-only commit; the maintainers choose).

## Checks after the first deployment

Run these from your own computer. Each must show what is written.

1. Signed out: `curl -sI https://agk-portal-staging.<your-subdomain>.workers.dev/` shows status 200 and these headers, exactly:
   - `Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: no-referrer`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Cache-Control: no-store`
   (The curl output for `/style.css` has the same four first headers and no `Cache-Control`.)
2. In a browser: the page offers sign-in and shows no project name.
3. Sign in with GitHub. Read the address bar on the GitHub page (only the host and path, never the code or state) and note that you returned to the portal address with nothing after it.
4. Signed in: the page lists the repositories of the installation you can read, each with a card: "Facts read for {week}." for the repository with an artifact, "Not known yet: no facts artifact exists for its latest week." for the one with none, and nothing at all for the one you cannot read. If a card says "Not known yet: GitHub answered {status}." or "the request to GitHub failed.", note which.
5. Sign out (the button). The page offers sign-in again.
6. Wait until 8 hours after a sign-in, or compare with the App's token expiry shown by the page's sign-out time, and note whether the session ended (the "Your session has ended" line).

## Unconfirmed facts this deployment settles

Each is marked `(verify)` in the repository. For each, the check that settles it:

- the authorization address and the parameters of the GitHub App's web flow: sign-in in check 3 works (or the page says "sign-in failed");
- the token answer and its expiry field: check 3, and the session lasting about 8 hours in check 6;
- the `permissions` field of an installation in the installations listing: check 4 shows the cards and not the line "has more access than this portal allows" (if that line appears for an installation you set to the two reads, the field is not as recorded);
- the installations listing and the repositories listing shapes: check 4 lists the repositories;
- the artifact listing fields and the download's 302 `Location`: check 4 reads a week for the repository with an artifact;
- the Workers module shape and the `env` values being text: checks 1 and 3 work and no 500 names a setting you set;
- the 8 hours of the session: check 6;
- an installation on selected repositories only (least access): check 4 with the repositories chosen in GitHub step 3;
- the `compatibility_date` and `keep_vars` of `site/wrangler.toml` and the Workers Builds fields: the first build and deployment succeed, and a redeploy keeps the four settings.

## What to send back

Send in the pull request thread or to the builder, in words (never a value): the output of the `curl -sI` command; what each card says; the text of any error page; which check failed and what you saw. Do not send a cookie, a token, a client secret, the session key, a signed address or a screenshot that shows one. The builder writes the record in `docs/runs/staging-record.md` by a docs-only pull request from your words, and opens a pull request with a test for each fact that turned out different.

## Undo

Cloudflare, the Worker, Deployments: roll back to the previous version; or turn off the `workers.dev` route; or delete the Worker. In GitHub, uninstall the App or delete it. Nothing else in this repository needs to change.
