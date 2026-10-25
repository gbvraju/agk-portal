# ADR-0034: Upgrade agk from 0.50.0 to 0.55.0

- Status: Accepted
- Date: 2026-10-25
- Deciders: maintainers
- Related: ADR-0027
- Requirements: REQ-105

Protected classes: `.claude/`, `.github/`, `CLAUDE.md`, `agk.mk`, `config/`, `constitution/`, `scripts/agk/`, `agk.toml`

## Context

ADR-0027 took this install from 0.43.0 to 0.50.0. agk v0.55.0 adds what the portal's sessions have been doing by hand: the router, which sets one `agk:` label per pull request from GitHub events; `session.py` with `watch`, `queue`, `next`, `resume`, `claim` and `after`; checkpoints and draft pull requests; capacity and claims; every spec approved only by a person (`spec_approvers`, `Approve:`); measured causes and corrections; waits that never go silent; and `report.json` schema 6, which the portal's reader accepts since ADR-0032. The brief of issue #66 asks for the upgrade, three settings the kit now reads, and the kit's tag v0.55.0 as the source.

## Decision

1. The install is upgraded from 0.50.0 to 0.55.0 by one run of the kit's `scripts/agk/upgrade.py` from a checkout of the tag v0.55.0 (commit dc9ca6e), a dry run first and then for real (`dry run: 27 files would change`, then the same 27 files plus the version line of `agk.toml`). It replaced `.claude/agents/architect.md`, `.claude/hooks/architect_guard.py`, `.github/workflows/governance.yml`, `.github/workflows/proof.yml`, `.gitignore`, `CLAUDE.md`, `agk.mk`, `constitution/principles.md`, `docs/specs/TEMPLATE.md` and eleven files of `scripts/agk/` (`check_final_clearance.py`, `check_pr_body.py`, `check_protected_changes.py`, `check_specs.py`, `common.py`, `doctor.py`, `facts.py`, `metrics.py`, `product_report.py`, `reviewers.py`), and created `.claude/agents/conductor.md`, `.claude/hooks/conductor_guard.py`, `.github/workflows/agk-route.yml`, `config/session-rules.md` and `scripts/agk/check_brief.py`, `check_design.py`, `route.py` and `session.py`. No installed file was edited by hand.
2. Three settings the kit now reads are added, each by this ADR: `config/reviewers.yaml` gains `spec_approvers: [gbvraju]` (without it a spec flip to Approved fails) and `verdict_authors: [gbvraju]` (absent before; the kit read the user handle of the team `maintainers` instead, which is the same account); `agk.toml` gains the table `[flow]` with `assign = "conductor"`, so that finished sessions ask the conductor.
3. `pr_mode` stays `strict`: the kit's default is `strict` and the upgrade only reported that the template of `agk.toml` has the key `pr_mode = "strict"`; no key was added to `agk.toml`. Moving to flow mode needs its own ADR and the maintainers' ruling.
4. The upgrade is checked by `agk doctor --kit-root` at the v0.55.0 checkout: `kit-version`, `vendored-missing` and `vendored-differs` are ok, so every vendored file equals the kit's copy byte for byte. Three checks fail on GitHub settings that a pull request cannot change: `ruleset-bypass` and `repo-auto-merge`, which failed in the same way with the 0.50.0 doctor, and `brief-label` (the label `agk-brief` does not exist yet).
5. The tests that take data from the repository's script needed test-only changes that the upgrade forces, as ruled for the earlier upgrades: the schema 1 form of the script's report (now a function `schema1Form` in `site/tests/support/report-script.ts`) also drops the group `ready`, `usage`, `usage_reported`, `corrections`, the key `flow`, the three At risk kinds of schema 6 and the unknown items for open briefs, stalled pull requests and requirements without a brief, which the kit adds for facts that the portal's fixtures do not carry; and the test that compared the script's report with the kit's schema 3 golden now compares the two in the schema 1 form. No page code changes.
6. What a person does on GitHub after the merge, and the upgrade does not do: the conductor opens one issue labelled `agk-conductor` in this repository for `Request:` and `Assign:`; the label `agk-brief` is created; and the maintainers read the three failing doctor checks of decision 4. The router workflow `agk-route.yml` and the new governance steps run on GitHub, so the first pull request after the merge shows them.
7. `.claude/`, `.github/`, `CLAUDE.md`, `agk.mk`, `config/`, `constitution/`, `scripts/agk/` and `agk.toml` are protected paths, so this change needs this ADR in the same pull request, naming each.

## Consequences

- The kit's router, session commands and approval checks are installed; `python3 scripts/agk/session.py watch` replaces the sessions' own watch scripts once the conductor says so.
- The repository's `scripts/agk/product_report.py` writes schema 6 here, as the kit's workflow does, and the portal's reader accepts it.
- A spec can become Approved only through a listed person's `Approve:` line (`spec_approvers`).

## Residual

- 2026-10-25: the router workflow and the new governance steps cannot run locally; the first pull request after the merge is their proof (due 2026-11-30).
- 2026-10-25: the doctor's `ruleset-bypass` and `repo-auto-merge` fail on the repository's settings, as they did before the upgrade; the maintainers rule on them (due 2026-11-30).
