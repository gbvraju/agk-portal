# ADR-0020: Upgrade agk from 0.32.0 to 0.40.0

- Status: Proposed
- Date: 2026-10-22
- Deciders: maintainers
- Related: ADR-0004, ADR-0017, ADR-0019
- Requirements: REQ-105

Protected classes: `.github/`, `scripts/agk/`, `.claude/`, `config/`, `agk.toml`

## Context

ADR-0004 took this install from 0.31.0 to 0.32.0. From kit 0.39.0 the weekly report script writes `report.json`, the report's sections as data (agk SPEC-0022), beside the facts in the same artifact, and the product-report workflow uploads both files as `agk-facts-<week>`. The This week section of the portal renders that data (ADR-0019), and REQ-105 AC2 compares the page with the output of this repository's own `scripts/agk/product_report.py`, which at 0.32.0 has no `--json`. The maintainers ordered the upgrade to the latest release as Item 0 of the fourth brief. The latest release when the pull request was opened was the tag v0.39.0 of the agk repository (commit 318ada6); the maintainers' review then named v0.40.0 (commit f87217d), tagged since, and the upgrade was brought to it in the same pull request. The plugin installed in the builder's session is still 0.32.0 and cannot be updated from a session, so the kit's `upgrade.py` was run from a checkout of each tag, as its header allows ("run it from the kit checkout or the plugin root"), after reading it for any network or process call (it makes none); the maintainers accepted that (Q-B14-2), the plugin version here is not a blocker.

## Decision

1. The install is upgraded from 0.32.0 to 0.40.0 in two runs of the kit's `scripts/agk/upgrade.py`, each a dry run first and then for real, each in its own commit. The run of the tag v0.39.0 replaced exactly `.github/workflows/product-report.yml`, `scripts/agk/facts.py`, `scripts/agk/metrics.py`, `scripts/agk/product_report.py`, `scripts/agk/reviewers.py` and set the `version` line of `agk.toml` to 0.39.0. The run of the tag v0.40.0 created `.claude/agents/architect-review.md` and `config/review-checklist.md`, replaced `.claude/agents/architect.md` and `.claude/hooks/architect_guard.py`, and set the `version` line to 0.40.0. Every other kit file was already identical to the kit's. No file of this project's own is edited.
2. `.github/workflows/product-report.yml` now runs `product_report.py --json`, fails when the facts or the report data are missing or empty, and uploads `facts.json` and `report.json` as one artifact `agk-facts-<week>` with an upload action pinned by hash (v7.0.2), retention 90 days. The first scheduled run is Monday 2026-10-26.
3. `reviewers.py` gains the `verdict_authors` list (SPEC-0021). `config/reviewers.yaml` has no such key, so the verdict authors are the user handle of the team `maintainers`, `@gbvraju`; `python3 scripts/agk/reviewers.py --codeowners --write` left `.github/CODEOWNERS` unchanged and `reviewers.py --check` and `--check-codeowners` pass.
4. The upgrade is checked by `make governance`, `make test`, and `agk doctor` run against the kit checkout of v0.40.0 (20 ok, 1 fail: see the residual; `kit-version`, `vendored-missing` and `vendored-differs` all ok, so every replaced or created file equals the kit's copy byte for byte), and by running the 0.39.0 `scripts/agk/product_report.py --facts FILE --week 2026-W41 --today 2026-10-14 --json OUT` on the kit's `facts/ok` fixture, whose `report.json` equals the kit's golden for that fixture. A kit upgrade adds no test of this project's; its proof reads `unknown (no-test-files)` and the maintainers accept that for an upgrade pull request only (Q-B14-3): the proof is the kit's own tested release plus the doctor's hash match of every replaced file.
5. 0.40.0 adds the architect-review agent and its checklist (`.claude/agents/architect-review.md`, `config/review-checklist.md`) and changes the architect agent and its guard hook; this project's use of them is not part of this decision.

## Consequences

- `scripts/agk/product_report.py --json` exists here, so the tests of REQ-105 AC2 can run this repository's own script (the fourth brief).
- The weekly workflow of this repository publishes `report.json` from Monday 2026-10-26; artifacts before then hold `facts.json` alone and stay readable (ADR-0017).
- `.github/`, `scripts/agk/` and `agk.toml` are protected paths, so this change needs this ADR in the same pull request, naming each.

## Residual

- 2026-10-22: `agk doctor` reports one warn-level failure, `repo-auto-merge`: the repository setting `allow_auto_merge` is off. The maintainers turn the setting on (Q-B14-1 ruled; it only allows auto-merge); no agent enables auto-merge on any pull request (due 2026-12-31).
- 2026-10-22: the proof of an upgrade pull request reads `unknown (no-test-files)`; the maintainers record a kit residual in agk (an upgrade could carry its own proof, for instance the doctor's hash match of every replaced file) (due 2026-12-31).
- 2026-10-22: the `.claude/settings.json` of this repository names no plugin ref, so the residual of ADR-0004 about the ref has nothing to set (due 2026-12-31).
