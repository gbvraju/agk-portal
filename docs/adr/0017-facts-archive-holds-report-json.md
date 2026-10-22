# ADR-0017: The facts archive may hold report.json beside facts.json

- Status: Accepted
- Date: 2026-10-22
- Deciders: maintainers
- Related: ADR-0006, ADR-0016
- Requirements: REQ-101

## Context

SPEC-0001 rule 2 said that the downloaded archive holds one file, `facts.json`, and the archive reader of the portal refused anything else. From kit 0.39.0 agk publishes two files in the `agk-facts-<week>` artifact: `facts.json` and `report.json`, the report's computed sections, which the page will render so that it agrees with the report by construction (the maintainers' ruling of 2026-10-22 on the This week section). Artifacts made before that kit hold `facts.json` alone and stay readable. The first scheduled report of the new kit is Monday 2026-10-26; after it every artifact of an upgraded project would be refused by the old reader and every card would say "not known yet".

## Decision

1. The archive reader accepts an archive that holds `facts.json` alone, or `facts.json` and `report.json` in either order, and nothing else. Any other entry (a third entry, another name, a path, another case), a duplicate entry, an archive without `facts.json`, and an end record that does not match the directory refuse the archive, and the repository's card reads "not known yet" with the archive reason.
2. Each entry keeps its checks: not encrypted, stored or deflated, within its size cap (one megabyte each), the declared size and the checksum right. The archive as downloaded is read to at most three megabytes (two entries of the cap and their headers), no longer two.
3. `facts.json` is read as before. `report.json` is checked and discarded: the page does not read it yet, and nothing in it can change a card.
4. SPEC-0001 rule 2 is amended by `docs/runs/proposed-spec-amendments-2.md` (Amendment 4), applied by this ADR in the same pull request.

## Consequences

- Artifacts made by kit 0.39.0 and later are readable, and older artifacts still are.
- A `report.json` that is damaged, too large or lies about its size refuses the whole archive, so the card says "not known yet" even though `facts.json` is good. That is the cautious reading; it is revisited when the page reads `report.json`.
- The size cap of `report.json` (one megabyte) is the builder's reading, not agk's; if the report grows past it, the card reads "not known yet" until the cap is raised by a decision.

## Residual

- 2026-10-22: the name and shape of `report.json` and its size in practice are from the maintainers' message, not read from agk's specification (verify); the first artifact of kit 0.39.0 at staging settles them (due 2026-12-31).
- 2026-10-22: the one-megabyte cap for `report.json` and the three-megabyte archive limit are the builder's readings (due 2026-12-31).
