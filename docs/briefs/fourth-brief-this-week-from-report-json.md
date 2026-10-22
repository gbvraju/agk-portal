# Brief: Fourth brief: the This week section renders report.json (REQ-105), in four items

Written in the architect role (`.claude/agents/architect.md`) in an ordinary session: its tool list and guard hook are not enforced here, only the rules of the file bind. Date 2026-10-22. It replaces the third brief (PR #27, rejected and closed unmerged on 2026-10-22: it had the page reproduce the report's rules in a second language). It builds SPEC-0005 as amended by Amendment 6 (`docs/runs/proposed-spec-amendments-4.md`, applied by ADR-0019 in the pull request that carries this brief), on agk SPEC-0022 (the report also publishes its sections as data in `report.json`, schema 1, kit 0.39.0) and on the archive reader of ADR-0017. Items 1 to 4 start only after that pull request is merged.

## Estimate and split

The rule: an item that measures over about 600 changed lines of code and tests is split, and said so before building. The measured cost of the first plan was about 2,300 changed lines (a port of about 530 lines of the report, a parity harness, five test files, about 700 lines of fixtures). Rendering data is less, but not small: the closed list of agk SPEC-0022 rule 5 has 21 item kinds, each with fields and links and each with a fixed phrase of SPEC-0005 rule 10; the page must also check the document against the closed list before it trusts it, escape every title, and refuse an address that is not GitHub's. Estimate of the whole, before fixtures: about 620 lines of code (a document check of about 120, the renderers of about 450, the wiring of about 50) and about 960 lines of tests, about 1,600 in all. The fixtures are not written: they are the kit's own goldens under `tests/kit/fixtures/report/golden/` (public data, no token, no signed address), copied unchanged; the five or six used are about 1,400 lines of JSON. Four items of about 350 to 480 lines of code and tests each, one pull request each, never stacked.

## Rules block

Operating rules that apply to every item (`constitution/principles.md` by number; `CLAUDE.md` for the short form):

- Principle 1: `.github/`, `agk.toml`, `constitution/` and `docs/requirements.md` are protected paths. No item here changes one, except the final status line of REQ-105 (status-only, exempt) on the maintainers' word.
- Principle 2 and 11: never merge, enable auto-merge, or bypass or weaken a check.
- Principle 3: one pull request per item, branched from `origin/main`, never stacked; one open pull request at a time.
- Principle 5 and `CLAUDE.md` rule 4: tests first, shown failing on the base; every test carries its `REQ-105 ACn` marker; nothing is marked done by the builder. The pull request body never declares `Behaviour: unchanged` for an item that adds behaviour.
- Principle 7: a fact that is not confirmed is marked `(verify)` in the file and in the pull request body.
- Principle 9 and `CLAUDE.md` rule 5: no secret anywhere; no network call in a check. The fixtures hold no token, no signed address and no real customer data.
- Principle 10: dates from `date -u`; the pull request body states `Advances:`, `Size:` and `Expected:` copied from the item.
- No kit file (`scripts/agk/`, workflows of the kit, `Makefile`, `agk.mk`, `.gitignore`) is edited.
- The core (`site/src/core/`) imports only relative paths inside itself, has no runtime dependency and uses only web-standard APIs (SPEC-0003). The page shows no script and no inline style (SPEC-0004 rule 2); every value from the data is escaped before it reaches the page, and a link is shown only if its address starts with `https://github.com/`.
- The page renders the report's data; it computes no section, no date and no sum (SPEC-0005 as amended). An unknown stays "not known yet".
- Principle 12: on ambiguity or a refusal, stop and report; do not widen the item.

## Items

### Item 1 — The report document and the section shell (REQ-105 AC1 in part, AC6, AC8)

- Advances: REQ-105
- Scope: `site/src/core/` (the archive reader returns `report.json` as well as `facts.json`, the document check of SPEC-0005 rule 13 against the closed list of agk SPEC-0022 rules 3 to 5, the opening line, the notices, the dirty notice and the facts-commit link, the escaping and the link check, the section shell in the card with no part yet), `site/tests/this-week.test.ts`, `site/tests/fixtures/report/` (the goldens `kinds`, `facts-empty`, `quiet`, `dirty-unknown` copied unchanged, and documents to be refused made from them in the tests). No other path.
- Needs: the pull request of ADR-0019 merged.
- Acceptance:
  1. Tests first, shown failing on the base: a golden passes the document check and its opening line equals SPEC-0005 rule 1; a document that is not JSON, of another schema, with an extra or a missing key, an extra or unknown kind, an extra or missing field, a date that is not `YYYY-MM-DD`, or `unknown` where the list does not allow it, gives the card "Not known yet: the report could not be read." and no This week while the facts card still reads; an archive without `report.json` gives "Not known yet: the artifact has no report (made before kit 0.39.0)."; a `working-tree-modified` notice shows the fixed notice and the `facts-commit` link; a title with markup is escaped; a link that is not `https://github.com/` is not shown; the card of a project whose `repo` is unknown shows no This week.
  2. The markers are `REQ-105 AC1` (the week and the opening), `AC6` and `AC8`.
- Branch: chore/this-week-report-shell
- Size: M
- Expected: 3-5 hours

### Item 2 — Delivered and Time and review (REQ-105 AC1, AC2, AC4, AC5, AC7)

- Advances: REQ-105
- Scope: `site/src/core/` (the renderers of the kinds `requirement-done`, `pull-request-merged`, `pull-requests-merged`, `pull-request-cost`, `week-totals` and `unknown` in their sections), `site/tests/this-week-delivered.test.ts`, `site/tests/fixtures/report/` (further goldens, copied unchanged). No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base, for each golden: every item of the two sections appears once, in the order of the data, with its identifiers, numbers, dates, hour strings and links; the phrases are those of SPEC-0005 rule 10 and no pull request title is a sentence; an empty section says "Nothing this week" and no other part does; a busy week shows the summary line and no per-change line; an `unknown` value is "not known yet" with the count of changes that lack it ("{k} of {n} changes") and never a number or zero; the page does no arithmetic (the hour strings are shown as they are).
  2. The markers are `REQ-105 AC1`, `AC2`, `AC4`, `AC5` and `AC7`, for these two sections.
- Branch: chore/this-week-delivered-time
- Size: M
- Expected: 3-5 hours

### Item 3 — Proven and Needs your decision (REQ-105 AC1, AC2, AC3, AC4, AC5)

- Advances: REQ-105
- Scope: `site/src/core/` (the renderers of `requirement-proven`, `requirement-not-proven` with its six reasons, `planned-not-counted`, the six groups of `needs_you` with their counts and the kinds `draft-spec`, `proposed-adr`, `question`, `pull-request-no-verdict`, `overdue-residual`, `unspecced-requirement`), `site/tests/this-week-proven-decision.test.ts`, `site/tests/fixtures/report/` (further goldens, copied unchanged). No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base, for each golden: every item appears once, in the data's order, with its identifiers, numbers, dates and links; each reason of SPEC-0005 rule 10 is shown with its words (an unlisted proof code as the code, a missing one as "reason not known yet"); a group count of `unknown` is "not known yet"; no file path, residual text or specification title is a sentence; the singular for a count of one.
  2. The markers are `REQ-105 AC1`, `AC2`, `AC3`, `AC4` and `AC5`, for these two sections.
- Branch: chore/this-week-proven-decision
- Size: M
- Expected: 3-5 hours

### Item 4 — At risk (REQ-105 AC1, AC2, AC3, AC4, AC5)

- Advances: REQ-105
- Scope: `site/src/core/` (the renderers of `residual-overdue`, `pull-requests-open-long`, `pull-requests-sent-back`, `pull-requests-merged-no-verdict`, `pull-requests-merged-not-cleared` and `drift-audit`, with their entries and the three forms of the housekeeping line), `site/tests/this-week-risk.test.ts`, `site/tests/fixtures/report/` (further goldens, copied unchanged). No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base: every item and every entry appears once, in the data's order, with its numbers, days and links; a kind with two or more pull requests is one line that names every one; the housekeeping line has its three forms (an open issue, none open, unknown) and no code is shown; the page of all five sections for each golden holds every item of the data and nothing else; a test changes one number in a golden and shows that only the line that depends on it changes.
  2. The markers are `REQ-105 AC1`, `AC2`, `AC3`, `AC4` and `AC5`, for this section. After this item merges, the maintainers say whether REQ-105 is done (a final status-only commit on their word).
- Branch: chore/this-week-risk
- Size: M
- Expected: 3-5 hours

## Open questions

- Q-B13-1 REQ-105 AC2 compares the page with "the output of the repository's scripts/agk/product_report.py". This repository's copy is kit 0.32.0, which has no `--json`. The reading chosen: the parity test of Items 1 to 4 compares the page with the kit's goldens (the data); once this repository's kit is upgraded to 0.39.0 or later (the maintainers' separate decision, not in this brief), a test also runs the script on the golden's facts and checks that its `--json` output equals the golden (SPEC-0005 rule 11 as amended). The requirement text is not changed.
- Q-B13-2 The two reasons for an unreadable report ("the report could not be read"; "the artifact has no report (made before kit 0.39.0)") are the builder's wording. The maintainers rule.
- Q-B13-3 The count "{k} of {n} changes" lacking an hour value is a count of items in the data, not a rule of the report; the reading chosen: the page may count items it renders. The maintainers rule if the page must show nothing the data does not state.
- Q-B13-4 The goldens are copied from agk at its commit 2319194 (the kit's `tests/kit/fixtures/report/golden/*/report.json`); they match kit 0.39.0 (verify against `kit/report-schema.json` of that version). A schema change fails the document check and is a new amendment.
- Q-B13-5 Until Item 4 merges the section shows only the parts built (Q-B4-1 of the rejected brief, kept): a part not built is not shown at all; the page is not shown to anyone but the maintainers' staging.

## Report format

The PR body for each item contains:

- Advances: REQ-nnn
- Build-state row: Date | Change | REQs
- Decisions taken: one line each, with the brief section it came from
- Brief: <path>#<item>, with the item's Size: and Expected: lines copied unchanged
- Questions: the Q list
- Verified: commands run and their results, verbatim counts
