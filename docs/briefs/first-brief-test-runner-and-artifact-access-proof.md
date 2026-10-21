# Brief: First brief: test runner and artifact access proof

Written in the architect role (`.claude/agents/architect.md`) in an ordinary session: its tool list and guard hook are not enforced here, only the rules of the file bind. Date 2026-10-21. Implements SPEC-0001 (Approved) for REQ-101, milestone M1 of ADR-0002. Each item is built later as its own pull request, branched from the default branch, tests first, one open pull request at a time.

## Rules block

Operating rules that apply to every item (`constitution/principles.md` by number; `CLAUDE.md` for the short form):

- Principle 1: `agk.toml` and `.github/` are protected paths; a change to either carries an ADR in the same pull request that names each class (`agk.toml`, `.github/`).
- Principle 2: never merge, enable auto-merge, or bypass a check. Principle 11: no check is weakened to go green.
- Principle 3: one pull request per item, branched from `origin/main`, never stacked.
- Principle 5 and `CLAUDE.md` rule 4: tests first; every test carries its `REQ-101 ACn` marker; nothing is marked done by the builder.
- Principle 7: a fact about GitHub or the runner that is not confirmed is marked `(verify)` in the file and in the pull request body, and an unconfirmed fact is a question, not a guess.
- Principle 9 and `CLAUDE.md` rule 5: no secret anywhere, no personal access token, no App; no network call in a check. The only credential is the workflow's own `github.token`.
- Principle 10: dates from `date -u`; the pull request body states `Advances:`.
- No kit workflow (`.github/workflows/drift-audit.yml`, `governance.yml`, `metrics.yml`, `product-report.yml`, `proof.yml`) and no kit file (`.gitignore`, `Makefile`, `agk.mk`, `scripts/agk/`) is edited; the doctor's hash check and `agk upgrade` depend on them.
- Principle 12: on ambiguity or a refusal, stop and report; do not widen the item.

## Items

### Item 1 — The TypeScript test runner

- Advances: REQ-101
- Scope: `site/package.json`, `site/package-lock.json`, `site/tsconfig.json`, `site/.gitignore`, `site/tests/marker-scan.test.ts`, `agk.toml`, `docs/adr/0005-typescript-test-runner.md`. No other path.
- Acceptance:
  1. `site/package.json` is private, has an `engines.node` range that contains the Node version the `ubuntu-latest` runner image lists (checked against the runner-images documentation at build time, `(verify)`; the cloud checkout has Node v22.22.0 and npm 10.9.4, which is not the runner), pins every `devDependencies` entry to an exact version (no `^`, no `~`) looked up at build time, and has an `npm test` script; `site/package-lock.json` is committed and the install is `npm ci`.
  2. `agk.toml` sets `test_dirs = ["site/tests"]`, `test_patterns = ["*.test.ts"]` and `project_tests = "cd site && npm ci --ignore-scripts && npm test"`, and no other key changes. `load_config` takes `test_patterns` from `agk.toml` (confirmed on 2026-10-21 with `config.py test_patterns`).
  3. `site/tests/marker-scan.test.ts` is the placeholder test: it proves the kit's marker scan finds a `REQ-101 ACn` marker in a `*.test.ts` file by creating a fixture file in a temporary directory (no network, standard-library Python of `scripts/agk/` only), and it assembles the marker text from parts so that no literal `REQ-101 ACn` marker sits in a tracked file (a marker in a comment or a string counts alike, so a literal would claim an acceptance criterion this test does not prove).
  4. `site/.gitignore` ignores `node_modules/` and `dist/`; the kit's root `.gitignore` is not edited (Q-B1-1).
  5. ADR-0005 is Proposed, names `agk.toml`, and sits in the same pull request. No file under `.github/` is edited.
  6. Tests first: the placeholder test is committed before the runner it needs is complete, and the `proof` workflow shows red on the base and green on the head (`outcome: proven`). `make governance` all ok and `make test` exit 0 are read before the push.
- Branch: chore/ts-test-runner
- Size: S
- Expected: 1-2 hours

### Item 2 — The throwaway access proof (SPEC-0001 rule 9)

- Status: superseded by ADR-0006 (the access model moves to a GitHub App and a server; a new brief follows). Do not build this item.
- Advances: REQ-101
- Scope: `.github/workflows/artifact-access-proof.yml` (a new file), `site/tests/proof-workflow.test.ts`, `docs/runs/artifact-access-proof.md`, `docs/adr/0006-artifact-access-proof.md`. No other path.
- Acceptance:
  1. Tests first: `site/tests/proof-workflow.test.ts` reads the workflow file as text and fails when it contains a `secrets.` reference, any credential other than `github.token`, permissions other than `contents: read` and `actions: read`, an HTTP method other than GET, or an endpoint other than the artifact list and the artifact zip download; it carries the markers `REQ-101 AC6` and `REQ-101 AC7`. It uses no network.
  2. The workflow is new, its header says it is throwaway and that its removal is the maintainers' decision after they read the record, and no kit workflow is edited. It runs on `pull_request`, authenticates only with `${{ github.token }}` and uses no secret.
  3. For a target repository named in the workflow, it calls `GET /repos/{owner}/{repo}/actions/artifacts` (list), picks the first artifact that has not expired, then calls `GET /repos/{owner}/{repo}/actions/artifacts/{id}/zip` (download), and prints each call as `METHOD URL -> HTTP status` (the redirect and the final transfer are two lines). As a control it repeats both calls without a token. It never prints the token. A refused status is recorded, not hidden; the job fails only if the workflow itself breaks.
  4. First target: any public repository, other than this one, that has an artifact created in the last 7 days; the builder picks it at build time and records why (for example the CI of an `actions/*` repository, `(verify)` that it keeps one). Second target, only on the maintainers' word that `gbvraju/agk` publishes `agk-facts-<week>`: `gbvraju/agk`, as a further commit on the same pull request, with the record extended.
  5. `docs/runs/artifact-access-proof.md` records, per run: the date from `date -u`, the run URL, the target and why it was chosen, each call with its method, URL and HTTP status, the control calls, and what failed. The lines are copied from the run log.
  6. Stop rule: if the list or the download with the workflow's own token returns 401, 403 or 404, the builder stops, records it, adds no secret and no workaround, and raises a question; the maintainers decide the fallback. Whether the workflow's own token can read another public repository's artifacts stays `(verify)` until a 200 is recorded.
  7. ADR-0006 is Proposed, names `.github/`, and sits in the same pull request.
- Branch: chore/artifact-access-proof
- Size: M
- Expected: 2-4 hours

## Open questions

- Q-B1-1 Where does the TypeScript project live? The reading chosen is `site/`: the kit's root `.gitignore` is a kit-managed file (the upgrade and the doctor hash it), so it is not edited, and a nested `site/.gitignore` keeps `node_modules/` and `dist/` out of the tree. The alternative is a root `package.json` with an edit of the kit's `.gitignore`, which needs the maintainers' ruling. Confirm `site/`, or rule otherwise.
- Q-B1-2 Does the `proof` workflow's red-then-green work for `project_tests` that run `npm ci`? The reading chosen: on the base the pull request's test file is placed in a worktree without `site/package.json`, so `cd site` fails (red), and on the head the command passes (green). This is confirmed only by the CI run of Item 1 `(verify)`; if the outcome is `not-proven` or `unknown`, the builder reports the reason that the step names and stops.
- Q-B1-3 Who removes the throwaway workflow, and when? The reading chosen: the maintainers decide after reading the record, in a pull request of its own; it is not an item of this brief.

## Report format

The PR body for each item contains:

- Advances: REQ-nnn
- Build-state row: Date | Change | REQs
- Decisions taken: one line each, with the brief section it came from
- Brief: <path>#<item>, with the item's Size: and Expected: lines copied unchanged
- Questions: the Q list
- Verified: commands run and their results, verbatim counts
