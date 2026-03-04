# Retro: Bug Fixes + Isolated Scan Mode

_Date: 2026-03-04_

## What Was Done

Fixed 6 bugs found during stress testing on 24 major open-source projects, and implemented `depsweep owner/repo` isolated scan mode that simplifies CLI, npx, and CI usage.

### Bugs Fixed
1. **@types/* scope over-protection** — scope matching in `isProtectedDependency()` was protecting ALL `@types/*` packages if any `@types/*` was in the protected list. Fixed by removing scope matching entirely; explicit entries + wildcards are sufficient.
2. **Silent crash on missing version** — Commander `.version(undefined)` broke when monorepo root had no `version` field. Fixed by reading depsweep's own package.json for version.
3. **globby symlink crash** — `followSymbolicLinks: true` (default) caused `RangeError: Map maximum size exceeded` on pnpm `hoist=false` repos. Fixed with `followSymbolicLinks: false`.
4. **Vitest coverage provider FP** — `@vitest/coverage-v8` loaded via `provider: 'v8'` string in vitest config, never imported. Added config file scanning.
5. **ESLint import resolver FP** — `eslint-import-resolver-typescript` used via `'import/resolver': { typescript: true }` pattern. Added to plugin conventions + settings detection.
6. **Empty JSON output** — Monorepo roots with 0 deps produced no output. Added early JSON exit with valid empty ScanResult.

### Feature: Isolated Scan Mode
- `depsweep owner/repo` positional argument
- Clones to temp dir, detects package manager, installs with --ignore-scripts
- Forces --dry-run (can't modify a temp clone)
- All flags work: --json, --output, --measure-impact, --verbose
- Cleanup in finally block
- CI workflow simplified from 12 steps to 7

## What Worked
- Stress testing methodology: running against real-world projects is the most effective way to find FPs and bugs
- Bug categorization by severity helped prioritize fixes
- The isolated mode was a clean abstraction — all the clone/install/detect logic is in one function
- `finally` block cleanup pattern is robust

## What Didn't Work
- Plan status tracking wasn't updated during execution (said step 0 when steps 1-4 were done)
- The scope matching bug was subtle — it looked correct but had a pathological case with `@types/*`

## Learnings
- **Scope matching is dangerous** for protected deps — too broad. Explicit entries + wildcards are the right granularity.
- **Vitest/ESLint resolver patterns** are common enough to warrant first-class detection. Both appeared in multiple top-50 projects.
- **globby defaults are hostile** — `followSymbolicLinks: true` is the default but causes crashes on pnpm workspaces.
- **Commander.js `.version(undefined)`** silently breaks the method chain rather than throwing.

## Updated Artifacts
- CLAUDE.md — Added Usage Modes section, updated detection flow to 9 layers
- MEMORY.md — Added Isolated Scan Mode section, updated current state
- Plan completed and marked as such
