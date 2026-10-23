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
