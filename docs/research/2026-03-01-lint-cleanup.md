# Research: Lint Cleanup

_Date: 2026-03-01_
_Topic: ESLint errors and warnings analysis_

## Summary

DepSweep has 2 ESLint errors and 40 warnings across 6 source files. These block the precommit hook (`npm run precommit` runs `lint + test:unit`).

## Findings

### Errors (2)

| File | Line | Issue |
|------|------|-------|
| `performance-optimizations.ts` | 13 | `T extends {}` should be `T extends object` |
| `utils.ts` | 528 | `let totalErrors = 0` should be `const` |

### Warnings by Category

**Unused Imports (10)**
- `helpers.ts`: `ProgressOptions`, `DependencyInfo`, `ImpactMetrics`, `EnvironmentalReport`, `formatEnhancedImpact`, `findSubDependencies`
- `index.ts`: `PROTECTED_DEPENDENCIES`, `getProtectionReason`, `isTypePackageUsed`, `processFilesInParallel`
- `utils.ts`: `readdirSync`, `getMemoryUsage`, `processResults`

**Unused Variables/Assignments (10)**
- `enhanced-environmental-calculations.ts:39`: unused `error`
- `helpers.ts:1136`: unused export `validateEnvironmentalImpact`
- `index.ts:250-252`: unused params `filePath`, `sIndex`, `sCount`
- `index.ts:277,282,283`: unused vars `index`, `subdepIndex`, `subdepCount`
- `performance-optimizations.ts:201`: unused param `context`
- `performance-optimizations.ts:245`: unused var `fileReader`
- `utils.ts:47`: unused var `fileSystem`
- `utils.ts:498`: unused var `key`
- `utils.ts:522`: unused var `BATCH_SIZE`

**`any` Types (13)**
- `helpers.ts`: 5 instances (lines 94, 95, 96, 795, 796)
- `interfaces.ts`: 1 instance (line 3)
- `performance-optimizations.ts`: 5 instances (lines 146, 201, 241, 338, 367)
- `utils.ts`: 3 instances (lines 269, 407, 480)

## Risk Assessment

- Removing unused imports is safe (no runtime effect)
- Prefixing unused params with `_` is safe (convention)
- Removing unused variable assignments needs verification (side effects?)
- Changing `any` to proper types needs careful analysis
- `validateEnvironmentalImpact` might be exported for external use — check before removing
