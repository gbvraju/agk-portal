# Brief: Fourth brief: the This week section renders report.json (REQ-105), in four items

Written in the architect role (`.claude/agents/architect.md`) in an ordinary session: its tool list and guard hook are not enforced here, only the rules of the file bind. Date 2026-10-22. It replaces the third brief (PR #27, rejected and closed unmerged on 2026-10-22: it had the page reproduce the report's rules in a second language). It builds SPEC-0005 as amended by Amendment 6 (`docs/runs/proposed-spec-amendments-4.md`, applied by ADR-0019 in the pull request that carries this brief), on agk SPEC-0022 (the report also publishes its sections as data in `report.json`, schema 1, kit 0.39.0) and on the archive reader of ADR-0017. Item 0 (the kit upgrade) and then Items 1 to 4 start only after that pull request is merged, one at a time.

## Estimate and split

The rule: an item that measures over about 600 changed lines of code and tests is split, and said so before building. The measured cost of the first plan was about 2,300 changed lines (a port of about 530 lines of the report, a parity harness, five test files, about 700 lines of fixtures). Rendering data is less, but not small: the closed list of agk SPEC-0022 rule 5 has 21 item kinds, each with fields and links and each with a fixed phrase of SPEC-0005 rule 10; the page must also check the document against the closed list before it trusts it, escape every title, and refuse an address that is not GitHub's. Estimate of the whole, before fixtures: about 620 lines of code (a document check of about 120, the renderers of about 450, the wiring of about 50) and about 960 lines of tests, about 1,600 in all. The fixtures are not written: they are the kit's own facts documents under `tests/kit/fixtures/` (public data, no token, no signed address), copied unchanged: `report/kinds`, `report/busy`, `report/quiet`, `report/dirty-unknown`, `facts/ok` and `facts/empty`, about 2,100 lines of JSON; the `report.json` of each is not copied but written at test time by this repository's own `scripts/agk/product_report.py --json` (kit 0.39.0 or later, Item 0), which is what REQ-105 AC2 names. Item 0 is the kit upgrade itself, in a pull request of its own; its changed lines are kit files replaced verbatim, and are counted apart from code and tests. Four items of about 350 to 480 lines of code and tests each after it, one pull request each, never stacked.

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

### Item 0 — Upgrade the kit to its latest release (REQ-105 AC2)

- Advances: REQ-105
- Scope: the files that the plugin's own `upgrade.py` changes when it takes this install from 0.32.0 to the latest release (0.39.0 or later; the dry run lists them: the verbatim kit files such as `scripts/agk/`, the kit workflows under `.github/workflows/`, `.claude/`, the templates, `Makefile` and `agk.mk`, and the `version` line of `agk.toml`), `docs/adr/0020-upgrade-agk-<version>.md` (Proposed, naming each protected class that changes: `.github/`, `scripts/agk/`, `agk.toml`, and any other the dry run shows), the settings entry of the plugin ref (`.claude/settings.json`, the residual of ADR-0004), and a decisions-log row. No other path; no file of this project's own is edited by hand.
- Needs: the pull request of ADR-0019 merged; the latest release of the kit installed as the plugin.
- Acceptance:
  1. A dry run first: the list of files it would change is in the pull request body before the real run, and the real run changes exactly those and no other.
  2. The upgrade ADR is in the same pull request and names each protected class that changes; a project file that the kit would overwrite (a verbatim file this project has edited) is reported as a question and not overwritten silently.
  3. The reviewer handle in `config/reviewers.yaml` is checked against `verdict_authors` (who may post a verdict) and the result is stated in the pull request body; a mismatch is reported, not edited around.
  4. `agk:doctor` reports nothing misconfigured; `make governance` and `make test` pass; `scripts/agk/product_report.py --facts FILE --week WEEK --json OUT` writes a `report.json` for a copied kit fixture, and the pull request body states its first lines.
  5. The `(verify)` of Q-B13-4 (the schema of `report.json`) is settled by that run.
- Branch: chore/upgrade-agk
- Size: M
- Expected: 2-4 hours

### Item 1 — The report document and the section shell (REQ-105 AC1 in part, AC6, AC8)

- Advances: REQ-105
- Scope: `site/src/core/` (the archive reader returns `report.json` as well as `facts.json`, the document check of SPEC-0005 rule 13 against the closed list of agk SPEC-0022 rules 3 to 5, the opening line, the notices, the dirty notice and the facts-commit link, the escaping and the link check, the section shell in the card with no part yet), `site/tests/this-week.test.ts`, `site/tests/fixtures/report/` (the facts documents `kinds`, `empty`, `quiet` and `dirty-unknown`, copied unchanged from the kit's fixtures; the `report.json` of each is written at test time by `scripts/agk/product_report.py --json`, and documents to be refused are made from it in the tests). No other path.
- Needs: Item 0 merged.
- Acceptance:
  1. Tests first, shown failing on the base: a document written by this repository's script from a fixture facts document passes the document check and its opening line equals SPEC-0005 rule 1; a document that is not JSON, of another schema, with an extra or a missing key, an extra or unknown kind, an extra or missing field, a date that is not `YYYY-MM-DD`, or `unknown` where the list does not allow it, gives the card "Not known yet: the report could not be read." and no This week while the facts card still reads; an archive without `report.json` gives "Not known yet: the artifact has no report (made before kit 0.39.0)."; a `working-tree-modified` notice shows the fixed notice and the `facts-commit` link; a title with markup is escaped; a link that is not `https://github.com/` is not shown; the card of a project whose `repo` is unknown shows no This week.
  2. The markers are `REQ-105 AC1` (the week and the opening), `AC6` and `AC8`.
- Branch: chore/this-week-report-shell
- Size: M
- Expected: 3-5 hours

### Item 2 — Delivered and Time and review (REQ-105 AC1, AC2, AC4, AC5, AC7)

- Advances: REQ-105
- Scope: `site/src/core/` (the renderers of the kinds `requirement-done`, `pull-request-merged`, `pull-requests-merged`, `pull-request-cost`, `week-totals` and `unknown` in their sections), `site/tests/this-week-delivered.test.ts`, `site/tests/fixtures/report/` (further facts documents, copied unchanged). No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base, for each fixture facts document (the `report.json` written by the repository's script): every item of the two sections appears once, in the order of the data, with its identifiers, numbers, dates, hour strings and links; the phrases are those of SPEC-0005 rule 10 and no pull request title is a sentence; an empty section says "Nothing this week" and no other part does; a busy week shows the summary line and no per-change line; an `unknown` value is "not known yet", with no count unless the data carries one (Q-B13-3), and never a number or zero; the page does no arithmetic and counts nothing (the hour strings are shown as they are).
  2. The markers are `REQ-105 AC1`, `AC2`, `AC4`, `AC5` and `AC7`, for these two sections.
- Branch: chore/this-week-delivered-time
- Size: M
- Expected: 3-5 hours

### Item 3 — Proven and Needs your decision (REQ-105 AC1, AC2, AC3, AC4, AC5)

- Advances: REQ-105
- Scope: `site/src/core/` (the renderers of `requirement-proven`, `requirement-not-proven` with its six reasons, `planned-not-counted`, the six groups of `needs_you` with their counts and the kinds `draft-spec`, `proposed-adr`, `question`, `pull-request-no-verdict`, `overdue-residual`, `unspecced-requirement`), `site/tests/this-week-proven-decision.test.ts`, `site/tests/fixtures/report/` (further facts documents, copied unchanged). No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base, for each fixture facts document (the `report.json` written by the repository's script): every item appears once, in the data's order, with its identifiers, numbers, dates and links; each reason of SPEC-0005 rule 10 is shown with its words (an unlisted proof code as the code, a missing one as "reason not known yet"); a group count of `unknown` is "not known yet"; no file path, residual text or specification title is a sentence; the singular for a count of one.
  2. The markers are `REQ-105 AC1`, `AC2`, `AC3`, `AC4` and `AC5`, for these two sections.
- Branch: chore/this-week-proven-decision
- Size: M
- Expected: 3-5 hours

### Item 4 — At risk (REQ-105 AC1, AC2, AC3, AC4, AC5)

- Advances: REQ-105
- Scope: `site/src/core/` (the renderers of `residual-overdue`, `pull-requests-open-long`, `pull-requests-sent-back`, `pull-requests-merged-no-verdict`, `pull-requests-merged-not-cleared` and `drift-audit`, with their entries and the three forms of the housekeeping line), `site/tests/this-week-risk.test.ts`, `site/tests/fixtures/report/` (further facts documents, copied unchanged). No other path.
- Needs: Item 1 merged.
- Acceptance:
  1. Tests first, shown failing on the base: every item and every entry appears once, in the data's order, with its numbers, days and links; a kind with two or more pull requests is one line that names every one; the housekeeping line has its three forms (an open issue, none open, unknown) and no code is shown; the page of all five sections for each fixture facts document holds every item of the data and nothing else; a test changes one number in a fixture and shows that only the line that depends on it changes.
  2. The markers are `REQ-105 AC1`, `AC2`, `AC3`, `AC4` and `AC5`, for this section. After this item merges, the maintainers say whether REQ-105 is done (a final status-only commit on their word).
- Branch: chore/this-week-risk
- Size: M
- Expected: 3-5 hours

## Open questions

Ruled by the maintainers on 2026-10-22 (verdict "fix list" on PR #37), recorded in the decisions log:

- Q-B13-1 ruled: AC2 tests run this repository's own `scripts/agk/product_report.py --json`, not copied goldens; hence Item 0 (the kit upgrade) before Item 1.
- Q-B13-2 accepted: the two card reasons for an unreadable or absent report ("the report could not be read"; "the artifact has no report (made before kit 0.39.0)") are as written.
- Q-B13-3 ruled: the page computes no count. If `report.json` carries no count of items lacking hours, the phrase is "not known yet" without "{k} of {n}". See the kit residual below.
- Q-B13-4 settled by Item 0: the schema is read from the kit that is installed, not assumed from copied goldens.
- Q-B13-5 as read: until Item 4 the section shows only the parts built (a part not built is not shown at all); the page is not shown to anyone but the maintainers' staging.

Open:

- Q-B13-6 REQ-105 AC5 says "not known yet with the count of items lacking it". With Q-B13-3 the page shows no count, so that clause is not met until agk's report carries it. The requirement text is protected (`docs/requirements.md`) and is not changed here. The reading chosen: the clause stays unmet and is recorded as a residual; the maintainers decide whether to amend AC5 by an ADR or to wait for the kit.

## Kit residual (for agk, not this repository)

- Generic: the `cost` item (`week-totals`, or each `pull-request-cost`) could carry the count of merged changes lacking hours, so that a reader can say how many changes a "not known yet" total lacks without counting. A schema change of agk SPEC-0022, raising the schema number (owner: agk maintainers).

## Report format

The PR body for each item contains:

- Advances: REQ-nnn
- Build-state row: Date | Change | REQs
- Decisions taken: one line each, with the brief section it came from
- Brief: <path>#<item>, with the item's Size: and Expected: lines copied unchanged
- Questions: the Q list
- Verified: commands run and their results, verbatim counts
