# DepSweep

## Project Overview
CLI tool for automated dependency cleanup with environmental impact reporting. Scans projects for unused npm dependencies using AST analysis.

## Tech Stack
- **Language:** TypeScript (ESM, strict mode)
- **Runtime:** Node.js >=20.19.0
- **CLI:** Commander.js with JSON output mode
- **AST:** Babel parser + traverse for import detection
- **Testing:** Jest 30 + ts-jest
- **Linting:** ESLint 10 (own flat config, not mikey-pro) + Prettier

## Architecture
- `src/index.ts` — CLI entry, main() with Commander.js, JSON output mode
- `src/helpers.ts` — Dep analysis (isDependencyUsedInFile w/ AST), env impact calcs
- `src/utils.ts` — getDependencyInfo, getSourceFiles, AST file scanning
- `src/constants.ts` — Protected deps lists, env constants, config patterns
- `src/performance-optimizations.ts` — OptimizedDependencyAnalyzer, LRU cache
- `src/interfaces.ts` — TypeScript types (ScanResult, ImpactMetrics, etc.)
- `scripts/` — generate-report.js, generate-pr-body.js (JSON->markdown)
- `test/` — Jest tests (__tests__/, __mocks__/, setup.ts)

## Commands
```bash
npm run build          # tsc + chmod +x dist/index.js
npm run validate       # type-check + lint + test:coverage:check (full CI)
npm run precommit      # lint + test:unit (quick check)
npm test               # jest (excludes utils.test.ts)
npm run lint           # eslint src/**/*.ts
npm run dev            # tsc --watch
npm run dev:run        # build + run
```

## Usage Modes
- **Local scan:** `depsweep` (scans current project)
- **Remote scan:** `depsweep owner/repo` (clones, installs, scans, cleans up — implicit --dry-run)
- **JSON output:** `depsweep --json` or `depsweep owner/repo --json --output report.json`
- **CI scan:** Issue titled `depsweep: owner/repo` triggers scan-request.yml

## Detection Flow
1. `getSourceFiles()` collects project files via globby
2. `getDependencies()` excludes `optionalDependencies`
3. `getDependencyInfo()` runs a 9-layer detection pipeline (regex, package.json config, scripts, binaries, framework plugins, vitest coverage, ESLint resolvers, peer deps, subdeps)
4. `@types/` packages: `isTypePackageUsed()` with peer dep checks + AST
5. Protected dependencies: exact name/pattern matching in constants.ts

## Conventions
- ESM project: use `import`, never `require` in source
- Conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Babel traverse CJS/ESM interop: `(traverse as any).default || traverse`
- `jest.clearAllMocks()` doesn't clear `mockResolvedValueOnce` — use `mockReset()`

## Testing
- **Framework:** Jest 30 + ts-jest
- **Location:** `test/__tests__/` (unit, e2e, performance)
- **Run:** `npm test` (excludes utils.test.ts), `npm run test:unit`, `npm run test:e2e`
- **Coverage:** `npm run test:coverage`
