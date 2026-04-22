# Project Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up ~1,100 lines of dead code, add retry/parallelization to API calls, show formula in verbose mode, and add unit tests for the detection pipeline.

**Architecture:** Five independent improvement areas executed in dependency order. Dead code cleanup first (reduces noise), then API resilience (retry + parallelize), then UX (verbose formula), then testing.

**Tech Stack:** TypeScript, Jest 30, npm registry API

_Status: COMPLETED_
_LastCompletedStep: 5_
_TotalSteps: 5_
_Completed: 2026-03-09_

---

### Task 1: Dead Code Cleanup

Remove all code from the old CI-based environmental impact model that is no longer called from any live path.

**Files to delete:**
- `src/enhanced-environmental-calculations.ts` (entire file, 528 lines, 19 exports all dead)

**Files to modify:**
- `src/helpers.ts` -- remove 26 dead exported functions (~450 lines), remove imports from enhanced-environmental-calculations.ts
- `src/interfaces.ts` -- remove `EnvironmentalImpact` (41 fields), `ImpactMetrics`, `EnvironmentalReport`
- `src/constants.ts` -- remove 17 unused constants from ENVIRONMENTAL_CONSTANTS

**Test files to delete (100% dead code tests):**
- `test/__tests__/enhanced-environmental-calculations.test.ts`
- `test/__tests__/environmental-impact-comprehensive.test.ts`
- `test/__tests__/environmental-impact-simple.test.ts`

**Test files to modify (mixed live + dead code tests):**
- `test/__tests__/helpers-comprehensive.test.ts` -- remove dead function tests, keep isConfigFile/parseConfigFile/scanForDependency/isDependencyUsedInFile tests
- `test/__tests__/remaining-coverage.test.ts` -- remove calculateImpactStats/displayImpactTable/validateInputs tests
- `test/__tests__/final-push-coverage.test.ts` -- remove displayImpactTable/calculateEnvironmentalImpact/validateInputs tests
- `test/__tests__/coverage-gaps.test.ts` -- remove dead code tests
- `test/__tests__/precision-coverage.test.ts` -- remove dead code tests
- `test/__tests__/edge-cases.test.ts` -- remove dead function tests, keep isConfigFile/parseConfigFile/isDependencyUsedInFile tests
- `test/__tests__/unit.test.ts` -- remove dead function tests, keep live tests

**Dead functions in helpers.ts to remove:**
getMemoryUsage, generatePatternMatcher, matchesDependency, processResults, formatTime, createTemporaryPackageJson, measurePackageInstallation, getDownloadStatsFromNpm, getYearlyDownloads, calculateImpactStats, displayImpactTable, calculateEnvironmentalImpact, validateInputs, calculateTransferEnergy, calculateNetworkEnergy, calculateStorageEnergy, calculateEwasteEnergy, calculateEfficiencyEnergy, calculateServerEfficiencyEnergy, aggregateEnergySavings, createZeroEnvironmentalImpact, calculateCumulativeEnvironmentalImpact, formatEnvironmentalImpact, displayEnvironmentalImpactTable, generateEnvironmentalRecommendations, displayEnvironmentalHeroMessage

**Dead constants to remove from ENVIRONMENTAL_CONSTANTS:**
CPU_ENERGY_PER_GB, MEMORY_ENERGY_PER_GB, LATENCY_ENERGY_PER_MB, BUILD_SYSTEM_ENERGY_PER_HOUR, CI_CD_ENERGY_PER_BUILD, REGISTRY_ENERGY_PER_DOWNLOAD, CARBON_OFFSET_COST_PER_KG, WATER_TREATMENT_COST_PER_LITER, RENEWABLE_ENERGY_PERCENTAGE, LIFECYCLE_ENERGY_MULTIPLIER, PEAK_ENERGY_MULTIPLIER, OFF_PEAK_ENERGY_MULTIPLIER, BUILD_TIME_PRODUCTIVITY_GAIN, EWASTE_IMPACT_PER_GB, SERVER_UTILIZATION_IMPROVEMENT, EFFICIENCY_IMPROVEMENT, NETWORK_ENERGY_PER_MB

**Keep in ENVIRONMENTAL_CONSTANTS (used by global-impact.ts):**
ENERGY_PER_GB, CARBON_INTENSITY, CARBON_INTENSITY_NA, CARBON_INTENSITY_EU, CARBON_INTENSITY_AP, WATER_PER_KWH, TREES_PER_KG_CO2, CO2_PER_CAR_MILE, STORAGE_ENERGY_PER_GB_YEAR

**Verify:** `npm run validate` passes, coverage thresholds still met.

---

### Task 2: Add Retry Logic to getPackageMetadata

**Files:**
- Modify: `src/global-impact.ts`
- Modify: `test/__tests__/global-impact.test.ts`

Add exponential backoff retry to `getPackageMetadata()`:
- 3 retries max, delays: 1s, 2s, 4s
- Retry on: network errors, 429 (rate limit), 503 (service unavailable), 502 (bad gateway)
- Don't retry on: 404 (package not found), 400 (bad request)
- Log retry attempts only in verbose mode (pass through optional logger)

Add tests for:
- Succeeds on 2nd attempt after transient failure
- Returns null after 3 failed retries
- Doesn't retry on 404
- Retries on 429/503

**Verify:** `npx jest test/__tests__/global-impact.test.ts --no-coverage`

---

### Task 3: Parallelize API Calls

**Files:**
- Modify: `src/global-impact.ts`
- Modify: `src/index.ts`
- Modify: `test/__tests__/global-impact.test.ts`

**3a: Parallelize resolveTransitiveSize**
Replace sequential queue with batched concurrent fetches (concurrency limit = 5):
```typescript
async function resolveTransitiveSize(dependencies: string[], quickCheck: boolean): Promise<number> {
  if (quickCheck || dependencies.length === 0) return 0;
  const visited = new Set<string>();
  let totalSize = 0;
  let queue = [...dependencies];
  while (queue.length > 0) {
    const batch = queue.splice(0, 5).filter(d => !visited.has(d));
    batch.forEach(d => visited.add(d));
    const results = await Promise.all(batch.map(d => getPackageMetadata(d)));
    for (const [i, metadata] of results.entries()) {
      if (!metadata) continue;
      totalSize += metadata.unpackedSize;
      for (const dep of metadata.dependencies) {
        if (!visited.has(dep)) queue.push(dep);
      }
    }
  }
  return totalSize;
}
```

**3b: Parallelize per-dep metadata fetching in index.ts**
In both JSON and CLI output paths, fetch metadata for all unused deps concurrently (limit 5):
```typescript
// Fetch all metadata in parallel
const metadataResults = await Promise.all(
  unusedDependencies.map(dep => getPackageMetadata(dep))
);
```
Then loop through results to build unusedDepInfos. The transitive resolution per-dep is still sequential per-dep but parallelized internally.

**Verify:** `npm run validate`

---

### Task 4: Show Formula in Verbose Mode

**Files:**
- Modify: `src/index.ts` (CLI output path only)

In the CLI `--measure-impact --verbose` path, after displaying per-dep impact, add:

```
  Formula:
    totalSizeGB = (unpackedSize + transitiveDepsSize) / 1024^3
    energyWaste = monthlyDownloads * totalSizeGB * 0.06 kWh/GB (IEA/LBNL 2024)
    carbonWaste = energyWaste * 0.37 kg CO2/kWh (EIA 2023, US avg)
    waterWaste  = energyWaste * 1.8 L/kWh (Uptime Institute)
```

Small change, just append after the sources block when verbose is enabled.

**Verify:** `npm run build && node dist/index.js --help`

---

### Task 5: Add Detection Pipeline Unit Tests

**Files:**
- Create: `test/__tests__/detection-pipeline.test.ts`

Add focused unit tests for the most critical detection gaps:

**5a: getDependencyInfo layers** (from utils.ts)
- Binary name detection: package with custom `bin` field, verify it's found in scripts
- Framework plugin conventions: `karma-chrome-launcher`, `eslint-plugin-import`
- Jest environment detection: `jest-environment-jsdom` via jest config
- Vitest coverage provider: `@vitest/coverage-v8` via vitest config
- ESLint import resolver: `eslint-import-resolver-typescript`
- Peer dependency awareness: dep required by another installed dep

**5b: OptimizedDependencyAnalyzer regex patterns** (from performance-optimizations.ts)
- Scoped package import: `import { x } from '@scope/pkg'`
- Dynamic import: `import('@scope/pkg')`
- Require: `require('pkg')`
- Side-effect import: `import 'pkg'`
- No false positive from string/comment containing package name

**Verify:** `npx jest test/__tests__/detection-pipeline.test.ts --no-coverage`

---

## Verification Plan
- [ ] Build succeeds (`npm run build`)
- [ ] Type check passes (`npx tsc --noEmit`)
- [ ] All tests pass (`npm test`)
- [ ] Coverage thresholds still met (60% stmt, 49% branch, 60% func, 60% line)
- [ ] Lint passes (`npm run lint`)
- [ ] `depsweep --json --measure-impact --dry-run` produces valid JSON
- [ ] `depsweep --measure-impact --verbose --dry-run` shows formula section

## Risks
| Risk | Mitigation |
|------|-----------|
| Dead code removal drops coverage below thresholds | Check coverage after removal, adjust thresholds if needed |
| Parallelized API calls cause rate limiting | 5-concurrency limit + retry logic |
| Test removal breaks CI | Run full validate before committing |
