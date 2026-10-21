# SPEC-0006: The Requirements section shows how each requirement stands

- Status: Approved
- Owner: maintainers
- Requirements: REQ-106

Status is `Draft` or `Approved`. An Approved spec is owned by its reviewer group; agents propose patches.
Written by the intake of one sentence, as data: "The Requirements section lists how each requirement stands in plain phrases: its own title, whether it is planned, in progress or done, whether its specification is approved, how many of its acceptance criteria have a test, and whether it is proven, each linked to its evidence." It is milestone M2 of ADR-0002 as amended by ADR-0006, second part (This week is SPEC-0005; Trend follows as its own intake). The product owner answered three questions on 2026-10-21: one line per requirement (its title, a status phrase, "{k} of {n} acceptance criteria have a test", the specification phrase, the proven phrase from the report's rule), with the criteria text behind a closed `<details>` element, each criterion with its test mark or "no test"; the requirements numbered REQ-001 to REQ-099, which are the kit's own, are hidden behind a fixed line with its link; the requirements stand in the groups In progress, Planned and Done with their counts and in id order, and Done is closed behind `<details>` when it has more than ten. The agk product report has no section called Requirements, so this section reuses only the report's own helper rules, from the same facts fields, so that it cannot disagree with This week (SPEC-0005); each is cited below as a read-only reference to the agk specs and to the vendored `scripts/agk/product_report.py`. The one rule the report does not have is rule 2 (the kit's requirements are hidden), and the reason is given there.

## Rules

1. **Where each value comes from.** The section reads the same facts document as SPEC-0005 and nothing else. Each value is computed by the report's own rule:
   - *The status* is `requirements[].status`: `planned`, `in-progress` or `done` (agk SPEC-0009 rule 8); any other value is "not known yet".
   - *The criteria* are `requirements[].criteria` (agk SPEC-0009 rule 8): `{id, text}` in file order. A requirement whose `criteria` is `[]` has "no acceptance criteria listed"; one whose `criteria` is `"unknown"` has "its acceptance criteria are not known yet" (`criteria_text` and `proven` of the report; agk SPEC-0011 rule 9, Proven).
   - *The tests* are the report's rule in `proven` (agk SPEC-0011 rule 9, Proven; SPEC-0009 rule 9): a criterion has a test when `markers[]` holds an object with that `req` and that `ac`. A marker is presence only; the section never says a test is good (agk SPEC-0011 rule 12).
   - *The specification* is the report's rule in `requirement_items` (agk SPEC-0011 rule 6): a requirement is named by a spec when a `specs[].requirements` list holds its id; the spec's `status` is `Draft` or `Approved` (agk SPEC-0009 rule 10). When several specs name one requirement the phrase is "Specification approved." if every one is Approved, "Specification waiting for approval." if any is Draft, and "Specification not known yet." if any status is unknown (Q-S0006-2).
   - *Proven* is the value `proven` of the report gives the same requirement, the same function as the Proven part of This week (SPEC-0005 rule 4), shown in the same fixed phrases. A `planned` requirement is not counted by the report's Proven (agk SPEC-0011 rule 9) and shows "Not counted yet: it is planned."
2. **Which requirements.** The section lists the requirements numbered REQ-100 or above; the numbers REQ-001 to REQ-099 are reserved for the kit by `docs/requirements.md` and are not listed. This is the one rule the report does not have: the report lists every requirement (agk SPEC-0011 rule 3, kind `requirement`), but the kit's requirements describe the kit and not the project, are all `planned` for ever and would head every list with items the client cannot act on. A fixed line shows how many were hidden, with a link to `docs/requirements.md` at the facts commit: "{n} kit requirements are not shown." ("1 kit requirement is not shown." for one; the line is omitted when there are none). The identifier decides, by its number, not by any other field. This rule makes the section differ from the Needs your decision group of SPEC-0005 (Q-S0006-1).
3. **Groups and order.** The listed requirements stand in three groups in this order: "In progress ({n})", "Planned ({n})", "Done ({n})", each with its count, and inside each group in the order of the number of the identifier. A group with no requirement is not shown; with no requirement in any group the section says "No requirements yet." A Done group of more than ten requirements is closed behind a `<details>` element whose `<summary>` is its heading; any other group is open.
4. **The line.** One line per requirement: the requirement's own title as the sentence, then the fixed phrases in this order, then its identifier as a reference linked to its line in `docs/requirements.md` at the facts commit (`https://github.com/{repo}/blob/{commit}/docs/requirements.md#L{line}`). No other text of the facts is shown as a sentence. The fixed phrases are in rule 8.
5. **The criteria.** Each line holds a closed `<details>` element whose summary is the fixed phrase "Acceptance criteria" and whose body lists, in file order, each criterion's own text, followed by "has a test" with a link to the first marker's file and line at the facts commit, or "no test". A requirement with no criteria or unknown criteria shows its fixed phrase of rule 1 in the body. The criterion text is the requirement's own sentence and is not changed.
6. **Unknown is said.** A value the facts mark `"unknown"` (the status, the criteria, the specs, the markers) is "not known yet", never zero and never a guessed status. A source that cannot be read (`requirements` unknown) shows the one fixed line "Requirements could not be read: not known yet." in place of the section; `markers` unknown shows "tests not known yet" in place of the coverage; `specs` unknown shows "Specification not known yet." (agk SPEC-0011 rule 12).
7. **No script.** The section is server-rendered HTML with `<details>` and `<summary>` only: no script, no inline style (SPEC-0004 rules 1 and 2). A project whose facts cannot be read, whose `repo` is unknown or whose `schema` is not 1 shows no Requirements, only its card (SPEC-0001 rule 4; SPEC-0005 rule 9).
8. **The fixed phrases.** These, and no other sentence besides a requirement's own title and criteria text, are shown. A count of one uses the singular.

   | Part | Fixed phrase |
   | --- | --- |
   | Status | "Planned." / "In progress." / "Done." / "Status not known yet." |
   | Tests | "{k} of {n} acceptance criteria have a test." / "No acceptance criteria are listed." / "Its acceptance criteria are not known yet." / "Tests not known yet." |
   | Specification | "Specification approved." / "Specification waiting for approval." / "No specification yet." / "Specification not known yet." |
   | Proven | the phrases of SPEC-0005 rule 10 for Proven, without the title and the identifier that the line already carries: "Proven (last change #{n}: {outcome})." where {outcome} is "proven" or "skipped: declared as not changing behaviour", and "Not proven: {reasons}." with the reasons as SPEC-0005 words them ("{ACn} has no test", "it lists no acceptance criteria", "no merged change was found", "the last change (#{n}) did not prove it: {words}", "the last change (#{n}) has a proof that is not known yet: {words}", "its acceptance criteria are not known yet"), the codes only behind the link; "Not counted yet: it is planned."; "Proof not known yet." |
   | Group | "In progress ({n})" / "Planned ({n})" / "Done ({n})" / "No requirements yet." |
   | Criteria | "Acceptance criteria" / "has a test" / "no test" |
   | Hidden | "{n} kit requirements are not shown." / "1 kit requirement is not shown." |
   | Unknown | "Requirements could not be read: not known yet." |

   The phrases are held to the same plain-language standard as SPEC-0005 (the identifier after the plain sentence as a reference), and the product owner reviews this table in the approval pull request before the spec is approved.
9. **The parity tests.** The tests render the section from each fixture facts document and week and run `python3 scripts/agk/product_report.py --facts FILE --week WEEK` on the same pair. They show that: the proven phrase of each `done` or `in-progress` requirement equals the report's Proven line for it; the set of `planned` requirements with no spec equals the report's group "Planned requirements with no specification" once the numbers below 100 are removed from both; the number of criteria and of criteria with a marker equals the report's reasons "{ACn} has no test"; and the section lists no requirement that the facts do not hold. A test changes one marker in a fixture and shows that only the coverage of that requirement changes.
10. **Fixtures and tests.** The fixtures are facts documents under `site/tests/fixtures/` that carry no token and no signed address, covering each status, a requirement with every criterion tested, with some tested and with none, with no criteria and with unknown criteria, a requirement named by no spec, by a Draft spec, by an Approved spec and by two specs of different status, the kit's requirements, more than ten Done requirements, and unknown values in each source. The tests are TypeScript files named `*.test.ts` under `site/tests/`, run by the npm command in `agk.toml` `project_tests`, each carrying the marker `REQ-106 ACn` it proves.

## Tests

- Rules 1, 3 and 4: each requirement numbered 100 or above appears once as one line with its title, a status phrase and the linked identifier; REQ-106 AC1.
- Rules 1 and 9: the count of criteria and of criteria with a marker equals the report's, and no line says a test is good; REQ-106 AC2.
- Rules 1 and 9: the specification phrase follows the report's naming rule, and the proven phrase equals the report's Proven line; REQ-106 AC3.
- Rule 3: the groups, their counts, their order, the id order inside each and the closed Done group above ten; REQ-106 AC4.
- Rule 5: the details body lists each criterion's own text with its test mark or "no test", and the fixed phrases for no criteria and unknown criteria; REQ-106 AC5.
- Rule 2: the numbers 1 to 99 are not listed and the hidden line shows the right count with its link, singular for one, omitted for none; REQ-106 AC6.
- Rule 6: unknown status, criteria, specs and markers each say "not known yet", never zero, and an unreadable source shows one fixed line; REQ-106 AC7.
- Rule 7: a project without readable facts shows no Requirements, and the section holds no script and no inline style; REQ-106 AC8.

## Proof

REQ-106 AC1 to AC3: *each requirement stands as the report's own rules say.* Rules 1, 4 and 9. REQ-106 AC4 and AC5: *the groups are easy to read on a phone and the criteria are one tap away.* Rules 3 and 5. REQ-106 AC6: *the kit's requirements are hidden and counted.* Rule 2. REQ-106 AC7 and AC8: *an unknown is said and a project without facts shows only its card.* Rules 6 and 7. The maintainers read one live Requirements section beside the same facts' report before the milestone is called done.

## Residual

- 2026-10-21: the rule that hides REQ-001 to REQ-099 is the one rule the report does not have; the This week group "Planned requirements with no specification" still lists them, as the report does, until the report's gap is fixed in agk and this project upgrades (due 2026-12-31).
- 2026-10-21: the page is tied to the report as vendored at kit 0.32.0 and to the facts fields of agk SPEC-0009; a kit upgrade that changes either fails the parity tests, and the spec is then amended (due 2026-12-31).
- 2026-10-21: the product owner reviews the phrase table of rule 8 in the approval pull request before this spec is approved (due 2026-11-30).
- 2026-10-21: a long list of Done requirements is closed, not paged; a project with hundreds of requirements may need paging in a later slice (due 2026-12-31).

## Open questions

- Q-S0006-1 The kit's requirements (REQ-001 to REQ-099) are hidden in this section, but SPEC-0005 follows the report exactly, so its Needs your decision group "Planned requirements with no specification" lists them. The criteria assume the two differ, as ruled. Confirm, or say that SPEC-0005 should hide them too (which would make that group differ from the report, and the parity test would remove the numbers below 100 from both sides).
  Ruled 2026-10-21 by the product owner: SPEC-0005 keeps parity with the report and is not changed. The kit requirements in Needs your decision are a gap of the report itself, to be fixed in agk; after this project upgrades to the kit version that fixes it, parity removes them here too. There is no project-level rule.
- Q-S0006-2 The report has no rule for a requirement named by two or more specs of different status. The criteria assume "approved" only when every naming spec is Approved, "waiting for approval" when any is Draft, and "not known yet" when any status is unknown; no other rule is invented. Confirm, or give the rule.
  Ruled 2026-10-21 by the product owner: as read (approved only when every naming spec is Approved; waiting for approval when any is Draft; not known yet when any status is unknown).
