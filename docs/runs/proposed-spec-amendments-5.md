# Proposed spec amendments 5 (SPEC-0005)

Date: 2026-10-23 (from `date -u`). Approved specs are changed only through a proposal like this one (principle 6), applied by an ADR (ADR-0022). SPEC-0005 is `docs/specs/0005-the-this-week-section-shows-for-the-week-the-facts-artifact.md`. Ruled by the maintainers on the intake pull request of REQ-108 (verdict "fix list f8bd660", item 1): the wording changes of SPEC-0005 rule 10 are made by this file, applied by an ADR in the build pull request.

## Amendment 7 — rule 10, the fixed phrases: the page title, the card without This week and the status words

**Reason.** SPEC-0008 (Approved, REQ-108) gives the page a look and three wording changes that rule 10 of SPEC-0005 fixes: the signed-in page is titled "Your projects" (answer 1 of the product owner: neutral, no new GitHub call); the line "Facts read for {week}." is not shown where This week is shown, and a card without This week keeps the week as "Week {week}: not known yet: {reason}." (answer 2); and every status is shown as a word with a colour, the five words being "Done", "Proven", "Needs you", "At risk" and "Not known yet" (answer 8 of the intake). Rule 10 says these phrases, and no other sentence, are shown, so each new sentence needs its row. No existing phrase of rule 10 changes; the Needs your decision fold uses the group's existing heading and count (no new phrase), and the grouped At risk fold is not part of this amendment.

**Old text.** The last row of the table of rule 10:

    | Any | "Nothing this week." / "{What} could not be read: not known yet." / "Week {label}: Monday {start} to Sunday {end} (UTC). What waits for you is as of {today}." / "These numbers were made from a copy with unsaved changes; treat them with care." | the report's opening, empty and notice lines |

**New text.** That row, then these three rows:

> | Any | "Your projects" (the title and the heading of the signed-in page) | the page title (SPEC-0008 rule 8) |
> | Any | "Week {label}: not known yet: {reason}." (a card without This week: no report, an unreadable report or an unknown repository; the line "Facts read for {week}." is not shown) | the card without This week (SPEC-0008 rule 8) |
> | Any | the status words of a badge, always with their colour: "Done", "Proven", "Needs you", "At risk", "Not known yet" | the status badge (SPEC-0008 rule 4) |

## Amendment 8 — rule 10, the totals line of Time and review as five tiles

**Reason.** The approved mockup shows one tile per number of the week's totals; the page showed the totals as one sentence (residual of 2026-10-23, `docs/runs/residuals.md`). The totals item of `report.json` (kind `week-totals`) already holds the five numbers as fields (`merged`, `hours`, `fix_verdicts`, `behaviour_unchanged`, `estimate`), so each tile places one field and the page computes nothing. The schema stays 1; a field for hours not known (`hours_unknown`) is a separate pull request after the kit's v0.43.0. The per-change cost lines (kind `pull-request-cost`) are unchanged.

**Old text.** The totals row of rule 10:

    | Time and review | "This week: {n} changes merged; time from opening to merge: {h} hours in total; review rounds in total: {f}; declared as not changing behaviour: {u}; estimate: {N} of {M} within range." / "…estimate: none declared this week." | the totals line |

**New text.**

> | Time and review | five tiles in this order, each a fixed phrase over one field of the totals item: "{merged} changes merged" ("1 change merged"); "{hours} hours from opening to merge, in total" ("hours from opening to merge, in total: not known yet"); "{fix_verdicts} review rounds in total" ("1 review round in total"; "review rounds in total: not known yet"); "{behaviour_unchanged} declared as not changing behaviour"; "estimate: none declared this week" / "estimate: {N} of {M} within range"; and the link "(the week)" once after the tiles | the totals line (Amendment 8) |

## Amendment 9 — rules 10 and 13 and the intro, the Tests and the Residual: report.json schema 2 and the sixth tile

**Reason.** agk v0.43.0 (agk SPEC-0024, REQ-031) raises the `schema` of `report.json` to 2 for every report: the item of kind `week-totals` gains `hours_unknown`, an integer from 0, always present, the number of the week's merged changes whose hours are not known (also in a busy week). The report of Monday 2026-10-26 is schema 2; the artifacts before it are schema 1. SPEC-0005 fixes the schema number in its intro, rule 13, a Tests line and a Residual bullet, and the totals row of rule 10 (Amendment 8) has no tile for the count. SPEC-0001 rule 4 is about `facts.json`, whose schema stays 1, and is not changed. The page places the field and computes nothing.

**Old text and new text.** (the words that change; the rest of each paragraph is as it is)

1. The introduction: "(agk SPEC-0022, kit 0.39.0, schema 1)" becomes "(agk SPEC-0022, kit 0.39.0, schema 1; schema 2 from kit 0.43.0, agk SPEC-0024)".
2. Rule 13: "`schema` the number 1;" becomes "`schema` the number 1 or 2 (schema 2, agk SPEC-0024, adds `hours_unknown`, an integer from 0 and always present, to the item of kind `week-totals` and to nothing else; each schema has its own closed list);" and "whose schema is not 1, or that has an extra or missing key, kind or field" becomes "whose schema is not 1 or 2, or that has an extra or missing key, kind or field for its schema (schema 2 without `hours_unknown`, schema 1 with it)".
3. Rule 10, the totals row (Amendment 8): after the hours phrase it gains "for schema 2 only, a sixth tile after the hours tile, "{hours_unknown} changes without known hours" ("1 change without known hours"; 0 is shown, because 0 is a known value);", and "five tiles in this order" becomes "five tiles in this order (six for schema 2)".
4. Tests: "a schema other than 1 show no This week" becomes "a schema other than 1 or 2 show no This week", and a line for rules 10 and 13 is added (the sixth tile for schema 2, five tiles for schema 1, the field required for schema 2 and refused for schema 1; REQ-105 AC5 and AC8).
5. Residual: "the page is tied to `report.json` schema 1 (agk SPEC-0022); a schema change fails the document check and the spec is then amended;" becomes "the page reads `report.json` schemas 1 and 2 (agk SPEC-0022 and SPEC-0024); another schema number fails the document check and the spec is then amended;".

## Amendment 10 — SPEC-0005 rules 10 and 13 and the intro, the Tests and the Residual: report.json schema 3

**Reason.** agk v0.50.0 (agk SPEC-0026, REQ-033) makes the `schema` of `report.json` 3 for every report: the report gains `counts` (the four sections `delivered`, `proven`, `needs_you`, `at_risk`, each an integer or `"unknown"`), the four grouped kinds gain `count` (an integer, the data's own number of its entries), the totals gain `fix_verdicts_unknown` (an integer from 0, always present), and open pull requests whose verdicts could not be read become one `unknown` item that names how many, with links, in the pull-request group of Needs your decision and in At risk. The report of Monday 2026-10-26 is schema 3; the page reads schemas 1 and 2 only, so without this its card would read "not known yet". The page places the data's numbers and computes nothing. SPEC-0001 rule 4 is about `facts.json` and is not changed.

**Old text and new text.** (the words that change; the rest of each paragraph is as it is)

1. The introduction: "(agk SPEC-0022, kit 0.39.0, schema 1; schema 2 from kit 0.43.0, agk SPEC-0024)" becomes "(...; schema 3 from kit 0.50.0, agk SPEC-0026)".
2. Rule 13: "`schema` the number 1 or 2 (schema 2, ... ; each schema has its own closed list)" becomes "`schema` the number 1, 2 or 3 (schema 2 ...; schema 3, agk SPEC-0026, adds `counts` (exactly the keys `delivered`, `proven`, `needs_you`, `at_risk`, each an integer from 0 or `"unknown"`), `count` (an integer from 0) on the four grouped kinds of At risk and `fix_verdicts_unknown` (an integer from 0) on `week-totals`; each schema has its own closed list and no field of a later schema is allowed in an earlier one)", and the refusal now reads "whose schema is not 1, 2 or 3, or that has an extra or missing key, kind or field for its schema (schema 2 without `hours_unknown`, schema 1 with it, schema 3 without `counts`, `count` or `fix_verdicts_unknown`)".
3. Rule 10, the totals row (Amendments 8 and 9): "(six for schema 2)" becomes "(six for schema 2, seven for schema 3)" and a tile is added after the review-rounds tile for schema 3 only: "{fix_verdicts_unknown} changes without known review rounds" ("1 change without known review rounds"; 0 is shown).
4. Rule 10, a new row after the last At risk row: for schema 3, a grouped line whose `count` (the data's own) is above 5, with its changes in a details element: "{n} changes have been open." / "{n} changes were sent back." / "{n} changes were merged without a review." / "{n} changes were merged before their final review."; a count of 5 or fewer stays as before; the unknown item for open pull requests whose verdicts could not be read is the existing "{What} could not be read: not known yet.".
5. Tests: "a schema other than 1 or 2" becomes "a schema other than 1, 2 or 3", and a line for rules 10 and 13 is added (the seventh tile and the fold for schema 3, neither for schemas 1 and 2; REQ-105 AC5 and AC8).
6. Residual: "the page reads `report.json` schemas 1 and 2 (agk SPEC-0022 and SPEC-0024)" becomes "schemas 1, 2 and 3 (agk SPEC-0022, SPEC-0024 and SPEC-0026)".

## Amendment 11 — SPEC-0008 rule 8, the Tests and the Residual: the At risk fold

SPEC-0008 is `docs/specs/0008-the-portal-page-has-a-modern-accessible-look-from-one-theme.md`, applied by ADR-0026.

**Reason.** The At risk fold left SPEC-0008 at its approval because report.json carried no count for a grouped item and the length of `entries` would be a count the page computes (SPEC-0008 Residual). Schema 3 carries `count` on each grouped kind, so the fold can be built on the data's number. Its words are the ones the Residual recorded.

**Old text and new text.**

1. Rule 8: "The grouped At risk lines are not folded in this spec (ruled by the maintainers, see above and the Residual)." becomes "A grouped At risk line whose `count` (the data's own `count`, from report.json schema 3, agk SPEC-0026) is above 5 reads its fixed phrase of SPEC-0005 rule 10 with that count and has its changes in a `details` element; a count of 5 or fewer, and every line of schema 1 and schema 2 (which carry no count), stay as SPEC-0005 rule 10 has them (Amendment 11)."
2. Tests: the line for rules 8 and 9 gains "the At risk fold over a count of 5 (the data's count, never the entries)".
3. Residual: the bullet of 2026-10-23 on the At risk fold becomes a bullet of 2026-10-24 saying it was built when the kit's report.json carried a count for each grouped item (schema 3, ADR-0026), with the same four phrases.
