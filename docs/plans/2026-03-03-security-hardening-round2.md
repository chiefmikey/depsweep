# Plan: Security Hardening Round 2 + Detection Bug Fixes

_Date: 2026-03-03_
_Status: COMPLETED_
_LastCompletedStep: 7_
_TotalSteps: 7_
_Completed: 2026-03-03_

## Goal

Fix remaining critical/high security issues in submit-pr.yml, fix regex lastIndex bug, add input validation, and scrub PAT from git config. From the 3-agent audit.

## Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| --ignore-scripts on installs | Add to all install AND uninstall commands | Prevents lifecycle script execution from untrusted repos |
| PAT scrubbing | Remove PAT from remote URL after clone, use inline URL only at push time | PAT already inline at push (line 211), just need to scrub origin after clone |
| Input validation | Strict regex on repo format and dep names | Prevents newline injection and flag injection |
| lastIndex fix | Reset lastIndex before each test() call | g flag + test() advances lastIndex; must reset per-file |
| Permissions block | Add explicit minimal permissions to submit-pr.yml | Defense in depth |
| Fork sync | Add gh repo sync before reuse | Prevents stale/tampered fork |
| depsweep own install | Add --ignore-scripts | Defense in depth |

## Steps

### Step 1: Fix submit-pr.yml — --ignore-scripts on all install/uninstall commands
### Step 2: Fix submit-pr.yml — scrub PAT from git remote URL after clone
### Step 3: Fix submit-pr.yml — add permissions block, input validation, fork sync
### Step 4: Fix scan-request.yml — add input validation regex
### Step 5: Fix regex lastIndex bug in performance-optimizations.ts
### Step 6: Full verification
### Step 7: Commit

## Execution Journal

- All submit-pr.yml fixes applied in single rewrite: --ignore-scripts (8 occurrences), PAT scrub, permissions block, input validation (repo + dep names), fork sync, --depth 1 clone
- scan-request.yml: Added strict regex validation + newline stripping
- performance-optimizations.ts: Added lastIndex reset before pattern.test()
- Build: clean. Tests: 387 passed, 1 skipped. Lint: 0 errors.
- Verified with awk scan: zero ${{ }} in run blocks, all fixes confirmed.
