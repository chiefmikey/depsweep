# Plan: Bug Fixes + Isolated Scan Mode

_Date: 2026-03-04_
_Status: COMPLETED_
_LastCompletedStep: 8_
_Completed: 2026-03-04_
_TotalSteps: 8_

## Goal

Fix all bugs uncovered during stress testing on 20+ major projects, and implement `owner/repo` positional argument for isolated clone-and-scan mode that simplifies both CLI usage and CI workflows.

## Bugs to Fix

| Bug | Severity | Source |
|-----|----------|--------|
| `@types/*` scope over-protection | Critical | MUI, Puppeteer |
| Silent crash on missing `version` | Critical | Puppeteer |
| globby symlink crash on pnpm hoist=false | Critical | Angular (already fixed) |
| `@vitest/coverage-v8` provider string | High | Svelte, Vue.js (2x) |
| ESLint import resolver convention | High | Puppeteer |
| Empty JSON when scan produces no output | Medium | socket.io CI |

## Feature: Isolated Scan Mode

`depsweep owner/repo` — clone, install, scan, report, cleanup. Implicit `--dry-run` for remote repos. All flags work: `--json`, `--output`, `--measure-impact`.

## Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope matching fix | Remove scope matching entirely | Explicit entries + wildcards sufficient; scope matching too broad for `@types` |
| Vitest detection | Scan vitest config files for provider string | Maps `provider: 'v8'` → `@vitest/coverage-v8` |
| ESLint resolver | Add `eslint-import-resolver-` to plugin conventions | Same pattern as other ESLint conventions |
| Isolated mode trigger | Positional arg matching `owner/repo` pattern | Clean CLI ergonomics: `depsweep facebook/react` |
| Remote repo dry-run | Always implicit | Can't meaningfully modify a temp clone |

## Steps

### Step 1: Fix `@types/*` scope over-protection
- **File:** `src/constants.ts`
- **What:** Remove scoped package matching from `isProtectedDependency()` (lines 308-313). The explicit entries and wildcard patterns are already sufficient. Scope matching is too broad — it protects ALL `@types/*` if ANY `@types/*` is in the list.
- **Code:** Delete lines 308-313 (the `// Scoped package matching` block)
- **Verify:** `npm run build && npm test`

### Step 2: Fix silent crash on missing version
- **File:** `src/index.ts`
- **What:** Guard against `undefined` version in Commander.js `.version()` call. Also fix catch block to log error before calling cleanup (which calls process.exit).
- **Code:** Change line 135 from `packageJson.version` to `packageJson.version ?? "0.0.0"`. In catch block (line 781-788), swap order: log error first, then cleanup.
- **Verify:** `npm run build`

### Step 3: Add vitest coverage provider detection
- **File:** `src/utils.ts`
- **What:** After binary name resolution and before plugin conventions, add vitest config file scanning. When dep matches `@vitest/coverage-*`, scan vitest config files for matching provider string.
- **Code:** Add detection block that maps `@vitest/coverage-v8` → checks for `provider: 'v8'` or `provider: "v8"` in vitest config files.
- **Verify:** `npm run build && npm test`

### Step 4: Add ESLint import resolver convention
- **File:** `src/utils.ts`
- **What:** Add `eslint-import-resolver-` prefix to PLUGIN_CONVENTIONS. Also add detection for `'import/resolver': { NAME: ... }` in ESLint config files which maps to `eslint-import-resolver-NAME`.
- **Verify:** `npm run build && npm test`

### Step 5: Implement isolated scan mode (owner/repo argument)
- **File:** `src/index.ts`
- **What:** Add `[target]` positional argument. When target matches `owner/repo` pattern:
  1. Create temp dir
  2. Clone repo with `git clone --depth 1`
  3. Detect package manager from lockfile
  4. Install deps with `--ignore-scripts`
  5. Set projectDirectory to clone path
  6. Force `--dry-run` mode
  7. Run normal scan flow
  8. Clean up temp dir on exit
- **Verify:** `npm run build && node dist/index.js chalk/chalk --json --dry-run 2>/dev/null | head -5`

### Step 6: Fix empty output on monorepo with no root deps
- **File:** `src/index.ts`
- **What:** When scan produces 0 dependencies and `--json` is set, still output a valid ScanResult with empty arrays instead of exiting silently.
- **Verify:** `npm run build`

### Step 7: Simplify CI scan-request workflow
- **File:** `.github/workflows/scan-request.yml`
- **What:** Replace the multi-step clone/install/scan with single `npx depsweep` invocation using the new isolated mode.
- **Verify:** Review YAML

### Step 8: Full verification
- **What:** Run all tests, lint, build, verify fixes
- **Verify:** `npm run validate`

## Verification Plan
- [ ] Build succeeds
- [ ] All tests pass
- [ ] Lint passes (0 errors)
- [ ] `@types/ip` would no longer be over-protected (scope matching removed)
- [ ] Missing version doesn't crash
- [ ] `depsweep owner/repo` clones and scans
- [ ] `--json` output always valid even with 0 deps
- [ ] CI workflow simplified

## Risks
| Risk | Mitigation |
|------|-----------|
| Removing scope matching under-protects framework packages | Check: explicit entries + wildcards in PROTECTED_DEPENDENCIES already cover needed packages |
| Isolated mode git clone fails | Handle errors gracefully, show helpful message |
| pnpm/yarn lockfile install issues in isolated mode | Fallback to non-frozen install |

## Execution Journal

### Step 1: Fix @types/* scope over-protection ✅
- Removed scoped package matching from `isProtectedDependency()` in constants.ts
- Updated tests in unit.test.ts and constants.test.ts to match new explicit-only matching

### Step 2: Fix silent crash on missing version ✅
- Restructured main() to use getDepsweepVersion() — reads depsweep's own package.json
- Moved Commander setup before project resolution, so version is always valid

### Step 3: Add vitest coverage provider detection ✅
- Added config file scanning in utils.ts for `@vitest/coverage-*` packages
- Maps `provider: 'v8'` → `@vitest/coverage-v8`, etc.

### Step 4: Add ESLint import resolver convention ✅
- Added `eslint-import-resolver-` to PLUGIN_CONVENTIONS
- Added `import/resolver` settings detection in ESLint configs

### Step 5: Implement isolated scan mode ✅
- Added `[target]` positional argument with `owner/repo` regex validation
- Added `cloneAndInstall()` — clone, detect PM, install with --ignore-scripts, fallback
- Force `--dry-run` for remote repos
- `finally` block cleans up temp directory
- Tested: `depsweep chalk/chalk --json --dry-run` produces correct JSON, temp dir cleaned

### Step 6: Fix empty output on monorepo with no root deps ✅
- Added early JSON exit when `dependencies.length === 0 && options.json`
- Returns valid ScanResult with empty arrays

### Step 7: Simplify CI scan-request workflow ✅
- Removed 5 steps (clone, detect PM, install, install failure handler, working-directory scan)
- Replaced with single `node dist/index.js "$TARGET_REPO" --json --measure-impact --output report.json`
- Added `npm install -g pnpm` step for pnpm repos

### Step 8: Full verification ✅
- `npm run validate` passes: type-check + lint + 387 tests + coverage above thresholds
- E2E test for invalid flags updated to match Commander behavior
- Live test: `depsweep chalk/chalk --json --dry-run` → correct output, cleanup works
