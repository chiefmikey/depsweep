# Plan: Lint Cleanup — Zero Errors, Zero Warnings

_Status: COMPLETED_
_LastCompletedStep: 4_
_TotalSteps: 4_
_Created: 2026-03-01_
_Completed: 2026-03-01_
_Summary: Fixed all 2 ESLint errors and 40 warnings. Zero lint issues remain._

## Task

Autonomously selected: Fix all 2 ESLint errors and 40 warnings across the codebase. This is the highest-impact code health task — lint errors block precommit hooks, and 40 warnings indicate dead code.

## Steps

### Step 1: Fix errors and unused imports/variables
Fix the 2 ESLint errors and remove all unused imports, variables, and assignments across all 6 files.

**Verify:** `npx eslint src/ 2>&1 | grep -c "error"` should return 0 errors.

### Step 2: Fix unused function parameters
Prefix unused callback/function parameters with `_` per ESLint convention.

**Verify:** `npx eslint src/ 2>&1 | grep "no-unused-vars"` should return no results.

### Step 3: Address `any` types
Replace `any` with proper types where feasible. For genuinely needed `any` (dynamic configs, external API boundaries), add inline eslint-disable comments with justification.

**Verify:** `npx eslint src/ 2>&1 | grep "no-explicit-any"` should return no results.

### Step 4: Full verification
Run lint, tests, type-check, and build to ensure nothing is broken.

**Verify:** `npm run validate` passes.

## Risks

- Removing unused imports/vars could break tests that mock those symbols
- Changing `any` types could cause type errors elsewhere
- Mitigation: Run full test suite after each step

## Execution Journal

**Step 1-3 (combined):** Fixed all issues across 6 files:
- `enhanced-environmental-calculations.ts`: removed unused `error` catch binding
- `interfaces.ts`: suppressed `any` on configs (arbitrary config shape)
- `performance-optimizations.ts`: fixed empty object type, typed caches (`boolean`, `Stats`), prefixed unused params, removed dead `fileReader` variable, suppressed necessary `any` types
- `helpers.ts`: removed 6 unused imports, suppressed Babel traverse interop `any`, typed `calculateImpactStats` return, removed dead `validateEnvironmentalImpact` function
- `index.ts`: removed 4 unused imports, removed dead `subdepIndex`/`subdepCount` vars, prefixed unused callback params, simplified `for...of` loop
- `utils.ts`: removed 2 unused imports, removed dead `fileSystem` var, removed dead `BATCH_SIZE` computation, fixed `let`→`const`, simplified destructuring, suppressed 3 necessary `any` types

**Step 4:** Full verification passed — `npm run validate` (type-check + lint + test:coverage:check) all green. Coverage improved slightly to 72.58%.
