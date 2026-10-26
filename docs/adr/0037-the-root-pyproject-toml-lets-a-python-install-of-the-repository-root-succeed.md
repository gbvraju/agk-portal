# ADR-0037: The root pyproject.toml lets a Python install of the repository root succeed

- Status: Proposed
- Date: 2026-10-26
- Deciders: maintainers
- Related: ADR-0016, ADR-0034
- Requirements: REQ-101

Protected classes: `pyproject.toml`

## Context

The hosting provider's check `Workers Builds: agk-portal-staging` fails on every pull request and passes on every commit of `main`: 8 of 8 pull-request heads (#57, #59, #61, #63, #65, #67, #71, #73) read failure and 12 of 12 `main` commits read success (measured on issue #72 from the check runs). Since the upgrade to agk 0.55.0 the router reads every check, so every pull request is labelled `agk:ci-red` while the required checks are green; a red check no longer always means something real. The maintainers recorded the cause on 2026-10-22 from the build log (docs/runs/staging-record.md): the build "detected the root `pyproject.toml` and tried a Python package install at the repository root (setuptools: multiple top-level packages)". The check run carries only a build id, so the log is not readable from here. What was reproduced locally: `pip install .` on a clean clone of `main` fails with `Multiple top-level packages discovered in a flat-layout: ['site', 'config', 'constitution']`, because the root `pyproject.toml` has a `[project]` table and neither a `[build-system]` nor a package list, while `site/` has no Python project file. The file is the kit's template `pyproject.toml`, rendered once at the install and owned by the project since (it is not a vendored file; the doctor's hash check does not cover it).

## Decision

1. The root `pyproject.toml` gains a `[build-system]` (setuptools, `setuptools.build_meta`) and `[tool.setuptools]` with `packages = []`: a Python install of the repository root now succeeds and installs nothing, instead of failing on the flat-layout discovery. Nothing else in the file changes: the `[project]` table and the pytest and ruff settings stay as the kit's checks read them. No installed kit file is edited, and no setting of the hosting provider is changed.
2. The cause is not fully confirmed (verify): that this is the step that fails in Cloudflare on pull-request builds, and why a `main` build does not run it, need the build log and the build settings, asked for in Q-B25-1 on issue #72. The proof of this change is the check `Workers Builds: agk-portal-staging` green on its own pull request; if it stays red, nothing else is changed and the maintainers' answer decides.
3. `pyproject.toml` is a protected path, so this change needs this ADR in the same pull request, naming it.

## Consequences

- If the cause is as measured, a red staging check on a pull request means something real again, and the router no longer labels every portal pull request `agk:ci-red`.
- The kit's template `pyproject.toml` has the same flaw for any adopter that is not a Python package and builds at the repository root; that is for agk, not for this repository.

## Residual

- 2026-10-26: the open residual of docs/runs/staging-record.md (Cloudflare pull-request builds fail on the root `pyproject.toml`) is closed only when the check is green on this pull request (due 2026-11-30).
