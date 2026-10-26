# ADR-0036: Build the cockpit of SPEC-0010, reading agk's pipeline document

- Status: Accepted
- Date: 2026-10-26
- Deciders: maintainers
- Related: ADR-0033, ADR-0034, ADR-0035
- Requirements: REQ-110

## Context

SPEC-0010 (Approved, #65, ADR-0033) specifies the cockpit: for each of a person's projects, the pull requests ready to merge and the specs waiting for approval in plain words, and a count of pull requests in each state, each linked to GitHub, read-only. It said the schema of the pipeline document was agk's and not written yet. agk #227 is merged: every routing run of the router uploads the artifact `agk-pipeline` holding `pipeline.json`, schema 1 (`kit/pipeline-schema.json`). The brief of issue #70 asks for the build, with the amendment of SPEC-0010 rule 2 that names agk's schema.

## Decision

1. The cockpit is built to SPEC-0010 rules 1 to 10 as approved: `/cockpit`, linked by the word "Cockpit" from the start page and the project pages; the three parts Needs your merge, Specs to approve and In the pipeline with the business phrases of rule 10; empty and unknown; as of; read-only (the only way to act is a link to GitHub, with no form, button, script or token); and the look of SPEC-0008.
2. The data is the newest unexpired artifact `agk-pipeline` of each project of the person's list, read with the person's own token and the App's two read permissions, as SPEC-0001 rule 2 reads the facts; the archive must hold exactly `pipeline.json`, and the document is checked against agk's closed list before anything in it is used. A summary or spec title of `unknown` falls back to the phrase of rule 3 or 4. A failure is that project's alone and says why; a count that cannot be read is "not known yet", never zero.
3. SPEC-0010 is amended by Amendment 18 of `docs/runs/proposed-spec-amendments-5.md`, applied by this ADR in the same pull request: rule 2 names agk's schema 1, and four points the spec does not fix are stated (Q-B24-1 on issue #70, answered): the word "Cockpit", the summary of the fold "{project} ({n})", agk's `unknown` for a spec, and the zero counts of the strip, which are shown muted on every width so that no separator is left behind (rule 5).
4. The facts reader is generalised without a change of behaviour: its artifact listing and download become shared functions (`listArtifacts`, `downloadArchive`) and the archive reader takes the list of entries it accepts; the facts and the pipeline use them.
5. The fixtures are pipeline documents of agk's shape, valid against agk's schema (`site/tests/fixtures/pipeline`).

## Consequences

- A person sees what waits for them now, not once a week, as soon as a project has the kit version whose router publishes the artifact; until then its lines read "no pipeline document exists".
- The portal's App permissions are unchanged.

## Residual

- 2026-10-26: a project shows the cockpit only after it has the kit version that publishes `agk-pipeline` (due 2026-12-31).
