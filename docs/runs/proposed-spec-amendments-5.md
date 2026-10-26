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

## Amendment 12 — SPEC-0009 rules 1 and 6: the pills, the visible label and the button

SPEC-0009 is `docs/specs/0009-a-person-with-many-projects-starts-from-one-line-per-project.md`, applied by ADR-0029.

**Reason.** The approved mockup shows each count of a start-page line as a small pill in the status colours, and the find input needs a visible label (an accessible name) with a short button. No new phrase is needed beyond the button "Find" (the label is the existing "Find a project").

**Old text and new text.**

1. Rule 1: after "and a link to `/p/{owner}/{repo}`." the new sentence is added: "Each of the three counts is a small pill in the status colours of SPEC-0008 (delivered: done; needs you: decide; at risk: risk; a count that is not known yet: none); merged and hours are plain text; a count of 0 stays plain, muted and hidden on a phone (rule 4), and no new phrase is added: the words stay "delivered", "needs you" and "at risk"."
2. Rule 6: "with one native text input `q` and a button "Find a project" keeps" becomes "with a visible label "Find a project" tied (`for`) to one native text input `q`, the label being the input's one accessible name, and a button "Find", keeps", and the list of the page's fixed phrases gains "Find".

## Amendment 13 — SPEC-0005 rules 5, 10 and 13, the intro, the Tests and the Residual: report.json schema 4 and the group Ready to merge

**Reason.** agk #184 (REQ-037 part c) makes the `schema` of `report.json` 4: `needs_you` gains the group `ready` ("Ready to merge"), first in the data, with the item kind `pull-request-ready` (exactly `number`, `title` and `links`); no other field changes. The page reads schemas 1 to 3 only, so the first report written after #184 would read "not known yet". The brief of issue #58 asks to show each item as `PR #<n> "<title>"` linked to its pull request, which is the one line where SPEC-0005 rule 10 ("no title of a pull request ... is shown as a sentence") is departed from, and to say on the page when a schema is not one the page reads instead of showing an empty week.

**Old text and new text.** (the words that change; the rest of each paragraph is as it is)

1. The introduction: "(...; schema 3 from kit 0.50.0, agk SPEC-0026)" gains "; schema 4 from agk #184, REQ-037 part c, the group `ready`".
2. Rule 5: the groups gain `ready` (schema 4 only, first in the data) and the items gain `pull-request-ready` (schema 4 only).
3. Rule 13: "`schema` the number 1, 2 or 3 (...)" becomes "the number 1, 2, 3 or 4 (schema 4 adds the group `ready` and the kind `pull-request-ready` with exactly `number`, `title` and `links`, and nothing else; ...)" and the refusal reads "whose schema is not 1, 2, 3 or 4". A report whose `schema` is an integer that is not 1 to 4 reads, on a card without This week, "Week {label}: not known yet: the report has a schema this page does not read."; any other departure still reads "the report could not be read".
4. Rule 10: the group headings row gains "Ready to merge ({n})" (schema 4, first); a new row gives the ready line `PR #{n} "{title}"`, the whole text linked to the pull request, and says an unreadable clearance is the existing unknown line; a new row gives the card with an unknown schema; and the sentence "no title of a pull request ... is shown as a sentence" gains "; the one exception is the line of a pull request that is ready to merge (the brief of issue #58, ADR-0030), which shows its number and its title".
5. Tests: "a schema other than 1, 2 or 3" becomes "1, 2, 3 or 4" and a line for rules 5, 10 and 13 is added (REQ-105 AC2, AC5 and AC8).
6. Residual: "schemas 1, 2 and 3 (agk SPEC-0022, SPEC-0024 and SPEC-0026)" becomes "schemas 1 to 4 (agk SPEC-0022, SPEC-0024, SPEC-0026 and #184)".

## Amendment 14 — SPEC-0009 rules 1 to 3: schema 3 or later

SPEC-0009 is `docs/specs/0009-a-person-with-many-projects-starts-from-one-line-per-project.md`, applied by ADR-0030.

**Reason.** The start page placed a project by its counts only for a report "of schema 3"; a report of schema 4 has the same `counts`, so a project whose latest report is schema 4 must be placed by them and not read "the report has no counts". The reason of a schema that is not read is the card's (rule 3, "the card's existing reasons").

**Old text and new text.** Rule 1: "(schema 3; a count of `"unknown"` reads "not known yet")" becomes "(schema 3 or later; ...)". Rule 2: "is of schema 3 and is for" becomes "is of schema 3 or later and is for". Rule 3: "or its report is of schema 1 or 2" gains "(a report of schema 3 or later has counts)".

## Amendment 15 — SPEC-0005 rules 10 and 13, the intro, the Tests and the Residual: report.json schema 5 and the usage figures

**Reason.** agk #198 (REQ-040 part c1) makes the `schema` of `report.json` 5: the kind `pull-request-cost` gains `usage` (a whole number of tokens, `not-reported` or `unknown`) and the kind `week-totals` gains `usage` (the same) and `usage_reported` (a whole number); no other field changes. The page reads schemas 1 to 4 only, so the first report written after #198 would read "the report has a schema this page does not read". The brief of issue #60 asks the figures to be rendered as the other cost figures are: tokens when a number, `not reported`, `unknown`, never zero for a missing figure, and `usage_reported` as "<n> pull requests reported a usage figure". The wording of the sentence and the tiles is fixed here (Q-B20-1).

**Old text and new text.** (the words that change; the rest of each paragraph is as it is)

1. The introduction: "(...; schema 4 from agk #184, REQ-037 part c, the group `ready`)" gains "; schema 5 from agk #198, REQ-040 part c1, the usage figures".
2. Rule 13: "the number 1, 2, 3 or 4" becomes "1, 2, 3, 4 or 5" and gains "schema 5, agk #198, adds `usage`, a whole number from 0, `"not-reported"` or `"unknown"`, to the items of kind `pull-request-cost` and `week-totals`, and `usage_reported`, an integer from 0, to `week-totals`, and nothing else"; the refusal reads "whose schema is not 1, 2, 3, 4 or 5" and the list of refusals gains "schema 5 without `usage` or `usage_reported`, schema 4 with either". The card with an unknown schema is for an integer that is not 1 to 5.
3. Rule 10, the per-change row: for schema 5 only the sentence "Usage: {u} tokens." ("Usage: 1 token."; "Usage: not reported."; "Usage: unknown.") before the reference.
4. Rule 10, the totals row: for schema 5 only, two tiles after the estimate tile, "usage in total: {usage} tokens" ("usage in total: 1 token"; "usage in total: not reported"; "usage in total: unknown"; 0 is shown) and "{usage_reported} pull requests reported a usage figure" ("1 pull request reported a usage figure"; 0 is shown). The page places the data's numbers and computes none.
5. Tests: "a schema other than 1, 2, 3 or 4" becomes "1, 2, 3, 4 or 5" and a line for rules 10 and 13 is added (REQ-105 AC2, AC5 and AC8).
6. Residual: "schemas 1 to 4 (agk SPEC-0022, SPEC-0024, SPEC-0026 and #184)" becomes "schemas 1 to 5 (... and #198)".

## Amendment 16 — SPEC-0005 rules 2, 6, 10 and 13, the intro, the Tests and the Residual: report.json schema 6, the part Flow, three At risk kinds and corrections

**Reason.** agk #208 (REQ-041 build d with REQ-040 c2 and REQ-039 e2) makes the `schema` of `report.json` 6: `sections` gains a sixth key `flow` (required, after `cost`) whose items are `flow-figures` or `unknown`; `at_risk` gains the kinds `pull-requests-stalled`, `briefs-idle` and `requirements-without-brief`; `week-totals` gains `corrections`; no other field changes. The page reads schemas 1 to 5 only, so the first report written after #208 would read "the report has a schema this page does not read". The brief of issue #62 asks the page to render Flow with the words of agk's markdown (`flow_text`) and the At risk kinds and the corrections "the same way"; agk's markdown shows a pull request's title and a brief's title, which rule 10 forbids as a sentence, so the At risk lines and the corrections tile follow the existing phrases of the page without titles (Q-B21-1).

**Old text and new text.** (the words that change; the rest of each paragraph is as it is)

1. The introduction: "(...; schema 5 from agk #198, REQ-040 part c1, the usage figures)" gains "; schema 6 from agk #208, REQ-041 build d, the Flow section, three At risk kinds and the corrections figure".
2. Rule 2: gains "; for schema 6 a sixth part, Flow, after Time and review, from the key `flow`". Rule 6: gains "for schema 6 also `pull-requests-stalled`, `briefs-idle` and `requirements-without-brief`".
3. Rule 13: "the number 1, 2, 3, 4 or 5" becomes "1, 2, 3, 4, 5 or 6" and gains the schema 6 list (the key `flow`; `flow-figures` with exactly `open_builders`, `max_builders`, the four medians, `conflicts`, `renumbers` and `retakes`; the three At risk kinds; `corrections`; and nothing else); the refusal reads "whose schema is not 1, 2, 3, 4, 5 or 6" and the list of refusals gains "schema 6 without `flow` or `corrections`, schema 5 with either". The card with an unknown schema is for an integer that is not 1 to 6.
4. Rule 10: a new row gives the three At risk lines of schema 6 (no title; "A change is stalled on its builder. (#n)", "A brief has had no pull request for {d} days. (#n)", "{id} has no open brief.", their grouped forms and the folds over 5 by the data's `count`); the totals row gains, for schema 6 only, the tile "{corrections} corrections" ("1 correction"; 0 shown; "corrections: unknown") after the review-rounds tiles; a new row gives the Flow line in agk's words with `none` and `unknown` as written.
5. Tests: "a schema other than 1, 2, 3, 4 or 5" becomes "1, 2, 3, 4, 5 or 6" and a line for rules 2, 6, 10 and 13 is added (REQ-105 AC2, AC5 and AC8).
6. Residual: "schemas 1 to 5 (... and #198)" becomes "schemas 1 to 6 (... and #208)".

## Amendment 17 — SPEC-0005 rules 10 and 13, the intro, the Tests and the Residual: report.json schema 7 and the shadow review's catch rate

**Reason.** agk #228 (REQ-042 build c) makes the `schema` of `report.json` 7: the item `week-totals` of `cost` gains one required field, `shadow`, either `"not-running"` or `"unknown"` or an object with `week` and `total` (each the eight counts and a `catch_rate`), `unpaired` and `unread`; no other field changes. The page reads schemas 1 to 6 only, so the first report written after #228 would read "the report has a schema this page does not read". The brief of issue #69 asks the page to show it as a tile of Time and review in plain words, "Conductor catch rate: {catch_rate} ({heads} changes reviewed twice)" for the week and for the total, `not-running` as "Second review: not running" and `unknown` as "not known yet". The two tiles need a word that tells them apart; the wording is Q-B23-1.

**Old text and new text.** (the words that change; the rest of each paragraph is as it is)

1. The introduction: "(...; schema 6 from agk #208, ...)" gains "; schema 7 from agk #228, REQ-042 build c, the shadow review's catch rate".
2. Rule 13: "the number 1, 2, 3, 4, 5 or 6" becomes "1, 2, 3, 4, 5, 6 or 7" and gains the schema 7 list (`shadow`, required on `week-totals`, with exactly the keys above, and nothing else); the refusal reads "whose schema is not 1, 2, 3, 4, 5, 6 or 7" and the list of refusals gains "schema 7 without `shadow`, schema 6 with it". The card with an unknown schema is for an integer that is not 1 to 7.
3. Rule 10, the totals row: for schema 7 only, two tiles last, after the usage tiles: "Conductor catch rate this week: {catch_rate} ({heads} changes reviewed twice)" and "Conductor catch rate in total: {catch_rate} ({heads} changes reviewed twice)", with the `catch_rate` the data's own string (`none` as written, never 0), "1 change reviewed twice" for one and 0 shown; when `shadow` is `not-running` the one tile "Second review: not running"; when it is `unknown` the one tile "Second review: not known yet". `unpaired` and `unread` are checked and not shown. The page places the data and computes nothing.
4. Tests: "a schema other than 1, 2, 3, 4, 5 or 6" becomes "1, 2, 3, 4, 5, 6 or 7" and a line for rules 10 and 13 is added (REQ-105 AC5 and AC8).
5. Residual: "schemas 1 to 6 (... and #208)" becomes "schemas 1 to 7 (... and #228)".

## Amendment 18 — SPEC-0010 rules 1, 2, 4, 9 and 10, the Tests and the Residual: agk's pipeline schema and the words of the build

SPEC-0010 is `docs/specs/0010-a-person-sees-what-waits-for-them-specs-to-approve-and-pull.md`, applied by ADR-0036.

**Reason.** SPEC-0010 (Approved, #65) said that the schema of the pipeline document was agk's and not written yet, and that the spec would be amended when agk wrote it. agk #227 is merged: the router writes `pipeline.json`, schema 1 (`kit/pipeline-schema.json`), into the artifact `agk-pipeline` after every routing run. The brief of issue #70 asks the cockpit to be built to rules 1 to 10 with that schema named in rule 2. The build also needs four words or cases that the spec does not fix, put as Q-B24-1 on issue #70: the word "Cockpit" for the link, the title and the heading; the summary of the fold of a long list; agk's `unknown` for a spec, a title or a summary; and the zero counts of the strip (the conductor answered that no stray comma may be shown).

**Old text and new text.** (the words that change; the rest of each paragraph is as it is)

1. Rule 1: "linked from the start page and the project pages" gains "by the word "Cockpit" (also the page's title and heading)".
2. Rule 2: "The schema is agk's and is not written yet: ... this spec is amended when agk writes its schema." becomes the closed list of agk's schema 1: exactly `schema` (the number 1), `as_of` (a UTC time), `ready` (items of exactly `number`, `summary`, `url`), `approve` (items of exactly `number`, `spec`, `spec_title`, `url`) and `counts` (exactly the six keys, each an integer from 0 or `"unknown"`); the archive holds exactly the entry `pipeline.json`; the reasons "the pipeline document could not be read", "the pipeline document has a schema this page does not read" and "no pipeline document exists" are fixed.
3. Rule 4: the case of agk's `unknown` is stated: with a title the title line, with a title of `unknown` and a `SPEC-dddd` the fallback line, with both `unknown` the line "A spec waiting for approval could not be read: not known yet." linked to the pull request. A `summary` of `unknown` is the fallback of rule 3.
4. Rule 9: the fold of a long list has the summary "{project} ({n})".
5. Rule 10: the phrases "Cockpit", "All projects", "A spec waiting for approval could not be read: not known yet." and "{project} ({n})" are added.
6. Rule 5: a count of 0 is shown muted on every width, not hidden on a phone as SPEC-0009 rule 4 does, because a hidden count would leave its separator behind; each separator belongs to the count it comes before (the first count has none, each later count starts with ", "). This is the fallback the conductor named in the answer to Q-B24-1 item 4, since hiding a leading separator by CSS alone cannot be done cleanly within SPEC-0008.
7. Tests: a line for rule 2 is added (REQ-110 AC4 and AC6), the line for rule 4 states the three forms and the line for rule 5 states the zero.
8. Residual: the pipeline document exists, but a project shows it only after it has the kit version whose router publishes it.

## Amendment 19 — SPEC-0010 rules 5, 7 and 10 and the Tests: the strip's separator and the time in plain words

SPEC-0010 is `docs/specs/0010-a-person-sees-what-waits-for-them-specs-to-approve-and-pull.md`, applied by ADR-0038.

**Reason.** The maintainer's phone screenshot of `/cockpit` (2026-10-26, brief #75) shows two faults of the cockpit built to SPEC-0010 as amended by Amendment 18. When the counts strip wraps, the next line starts with ", approve 0", because rule 5 (as amended) put the separator at the start of the next count's span. And the time shows as the data's raw `2026-10-26T02:48:20Z`, which is not plain words, and it breaks across lines.

**Old text and new text.** (the words that change; the rest of each paragraph is as it is)

1. Rule 5: "Each separator belongs to the count it comes before: the first count has none and each later count starts with ", "." becomes "Each separator ends the count before it and stays with it, so a count never breaks inside and no line of the strip starts with a comma: the last count has none, and the strip wraps only between counts." A 0 stays muted and never hidden.
2. Rule 7: "shows "as of {as_of}" with the data's own value, placed as it is" becomes "shows "as of {time}", the time of the data in plain words, `D Mon YYYY, HH:MM UTC` (the day without a leading zero, the month as three letters, a 24-hour clock, always UTC, because the page is rendered on the server and does not know the viewer's zone), made from the digits of the data's own `as_of` with nothing computed; the data's own value stays in the `datetime` of a `<time>` element, and a time that is not a real one is shown as the data gives it. The time does not break across lines." The same time is used in every place the cockpit shows `as_of`.
3. Rule 10: the phrase "as of {as_of}" becomes "as of {time}".
4. Tests: the lines for rules 5 and 7 state the separator and the time format.
