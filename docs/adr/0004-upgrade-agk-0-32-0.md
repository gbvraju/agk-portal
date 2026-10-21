# ADR-0004: Upgrade agk from 0.31.0 to 0.32.0

- Status: Accepted
- Date: 2026-10-21
- Deciders: maintainers
- Related: ADR-0001, ADR-0003
- Requirements: REQ-101

Protected classes: `scripts/agk/`, `agk.toml`

## Context

ADR-0001 installed agk 0.31.0. Its intake script numbered the first project requirement REQ-004 although `docs/requirements.md` reserves REQ-001 to REQ-099 for the kit and starts a project's own requirements at REQ-101. REQ-101 was used by the maintainers' ruling (ADR-0003), and the intake check refused it. agk 0.32.0 fixes the defect: `next_req_number` in `scripts/agk/common.py` gives the highest number plus one, and never below REQ-101 when `agk.toml` has `mode` `init` or `adopt`.

## Decision

1. Upgrade the install from 0.31.0 to 0.32.0 with the plugin's own `upgrade.py`, a dry run first, then for real. It changes two files and no other: `scripts/agk/common.py` (a verbatim kit file, replaced) and the `version` line of `agk.toml`.
2. No workflow, hook, template or setting changes. `.github/workflows/` stays byte-identical to the kit's.
3. The number REQ-101 of ADR-0003 is now the number the kit itself prints; a decisions-log row records that REQ-101 was used per the reservation and that the defect is fixed in agk 0.32.0.

## Consequences

- `intake.py ids`, `stub` and `check` agree with `docs/requirements.md` on the next requirement number.
- `scripts/agk/` and `agk.toml` are protected paths, so this change needs this ADR in the same pull request, naming each.
- The kit's own tests are not installed here, so this change is proven by `make governance` and by `intake.py check` printing `ok intake` on the pull request of ADR-0003.

## Residual

- 2026-10-21: the plugin settings entries for `.claude/settings.json` that `init` printed still name `ref` v0.31.0 if the maintainers applied them; set the ref to v0.32.0 in a change of its own (due 2026-11-30).
