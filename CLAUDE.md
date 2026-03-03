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

1. `getSourceFiles()` in utils.ts collects project files via globby
2. `getDependencyInfo()` in utils.ts dispatches to `OptimizedDependencyAnalyzer.processFilesInBatches()`
3. For `@types/` packages: uses `helpers.ts:isTypePackageUsed()` with peer dep checks
4. For regular packages: uses `performance-optimizations.ts:isDependencyUsedInFile()` (regex only)
5. `helpers.ts:isDependencyUsedInFile()` has full AST+config scanning but is ONLY used for @types

## GitHub Actions Workflows

- `scan-request.yml` — Issue-triggered (`depsweep: owner/repo`), scans target project
- `submit-pr.yml` — workflow_dispatch, opens PR removing unused deps on target repo
- `impact-report.yml` — Manual environmental impact report
- Uses `ADMIN_PAT` secret for cross-repo operations

## Conventions

- ESM project: use `import`, never `require` in source
- Conventional commits: `feat:`, `fix:`, `chore:`, etc.
- No emojis in production code output (removed in recent cleanup)
- `jest.clearAllMocks()` doesn't clear `mockResolvedValueOnce` — use `mockReset()`
- Babel traverse CJS/ESM interop: `(traverse as any).default || traverse`
