# DepSweep

CLI tool for automated dependency cleanup with environmental impact reporting.
TypeScript, Node.js >=18, ESM, Babel AST parsing, Commander.js CLI.

## Commands

```bash
npm run build          # rm -rf dist && tsc && chmod +x dist/index.js
npm run validate       # type-check + lint + test:coverage:check (full CI)
npm run precommit      # lint + test:unit (quick check)
npm test               # jest (excludes utils.test.ts)
npm run lint           # eslint src/**/*.ts
```

## Architecture

- `src/index.ts` — CLI entry, main() with Commander.js, JSON output mode
- `src/helpers.ts` — Dep analysis (isDependencyUsedInFile w/ AST), env impact calcs
- `src/utils.ts` — getDependencyInfo, getSourceFiles, AST file scanning
- `src/constants.ts` — Protected deps lists, env constants, config patterns
- `src/performance-optimizations.ts` — OptimizedDependencyAnalyzer, LRU cache
- `src/interfaces.ts` — TypeScript types (ScanResult, ImpactMetrics, etc.)
- `scripts/generate-report.js` — JSON→markdown for issue comments
- `scripts/generate-pr-body.js` — JSON→markdown for PR bodies

## Detection Flow

1. `getSourceFiles()` in utils.ts collects project files via globby (dot: true for dotfiles)
2. `getDependencies()` in utils.ts excludes `optionalDependencies` (platform-only, never imported)
3. `getDependencyInfo()` in utils.ts runs a multi-layer detection pipeline:
   - Layer 1: `OptimizedDependencyAnalyzer.processFilesInBatches()` — 8 regex patterns against all source files
   - Layer 2: Package.json config field scanning (eslintConfig, prettier, stylelint, babel, jest, browserslist, commitlint, lint-staged, husky, mocha, ava, nyc, c8)
   - Layer 3: Package.json scripts scanning — npm scripts containing dependency name
   - Layer 4: Binary name resolution — reads `bin` field from `node_modules/<dep>/package.json`, checks scripts AND source files
   - Layer 5: Framework plugin conventions — karma-*, grunt-*, gulp-*, eslint-formatter-*, eslint-plugin-*, eslint-config-* auto-discovery
   - Layer 6: Peer dependency awareness — if dep is required peer of another installed dep, mark as used
   - Layer 7: Subdependency checking — if any subdep is used, parent is marked as used
4. For `@types/` packages: uses `helpers.ts:isTypePackageUsed()` with peer dep checks + AST
5. Protected dependencies: name/pattern matching against curated lists in constants.ts

## GitHub Actions Workflows

- `scan-request.yml` — Issue-triggered (`depsweep: owner/repo`), scans target project
- `submit-pr.yml` — workflow_dispatch, opens PR removing unused deps (supports dry_run mode)
- `impact-report.yml` — Manual environmental impact report
- Uses `ADMIN_PAT` secret for cross-repo operations

## Conventions

- ESM project: use `import`, never `require` in source
- Conventional commits: `feat:`, `fix:`, `chore:`, etc.
- No emojis in production code output (removed in recent cleanup)
- `jest.clearAllMocks()` doesn't clear `mockResolvedValueOnce` — use `mockReset()`
- Babel traverse CJS/ESM interop: `(traverse as any).default || traverse`
