# Retro: Remaining Issues Cleanup

_Date: 2026-03-04_

## What Was Done

Resolved all remaining issues: committed uncommitted work, closed 2 stale test issues, triaged and resolved all 28 Dependabot PRs (14 merged as patches, 5 GitHub Actions upgraded, 7 major versions upgraded, 2 closed as non-applicable, 1 closed as removed dep), and upgraded ESLint to v10.

## Results
- **Before:** 2 open issues, 28 open PRs, uncommitted local changes
- **After:** 0 open issues, 0 open PRs, all changes committed and pushed, all deps current

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Skip isbinaryfile 6 | Requires Node >=24, too aggressive for a tool targeting Node >=20 |
| Remove @types/glob | v9 is deprecated stub — glob ships own types now |
| Upgrade ESLint to 10 | 3 new recommended rules (preserve-caught-error, no-unassigned-vars, no-useless-assignment). Only 1 existing violation found and fixed. |
| Bump engines to >=20.19.0 | Required by ESLint 10, globby 16, ora 9, find-up 8. Node 18 is EOL anyway. |
| Remove --ext .ts from lint scripts | Removed in ESLint 10. File filtering is already in eslint.config.js `files` array. |
| Use --admin for stale patches | 3 patches were behind main and wouldn't merge normally. Safe to force since they're patches. |

## What Worked
- Batch-merging safe patches with a loop was efficient (14 PRs in one command)
- Researching breaking changes BEFORE upgrading prevented trial-and-error
- Parallel research agents for different package ecosystems saved time

## What Didn't Work
- `--legacy-peer-deps` was needed for the ESLint ecosystem install due to transitive peer dep conflicts
- 3 actions PRs had merge conflicts after earlier merges — had to apply directly

## Learnings
- ESLint 10's `preserve-caught-error` rule is valuable — catches error chain breakage
- globby 16 now searches .gitignore up to git root — subtle behavior change worth knowing
- Dependabot PRs accumulate fast when not merged regularly — 28 PRs spanning 12 months
