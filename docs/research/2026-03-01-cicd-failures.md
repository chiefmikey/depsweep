# Research: CI/CD Failures

_Date: 2026-03-01_

## Overview

Every CI workflow except Auto-Merge is failing. 12 workflow files in `.github/workflows/`, 6 distinct failure modes.

## Root Causes

### 1. Security Vulnerabilities (blocks: security.yml, quality.yml, pr-gate.yml)
- `minimatch` <=3.1.3 — HIGH (ReDoS) — fix: 3.1.2→3.1.5
- `ajv` <6.14.0 — MODERATE (ReDoS) — fix: 6.12.6→6.14.0
- `diff` 4.0.0-4.0.3 — LOW (DoS) — fix: 4.0.2→4.0.4
- All auto-fixable via `npm audit fix` (semver-compatible)

### 2. ESM/CJS Mismatch (blocks: test.yml, pr-gate.yml)
- Dist output is ESM (`export const ...`)
- CI validation scripts use `require()` — fails on ESM modules
- Must use `import()` or run with `--experimental-vm-modules`

### 3. Wrong Constant/Category Names (blocks: test.yml, pr-gate.yml)
CI expects constants that don't exist:
- `WATER_INTENSITY` → actual: `WATER_PER_KWH`
- `TREE_CARBON_ABSORPTION` → actual: `TREES_PER_KG_CO2`
- `CAR_EMISSIONS_PER_MILE` → actual: `CO2_PER_CAR_MILE`
- `EWASTE_ENERGY_PER_GB` → actual: `EWASTE_IMPACT_PER_GB`
- `SERVER_EFFICIENCY_FACTOR` → doesn't exist
- `NETWORK_ENERGY_PER_MB` → actual: exists ✓

CI expects categories that don't exist:
- `INFRASTRUCTURE` → no match
- `DEVELOPMENT_TOOLS` → actual: `DEV_UTILITIES`
- `FRAMEWORK_SPECIFIC` → no match

Actual categories: CORE_RUNTIME, BUILD_TOOLS, FRAMEWORK_CORE, TESTING, CODE_QUALITY, DEV_SERVER, PACKAGE_MANAGEMENT, TYPE_DEFINITIONS, CONFIGURATION, STYLING, ASSET_HANDLING, DEV_UTILITIES, SECURITY, DATABASE, HTTP_API, STATE_MANAGEMENT, ROUTING, I18N

### 4. console.log Check (blocks: test.yml quality job, pr-gate.yml quality job)
- CI checks for `console.log` in src/ and fails if found
- This is a CLI tool — it legitimately has 50 console.log calls
- Check must be removed

### 5. Performance Benchmark (blocks: performance.yml)
- Uses `depsweep` command directly (not in PATH)
- Must use `npx depsweep` or `node dist/index.js`

### 6. Status Badge (blocks: status-badge.yml)
- Runs `npm run test:coverage` twice (once for test, once to extract status)
- Wasteful and doubles failure surface

### 7. Codecov Issues
- `test.yml` uses codecov v4 with `fail_ci_if_error: true` — blocks if codecov is unavailable
- `quality.yml` uses codecov v3 (outdated)

### 8. Non-existent Scripts
- `build:analyze` doesn't exist in package.json (test.yml quality job)
- `coverage:detailed` — exists but may fail (references `scripts/coverage-analysis.js`)

## Workflow Inventory

| Workflow | Trigger | Status | Fix Needed |
|----------|---------|--------|------------|
| security.yml | push/PR/weekly | FAIL | npm audit fix, fix logic |
| performance.yml | push/PR/weekly | FAIL | use npx |
| status-badge.yml | daily | FAIL | simplify |
| test.yml | push/PR | FAIL | ESM fix, constants, console.log, codecov |
| quality.yml | push/PR | FAIL | codecov v4, security audit |
| pr-gate.yml | PR | FAIL | ESM fix, constants, console.log, security |
| publish.yml | manual | UNKNOWN | Node 'latest' is risky |
| release.yml | tag push | UNKNOWN | deprecated create-release action |
| test-runner.yml | manual | UNKNOWN | test summary always says success |
| auto-merge.yml | PR target | PASS | OK |
| impact-report.yml | manual | UNKNOWN | no node version |
