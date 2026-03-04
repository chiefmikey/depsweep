# Plan: Fix Detection Precision to 100%

_Date: 2026-03-03_
_Status: COMPLETED_
_LastCompletedStep: 5_
_TotalSteps: 5_
_Completed: 2026-03-03_

## Goal

Eliminate all false positives found during real-world testing on webpack (112 deps) and react-scripts (51 deps). Current precision: 71.4% (5 true positives, 2 false positives). Target: 100%.

## Root Causes

1. **`optionalDependencies` scanned but inherently never imported** — `fsevents` is a macOS-only native module listed in `optionalDependencies`. These deps exist to trigger platform-specific binary installation, not to be imported. Flagging them is always wrong.

2. **Webpack inline loader syntax not detected** — `require("bundle-loader!./file")` uses `!` as a separator. Our regex only matches `require('exact-name')`, missing the `loader-name!path` pattern.

## Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| optionalDependencies | Exclude from scanning entirely | They are never directly imported by design; flagging them is always a false positive |
| peerDependencies | Keep scanning | Peers CAN be imported directly (e.g., react as peer of react-dom) |
| Webpack inline loaders | Add regex pattern for `loader!path` syntax | Matches `require("name!...")` and `import("name!...")` patterns |
| Where to exclude optionalDeps | In `getDependencies()` | Simplest — don't include them in the list at all |

## Steps

### Step 1: Exclude optionalDependencies from getDependencies()
- **File:** `src/utils.ts`
- **What:** Remove `optionalDependencies` from the `allDependencies` array in `getDependencies()`
- **Verify:** `npm run build`

### Step 2: Add webpack inline loader regex pattern
- **File:** `src/performance-optimizations.ts`
- **What:** Add pattern to match `require("name!...")` and `import("name!...")` in `getCompiledPatterns()`
- **Verify:** `npm run build`

### Step 3: Update tests
- **What:** Update pattern count test, add test for optionalDependencies exclusion
- **Verify:** `npm test`

### Step 4: Full validation + real-world verification
- **Verify:** `npm run validate`, then re-test on webpack and react-scripts

### Step 5: Commit
- **Verify:** Clean git status

## Execution Journal

- Removed optionalDependencies from getDependencies() allDependencies array
- Added webpack inline loader regex: `(?:require|import)\s*\(?\s*['"]name!` (pattern 7 of 7)
- Updated test: pattern count 6 → 7
- Build clean, 387 tests pass, 0 lint errors
- Re-tested on webpack (112 deps): 4 flagged, 4 true positives, 0 false positives → 100% precision
- Re-tested on react-scripts (50 deps): 1 flagged, 1 true positive, 0 false positives → 100% precision
- Combined across 4 projects (219 deps): 5 flagged, 5 true positives, 0 false positives → 100% precision
