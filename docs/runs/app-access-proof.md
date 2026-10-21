# Access proof: a GitHub App user token reads a private repository's artifacts

Date: 2026-10-21 (from `date -u`). Item 2 of `docs/briefs/second-brief-access-proof-by-device-flow-and-the-build-of-re.md`. It records the runs of the throwaway workflow `.github/workflows/app-device-flow-proof.yml` (ADR-0010) on `main` at `009792e0faa8e2370c4ef985dccefd9dba3b252b`, read from the Actions API with GET calls (the run list, the jobs of each run, the log of each job). The log lines below are copied verbatim; before quoting, each was checked: none holds a token, a device code or a signed address (the workflow masks them, and the log shows `Authorization: ***` where the token is sent). The App's public client id, which the log also shows in its `env` block, is not quoted.

Target: `gbvraju/agk-proof-private`, a private repository with one artifact. Runner: `ubuntu-latest`, image `ubuntu-24.04`, version `20261018.339.1` for run 2 and `20261012.334.1` for runs 3 to 5.

## The runs

The maintainers' account counted two runs. The Actions API lists five runs of this workflow, all `workflow_dispatch`:

| Run number | Run id | Result | What happened |
| --- | --- | --- | --- |
| 1 | 39587097159 | cancelled | Started 10:46:58, cancelled 11:02:07 after 15 minutes. The log is not quoted: no call result is known from the list, and the maintainers did not name it as a proof run. |
| 2 | 39589090965 | failure | The 403 run: the token exchange returned 200 and the artifact list returned 403. |
| 3 | 39590957304 | failure | Stopped in the first second: `stop: the target is not OWNER/REPO` (the input was `agk-proof-private`, with no owner). No call to GitHub was made. |
| 4 | 39591082967 | failure | The same input error and the same stop. No call to GitHub was made. |
| 5 | 39591232745 | success | The proof run: list 200, zip 302, download 200. |

The maintainers' "run #3" that succeeded is run number 5 in the Actions list (id 39591232745); runs 3 and 4 are the two input errors. Everything below is from the log of each run.

### Run 2 (id 39589090965), `gbvraju/agk-proof-private`: refused with 403

```
call: POST /login/device/code -> 200
user code: 6057-CF53
verify at: https://github.com/login/device
waiting: authorization_pending            (21 lines, 11:03:27 to 11:05:10)
call: POST /login/oauth/access_token -> 200
call: GET /repos/gbvraju/agk-proof-private/actions/artifacts -> 403
stop: access was refused (403); no workaround, no secret
```

The stop rule of the brief applied: the run ended, no secret and no workaround was added, and the question went to the maintainers.

### The three changes between run 2 and run 5

The maintainers then changed three settings together:

1. the App's Actions permission to Read-only;
2. the new permission accepted on the installation;
3. the installation's repository access to All repositories.

Which one alone fixed the 403 is not known: they were changed together and no run was made between them.

### Run 5 (id 39591232745), `gbvraju/agk-proof-private`: proven

```
call: POST /login/device/code -> 200
user code: 6578-F53A
verify at: https://github.com/login/device
waiting: authorization_pending            (5 lines, 11:20:43 to 11:21:04)
call: POST /login/oauth/access_token -> 200
call: GET /repos/gbvraju/agk-proof-private/actions/artifacts -> 200
call: GET /repos/gbvraju/agk-proof-private/actions/artifacts/{id}/zip -> 302
redirect host: productionresultssa6.blob.core.windows.net
call: GET (redirect host productionresultssa6.blob.core.windows.net) -> 200
file: proof-artifact (167 bytes)
control: GET /repos/gbvraju/agk-proof-private/actions/artifacts without a token -> 404
```

## Conclusion

A GitHub App user-to-server token with Actions read and Metadata read lists and downloads an artifact of a private repository: the list answered 200, the download answered 302 to the storage host and 200 from it, and the artifact `proof-artifact` (167 bytes) was fetched. Anonymous access gets 404 on the same list call. This was shown on one private repository with the App installed on All repositories, after the Actions permission was granted and accepted.

What the runs also settle, for the `(verify)` marks that depended on them:

- GitHub's device-flow addresses and parameters worked as the workflow used them (`POST https://github.com/login/device/code`, `POST https://github.com/login/oauth/access_token` with the device-code grant, both 200), and the answers held the fields the script read (`device_code`, `user_code`, `verification_uri`, `interval`, `expires_in`, `access_token`, `error`).
- `jq` is present on the `ubuntu-24.04` image used.
- GitHub's masking hid the token where it is sent (`Authorization: ***`), and the redirect host alone printed while the full signed address was masked.

What the runs do not settle: which of the three changes fixed the 403; an installation on selected repositories only; the token's expiry field and the 8-hour behaviour (not printed); the shape of the `permissions` field of the installation listing (SPEC-0004 rule 7), and the address and answer of the code-for-token exchange of the web flow (SPEC-0002 rule 4), which differ from the device flow's and stay `(verify)`.

## Residual

- 2026-10-21: a client must grant the App Actions read and accept it on the installation, or the page reads 403 for the repositories (as run 2 did); the setup guide says so (due 2026-12-31).
- 2026-10-21: the test installation is on All repositories; a client installs on selected repositories only (least access), which these runs did not test (verify) (due 2026-12-31).
