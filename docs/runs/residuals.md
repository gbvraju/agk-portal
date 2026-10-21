# Residuals register

Accepted ADRs and Approved specs change only their Status line, so the due dates of their `## Residual` bullets are kept here.
Each open line is `- <source> | <text> | (due YYYY-MM-DD) | open`. The source is the file and the date of the bullet.

## Open

- docs/runs/app-access-proof.md 2026-10-21 | a client must grant the App Actions read and accept it on the installation, or the page reads 403 for the repositories (as run 2 did); the setup guide says so | (due 2026-12-31) | open
- docs/runs/app-access-proof.md 2026-10-21 | the test installation is on All repositories; a client installs on selected repositories only (least access), which these runs did not test (verify) | (due 2026-12-31) | open
- docs/requirements.md 2026-10-21 | REQ-107 AC2 names the measure "changes sent back or merged late"; that is a label only, the heading rule of SPEC-0007 ("Changes sent back or merged before review") governs, and no requirement text is changed | (due 2026-12-31) | open
- site/src/core/responses.ts 2026-10-21 | assertAllowed scans the whole page text, so plain text such as a requirement title containing "style =" or " onX=" would refuse a legitimate page; the check should inspect tags and attributes, not escaped text | (due 2026-12-31) | open

## Closed (not findings)

| Source | Text | Why it is closed |
| --- | --- | --- |
