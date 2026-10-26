# ADR-0037: Upgrade agk from 0.55.0 to 0.56.0 and give the staging Worker a previews table

- Status: Accepted
- Date: 2026-10-26
- Deciders: maintainers
- Related: ADR-0016, ADR-0034
- Requirements: REQ-101

Protected classes: `.claude/`, `.github/`, `config/`, `pyproject.toml`, `scripts/agk/`, `agk.toml`

## Context

The check `Workers Builds: agk-portal-staging` failed on every pull request and passed on every commit of `main` (measured on issue #72: 8 of 8 pull-request heads against 12 of 12 `main` commits). From the two build logs the maintainer pasted (a `main` build and a pull-request build), the conductor measured two causes, in order. First, the `main` build detects Node in `site` (`npm clean-install`, then `npx wrangler deploy`), while the pull-request build detects no tools and runs `pip install .` at the repository root; that step failed on the flat layout of the root `pyproject.toml` (the kit's template; a trial that made it pass, #74, was closed because the build still failed). Second, the pull-request deploy command is `npx wrangler preview`, Cloudflare's new Previews command (open beta), which stops with "Your Wrangler configuration is missing a `previews` block to run this command". The first cause is the kit's (agk brief #236) and is fixed in agk 0.56.0, whose upgrade plan adds `[build-system]` and `[tool.setuptools] packages = []` to the root `pyproject.toml` of every project that still has the template's. The second is the portal's own file. Since agk 0.55.0 the router read every check, so every portal pull request was labelled `agk:ci-red` while the required checks were green; agk 0.56.0 judges a pull request by `required_checks` only.

## Decision

1. The install is upgraded from 0.55.0 to 0.56.0 by one run of the kit's `scripts/agk/upgrade.py` from a checkout of the tag v0.56.0 (commit 9034c71), a dry run first and then for real (`dry run: 21 files would change`, then the same 21 files plus the version line of `agk.toml`). It replaced `.claude/agents/conductor.md`, `.claude/hooks/conductor_guard.py`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/agk-route.yml`, `.github/workflows/governance.yml`, `.github/workflows/proof.yml`, `config/session-rules.md`, `pyproject.toml` (it added `[build-system]` and `[tool.setuptools] packages = []`; no other line changed) and ten files of `scripts/agk/` (`check_final_clearance.py`, `check_pr_body.py`, `check_specs.py`, `common.py`, `facts.py`, `product_report.py`, `reviewers.py`, `route.py`, `session.py`), and created `.claude/agents/shadow.md` and `scripts/agk/full_run.py`, `shadow_rate.py` and `status_only.py`. No installed file was edited by hand, and `pyproject.toml` was changed by the upgrade only.
2. `agk.toml` changes only its `version` line. The upgrade reported two template keys that this file does not have: `required_checks = ["proof", "governance"]` and `agent_apps = ["claude"]`. Both are the kit's defaults when the key is absent, so no key is added: the router judges a pull request by `proof` and `governance` only, and the staging check, a preview build of a hosting service, no longer paints a pull request red either way. `pr_mode` stays `strict` (no key added).
3. `site/wrangler.toml` gains an empty `[previews]` table, the second cause: the build of a pull request runs `npx wrangler preview`, which needs the table, and the table may be empty. It names no binding, no route and no account. No setting in the hosting provider's dashboard changes, and the Worker that `main` deploys is unchanged.
4. The proof is the check `Workers Builds: agk-portal-staging` green on this pull request. If it stays red, the failing lines of the new build go on issue #72 in a `Measured:` line, and nothing else is changed.
5. `.claude/`, `.github/`, `config/`, `pyproject.toml`, `scripts/agk/` and `agk.toml` are protected paths, so this change needs this ADR in the same pull request, naming each.

## Consequences

- A red staging check on a pull request means something real again, and the router no longer labels a portal pull request `agk:ci-red` because of it.
- The kit's session rules, conductor guard, router, shadow review and status-only checks of 0.56.0 are installed; the router workflow and the new governance steps run on GitHub, so the first pull request after the merge shows them.

## Residual

- 2026-10-26: both builds run Node 24, while `site/package.json` asks for `>=22 <23` (npm prints an EBADENGINE warning); it is noted here and not changed in this pull request (due 2026-12-31).
- 2026-10-26: the open residual of docs/runs/staging-record.md (Cloudflare pull-request builds fail on the kit's root `pyproject.toml`) is closed only when the check is green on this pull request (due 2026-11-30).
