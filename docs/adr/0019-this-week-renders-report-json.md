# ADR-0019: The This week section renders the report's data instead of reproducing its rules

- Status: Accepted
- Date: 2026-10-22
- Deciders: maintainers
- Related: ADR-0006, ADR-0011, ADR-0017
- Requirements: REQ-105

## Context

ADR-0011 added REQ-105 and SPEC-0005 on the product owner's rule that the page uses the weekly report's own rules so that the page and the report never disagree. As approved, SPEC-0005 had the page compute each part as the report computes it. The third brief (PR #27) measured that at about 2,300 changed lines, chiefly a TypeScript port of the 755-line report, and the maintainers rejected it on 2026-10-22: duplicating the report's logic in a second language is a kit gap. agk then published the computed sections as data (agk SPEC-0022, kit 0.39.0): `report.json` beside `facts.json` in the same artifact `agk-facts-<week>`, schema 1, a closed list of 21 item kinds with their fields and links, written by the same run of the report's script that prints the markdown. The archive reader already accepts both files (ADR-0017).

## Decision

1. The This week section renders the sections of `report.json`; the page computes no section, no date and no sum. The page and the report agree by construction.
2. SPEC-0005 is amended accordingly by `docs/runs/proposed-spec-amendments-4.md` (Amendment 6: the rule of the section and rules 1 to 9, 11, 12 and a new rule 13), applied by this ADR in the same pull request. Rule 10 (the fixed phrases) is unchanged. The requirement text of REQ-105 is unchanged.
3. The page checks `report.json` against the closed list of agk SPEC-0022 before it uses it; a report that fails the check, or an archive of an older kit without `report.json`, gives the card a reason and no This week (SPEC-0005 rule 13).
4. The build is an Item 0 and four items of the fourth brief (`docs/briefs/fourth-brief-this-week-from-report-json.md`): the kit upgrade to the latest release (so that this repository's own `scripts/agk/product_report.py --json` exists), the document and the shell, Delivered with Time and review, Proven with Needs your decision, At risk. The third brief is superseded.
5. The page computes no count (the maintainers' ruling on Q-B13-3): where the data carries no count of items lacking hours, a total that lacks hours reads "not known yet" without "{k} of {n}".

## Consequences

- The page follows the report's schema number: a schema change fails the document check and needs a new amendment.
- The page writes its own sentences from the kinds, as it always did; the wording of the report's markdown can change without the page changing.
- The page's tests run this repository's own `scripts/agk/product_report.py --json` on copied kit fixtures, as REQ-105 AC2 words it; that needs the kit upgrade of Item 0 first (Q-B13-1 ruled).

## Residual

- 2026-10-22: REQ-105 AC5 says "not known yet with the count of items lacking it"; the page shows no count until agk's report carries one (a kit residual, recorded in the brief), so that clause is unmet; the requirement text is protected and is not changed here (Q-B13-6) (due 2026-12-31).
- 2026-10-22: the two card reasons for an unreadable or absent report are accepted as written by the maintainers; the schema of `report.json` is settled by Item 0 (due 2026-12-31).
