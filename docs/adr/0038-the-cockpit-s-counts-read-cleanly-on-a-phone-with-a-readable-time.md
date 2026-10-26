# ADR-0038: The cockpit's counts read cleanly on a phone, with a readable time

- Status: Accepted
- Date: 2026-10-26
- Deciders: maintainers
- Related: ADR-0036
- Requirements: REQ-110

## Context

The maintainer's phone screenshot of `/cockpit` (2026-10-26, brief #75) shows two faults of the cockpit of ADR-0036. When the counts strip wraps, the next line starts with ", approve 0", because the separator was put at the start of the next count's span (the answer to Q-B24-1 item 4, which asked for no trailing comma and was met with a leading one). And the time shows as the data's raw `2026-10-26T02:48:20Z`, which is not plain words, and it breaks across lines.

## Decision

1. The separator ends the count before it and stays with it: each count but the last is its text and its comma in one span, the last has none, the spans are separated by a space so that the strip wraps only between counts, and a count does not break inside (`white-space:nowrap`). A 0 stays muted and never hidden.
2. The time reads `D Mon YYYY, HH:MM UTC` (for example "26 Oct 2026, 02:48 UTC"): 24-hour, UTC, because the page is rendered on the server and does not know the viewer's zone. It is made from the digits of the data's own `as_of` with nothing computed; the data's own value stays in the `datetime` of a `<time>` element; a time that is not a real one is shown as given. The same time is used in every place the cockpit shows `as_of`, and it does not break across lines.
3. SPEC-0010 (Approved) is amended by Amendment 19 of `docs/runs/proposed-spec-amendments-5.md` (rules 5, 7 and 10 and the Tests), applied by this ADR in the same pull request.

## Consequences

- A person on a phone no longer sees a line that starts with a comma, and reads the time of the data in words.

## Residual

None.
