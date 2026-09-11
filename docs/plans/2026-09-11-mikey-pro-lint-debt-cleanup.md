# Mikey-Pro Lint Debt Cleanup

**Goal:** Bring `src/` into full compliance with the mikey-pro strict ESLint flat config (adopted in `chore/adopt-mikey-pro`, commit `9f17bd9`) so the Husky `pre-commit` hook (`lint-staged` -> `eslint --fix`) passes cleanly on ordinary commits again, without silently weakening rules that carry real value for a filesystem-scanning CLI.

**Architecture:** Five phases in strict order. Phase 0 (config decisions) must land first because it changes the denominator for every later phase — fixing code against a rule we are about to disable is wasted work. Phase 1 (auto-fix) must run immediately after and be independently verified (build + test), because it is proven capable of producing invalid syntax (see Risks). Phases 2-3 are code changes ordered by risk: mechanical/low-risk patterns before genuine refactors. Phase 4 is final verification and closes the loop that the original `chore/adopt-mikey-pro` PR left open.

**Tech Stack:** TypeScript (ESM, strict), ESLint 10 flat config (`mikey-pro/eslint`), Jest 30, Husky + lint-staged.

_Status: PENDING_
_LastCompletedStep: 0_
_TotalSteps: 5_
_Created: 2026-09-11_

---

## Verified Baseline (measured 2026-09-11, branch `chore/adopt-mikey-pro` @ `4a6328d`)

Do not trust the "~658" figure quoted when this pass was proposed without re-verifying it — it was re-measured here and happens to match exactly, but re-run the commands below before starting Phase 0 in case the branch has moved.

**Command used (JSON output, then aggregated with node):**

```bash
npx eslint src --format json > /tmp/eslint-report.json
node -e '
const report = require("/tmp/eslint-report.json");
let e=0,w=0; const rules={}, files={};
for (const f of report) {
  if (!f.messages.length) continue;
  e+=f.errorCount; w+=f.warningCount;
  files[f.filePath]=f.messages.length;
  for (const m of f.messages) {
    const r = m.ruleId || "(no-rule)";
    rules[r]=(rules[r]||0)+1;
  }
}
console.log("total", e+w, "errors", e, "warnings", w);
'
```

**Total: 658 problems (436 errors, 222 warnings).** Exit code 1 (blocks any lint-staged commit that would fail-fast on error count; the current `lint-staged` entry is `eslint --fix --no-error-on-unmatched-pattern` with no `--max-warnings` flag, so in principle only the 436 errors block a commit today, not the 222 warnings — but the project's own precedent (`docs/plans/2026-03-01-lint-cleanup.md`) targeted zero errors _and_ zero warnings, and this plan keeps that bar).

### Rule breakdown (top 15 of 60 distinct rule ids, full list in the aggregation run above)

| Count | Errors | Warnings | Rule                                               |
| ----- | ------ | -------- | -------------------------------------------------- |
| 118   | 118    | 0        | `@typescript-eslint/strict-boolean-expressions`    |
| 79    | 0      | 79       | `no-console`                                       |
| 45    | 45     | 0        | `max-depth`                                        |
| 41    | 41     | 0        | `require-unicode-regexp`                           |
| 41    | 41     | 0        | `@typescript-eslint/no-unsafe-member-access`       |
| 33    | 0      | 33       | `@typescript-eslint/explicit-member-accessibility` |
| 26    | 0      | 26       | `no-await-in-loop`                                 |
| 23    | 23     | 0        | `@typescript-eslint/no-unsafe-assignment`          |
| 22    | 22     | 0        | `security/detect-non-literal-regexp`               |
| 20    | 20     | 0        | `security/detect-non-literal-fs-filename`          |
| 18    | 18     | 0        | `@typescript-eslint/no-unsafe-argument`            |
| 15    | 0      | 15       | `security/detect-object-injection`                 |
| 13    | 13     | 0        | `@typescript-eslint/no-use-before-define`          |
| 11    | 11     | 0        | `@typescript-eslint/no-unsafe-type-assertion`      |
| 10    | 10     | 0        | `@typescript-eslint/no-non-null-assertion`         |

Remaining ~45 rule ids each contribute 1-10 occurrences (`member-ordering` 10, `sonarjs/cognitive-complexity` 9, `explicit-function-return-type` 9, `explicit-module-boundary-types` 9, `no-nested-template-literals` 8, `prettier/prettier` 7, `strict-void-return` 7, `no-explicit-any` 6, `complexity` 5, `no-unused-vars` 5, `max-lines-per-function` 3, `max-lines` 3, `no-floating-promises` 3, and ~30 singletons/doubletons). Full per-rule list is in `/tmp/eslint-report.json`'s aggregation output at authoring time — re-run the command above rather than trusting a stale copy.

**"Unsafe-\*" family combined (the real type-safety debt, mostly from `@babel/traverse` AST nodes and `JSON.parse`d npm-registry / `package.json` payloads being effectively `any`):** `no-unsafe-member-access` 41 + `no-unsafe-assignment` 23 + `no-unsafe-argument` 18 + `no-unsafe-type-assertion` 11 + `no-unsafe-call` 4 + `no-unsafe-return` 1 + `no-base-to-string` 1 = **99 errors**, concentrated in `helpers.ts` (Babel traversal) and `utils.ts`/`global-impact.ts` (registry JSON).

### File breakdown

| File                               | Total | Errors | Warnings |
| ---------------------------------- | ----- | ------ | -------- |
| `src/index.ts`                     | 217   | 132    | 85       |
| `src/utils.ts`                     | 191   | 146    | 45       |
| `src/performance-optimizations.ts` | 114   | 48     | 66       |
| `src/helpers.ts`                   | 107   | 89     | 18       |
| `src/global-impact.ts`             | 21    | 15     | 6        |
| `src/constants.ts`                 | 7     | 6      | 1        |
| `src/interfaces.ts`                | 1     | 0      | 1        |

`index.ts` and `utils.ts` alone account for 62% of all problems (408/658) and should be tackled first in Phases 2-3 for the biggest visible progress.

---

## Auto-fix viability (measured, throwaway copy, discarded)

Tested `npx eslint src --fix` in an isolated copy of this worktree (never staged/committed, copy discarded after measurement — see Method below).

**Result: 658 -> 551 problems (107 auto-fixed, ~16% of total).** Breakdown of what actually moved:

| Delta | Rule                                            | Before -> After |
| ----- | ----------------------------------------------- | --------------- |
| 22    | `require-unicode-regexp`                        | 41 -> 19        |
| 18    | `@typescript-eslint/strict-boolean-expressions` | 118 -> 100      |
| 10    | `security/detect-non-literal-regexp`            | 22 -> 12        |
| 6     | `@typescript-eslint/no-use-before-define`       | 13 -> 7         |
| 5     | `@typescript-eslint/no-unsafe-type-assertion`   | 11 -> 6         |
| 4     | `security/detect-non-literal-fs-filename`       | 20 -> 16        |
| 4     | `@typescript-eslint/no-explicit-any`            | 6 -> 2          |
| 4     | `@typescript-eslint/no-unsafe-assignment`       | 23 -> 19        |
| ...   | (small deltas of 1-3 across ~20 more rules)     |                 |

**Critical finding — a plain `--fix` sweep is NOT safe to commit blindly.** It introduced a fatal parse error in `helpers.ts`. The import-merge fixer (interaction of `import-x/no-duplicates` and `simple-import-sort/imports`) collapsed:

```ts
import fetch from 'node-fetch';
import type { Response } from 'node-fetch';
```

into the syntactically invalid:

```ts
import fetch, type { Response } from 'node-fetch';
```

(the correct merge is `import fetch, { type Response } from 'node-fetch';` — the fixer puts the `type` modifier in the wrong position when merging a default import with a type-only named import from the same specifier). This is a real, reproducible ESLint/TypeScript-ESLint autofixer limitation, not a one-off fluke — expect it (or similar import-merge breakage) to recur elsewhere `node-fetch`-style split default+type imports exist. **Phase 1 must run `npx tsc --noEmit` (or a full build) immediately after every `--fix` invocation and before considering the sweep complete**, and must diff-review every touched import block by hand.

**Method (for reproducing or re-running):** copied the worktree to a scratch directory, deleted its `.git` file first (a worktree's `.git` is a pointer to the _shared_ admin dir under the main checkout's `.git/worktrees/`, so running git commands in a naive copy risks corrupting the real worktree's index/HEAD — removing the pointer file makes accidental git commands in the copy fail loudly instead of silently touching shared state), ran `node node_modules/eslint/bin/eslint.js src --fix --format json` directly (the `node_modules/.bin/eslint` shim broke across the `cp -r`, unrelated to this task), and diffed the before/after JSON reports. The copy was left in `/tmp` (not `rm -rf`'d per this environment's destructive-command policy) and is scratch-only — nothing in it was staged or committed, and `src/` in the real worktree (`/tmp/depsweep-lintplan`) was never touched.

---

## Config downgrade/disable decisions

Two firm recommendations, no hedging:

1. **`security/detect-non-literal-fs-filename` — DISABLE for `src/**/*.ts`.** This rule exists to catch path-traversal vulnerabilities in server code that opens files at paths influenced by untrusted network/user input. Depsweep is a local CLI whose entire purpose is reading files at paths discovered by traversing the invoking user's own project tree (`getSourceFiles`, `getDependencyInfo`'s config/binary probing, transitive dep resolution) — there is no privilege boundary being crossed. An attacker able to influence "non-literal" paths here would need pre-existing write access to the project being scanned, at which point they already have equivalent-or-greater capability through the project's own build/install scripts. Confirmed 20 call sites across `utils.ts` and `performance-optimizations.ts`, all structurally the same "read a path we just derived from `fs.readdir`/globby" pattern. Sprinkling 20 justification `eslint-disable-next-line` comments is worse than one config-level disable with a single comment explaining the threat model — do the latter.

2. **`no-console` — DISABLE in `src/index.ts` specifically; triage the other 18 occurrences (helpers.ts 2, performance-optimizations.ts 7, utils.ts 9) individually in Phase 2, do not blanket-disable project-wide.** `index.ts` is the CLI entry point; console output there is the product (scan results, JSON mode, progress). Blanket-disabling everywhere would mask genuinely stray `console.log` debug statements left in library-ish files (`utils.ts`, `performance-optimizations.ts`, `helpers.ts`) that should either become real log output gated on `--verbose` or be deleted. 61 of the 79 occurrences are in `index.ts` and go away for free with this one config line; the remaining 18 get real triage.

**Do NOT downgrade** (kept at full strictness, addressed via real fixes in Phase 2/3):

- `@typescript-eslint/strict-boolean-expressions` — this rule's entire value is forcing explicit null/undefined/empty-string handling, which matters more than average in a filesystem tool where paths, config values, and registry fields are frequently optional strings. See Risks below for a concrete example of why a shortcut here is dangerous.
- `security/detect-object-injection` (15 warnings) — depsweep parses untrusted external npm-registry JSON (`global-impact.ts`) and arbitrary `package.json`/config file contents; unlike the fs-filename rule, this one has a real applicable threat model here (prototype pollution / unexpected key access from external data). Triage case-by-case in Phase 2, not a blanket disable.
- Complexity family (`max-depth` 45, `complexity` 5, `sonarjs/cognitive-complexity` 9, `max-lines-per-function` 3, `max-lines` 3, `max-classes-per-file` 1 = 66 combined) — legitimate signal; `index.ts` and `utils.ts` have organically grown large functions (consistent with the dead-code findings in `docs/plans/2026-03-09-project-improvements.md`). Decompose for real in Phase 3.
- `no-await-in-loop` (26 warnings) — some of these are almost certainly intentional (registry calls already have retry/backoff and a concurrency-5 batching pattern per `2026-03-09-project-improvements.md` Task 3). Blindly parallelizing would risk breaking rate-limiting behavior against the npm registry. Judgment call per call site in Phase 3, not mechanical.

---

## Phase 0: Config decisions

**File:** `eslint.config.js` (currently a 2-line re-export of `mikey-pro/eslint` — will need a local override block layered on top, e.g. via flat-config array composition).

- Add an override disabling `security/detect-non-literal-fs-filename` for `src/**/*.ts`, with a comment citing the threat-model reasoning above.
- Add an override disabling `no-console` for `src/index.ts` only.
- Re-run the baseline measurement command; expect roughly 658 -> ~577 (-20 errors from fs-filename, -61 warnings from index.ts console calls; some overlap with Phase 1's auto-fixable deltas is expected and will be re-measured after this phase, not before).

**Effort:** ~30-45 minutes (small config change, re-run and record new baseline).

**Verify:** `npx eslint src --format json` re-aggregated; `security/detect-non-literal-fs-filename` and `no-console`-in-index.ts no longer appear.

---

## Phase 1: Auto-fix sweep

- Run `npx eslint src --fix` on top of the Phase 0 config.
- Immediately run `npx tsc --noEmit`. If it fails, the fixer broke something — locate the offending file via the tsc error, hand-fix the malformed merge (the confirmed failure mode is `node-fetch`-style default+type import merges; grep the diff for any `import X, type {` pattern, since that syntax is never valid and is the fixer's signature bug), and re-run `tsc --noEmit` until clean.
- Run `npm test` to confirm no behavioral regression from the fixes that did apply cleanly (unicode-regexp flag additions, non-literal-regexp fixes, use-before-define reordering, etc. are generally safe but should not be taken on faith).
- Diff-review the full changeset by hand before moving on — this is a single large mechanical commit, not something to fix-and-forget.

**Effort:** ~2-3 hours (mostly the manual diff review and hunting down any additional fixer-introduced breakage beyond the one confirmed case).

**Verify:** `npx tsc --noEmit` clean, `npm test` green, re-measure lint count (expect roughly another -100 problems from the Phase 0 baseline).

---

## Phase 2: Mechanical pattern fixes

Rules that need real edits but follow one repeated, low-judgment pattern per rule — a Sonnet-tier pass, not Opus-tier:

- `@typescript-eslint/explicit-member-accessibility` (33) — add `public`/`private`/`protected` to every class member per mikey-pro's configured default (check the rule's `accessibility` option in the resolved config before starting — likely `explicit` for everything or `no-public` for defaults).
- `@typescript-eslint/member-ordering` (10) — reorder class members to the convention mikey-pro enforces (static before instance, fields before methods, etc. — read the rule's resolved option, don't guess).
- `@typescript-eslint/explicit-function-return-type` (9) + `@typescript-eslint/explicit-module-boundary-types` (9) — add explicit return types to exported/public functions. Low risk except where a function's real return type is a wide union or complex generic — flag those for Phase 3 review rather than forcing an `any`/overly-loose annotation just to silence the rule.
- `@typescript-eslint/no-non-null-assertion` (10) — each `!` needs a real null check or a narrowing guard; not literally mechanical but each occurrence is independent and low-risk to fix in isolation (no cross-cutting design decision).
- Remaining `no-console` triage (18: helpers.ts 2, performance-optimizations.ts 7, utils.ts 9) — per occurrence, either delete (stray debug), gate behind existing `--verbose` flag plumbing, or (rare) add a targeted disable with a one-line justification comment.
- `security/detect-object-injection` triage (15) — per occurrence: if the key is a compile-time-known literal or comes from `Object.keys`/a typed union, refactor to safe access (`Map`, `Object.hasOwn` guard, or an allowlist); if the key genuinely comes from external registry JSON, add a targeted disable with justification.

**Effort:** ~1 day (roughly 90-100 individually-simple-but-numerous edits across 5 files; batchable by rule across files).

**Verify:** re-run lint count per rule after each rule-batch; `npm test` and `npx tsc --noEmit` stay green throughout.

---

## Phase 3: Judgment refactors

The genuinely hard remainder — no shortcuts, no batch-and-forget:

- **`no-unsafe-*` family (99 errors combined)** — the single largest bucket. Root cause: `@babel/traverse`/`@babel/parser` node types are effectively `any` at the call sites in `helpers.ts`, and `JSON.parse`d npm-registry responses / `package.json` contents are `any` in `global-impact.ts` and `utils.ts`. Fix by introducing narrow interfaces/type guards at the parse boundary (a `PackageJsonShape` type, a typed wrapper around the specific Babel node kinds actually touched) rather than sprinkling `as` casts, which would just convert `no-unsafe-*` errors into `no-unsafe-type-assertion` errors. This touches the core AST-based dependency-usage detection (`isDependencyUsedInFile` and friends) — depsweep's actual product — so lean hard on the existing Jest suite plus a manual `npm run dev:demo` smoke test after each file, not just "tests still pass."
- **`@typescript-eslint/strict-boolean-expressions` remaining ~100** — per call site, decide the _correct_ explicit check (see Risks below for why this cannot be a mechanical find-replace). Do `global-impact.ts` and `helpers.ts` first since they're smaller and establish the pattern conventions to reuse in `index.ts`/`utils.ts`.
- **Complexity family (66 combined)** — real function decomposition in `index.ts` and `utils.ts`, the two files that dominate both the file-count table above and this codebase's known "grew organically" history (see `2026-03-09-project-improvements.md`'s dead-code findings — some complexity here may partially resolve once genuinely dead branches are identified, worth a quick dead-code grep pass before committing to a decomposition).
- **`no-await-in-loop` (26)** — read each loop; if it's the registry retry/backoff or concurrency-batched resolution described in `2026-03-09-project-improvements.md` Task 2/3, add a targeted disable with a comment explaining the intentional sequencing; if it's genuinely parallelizable (no shared rate-limit concern), convert to `Promise.all`/batched concurrency like the existing pattern.
- **`@typescript-eslint/no-use-before-define` remaining (7)** — reorder declarations; watch for `function` hoisting vs `const () =>` semantics when moving things (do not convert a hoisted function declaration into a non-hoisted const arrow as a side effect of reordering, that can break call sites above the new definition).

**Effort:** ~2-3 days. This phase dominates the total cleanup cost; do not compress the estimate on the schedule the config-downgrade and mechanical phases might tempt.

**Verify:** `npm run validate` (type-check + lint + `test:coverage:check`) green; manual smoke test `npm run dev:demo` and `node dist/index.js --json --dry-run` against this repo itself produce output consistent with pre-change behavior.

---

## Phase 4: Final verification and closeout

- `npm run validate` clean (0 errors, 0 warnings — matching the `2026-03-01-lint-cleanup.md` precedent, not just "commit no longer blocked").
- Make a trivial, real, no-op-safe edit to a `src/` file (e.g. a comment tweak), stage it, and let the Husky `pre-commit` hook (`npx lint-staged` -> `eslint --fix` + `prettier --write`) run for real — confirm it exits 0 without `--no-verify`. This is the actual acceptance criterion; lint counts hitting zero in a manual run is necessary but not sufficient proof the hook itself is unblocked.
- Confirm `npm run precommit` (`lint` + `test:unit`) and `npm run prepush` (`test:ci`) both still pass, since those are the other two gates in this repo's git-hook chain.

**Effort:** ~1 hour.

**Acceptance criterion:** a normal commit touching `src/` completes through the Husky pre-commit hook with no manual intervention, no `--no-verify`, and no lint errors or warnings remaining in `src/`.

---

## Rough total effort estimate

| Phase                             | Effort                |
| --------------------------------- | --------------------- |
| 0 — Config decisions              | 30-45 min             |
| 1 — Auto-fix sweep + verification | 2-3 hours             |
| 2 — Mechanical pattern fixes      | ~1 day                |
| 3 — Judgment refactors            | 2-3 days              |
| 4 — Final verification            | ~1 hour               |
| **Total**                         | **~3-4 working days** |

---

## Risks

| Risk                                                                                                                 | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Mitigation                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`strict-boolean-expressions` fixes change runtime behavior — null/undefined/empty-string are NOT interchangeable** | Concrete example 1: `helpers.ts` `isConfigFile()` currently does `if (!filePath \|\| typeof filePath !== 'string')`. `!filePath` is true for `null`, `undefined`, AND `''` (empty string). A mechanical "satisfy the linter" rewrite to `filePath == null` would stop catching an empty-string `filePath`, letting `path.basename('')` execute where the original code intentionally short-circuited. Concrete example 2: `global-impact.ts` `getPackageMetadata()` does `const url = version ? urlWithVersion : urlLatest;` where `version?: string`. The ternary's falsy check correctly routes an empty-string `version` to the `/latest` URL. A mechanical rewrite to `version !== undefined ? ... : ...` would treat `''` as a real version and build a broken registry URL (`.../pkg/`). Neither of these is hypothetical — both are real call sites in this codebase today. | Every one of the ~118 sites needs its own explicit-check decision (`== null`, `!== undefined`, `.length > 0`, or genuinely keeping the loose check via a narrow disable) based on what falsy value the code actually needs to treat specially. No batch find-replace. Phase 3, one file at a time, tests re-run after each file. |
| **`eslint --fix` can produce invalid syntax, not just "safe" mechanical changes**                                    | Confirmed empirically (see Auto-fix viability above): merging a default import with a type-only named import from the same specifier produces syntactically invalid TypeScript. Trusting `--fix` output without a build step would have silently broken `helpers.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Phase 1 mandates `tsc --noEmit` immediately after every `--fix` run, before any further work or commit, plus a manual diff read of the import blocks specifically.                                                                                                                                                               |
| **`no-unsafe-*` fixes touch the AST-based dependency detection core**                                                | `helpers.ts`'s Babel traversal logic is what determines whether a dependency is "used" — the entire product. A type-narrowing refactor done carelessly could introduce false positives (flagging a used dep as unused) or false negatives, which is a correctness regression in depsweep's core value proposition, not just a lint nit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Phase 3 treats this file with extra scrutiny: full Jest suite plus a manual `npm run dev:demo` / self-scan smoke test after every change, not just after the phase.                                                                                                                                                              |
| **Complexity-driven decomposition could interact with the still-pending dead-code cleanup**                          | `2026-03-09-project-improvements.md` already identified `index.ts`/`utils.ts` as organically overgrown. Decomposing a function for `max-depth`/`complexity` compliance before checking whether parts of it are dead code risks polishing code that should instead be deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Do a quick dead-code grep pass on the two largest files before starting Phase 3's complexity work, not after.                                                                                                                                                                                                                    |
| **Scope creep back into "just fix everything now"**                                                                  | This plan exists specifically because Mikl directed the cleanup be spun off as its own pass rather than blocking unrelated fixes. A future session picking this up should not silently fold in unrelated feature work just because it's touching the same files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Keep this plan's diffs lint-only; anything that looks like an actual behavior improvement beyond "preserve existing behavior while satisfying the linter" belongs in a separate PR/plan.                                                                                                                                         |

## Verification Plan

- [ ] Phase 0: `security/detect-non-literal-fs-filename` and `no-console` (in `index.ts`) no longer appear in `npx eslint src --format json`
- [ ] Phase 1: `npx tsc --noEmit` clean after `--fix`; `npm test` green; import blocks manually diff-reviewed
- [ ] Phase 2: per-rule counts for the mechanical batch hit zero; `npm test` and `npx tsc --noEmit` stay green throughout
- [ ] Phase 3: `npm run validate` clean; `npm run dev:demo` and a self-scan (`node dist/index.js --json --dry-run` against this repo) produce output consistent with pre-change behavior
- [ ] Phase 4: real commit touching `src/` passes the Husky pre-commit hook with no `--no-verify`
