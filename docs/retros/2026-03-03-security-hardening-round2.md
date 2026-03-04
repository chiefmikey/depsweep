# Retro: Security Hardening Round 2

_Date: 2026-03-03_

## What Happened

After the first round of security fixes (env vars for ${{ }}, --ignore-scripts in scan workflow), a 3-agent audit revealed 4 remaining critical/high issues in submit-pr.yml and 1 detection bug. Fixed all in a single pass.

## What Worked

- **Multi-agent parallel audit** caught issues that a single pass would have missed. Three different perspectives (accuracy, detection logic, security) gave comprehensive coverage.
- **Full file rewrite** for submit-pr.yml was faster and cleaner than incremental edits when many changes were needed.
- **Quick turnaround** — audit + fix + verify in one session.

## What Didn't Work

- **First round missed submit-pr.yml** — we only applied --ignore-scripts to scan-request.yml. The submit-pr workflow runs untrusted code too (install + uninstall) and was left unprotected.
- **PAT in git remote URL** is a common pattern that's easy to overlook. The credential persists in `.git/config` long after the clone.

## Key Learnings

1. **Both workflows need identical security treatment** — if scan-request.yml gets --ignore-scripts, submit-pr.yml must too. They both interact with untrusted repos.
2. **Regex `g` flag + `test()` = `lastIndex` bug** — `test()` advances `lastIndex` on match, so the next `test()` starts mid-string. Always reset `lastIndex = 0` before `test()` when reusing `g`-flag patterns.
3. **PAT scrubbing pattern**: `git clone` with token URL → immediately `git remote set-url origin` to remove it → re-inject token only at `git push` time via inline URL.
4. **GITHUB_OUTPUT newline injection** — `echo "key=value" >> $GITHUB_OUTPUT` is vulnerable if the value contains newlines. Strip with `tr -d '\n\r'` or use heredoc delimiter syntax.
5. **Input validation is defense in depth** — even though workflow_dispatch inputs are manually triggered, validating format prevents accidental or malicious flag injection.

## Round 3 — Scripts Checking & Final PAT Scrub

After a second "is it ready?" audit, two remaining issues were found:
1. **Scripts not checked** — `OptimizedDependencyAnalyzer` ignores `_context` entirely, so npm scripts were never scanned. Tools like `nyc` (only in scripts) got falsely flagged.
2. **PAT not scrubbed in scan-request.yml** — submit-pr.yml had the fix but scan-request.yml was missed.

### Fixes Applied
- Added scripts checking to `getDependencyInfo()` in `utils.ts` — checks `context.scripts` values for dependency name when no source file matches found
- Added `git remote set-url origin` after clone in scan-request.yml

### Verification
- Express.js: 0 false positives (44 deps, `nyc` correctly detected via scripts)
- React app: 0 false positives (13 deps, `react-scripts` correctly detected via scripts)
- False positive rate: 33% → 0%
- All 7 security checks pass on both workflows

## Remaining Known Limitations

These are accepted risks, not blockers:
- **Detection is regex-only for non-@types packages** — comments mentioning a package name will prevent it from being flagged (false negative for detection, not a false positive for PRs)
- **`includes()` substring matching** in package.json config scanning — e.g., `react` found in `react-app` string. Only fires as fallback when no source file matches exist.
- **`@types/glob` false negative** — `"global".includes("glob")` substring collision. Low impact (one dep, devDependency only).
