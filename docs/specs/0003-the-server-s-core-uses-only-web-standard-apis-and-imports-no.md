# SPEC-0003: The core is portable and each host has one thin adapter

- Status: Approved
- Owner: maintainers
- Requirements: REQ-103

Status is `Draft` or `Approved`. An Approved spec is owned by its reviewer group; agents propose patches.
Written by the intake of one sentence, as data: "The server's core uses only web-standard APIs and imports nothing host-specific, one thin adapter per host fills its secrets and configuration through one small interface, and a test fails if a core file imports a host-specific module or global." It follows ADR-0006 decision 4 and is the second of the three intakes of ADR-0006 decision 10. The maintainers answered three questions on 2026-10-21: the core has zero runtime dependencies and uses web-standard APIs only, with dev tools in `devDependencies`; a Node test drives the Cloudflare adapter with a fake environment and request, and the smoke test in the real Workers runtime belongs to the deployment brief; "host-specific" is detected by both a compile of the core under its own configuration with the web-worker libraries and no Node types, and a syntax-tree scan of imports that allow-lists only relative imports inside the core, never a deny-list. The Cloudflare Workers adapter is built; the AWS Lambda/Node adapter is named as the next adapter and is not built, and no test checks for its absence.

## Rules

1. **Layout.** The core is `site/src/core/`. Each host has one adapter in `site/src/adapters/<host>/`. The only adapter built is `cloudflare`. The core never imports an adapter; an adapter imports the core.
2. **Web-standard only.** The core uses only web-standard APIs: `fetch`, `Request`, `Response`, `Headers`, `URL`, `URLSearchParams`, Web Crypto (`crypto.subtle`, `crypto.getRandomValues`), `TextEncoder`, `TextDecoder`, `atob` and `btoa`, and the language's own built-ins. It has no runtime dependency: `site/package.json` has no `dependencies` entry, only `devDependencies`, and the core imports no package.
3. **The compile check.** `site/tsconfig.core.json` compiles `site/src/core/` with the web-worker library and the language library, no `types` (so no Node types), `strict`, and no emit. `tsc -p site/tsconfig.core.json` must exit 0 on the core. A core file that uses a Node-only global (`process`, `Buffer`, `__dirname`, `require`) does not compile, so the check fails closed. The library names are checked against the pinned compiler (verify, see the residuals).
4. **The import scan.** A test parses every `.ts` file under `site/src/core/` with the TypeScript compiler API and visits its syntax tree. It allow-lists exactly one kind of module specifier: a relative path (`./` or `../`) that, resolved from the importing file, stays inside `site/src/core/`. It applies to `import`, `import type`, `export ... from`, a dynamic `import()` and `import x = require()`. Any other specifier (`node:fs`, `cloudflare:workers`, `@cloudflare/...`, a package name, an absolute path, a computed specifier) fails the test and names the file and the specifier. A file that cannot be parsed, or a specifier the scan cannot classify, also fails. The scan reads syntax trees through the `typescript` package's JavaScript compiler API, which the pinned compiler may not offer (verify, see the residuals).
5. **One small interface.** The core receives its secrets and configuration only through `Config`, `{ get(name: ConfigName): string | undefined }`, where `ConfigName` is the one documented list: `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `SESSION_KEY` and `CALLBACK_URL` (the public address of the portal). The core reads no environment variable, binding or global for them. The names are in the code; no value is.
6. **A missing setting.** When the core needs a name for which `Config.get` returns nothing, it refuses with a message that names the setting and never a value (principle 8), and it calls nothing.
7. **The clock.** The core takes the time from an injected function, so tests fix time; it never reads a clock by another way.
8. **The Cloudflare adapter.** `site/src/adapters/cloudflare/` exports the Workers `fetch` handler. It builds a `Config` from the host's `env` (the secrets and variables), passes the `Request` and the `Config` to the core, and returns the core's `Response` unchanged. It hands the core no `env` object, no binding and no execution context. It is the only code that names a Cloudflare module or binding.
9. **The next adapter.** An AWS Lambda/Node adapter is the next one to build. It is not built, and nothing in the tests depends on its absence.
10. **Tests.** The tests are TypeScript files named `*.test.ts` under `site/tests/`, run by the npm command in `agk.toml` `project_tests`, each carrying the marker `REQ-103 ACn` it proves. The failing cases are fixtures written to a temporary directory, with no network. A test calls the adapter with a fake `env` and a fake `Request` in Node.

## Tests

- Rule 3: `tsc -p site/tsconfig.core.json` exits 0 on the core; REQ-103 AC1.
- Rule 3: a temporary core file that uses `process` and one that uses `Buffer` make the same check fail and name the file; REQ-103 AC2.
- Rules 2 and 4: the scan finds only relative imports inside the core in every real core file, and `site/package.json` has no `dependencies`; REQ-103 AC3.
- Rule 4: temporary core files that import `node:fs`, `cloudflare:workers`, a package, an absolute path, a path that leaves the core, and a dynamic `import()` of each, fail the scan and name the file and the specifier; REQ-103 AC4.
- Rule 5: the core run under a `Config` spy asks only for names on the documented list, and nothing it reads comes from an environment variable or global; REQ-103 AC5.
- Rule 6: a `Config` without one setting makes the core refuse, naming the setting and not its value; REQ-103 AC6.
- Rule 8: the adapter with a fake `env` fills `Config` from the fake secrets and variables, passes the request to the core and returns the core's response unchanged; REQ-103 AC7.
- Rule 8: the adapter hands the core no `env`, no binding and no context, only the request and `Config`; REQ-103 AC8.

## Proof

REQ-103 AC1 to AC4: *the core cannot depend on a host, and a host-specific import or global fails a check.* Rules 2 to 4. REQ-103 AC5 and AC6: *secrets and configuration reach the core only through one interface, and a missing one is named, never shown.* Rules 5 and 6. REQ-103 AC7 and AC8: *the Cloudflare adapter is thin.* Rule 8. The maintainers read the failing fixtures and the adapter's source before milestone M3 is built.

## Residual

- 2026-10-21: the real Workers runtime smoke test (`workerd` or miniflare) belongs to the deployment brief (due 2026-11-30).
- 2026-10-21: the names of the web-worker library and the compiler options under the pinned compiler (TypeScript 7.0.2) are from memory and are checked when the core's configuration is first built (verify) (due 2026-11-30).
- 2026-10-21: the AWS Lambda/Node adapter is named as the next adapter and is not built (due 2026-12-31).
- 2026-10-21: the compile check and the import scan prove what the core imports and which globals it names; they do not prove that the core behaves the same on another host, which only the second adapter's own tests show (due 2026-12-31).
- 2026-10-21: (verify) before the build: whether TypeScript 7.0.2 (the native rewrite) offers the JavaScript compiler API that the import scan needs; if it does not, the build brief names a pinned parser as a `devDependency`, or a pinned 5.x `typescript` used only for the scan, by ADR, and says which (due 2026-11-30).

## Open questions

none
