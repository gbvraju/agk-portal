# ADR-0014: The import scan reads syntax trees through a pinned 5.x typescript

- Status: Accepted
- Date: 2026-10-21
- Deciders: maintainers
- Related: ADR-0005, ADR-0008
- Requirements: REQ-103

## Context

SPEC-0003 rule 4 requires an import scan that parses every file of the core into a syntax tree and allow-lists only relative imports inside the core. The scan was planned to read syntax trees through the JavaScript compiler API of the `typescript` package, and the maintainers asked the build to check that against the pinned compiler (ruling on SPEC-0003, 2026-10-21). The check, made in Item 3 on 2026-10-21 against `typescript` 7.0.2 (the native rewrite): `require("typescript")` returns an object with `version` only and `createSourceFile` is undefined, so the API the scan needs is absent; the package exposes an unstable synchronous API under `typescript/unstable/sync`, which is not used. The compile check of the same rule works under 7.0.2: `tsc -p site/tsconfig.core.json` with the libraries `ES2022` and `WebWorker`, no `types`, and `moduleResolution` `Bundler` compiles the core, and fails with `TS2591` on `process` and `Buffer`.

## Decision

1. `site/package.json` gains one `devDependency`, pinned exactly: `"typescript5": "npm:typescript@5.9.3"`, a 5.x `typescript` installed under an alias. It is used only by the import scan (`site/tests/support/import-scan.ts`) to read syntax trees. It is never imported by the core, by an adapter or by the server, and the core still has no runtime dependency.
2. The compile check keeps using the project's own `typescript` 7.0.2 (`tsc`), unchanged.
3. When TypeScript 7 offers a stable JavaScript syntax-tree API, the alias is removed by a pull request of its own and the scan is moved to it.

## Consequences

- Two copies of `typescript` are installed in development. Neither is shipped.
- The scan's behaviour does not depend on the 7.x rewrite, so a compiler update cannot weaken it silently: the scan's own fixtures (an import of a Node module, a Cloudflare module, a package, an absolute path, a path leaving the core, a dynamic import, `require`, a re-export, an import type, a computed specifier, an unparsable file and a non-`.ts` file) fail it.

## Residual

- 2026-10-21: the alias pins `typescript` 5.9.3, looked up on 2026-10-21; it changes only by a pull request (due 2026-12-31).
- 2026-10-21: the unstable synchronous API of TypeScript 7 (`typescript/unstable/sync`) was not evaluated for the scan; it is marked unstable by its own name (due 2026-12-31).
