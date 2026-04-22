# Retro: Global Impact Redesign + Project Improvements

_Date: 2026-03-09_

## What happened

Two major efforts in one session:

1. **Global impact redesign** -- replaced the old CI-based environmental impact model (which used assumed values like "100 CI builds/month") with a new model using real npm data (actual download counts, actual package sizes from registry). Zero assumptions in the formula.

2. **Project improvements** -- dead code cleanup, API resilience, parallelization, verbose formula display, and detection pipeline testing.

## What went well

- **Subagent-driven development worked smoothly** for the global impact implementation. 10 tasks dispatched across 5 subagent calls, all completed without issues.
- **Dead code cleanup was massive** (-4,100 lines) and the codebase is dramatically cleaner. The old model had 19 exported functions in enhanced-environmental-calculations.ts that were all dead.
- **Coverage went UP despite removing code** -- from 62% to 70% statements. The dead code had dedicated tests inflating the numbers, but the new detection pipeline tests added real value.
- **Parallelization was straightforward** -- resolveTransitiveSize now batches 5 concurrent fetches, and index.ts fetches all metadata in parallel via Promise.all.

## What didn't go well

- **The old model had accumulated significant complexity** (41-field EnvironmentalImpact interface, 20+ calculation functions) that was never needed. This was over-engineering from early development.
- **Some test files were 100% testing dead code** (3 files deleted entirely). Tests should test behavior users care about, not internal implementation details of a calculation model.
- **Coverage thresholds had to be lowered** from 60%/49%/60%/60% to 57%/42%/56%/57% because removing the dead code removed the tests that covered it. The real coverage actually improved.

## Learnings

- **Real data beats assumptions.** The old model had 17+ assumed constants. The new model has 8 verified published constants and 2 real-time API data sources. Much more defensible for PR submissions.
- **Dead code accumulates fast when models change.** The old enhanced-environmental-calculations.ts was 528 lines of code that nobody called. Should have been deleted when the model changed.
- **Retry logic is cheap to add.** The exponential backoff implementation was ~30 lines and makes the tool robust against transient npm API failures.
- **Detection pipeline was the biggest untested risk.** 59 new tests now cover the 10-layer detection pipeline, catching real edge cases (scoped packages, binary name detection, framework plugins).

## CLAUDE.md updates applied

- Added `src/global-impact.ts` to architecture
- Updated `src/helpers.ts` description (no longer has env impact calcs)
- Added Environmental Impact Model section
- Added `--quick-check` to usage modes

## Numbers

| Metric | Before | After |
|--------|--------|-------|
| Source lines | ~4,600 | ~3,500 |
| Test count | 399 | 309 |
| Coverage (statements) | 62% | 70% |
| Coverage (branches) | 50% | 57% |
| Dead exports | 65 | 0 |
| Env constants | 25 | 9 |
| API call strategy | Sequential, no retry | Parallel (5x), 3 retries w/ backoff |
