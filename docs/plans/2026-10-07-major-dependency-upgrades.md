# Major dependency upgrades (deferred from the 2026-10 dependency sweep)

Date: 2026-10-07. Branch context: chore/dep-sweep-2026-10 (minor/patch + audit fix landed there).
Each trial below was run on a scratch install (then reverted) against the full `npm test` + `npm run build`.
Baseline: 17 suites, 541 passed / 1 skipped.

| Package | From -> To | Verified trial result | Effort |
|---|---|---|---|
| isbinaryfile | 5.0.7 -> 6.0.0 | Build ok, 541 pass. Breaking change is "add encoding hints" (new return/option surface); we only call `isBinaryFileSync(path)`. Requires Node >= 24 per its `engines` (repo engines say >=20.19). | XS code, but engines/CI Node 24 decision |
| @types/node | 25.9.9 -> 26.6.4 | Build ok, 541 pass. Types only; should match the Node major we run in CI/engines. | XS (do together with the Node 26 CI decision) |
| commander | 14.0.3 -> 15.0.0 | Build ok, 541 pass. Breaking: ESM-only (we are ESM), Node >= 22.12, only a lone `--no-*` option defaults to true (audit any `--no-*` flags in src/index.ts), `commander/esm.mjs` export removed. C14 gets security fixes until May 2027. | S |
| chalk | 5.6.2 -> 6.0.1 | Build ok, but 10 suites fail to compile under ts-jest: `TS2307 Cannot find module 'chalk'` (chalk 6 exposes types only through the `exports` map; test/tsconfig.test.json uses `moduleResolution: node`). Switching it to `bundler` alone did NOT fix it (same 10 failures), so jest ESM resolution/mocking needs investigation. Breaking per release notes: Node >= 22 only; numeric FORCE_COLOR is now an exact level; ansi256 downsamples to 16 colors at level 1. | S-M (test tooling, not source) |
| @babel/parser, @babel/traverse, @babel/types (lockstep) | 7.29.x -> 8.0.6 | Build FAILS: parser plugin names `classProperties`, `dynamicImport`, `exportNamespaceFrom`, `importMeta` in src/helpers.ts are no longer valid `PluginConfig` (now default syntax in Babel 8), and `TSImportType.argument` no longer exists (AST change). Test suites also fail to compile. Babel 8: ESM-only, Node `^22.18 || >=24.11`; traverse removes `NodePath.is/isnt/has/equals`; parser token/AST changes (babeljs.io/docs/v8-migration-api). Babel 7 EOL end of June 2027. | M (fix plugin list and TSImportType AST usage, re-verify the `(traverse as any).default` interop, add AST regression tests) |
| typescript | 5.9.3 -> 7.0.2 (native compiler) | Build FAILS: `TS5102 Option 'baseUrl' has been removed` and `TS5090` for `paths`. TS7 also makes `strict` default, `types` default `[]`, `rootDir` default `./`, and ships NO programmatic API until 7.1. Peer ranges block the toolchain: ts-jest 29.4.14 `<7`, typescript-eslint 8.71.1 `<6.1.0`. Microsoft recommends an aliased TypeScript 6 package for tooling plus `tsc` from 7. | L (blocked on ts-jest and typescript-eslint support; interim step: TS 6.0 after removing `baseUrl`) |
| actions/checkout | v6 -> v7 (v7.0.1) | v7.0.0 blocks checking out fork PRs for pull_request_target/workflow_run; module/deps upgrade. Check scan-request.yml (issue-triggered) and any pull_request_target use. | S |
| actions/setup-node | v6 -> v7 (v7.0.0) | ESM migration, new cache outputs, removed dummy NODE_AUTH_TOKEN export (check any publish step relying on it). | XS |
| actions/github-script | v7/v8 -> v9 (v9.0.0) | `require('@actions/github')` no longer works inside scripts (ESM `@actions/github` v9); adds `getOctokit`. Audit the 7 inline scripts. | S |
| codecov/codecov-action | v5 -> v7 (v7.1.1) | v6 moves to the node24 runtime (runner support needed); v7.0.0 is a signing-account change only. | XS |
| snyk/actions/node@master | unpinned | Pin to a release tag/SHA (separate hardening, not a major). | XS |
| actions/upload-artifact | v7 (v7.0.1 exists) | Already on the v7 major tag, covers 7.0.1. No change needed. | none |

## Suggested order
1. Decide the Node floor: chalk 6, commander 15, Babel 8 need Node >= 22 (Babel `^22.18`), isbinaryfile 6 needs >= 24. Bump `engines` and CI Node together.
2. commander 15, isbinaryfile 6, @types/node 26 (clean in trial).
3. chalk 6 once the jest ESM resolution issue is solved.
4. Babel 8 (lockstep) with source fixes.
5. TypeScript 6 (drop baseUrl), then 7 when ts-jest/typescript-eslint peer ranges allow.
6. Actions majors in one CI PR.

## Resolved: braces advisory (globby removal)
`braces <= 3.0.3` (GHSA-vfj7-8cjw-p6xm, high, published 2026-09-18) has no patched release (`first_patched_version: null`; 3.0.3 is latest), so no update or override could fix it. It was reachable only via globby -> fast-glob/micromatch. Resolved by removing that chain: globby is replaced by `src/glob.ts` (tinyglobby + `ignore` for nested/parent .gitignore handling) and micromatch by an explicit `picomatch` dependency (`npm ls braces` is empty). Node floor note: tinyglobby/picomatch/ignore are all fine on the repo's Node >=20.19, but the major upgrades above raise the floor (Node >= 22 for chalk 6/commander 15/Babel 8, >= 24 for isbinaryfile 6).
