# ADR-0005: The project's tests are TypeScript, run by npm

- Status: Proposed
- Date: 2026-10-21
- Deciders: maintainers
- Related: ADR-0001, ADR-0002, ADR-0004
- Requirements: REQ-101

Protected classes: `agk.toml`

## Context

The kit counts a requirement as done only when a `REQ-nnn` marker is found in the project's test files, and it runs the project's tests with the `project_tests` command of `agk.toml`. The installed defaults are Python (`test_dirs` `tests`, `test_patterns` `test_*.py`, pytest). The AGK portal is TypeScript (ADR-0002), so its tests are `*.test.ts` files run by npm. The root `.gitignore` and the five workflows are kit files that are not edited (the doctor hashes them), so the TypeScript project lives in `site/` with its own `.gitignore` (brief Q-B1-1, ruled as read).

## Decision

1. `agk.toml` sets `test_dirs = ["site/tests"]`, `test_patterns = ["*.test.ts"]` and `project_tests = "cd site && npm ci --ignore-scripts && npm test"`. No other key changes. The kit reads `test_patterns` from `agk.toml` (confirmed with `config.py test_patterns`) and finds markers by an `rglob` of that pattern under `test_dirs`.
2. `site/package.json` is private, pins every development dependency to an exact version, has an `engines.node` range of `>=22.0.0 <23`, and `site/package-lock.json` is committed; the install is `npm ci`.
3. No kit workflow is edited. The ubuntu runner has Node preinstalled, so the kit's `proof` and `governance` workflows run `project_tests` as they are.
4. The placeholder test `site/tests/marker-scan.test.ts` proves the marker scan finds an acceptance marker in a `*.test.ts` file, with the marker text assembled from parts so that no tracked file carries a literal marker.

## Consequences

- `make test` runs the TypeScript tests, and needs network access to the npm registry for `npm ci`.
- The `proof` workflow runs the same command in a detached worktree of the base: without `site/package.json` it fails there (red) and passes on the head (green) (brief Q-B1-2, confirmed by the CI run of this pull request).
- Until a real test replaces the placeholder, the marker scan finds no marker for REQ-101 in tracked files, so the requirement cannot be marked done.

## Residual

- 2026-10-21: the Node version of the `ubuntu-latest` runner image was read from release notes of the runner-images project, not from its documentation page, which was unreachable; confirm `22.x` there (verify) (due 2026-11-30).
- 2026-10-21: the pinned versions (`typescript` 7.0.2, `tsx` 4.23.15, `@types/node` 22.20.5) were looked up on 2026-10-21; they change only by a pull request (due 2026-12-31).
