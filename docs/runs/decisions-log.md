# Decisions log

One row per decision made outside an ADR, so a compacted session can be reconstructed from the repository.

| Date | Decision | Reason | Recorded in | By |
| ---- | -------- | ------ | ----------- | -- |
| 2026-10-21 | REQ-101 used per the requirements.md reservation; kit defect fixed in agk 0.32.0 | the kit reserves REQ-001..099; intake in 0.31.0 printed REQ-004 | docs/adr/0004-upgrade-agk-0-32-0.md | maintainers |
| 2026-10-21 | Q-S0001-1 ruled as read: schema 1 with or without kit_version | the criteria of REQ-101 assume this reading | docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md | maintainers |
| 2026-10-21 | Q-S0001-2 ruled as read: the latest artifact is the highest week label, then the newest by creation time | the criteria of REQ-101 assume this reading | docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md | maintainers |
| 2026-10-21 | Q-S0001-3 ruled as read: the config file is projects.json at the repository root | the criteria of REQ-101 assume this reading | docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md | maintainers |
| 2026-10-21 | Q-B1-1 ruled as read: the TypeScript project is site/; the kit's root files are untouched | the root .gitignore is a kit-managed file | docs/briefs/first-brief-test-runner-and-artifact-access-proof.md | maintainers |
| 2026-10-21 | Q-B1-2 ruled as read: proof is red on the base and green on the head; Item 1's CI run confirms it and the PR body quotes the proof outcome | the base has no site/package.json | docs/briefs/first-brief-test-runner-and-artifact-access-proof.md | maintainers |
| 2026-10-21 | Q-B1-3 ruled: the throwaway workflow is removed in the PR that builds the real data step, after the maintainers have read the record; that PR says so | the proof workflow is throwaway | docs/briefs/first-brief-test-runner-and-artifact-access-proof.md | maintainers |
| 2026-10-21 | Item 2 addition: the download answers 302 to storage then 200; record both statuses, the redirect host only (never the signed URL) and the control calls without a token; the brief file is not re-edited | the artifact zip is served from storage by redirect | docs/briefs/first-brief-test-runner-and-artifact-access-proof.md (Item 2) | maintainers |
