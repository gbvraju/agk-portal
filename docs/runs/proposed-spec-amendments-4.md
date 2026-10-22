# Proposed spec amendments 4 (SPEC-0005)

Date: 2026-10-22 (from `date -u`). Approved specs are changed only through a proposal like this one (principle 6), applied by an ADR (ADR-0019). SPEC-0005 is `docs/specs/0005-the-this-week-section-shows-for-the-week-the-facts-artifact.md`.

## Amendment 6 — the rule of the section, and rules 1 to 9, 11, 12 and 13

**Reason.** From kit 0.39.0 the agk weekly report publishes the sections it computed as data, in `report.json` beside `facts.json` in the same artifact `agk-facts-<week>` (agk SPEC-0022, schema 1: a closed list of item kinds, each with its fields and links). SPEC-0005 as approved had the page reproduce the report's rules in a second language, which was measured at about 2,300 changed lines (a port of about 530 lines of the report, a parity harness, five test files and the fixtures) and which invites drift. The maintainers ruled on 2026-10-22 that the page renders the report's data instead, and agrees with the report by construction. Rule 10 (the fixed phrases) is unchanged: the page writes its own sentences from the kinds, as it always did. The requirement text of REQ-105 is unchanged.


## The rule of the section (the introduction)

**Old text.** Each part of This week is computed exactly as the agk product report computes its section of the same name, from the same facts fields. The report is a pure function of the facts document (agk SPEC-0011 rule 2) and is vendored in this repository at kit 0.32.0 as `scripts/agk/product_report.py` (byte-identical to the agk repository's file when this spec was written). The references below are to agk specs and to that script; they are read-only references (this project is not named in agk).

**New text.**

> Each part of This week is rendered from the section of the same name in `report.json`, the data that the agk product report writes beside `facts.json` in the same artifact (agk SPEC-0022, kit 0.39.0, schema 1). The report's own script computed every item from the same facts and rendered its markdown from the same structure, so the page and the report agree by construction; the page computes no section and re-implements no rule of the report (amended 2026-10-22 by Amendment 6 of `docs/runs/proposed-spec-amendments-4.md`, ADR-0019; the first form of this spec had the page reproduce the report's rules, measured at about 2,300 changed lines). The references below are to agk specs; they are read-only references (this project is not named in agk).

## Rule 1

**Old text.** 1. **The week.** The week is the ISO week label of the `agk-facts-<week>` artifact (SPEC-0001 rule 2), from Monday 00:00 to the next Monday 00:00 in UTC, as `week_window` of the report computes it with `--week` (agk SPEC-0011 rule 8, the opening line). The lists of what waits for a person are as of the facts' `today`. The section opens with the fixed phrase "Week {label}: Monday {start} to Sunday {end} (UTC). What waits for you is as of {today}.".

**New text.**

> 1. **The week.** The week is the `week` of `report.json` (the ISO week label of the `agk-facts-<week>` artifact, SPEC-0001 rule 2), and the first and last day and the day the lists are as of are `opening.first`, `opening.last` and `opening.as_of` (Monday to Sunday in UTC; what waits for a person is as of `as_of`). The section opens with the fixed phrase "Week {label}: Monday {start} to Sunday {end} (UTC). What waits for you is as of {today}.". The page computes no date.

## Rule 2

**Old text.** 2. **Five parts, in order.** Delivered, Proven, Needs your decision, At risk, Time and review, the report's five sections in the report's order (agk SPEC-0011 rule 8; `SECTIONS` and `render_report`). A part with no line says "Nothing this week", and that is the only reason for it. A part whose source is `"unknown"` shows one line "{What} could not be read: not known yet." in place of its lines (agk SPEC-0011 rule 12).

**New text.**

> 2. **Five parts, in order.** Delivered, Proven, Needs your decision, At risk, Time and review: the five keys `delivered`, `proven`, `needs_you`, `at_risk` and `cost` of `sections`, in that order. A part whose list is empty says "Nothing this week", and that is the only reason for it. An item of kind `unknown` (agk SPEC-0022 rule 5) shows one line "{What} could not be read: not known yet." in place of the lines the thing would have given, where {What} is the item's `what`.

## Rule 3

**Old text.** 3. **Delivered** is computed as `delivered` in the report: agk SPEC-0011 rule 9 (Delivered), as amended by agk SPEC-0017 rules 3 to 5 (a requirement counts only in the week its `done_on` falls in; a `done` requirement with `done_on` unknown is listed with the note "week it became done: not known yet") and by agk SPEC-0015 rules 1 and 3 (a week with more than ten merged pull requests shows one summary line, the week link, and no line per pull request). One line per requirement, then one line per pull request with `state` `merged` and `merged_at` inside the week, in the report's order.

**New text.**

> 3. **Delivered** renders the items of `sections.delivered`, in the order of the data: one line per `requirement-done` (its `title`, its `criteria` count and list, or "its acceptance criteria are not known yet", and the note "week it became done: not known yet" when `became_done` is `unknown`), one line per `pull-request-merged`, and, for a busy week, the one summary line of `pull-requests-merged` with the week link and no line per pull request (the report decides, agk SPEC-0015).

## Rule 4

**Old text.** 4. **Proven** is computed as `proven` in the report: agk SPEC-0011 rule 9 (Proven). One line per requirement whose `status` is `done` or `in-progress`, proven or not proven by the report's reasons in the report's order, `planned` requirements counted in one closing line. The proof words are the report's `REASON_WORDS`, shown as in rule 10.

**New text.**

> 4. **Proven** renders the items of `sections.proven`, in the order of the data: `requirement-proven` ("proven", or "skipped: declared as not changing behaviour" for a `last_change.proof` of `skipped`), `requirement-not-proven` with its `reasons` joined by "; " in the order of the data, each reason a fixed phrase of rule 10 (an unlisted proof code is shown as the code and a missing one as "reason not known yet"), and the closing line of `planned-not-counted`.

## Rule 5

**Old text.** 5. **Needs your decision** is the report's Needs you, computed as `inbox` in the report: agk SPEC-0011 rules 3 to 6, all six kinds in the report's order (draft specifications, proposed decisions, waiting questions, changes without a verdict at least `inbox_hours` old, overdue residuals, planned requirements with no specification), each group headed by its count.

**New text.**

> 5. **Needs your decision** renders the groups of `sections.needs_you` in the order of the data, each headed by its `count` ("not known yet" when the count is `unknown`) and by the fixed heading of its `group` (`spec`, `adr`, `question`, `pull-request`, `residual`, `requirement`), and its items: `draft-spec`, `proposed-adr`, `question`, `pull-request-no-verdict`, `overdue-residual`, `unspecced-requirement`. The page never shows a file path as a sentence (it is behind the link).

## Rule 6

**Old text.** 6. **At risk** is computed as `at_risk` in the report: agk SPEC-0011 rule 10 (At risk) with its grouping by kind from agk SPEC-0016 rules 1 to 6: overdue residuals, open pull requests older than 7 days, pull requests sent back, the drift line, then the pull requests merged without a verdict or before their last commit was cleared. A kind with two or more pull requests is one line that names every one of them, in ascending order. Unproven changes stay visible: they are named under Proven and under At risk exactly where the report names them.

**New text.**

> 6. **At risk** renders the items of `sections.at_risk`, in the order of the data: `residual-overdue`, `pull-requests-open-long`, `pull-requests-sent-back` (one line that names every pull request of `entries`, in the order of the data, when there are two or more), `drift-audit`, `pull-requests-merged-no-verdict` and `pull-requests-merged-not-cleared`. Unproven changes stay visible exactly where the data names them.

## Rule 7

**Old text.** 7. **Time and review** (the report's Cost) is computed as `cost` in the report: agk SPEC-0011 rule 10 (Cost) with agk SPEC-0018 rule 6 and SPEC-0015 rule 4. For each pull request merged in the week, the hours from `created_at` to `merged_at` rounded half-up to 0.1 and its number of `fix` verdicts (the review rounds); then the totals: pull requests merged, hours in total, review rounds in total, the number that declared `Behaviour: unchanged`, and "estimate: {N} of {M} within range" or "none declared this week" as `estimate_ending` computes it from `estimated_hours` and `actual_hours`. The sums use whole tenths of an hour, not floating point, so the page and the report round alike. Any unknown term makes the sum "not known yet" with the count of changes that lack it ("{k} of {n} changes"), never a number and never zero. Hours only: no money and no rate (Q-S0005-1 for the hours).

**New text.**

> 7. **Time and review** (the report's Cost) renders the items of `sections.cost`, in the order of the data: one `pull-request-cost` line per merged change (its `hours` from opening to merge and its `fix_verdicts` review rounds) and the `week-totals` line (changes merged; time from opening to merge in hours in total; review rounds in total; declared as not changing behaviour; "estimate: {within} of {counted} within range" or "estimate: none declared this week"). The hours are the decimal strings of the data; the page does no arithmetic and no rounding. A value that is `unknown` is "not known yet" with, for the totals, the count of `pull-request-cost` items whose value is `unknown` ("{k} of {n} changes"), never a number and never zero. Hours only: no money and no rate (Q-S0005-1 for the hours).

## Rule 8

**Old text.** 8. **Unknown and the dirty notice.** A value the facts mark `"unknown"` is shown as "not known yet", never as zero or empty (agk SPEC-0011 rule 12). When `dirty` is not `false` the part shows the fixed notice "These numbers were made from a copy with unsaved changes; treat them with care." and the facts commit as a link (agk SPEC-0009 rule 24; SPEC-0011 rule 11, the footer).

**New text.**

> 8. **Unknown and the dirty notice.** A value that the data holds as `"unknown"` is shown as "not known yet", never as zero or empty (agk SPEC-0022 rule 6). When `notices` holds an item of kind `working-tree-modified` the section shows the fixed notice "These numbers were made from a copy with unsaved changes; treat them with care." and, from the item of kind `facts-commit`, the facts commit as a link. The other notices (`kit-version`, `metrics-issue`, `drift-audit-issue`) are not shown on the page, except that the drift line of rule 10 uses the `drift-audit` item.

## Rule 9

**Old text.** 9. **Links.** Every line ends with a link to its evidence, built from the facts' `repo` and `commit` as the report builds them (agk SPEC-0011 rule 11): a pull request `https://github.com/{repo}/pull/{n}`, an issue `.../issues/{n}`, a file at the facts commit `.../blob/{commit}/{path}`, a directory `.../tree/{commit}/{path}`, and the merged-in-the-week search of a busy week. A project whose `repo` is `"unknown"`, whose facts cannot be read, or whose `schema` is not 1 shows no This week, only its card "not known yet" with the reason (SPEC-0001 rule 4; the report refuses such a document).

**New text.**

> 9. **Links.** Every line ends with the links of its item (`links`: a pull request, an issue, a file or directory at the facts commit, or a search), shown as the report built them from the facts' `repo` and `commit`. A link is shown only if its address starts with `https://github.com/` and holds no space or quote; any other address is not shown and the line stays. A project whose `repo` is `"unknown"`, whose facts cannot be read, whose `schema` is not 1, or whose report cannot be read (rule 13) shows no This week, only its card "not known yet" with the reason (SPEC-0001 rule 4).

## Rule 11

**Old text.** 11. **The parity test.** The tests render This week from each fixture facts document and week, and run `python3 scripts/agk/product_report.py --facts FILE --week WEEK` on the same pair. The report's lines are parsed into items (kind, ids, numbers, dates, counts, hours, links) and compared with the page's items one by one, in order (the housekeeping line is compared by its total; the per-code counts are not shown on the page). A test changes one number in a fixture and shows that only the line that depends on it changes. A kit upgrade that changes the report's rules fails the parity test, and this spec is then amended to follow it.

**New text.**

> 11. **The parity test.** The tests render This week from each golden `report.json` (the kit's goldens under `tests/kit/fixtures/report/golden/`, copied as fixtures, public data with no token and no signed address) and compare the page with the data item by item: every item of every section appears once, in the data's order, with its identifiers, numbers, dates, counts, hour strings and links. A test changes one number in a golden and shows that only the line that depends on it changes. Where this repository's `scripts/agk/product_report.py` is at kit 0.39.0 or later, a test runs `python3 scripts/agk/product_report.py --facts FILE --week WEEK --json OUT` on the golden's facts and checks that `OUT` equals the golden (REQ-105 AC2 as worded, Q-B13-1). A kit upgrade that changes the schema number fails the document check (rule 13), and this spec is then amended to follow it.

## Rule 12

**Old text.** 12. **Fixtures and tests.** The fixtures are facts documents under `site/tests/fixtures/` that carry no token and no signed address, covering each kind of line, an empty week, a busy week (eleven merged pull requests), unknown values in each part, a dirty document and a document whose `repo` is unknown. The tests are TypeScript files named `*.test.ts` under `site/tests/`, run by the npm command in `agk.toml` `project_tests`, each carrying the marker `REQ-105 ACn` it proves. They need Python for the parity test only.

**New text.**

> 12. **Fixtures and tests.** The fixtures are `report.json` documents under `site/tests/fixtures/report/` copied from the kit's goldens, covering each kind of the closed list (the `kinds` golden), an empty week, a quiet week, a busy week, unknown values in each section, a dirty document, and documents that must be refused (rule 13) made from them. The tests are TypeScript files named `*.test.ts` under `site/tests/`, run by the npm command in `agk.toml` `project_tests`, each carrying the marker `REQ-105 ACn` it proves. They need no Python and no network, except the optional script test of rule 11.

## Rule 13

**Old text.** (none: a new rule)

**New text.**

> 13. **The document.** The page reads `report.json` from the same archive as `facts.json` (SPEC-0001 rule 2) and checks it against the closed list of agk SPEC-0022 rules 3 to 5 before it uses anything in it: exactly the keys `schema`, `week`, `opening`, `sections`, `notices`; `schema` the number 1; the five section keys; every item an object of a kind in the list with exactly the fields of that kind and `links`; every date `YYYY-MM-DD`; `unknown` only where the list allows it. A document that is not JSON, whose schema is not 1, or that has an extra or missing key, kind or field makes This week absent and the card reads "Not known yet: the report could not be read."; an archive of an older kit, without `report.json`, makes the card read "Not known yet: the artifact has no report (made before kit 0.39.0)."; neither stops the facts card or the page. The text of a title is escaped before it is shown (SPEC-0004 rule 2).

## Tests and residual

The tests list gains the line for rule 13 and the line for rule 11 now reads "for each golden, the items, counts, hour strings, links and their order equal the data's"; the first residual (the page is tied to the report as vendored at kit 0.32.0) is replaced by one that ties the page to `report.json` schema 1. Tests: `site/tests/` (REQ-105 AC1 to AC8), in the four items of the fourth brief.
