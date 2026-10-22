# Brief: Third brief: the This week section (REQ-105), in five parts

Written in the architect role (`.claude/agents/architect.md`) in an ordinary session: its tool list and guard hook are not enforced here, only the rules of the file bind. Date 2026-10-22. It builds the Approved SPEC-0005 (REQ-105) on the data step of the second brief (Item 7b, merged). The sections Requirements (REQ-106) and Trend (REQ-107) follow in their own briefs, and Item 9 of the second brief (the first live deployment) waits for all three sections (ruling of 2026-10-22). The estimate that makes this a brief of five items is in the next section.

## Estimate and split

The rule: an item that measures over about 600 changed lines of code and tests is split, and said so before building. The report that REQ-105 must agree with is `scripts/agk/product_report.py` (755 lines); the parts of it that the page must reproduce are the helpers (about 95 lines), `delivered` (50), `proven` and `cleared_line` (105), `inbox` and its item builders (120), `drift_line`, `by_kind` and `at_risk` (105) and `cost` with `estimate_ending` (55), about 530 lines of Python. A port to TypeScript with the fixed phrases of SPEC-0005 rule 10 is about 1.2 times that for code (about 650 lines), the parity test needs a parser of the report's lines (about 130 lines) and a test for each part against its fixtures (about 250 to 330 lines each), and the fixture facts documents are about 700 lines of JSON. The whole is about 2,300 changed lines, four times the limit, so REQ-105 is built in five items, one pull request each, each about 450 to 600 lines of code and tests before fixtures. The estimate of each item is in the item. The measured count goes in each pull request body against the estimate.

## Rules block

Operating rules that apply to every item (`constitution/principles.md` by number; `CLAUDE.md` for the short form):

- Principle 1: `.github/`, `agk.toml`, `constitution/` and `docs/requirements.md` are protected paths; a change to any of them carries an ADR in the same pull request that names each class. No item here changes one, except the final status line of REQ-105 (status-only, exempt) on the maintainers' word.
- Principle 2 and 11: never merge, enable auto-merge, or bypass or weaken a check.
- Principle 3: one pull request per item, branched from `origin/main`, never stacked; one open pull request at a time.
- Principle 5 and `CLAUDE.md` rule 4: tests first, shown failing on the base; every test carries its `REQ-105 ACn` marker; nothing is marked done by the builder. The pull request body never declares `Behaviour: unchanged` for an item that adds behaviour.
- Principle 7: a fact that is not confirmed is marked `(verify)` in the file and in the pull request body; an unconfirmed fact is a question, not a guess.
- Principle 9 and `CLAUDE.md` rule 5: no secret anywhere; no network call in a check. The fixtures hold no token, no signed address and no real customer data.
- Principle 10: dates from `date -u`; the pull request body states `Advances:`, `Size:` and `Expected:` copied from the item.
- No kit file (`scripts/agk/`, workflows of the kit, `Makefile`, `agk.mk`, `.gitignore`) is edited; the vendored report is read, never changed.
- The core (`site/src/core/`) imports only relative paths inside itself, has no runtime dependency and uses only web-standard APIs (SPEC-0003). The page shows no script and no inline style (SPEC-0004 rule 2); every value from the facts is escaped before it reaches the page.
- The page uses the report's own rules: each part is computed exactly as the report computes its section of the same name, from the same facts fields; the parity test runs the vendored report and compares items one by one (SPEC-0005 rules 3 to 7 and 11). A rule of the report that the facts alone cannot reproduce is a question, never an invented rule.
- Principle 12: on ambiguity or a refusal, stop and report; do not widen the item.

## Items

### Item 1 — The foundation of This week (REQ-105 AC1 in part, AC6, AC8)

- Advances: REQ-105
- Scope: `site/src/core/` (the facts document types and reader, the week window, dates and tenths of an hour, the links of the report's `Links`, the fixed opening phrase, the dirty notice, the section shell, its place in the card), `site/tests/this-week.test.ts`, `site/tests/support/report.ts` (the runner and parser of the report's lines), `site/tests/fixtures/facts/` (the base documents). No other path.
- Needs: Python 3 on the test runner (already needed by `make governance`).
- Acceptance:
  1. Tests first, shown failing on the base: for each base fixture and week, the opening line equals SPEC-0005 rule 1 and the week window equals the report's `week_window` for `--week` (Monday 00:00 to the next Monday 00:00 UTC, including a year boundary and an ISO week 53); a dirty document shows the fixed notice and the facts commit as a link; a document whose `repo` is unknown, whose schema is not 1 or whose facts cannot be read shows no This week and only its card; a card that reads facts shows the section with the parts built so far, in the report's order, and no part that is not yet built (Q-B4-1); every value from the facts is escaped; the links are built as the report builds them.
  2. The parity harness runs `python3 scripts/agk/product_report.py --facts FILE --week WEEK` on each fixture and parses its lines into items (kind, ids, numbers, dates, counts, hours, links); a test changes one number in a fixture and shows that only the line that depends on it changes.
  3. The markers are `REQ-105 AC6` and `REQ-105 AC8`, and `REQ-105 AC1` for the week window and the opening line.
- Branch: chore/this-week-foundation
- Size: M
- Expected: 3-5 hours

### Item 2 — Delivered and Time and review (REQ-105 AC1, AC2, AC4, AC5, AC7 in part)

- Advances: REQ-105
- Scope: `site/src/core/` (Delivered as `delivered`, with the week's merged pull requests, the busy-week summary line; Time and review as `cost`, with `estimate_ending`, sums in whole tenths of an hour), `site/tests/this-week-delivered.test.ts`, `site/tests/fixtures/facts/`. No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base, against the fixtures and the report: the items, counts, hour totals and links of the two parts equal the report's and stand in its order; a requirement counts only in the week its `done_on` falls in, and a `done` requirement with `done_on` unknown carries the note "week it became done: not known yet"; a week of eleven merged pull requests shows the one summary line and the totals with the week link and no line per pull request (and ten shows the lines); an empty part says "Nothing this week" and no other part does; a sum with an unknown term is "not known yet" with the count of changes that lack it ("{k} of {n} changes"), never a number and never zero; rounding is half-up to 0.1 as the report rounds; every sentence is a phrase of SPEC-0005 rule 10 and no pull request title appears.
  2. The markers are `REQ-105 AC1`, `AC2`, `AC4`, `AC5` and `AC7`, for these two parts.
- Branch: chore/this-week-delivered-time
- Size: M
- Expected: 3-5 hours

### Item 3 — Proven (REQ-105 AC1, AC2, AC3, AC4, AC5 in part)

- Advances: REQ-105
- Scope: `site/src/core/` (Proven as `proven`, `last_change`, `why`, the proof words of `REASON_WORDS`, the closing line for planned requirements), `site/tests/this-week-proven.test.ts`, `site/tests/fixtures/facts/`. No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base: one line per requirement whose status is `done` or `in-progress`, proven or not proven with the report's reasons in the report's order, equal to the report's items; each reason of SPEC-0005 rule 10 is covered ("{ACn} has no test", no criteria listed, no merged change found, the last change did not prove it with the words for each proof code and the code itself for an unlisted code, a proof not known yet, criteria not known yet); planned requirements are counted in the closing line with the singular for one; no pull request title and no free text appears; unknown values say "not known yet".
  2. The markers are `REQ-105 AC1`, `AC2`, `AC3`, `AC4` and `AC5`, for this part.
- Branch: chore/this-week-proven
- Size: M
- Expected: 3-5 hours

### Item 4 — Needs your decision (REQ-105 AC1, AC2, AC3, AC4, AC5 in part)

- Advances: REQ-105
- Scope: `site/src/core/` (the six kinds of the report's `inbox` and their item builders: draft specifications, proposed decisions, waiting questions, changes without a verdict at least `inbox_hours` old, overdue residuals, planned requirements with no specification; each group headed by its count; as of the facts' `today`), `site/tests/this-week-decision.test.ts`, `site/tests/fixtures/facts/`. No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base: all six kinds in the report's order with the group headings and counts of SPEC-0005 rule 10 ("not known yet" when a source is unknown), item for item equal to the report's; the path of a file only behind its link; no residual text, no specification title and no pull request title as a sentence; an empty group is omitted or says "Nothing this week" exactly as the report does (Q-B4-2); ages in whole days as the report counts them.
  2. The markers are `REQ-105 AC1`, `AC2`, `AC3`, `AC4` and `AC5`, for this part.
- Branch: chore/this-week-decision
- Size: M
- Expected: 3-5 hours

### Item 5 — At risk (REQ-105 AC1, AC2, AC3, AC4, AC5 in part)

- Advances: REQ-105
- Scope: `site/src/core/` (`at_risk` with its grouping by kind: overdue residuals, open pull requests older than 7 days, pull requests sent back, the housekeeping line, merged without a review or before their final review; a kind with two or more pull requests is one line naming every one, in ascending order), `site/tests/this-week-risk.test.ts`, `site/tests/fixtures/facts/`. No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base: the lines of each kind, single and grouped, equal the report's items and order; the housekeeping line is compared by its total, with the three forms of SPEC-0005 rule 10 (an open drift issue, none open, issues not known yet) and no code shown; unproven changes appear exactly where the report names them; the page of all five parts, for each fixture, equals the report's five sections in order; a test changes one number in a fixture and shows that only the line that depends on it changes.
  2. The markers are `REQ-105 AC1`, `AC2`, `AC3`, `AC4` and `AC5`, for this part. After this item merges, the maintainers say whether REQ-105 is done (a final status-only commit on their word).
- Branch: chore/this-week-risk
- Size: M
- Expected: 3-5 hours

## Open questions

- Q-B4-1 Between Item 1 and Item 5 the section shows only the parts built so far. The reading chosen: a part that is not built is not shown at all (not shown as empty or as "not known yet", which would say something false); the page is not deployed before Item 5 because Item 9 waits for all sections, so no visitor sees an incomplete section. The maintainers rule.
- Q-B4-2 The report prints a group with no item as the single word `nothing this week` for the whole section, and SPEC-0005 rule 2 says "Nothing this week" for a part with no line. Whether an empty group inside Needs your decision is omitted or says "Nothing this week" is not stated. The reading chosen: as the report does (parity), read from the report in Item 4 and recorded in the decisions log.
- Q-B4-3 The facts schema 1 field names are read from `scripts/agk/product_report.py` (its `load` and its use of each field), the one copy of the format in this repository; agk SPEC-0009 and `kit/facts-schema.json` are not here. The fixtures are hand written to that reading and marked `(verify)` against a real facts document at the first live sign-in (Item 9 of the second brief). The reading chosen: fixtures follow the report; where the report is silent about a field, the page ignores it.
- Q-B4-4 The page does not fetch the report's issue or run Python: the report is read only by the tests. The reading chosen: the port is TypeScript in the core, the Python is the oracle of the tests only, and a kit upgrade that changes the report fails the parity test (SPEC-0005 residual).

## Report format

The PR body for each item contains:

- Advances: REQ-nnn
- Build-state row: Date | Change | REQs
- Decisions taken: one line each, with the brief section it came from
- Brief: <path>#<item>, with the item's Size: and Expected: lines copied unchanged
- Questions: the Q list
- Verified: commands run and their results, verbatim counts
