# The reads of the start page (SPEC-0009 rule 7)

Date 2026-10-24 (from `date -u`). Counted by `site/tests/start-page.test.ts` with a counting GitHub client (recorded answers, no network); the test reads this file and fails if the numbers below differ from what it counts.

## What the start page reads

- GitHub reads for the person's list: 2 (the installations of the person, then the repositories of each installation: one installation, one page of repositories). More installations or more pages of repositories add one read each.
- GitHub reads per project: 3 (the artifact listing, the download address of the newest `agk-facts-<week>` artifact, and the signed download); a project whose listing fails costs 1 read and stops no other.
- 3 projects: 11 reads (2 for the list and 3 for each of the 3 projects, counted when all 3 projects answer); with one failing listing, 2 + 3 + 3 + 1 = 9.
- A project's page (`/p/{owner}/{repo}`) reads the list (2 reads) and the 3 reads of that project only; a name of a bad shape reads nothing, and a name that is not in the list reads the list only.

The reads are made in parallel, one request of the page, with no cache (SPEC-0001 residual).

## What is not known yet

- Time to first byte on staging: not recorded yet. The maintainers record it with the projects configured there after the merge, in this file or in `docs/runs/staging-record.md`.
- No claim about 50 projects is made before that record: 50 projects would cost 2 + 3 × 50 = 152 reads in one request by the count above, and whether a host allows that is the thing to measure.
