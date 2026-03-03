# Retro: Security and Detection Accuracy Fixes

_Date: 2026-03-03_

## What Happened

Fixed 4 critical security vulnerabilities in GitHub Actions workflows and 4 detection accuracy bugs that were causing a ~65% false positive rate. This was the blocker preventing depsweep from being used on public repos.

## What Worked

- **3-agent parallel audit** identified all issues comprehensively before any fixes were attempted. This prevented piecemeal discovery.
- **Parallel subagent execution** for independent steps (Steps 1+2, Steps 5+6) cut execution time significantly.
- **The plan** was well-scoped with clear verification criteria per step, making execution straightforward.
- **Security fix pattern** (env: vars for all ${{ }} in run: blocks) was simple and systematic.

## What Didn't Work

- **Coverage thresholds** were hardcoded in both `jest.config.ts` AND `package.json` command-line flags. The config file wins, so the package.json flags were ineffective. Cleaned up to use config file only.
- **Plan file step tracking** wasn't updated after each step during execution — had to catch up at the end. Should update `_LastCompletedStep_` immediately after each step completes.

## Key Learnings

1. **`\b` regex boundary is a trap for scoped packages**: `@` is a non-word character, so `\b@scope/pkg\b` fails when preceded by whitespace or quotes (both non-word). Use explicit character class boundaries instead.
2. **Performance optimization = accuracy regression risk**: The `OptimizedDependencyAnalyzer` bypassed the full AST-based detection in `helpers.ts`, using only 4 regex patterns. This was the root cause of the 65% false positive rate. Any time you add a "fast path", ensure it's feature-equivalent to the full path.
3. **globby defaults**: `dot: false` is globby's default. Always add `dot: true` when scanning config files.
4. **package.json as config**: Many tools store their config inline in package.json (eslintConfig, prettier, babel, jest, stylelint, browserslist). Dependency scanners must check these fields or they'll miss usage.
5. **GitHub Actions security**: Never use `${{ }}` in `run:` blocks with user-controlled data. Always pass through `env:` blocks. This is the #1 Actions security pitfall.

## Process Improvements

- When adding a "fast path" optimization, always write a test that verifies it produces identical results to the "full path" for a representative sample.
- Coverage thresholds should live in exactly one place (jest.config.ts), not duplicated in scripts.

## Impact

- Security: 4 critical injection vectors closed
- Accuracy: False positive rate should drop significantly (from ~65% to much lower) thanks to dotfile scanning, scoped package regex fix, side-effect import detection, and package.json config scanning
- Ready for cautious testing on public repos
