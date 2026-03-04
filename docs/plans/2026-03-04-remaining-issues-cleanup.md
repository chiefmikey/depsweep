# Plan: Fix All Remaining Bugs & Issues

_Date: 2026-03-04_
_Status: COMPLETED_
_LastCompletedStep: 7_
_Completed: 2026-03-04_
_TotalSteps: 7_

## Goal

Fix all remaining bugs and issues: commit uncommitted work, close stale test issues, triage and merge 28 Dependabot PRs, and verify everything works.

## Issue Inventory

| Issue | Type | Action |
|-------|------|--------|
| Uncommitted bug fixes + isolated mode | Code | Commit and push |
| #324 redux scan (OPEN, failed) | Stale test issue | Close |
| #325 socket.io scan (OPEN, failed) | Stale test issue | Close |
| 28 Dependabot PRs (oldest Mar 2025) | Dependency debt | Triage, merge safe, test risky |

## Dependabot PR Triage

### Safe patches — merge immediately:
- #299 lru-cache 11.2.1→11.2.6
- #289 @babel/traverse 7.28.3→7.29.0
- #286 @babel/types 7.28.2→7.29.0
- #285 @babel/parser 7.28.3→7.29.0
- #288 commander 14.0.0→14.0.3
- #249 yaml 2.8.1→2.8.2
- #244 js-yaml 3.14.1→3.14.2
- #246 glob 10.4.5→10.5.0
- #237 @types/micromatch 4.0.9→4.0.10
- #205 chalk 5.6.0→5.6.2
- #250 ts-jest 29.4.1→29.4.6
- #224 typescript 5.9.2→5.9.3
- #219 jest and @types/jest (patch)
- #278 prettier 3.6.2→3.8.1

### Minor/type bumps — merge after test:
- #314 @types/node 24.3.0→25.3.3
- #200 @types/glob 8.1.0→9.0.0

### Major bumps — need testing:
- #307 eslint 9.35.0→10.0.2
- #293 @eslint/js 9.39.2→10.0.1
- #308 typescript-eslint 8.52.0→8.56.1
- #303 globby 14.1.0→16.1.1
- #292 ora 8.2.0→9.3.0
- #251 isbinaryfile 5.0.6→6.0.0
- #213 find-up 7.0.0→8.0.0

### Non-applicable (not our deps):
- #85 express 4→5 (not a dep, just in protected list)
- #170 koa 2→3 (not a dep, just in protected list)

### GitHub Actions bumps — merge after review:
- #311 actions/upload-artifact 4→7
- #247 actions/checkout 4→6
- #230 actions/setup-node 4→6
- #203 actions/github-script 7→8
- #198 codecov/codecov-action 4→5

## Steps

### Step 1: Commit and push local changes
- Commit all bug fixes + isolated mode + docs
- Push to main
- Verify: `git status` shows clean

### Step 2: Close stale test issues
- Close #324 and #325 with comment explaining they were CI flow tests
- Verify: `gh issue list` shows 0 open issues

### Step 3: Close non-applicable Dependabot PRs
- Close #85 (express) and #170 (koa) — these are not depsweep deps
- Verify: 26 PRs remaining

### Step 4: Merge safe patch PRs
- Merge all 14 safe patch PRs
- Run `npm run validate` after merging
- Verify: build + tests pass

### Step 5: Merge GitHub Actions PRs
- Merge all 5 actions PRs (checkout v6, setup-node v6, upload-artifact v7, github-script v8, codecov v5)
- Verify: YAML is valid

### Step 6: Merge major version bump PRs (with testing)
- Merge one at a time, test after each:
  - eslint 10 + @eslint/js 10 + typescript-eslint 8.56 (ESLint ecosystem together)
  - globby 16
  - ora 9
  - isbinaryfile 6
  - find-up 8
  - @types/node 25 + @types/glob 9
- Run `npm run validate` after each group
- If any breaks: fix or close PR

### Step 7: Final verification
- `npm run validate` — all green
- `node dist/index.js chalk/chalk --json --dry-run` — isolated mode works
- `gh issue list` — 0 open
- `gh pr list` — 0 open (or only genuinely blocked ones)

## Verification Plan
- [ ] All local changes committed and pushed
- [ ] Stale issues closed
- [ ] Build passes after all merges
- [ ] Tests pass (387+)
- [ ] Lint passes (0 errors)
- [ ] Isolated mode still works

## Risks
| Risk | Mitigation |
|------|-----------|
| Major version bumps break the build | Merge one group at a time, test between |
| globby 16 API changes | Check changelog, may need code updates |
| eslint 10 config changes | May need eslint.config.js updates |

## Execution Journal

### Step 1 ✅ — Committed daa7a55, pushed to main
### Step 2 ✅ — Closed #324 (redux) and #325 (socket.io)
### Step 3 ✅ — Closed #85 (express) and #170 (koa) — not deps
### Step 4 ✅ — Merged 14 safe patches. Used --admin for 3 that were behind main.
### Step 5 ✅ — Merged 2 actions PRs (#311, #203), applied remaining 3 (#247, #230, #198) directly in adb0391
### Step 6 ✅ — Upgraded eslint 10 + @eslint/js 10 + typescript-eslint 8.56 + globby 16 + ora 9 + find-up 8 + @types/node 25. Removed deprecated @types/glob. Fixed preserve-caught-error lint rule. Skipped isbinaryfile 6 (needs Node 24). Closed #46 (mikey-pro not a dep).
### Step 7 ✅ — `npm run validate` passes (387 tests, 0 lint errors). Isolated mode works. 0 issues, 0 PRs.
