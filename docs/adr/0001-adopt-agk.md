# ADR-0001: agk-portal adopts agk

- Status: Accepted
- Date: 2026-10-21
- Deciders: maintainers
- Related: none
- Requirements: REQ-001, REQ-002, REQ-003

## Context

agk-portal adopts agk so that agent output stays consistent: rules live in committed settings, hooks, CI checks and
branch rules, and the method (requirements, specs, ADRs, reviewer groups, briefs) is part of the repository.

## Decision

1. Install agk 0.31.0 on 2026-10-21: `constitution/`, `config/`, `docs/` (requirements, ADRs, specs, briefs,
   runs, build-state), `scripts/agk/` (checks), `.claude/` (settings, hook,
   agent), `.github/` (workflow, PR template, CODEOWNERS), `CLAUDE.md`, `Makefile`, `agk.mk`, `agk.toml`, `pyproject.toml`,
   `.gitattributes` (marks `scripts/agk/` as generated). The kit's own tests are not installed.
2. Protected paths are listed in `config/protected-paths.txt`: `constitution/`, `config/`, `.claude/`, `.github/`,
   `docs/requirements.md`, `CLAUDE.md`, `scripts/agk/`, `Makefile`, `pyproject.toml`, `agk.mk`, `agk.toml`. They change only
   with an ADR in the same PR that names each changed path class. A change that touches only `- Status:` lines of
   `docs/requirements.md` is exempt.
3. The one direct commit to the default branch is the repository's creation commit; everything else goes through a
   pull request that passes the `governance` job. The ruleset for the default branch (`main`) is exactly: Active; no bypass; target the default branch; restrict deletions; require linear history; require a pull request (0 approvals, dismiss stale approvals, squash merge only); block force pushes; required status check `governance`.
   Repository settings: allow auto-merge; auto-delete head branches.
4. Reviewer model: path classes map to reviewer groups in `config/reviewers.yaml`; approvers are teams, never
   personal names. Agents implement; maintainers decide.

## Consequences

- Weakening a check requires an ADR, which makes the weakening visible and reviewable.

## Residual

- 2026-10-21: `config/reviewers.yaml` maps `maintainers` to a placeholder handle; replace it with a real team or user.
- 2026-10-21: the ruleset is a GitHub setting, not a file; apply it by hand.
