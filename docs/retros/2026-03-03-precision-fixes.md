# Retro: Precision Fixes

_Date: 2026-03-03_

## What Happened

After 3 rounds of security hardening and accuracy fixes, we achieved 0% false positives on simple projects (express, CRA). But honest testing on complex projects (webpack 112 deps, react-scripts 50 deps) revealed 2 false positives — 71.4% precision. Fixed both root causes in a single pass to reach 100%.

## What Worked

- **Honest real-world testing on complex projects** — testing only on simple projects gave false confidence. Webpack's inline loader syntax and react-scripts' optionalDependencies exposed gaps that express/CRA never would.
- **Small, targeted fixes** — both issues were 1-2 line changes with clear root causes. No over-engineering needed.
- **The `**/*` glob pattern** already scans all file types including config files — this meant webpack loaders referenced in `webpack.config.js` were already correctly detected without any special config file handling.

## What Didn't Work

- **Testing on only 2 simple projects and claiming "0% false positives"** — express has straightforward imports, CRA is a template. Neither exercises plugin systems, optional deps, or complex build tooling. The claim was technically true but misleading about real-world readiness.

## Key Learnings

1. **`optionalDependencies` should never be scanned** — they exist for platform-specific binary installation (`fsevents` on macOS), not for importing. Flagging them is always wrong.
2. **Webpack inline loader syntax** (`require("bundle-loader!./file")`) is a niche pattern mostly found in webpack's own codebase. Adding a regex for `name!` after require/import catches it.
3. **Test on projects that are HARDER than your expected use case** — if you want to run on express-sized projects, test on webpack-sized ones first.
4. **7 regex patterns** now covers all mainstream import patterns: context-boundary, from-import, named-import, require, side-effect-import, dynamic-import, and webpack-inline-loader.

## Final Detection Architecture

```
getDependencies() → excludes optionalDependencies
                  → includes dependencies, devDependencies, peerDependencies

For each dependency:
  1. OptimizedDependencyAnalyzer.processFilesInBatches() — 7 regex patterns against all source files
  2. Package.json config field scanning — eslintConfig, prettier, stylelint, babel, jest, browserslist
  3. Package.json scripts scanning — npm scripts containing dependency name
  4. Subdependency checking — if any subdep is used, parent is marked as used
  5. @types/ packages — separate AST-based detection via helpers.ts
  6. Protected dependencies — name/pattern matching against curated lists
```
