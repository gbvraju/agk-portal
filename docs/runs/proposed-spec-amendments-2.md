# Proposed spec amendments 2 (SPEC-0001)

Date: 2026-10-22 (from `date -u`). Approved specs are changed only through a proposal like this one (principle 6), applied by an ADR (ADR-0017). SPEC-0001 is `docs/specs/0001-the-build-reads-the-latest-agk-facts-week-artifact-of-each-p.md`.

## Amendment 4 — rule 2, the artifact

**Reason.** From kit 0.39.0 the agk weekly report publishes two files in the `agk-facts-<week>` artifact: `facts.json` and `report.json` (the report's computed sections, which the page will render later so that it agrees with the report by construction). An archive reader that accepts exactly one file would refuse every artifact made by that kit, and every card would read "not known yet". The first scheduled report of the new kit is Monday 2026-10-26.

**Old text.** 2. **The artifact.** For each repository of rule 1 the server, on each request, lists the repository's workflow artifacts with the GitHub REST API, keeps those named `agk-facts-<week>` that have not expired, takes the latest week (Q-S0001-2), and downloads it. The archive holds one file, `facts.json`, which is the facts document of agk SPEC-0009 byte for byte (agk SPEC-0019 rules 1 and 2, verify).

**New text.**

> 2. **The artifact.** For each repository of rule 1 the server, on each request, lists the repository's workflow artifacts with the GitHub REST API, keeps those named `agk-facts-<week>` that have not expired, takes the latest week (Q-S0001-2), and downloads it. The archive holds `facts.json`, which is the facts document of agk SPEC-0009 byte for byte (agk SPEC-0019 rules 1 and 2, verify), and, from kit 0.39.0, `report.json`, the report's computed sections. The archive is accepted when it holds `facts.json` alone (an artifact made before that kit) or `facts.json` and `report.json` in either order, and nothing else: any other entry, a duplicate entry, an archive without `facts.json`, or an entry that fails its checks (not encrypted, stored or deflated, within its size cap of one megabyte, size and checksum right) makes that repository's card "not known yet" with the archive reason (rule 6). `report.json` is checked and is not read by the page yet.

**Tests.** Tests: rule 2 (REQ-101 AC2 and AC3), in `site/tests/facts.test.ts`.
