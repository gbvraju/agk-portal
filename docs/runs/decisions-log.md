# Decisions log

One row per decision made outside an ADR, so a compacted session can be reconstructed from the repository.

| Date | Decision | Reason | Recorded in | By |
| ---- | -------- | ------ | ----------- | -- |
| 2026-10-21 | REQ-101 used per the requirements.md reservation; kit defect fixed in agk 0.32.0 | the kit reserves REQ-001..099; intake in 0.31.0 printed REQ-004 | docs/adr/0004-upgrade-agk-0-32-0.md | maintainers |
| 2026-10-21 | Q-S0001-1 ruled as read: schema 1 with or without kit_version | the criteria of REQ-101 assume this reading | docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md | maintainers |
| 2026-10-21 | Q-S0001-2 ruled as read: the latest artifact is the highest week label, then the newest by creation time | the criteria of REQ-101 assume this reading | docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md | maintainers |
| 2026-10-21 | Q-S0001-3 ruled as read: the config file is projects.json at the repository root | the criteria of REQ-101 assume this reading | docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md | maintainers |
