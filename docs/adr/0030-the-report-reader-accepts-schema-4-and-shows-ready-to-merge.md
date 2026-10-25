# ADR-0030: The report reader accepts schema 4 and shows Ready to merge

- Status: Accepted
- Date: 2026-10-25
- Deciders: maintainers
- Related: ADR-0019, ADR-0026, ADR-0028
- Requirements: REQ-105, REQ-109

## Context

agk #184 (REQ-037 part c) makes `report.json` schema 4: `needs_you` gains the group `ready` ("Ready to merge"), first in the data, with the item kind `pull-request-ready` (exactly `number`, `title` and `links`); no other field changes. The first weekly report written after #184 merges would not be read by this page (a schema it does not know reads "the report could not be read"), and the agk line would lose its week. Issue #58 asks for the reader, the group first with a link to each pull request, schemas 1 to 3 kept, and the page to say when a schema is unknown.

## Decision

1. The reader accepts schema 4: schema 3's lists plus the group `ready` and the kind `pull-request-ready` with exactly `number`, `title` and `links`; nothing else is accepted for 4, and schemas 1 to 3 refuse the group and the kind. The group is optional in the data: a week with nothing ready has none.
2. The page shows the group as the other Needs your decision groups, in the data's order (first), headed "Ready to merge ({n})" with the data's count ("not known yet" when the count is `unknown`, never zero), each item as `PR #{n} "{title}"` with the whole text linked to its pull request and the Needs you badge; an unreadable clearance is the existing unknown line with its link. A group over 5 items folds as the others do. This is the one place a pull request's title is shown (the brief says so); the title is escaped.
3. A report whose `schema` is an integer that is not 1 to 4 reads, on the card, "the report has a schema this page does not read", with the week; any other departure still reads "the report could not be read". The start page puts such a project under Not known yet with that reason.
4. The start page places a report of schema 3 or later by its counts (a schema 4 report has them).
5. SPEC-0005 is amended by Amendment 13 and SPEC-0009 by Amendment 14 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request. The fixtures are the goldens of agk #184 at head 98dca8c (busy and facts-pr-states), copied unchanged.

## Consequences

- The page reads the first report of agk #184's kit, and a later schema is said, not shown as an empty week.
- The count of the section `needs_you` in `counts` includes the ready items as the kit counts them; the page places by it and adds nothing.

## Residual

None.
