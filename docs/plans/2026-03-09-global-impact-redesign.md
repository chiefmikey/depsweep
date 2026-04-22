# Global Environmental Impact Redesign

## Problem

Environmental impact calculations used assumed values (fixed CI build counts,
estimated install times, runner power draw) producing numbers that aren't
defensible when submitting PRs to major repositories. The model measured
single-project CI impact when the real value is global ecosystem impact.

## Design

### Core Insight

When a published npm package has an unused entry in its `dependencies`, every
consumer who runs `npm install <package>` downloads that unused dep
transitively. With packages like axios at 395M installs/month, even a small
unused dependency produces measurable global waste.

### Two Categories

**Unused `dependencies` (global impact) -- reported with full metrics:**
Installed by every downstream consumer. Multiplier = parent package's real
monthly npm downloads. Every value in the formula is real data or a verified
published constant. Zero assumptions.

**Unused `devDependencies` (project-only) -- reported without impact numbers:**
Only installed in project CI/contributor machines. Calculating impact requires
assumptions (CI build frequency, runner power, install time estimation). Listed
as unused for cleanup value, but no environmental numbers attached.

### Formula

```
totalSizeGB = (depUnpackedSize + transitiveDepsSize) / (1024^3)
globalEnergy = parentDownloads * totalSizeGB * ENERGY_PER_GB
carbonSavings = globalEnergy * regionalCarbonIntensity
waterSavings = globalEnergy * WATER_PER_KWH
treesEquiv = carbonSavings * TREES_PER_KG_CO2
carMilesEquiv = carbonSavings / CO2_PER_CAR_MILE
```

Every input:

| Value | Source | Type |
|---|---|---|
| `parentDownloads` | npm downloads API | Real data |
| `depUnpackedSize` | npm registry API `dist.unpackedSize` | Real data (verified 50/50 exact match) |
| `transitiveDepsSize` | npm registry API per transitive dep | Real data |
| `ENERGY_PER_GB` (0.06) | IEA/LBNL 2024 | Verified published constant |
| `regionalCarbonIntensity` | IEA/EIA/Ember | Verified published constant |
| `WATER_PER_KWH` (1.8) | Uptime Institute | Verified published constant |
| `TREES_PER_KG_CO2` (0.045) | USDA Forest Service | Verified published constant |
| `CO2_PER_CAR_MILE` (0.4) | EPA | Verified published constant |

### Modes

- **Deep check** (default): resolves full transitive dependency tree sizes
  from registry. Used in CI and normal runs.
- **Quick check** (`--quick-check`): direct dep `unpackedSize` only, skips
  transitive resolution. For fast local iteration.

### Data Sources

All from npm public APIs, no local measurement:

1. **npm Downloads API** (existing): `GET /downloads/point/last-month/{pkg}`
   Returns monthly download count for parent package.

2. **npm Registry API** (new): `GET /{pkg}/{version}`
   Returns `dist.unpackedSize` and `dependencies` list.
   Validated: 50 packages tested, 50/50 byte-exact match with actual tarballs.

### CLI Changes

- `--quick-check` flag: skip transitive dep resolution (like `--dry-run`
  modifies behavior, this modifies depth)
- `--measure-impact` behavior unchanged but impact calculation uses new formula
- No other flag changes

### Output

Impact report only shown when unused `dependencies` (not devDeps) are found:

```
Global Environmental Impact:
  lodash (dependency) -- 1.4 MB unpacked
    Monthly installs:    395,006,129 (npm)
    Data footprint:      527 TB/month
    Energy waste:        31,604 kWh/month
    Carbon waste:        11,862 kg CO2e/month
    Equivalent to:       29,655 miles driven

  Sources: npm download count (real-time), package size (npm registry),
  energy intensity (IEA/LBNL 2024), carbon intensity (IEA 2025)
```

For devDeps:
```
karma-sauce-launcher (devDependency) -- 67 KB unpacked
    No global impact (devDependencies are not installed by consumers)
```

JSON output includes `impactCategory: "global" | "dev-only"` per dep.

### Code Changes

**New:**
- `src/global-impact.ts` -- registry metadata fetcher, transitive size
  resolver, global impact calculator

**Modified:**
- `src/index.ts` -- impact loop uses registry lookups instead of local
  `measurePackageInstallation()`. Categorizes deps vs devDeps from package.json.
- `src/interfaces.ts` -- `GlobalImpactMetrics` interface, `impactCategory` field
- `src/helpers.ts` -- display functions for new output format

**Removed from impact path:**
- `measurePackageInstallation()` calls
- `calculateCICDEnergy()`, `calculateCPUEnergy()`, `calculateMemoryEnergy()`,
  `calculateBuildEnergy()`, `calculateRegistryEnergy()`
- `BUILD_SYSTEM_ENERGY_PER_HOUR`, `CPU_ENERGY_PER_GB`, `MEMORY_ENERGY_PER_GB`
- CI-based `calculateImpactStats` stats table
- `enhanced-environmental-calculations.ts` heavily simplified

**Unchanged:**
- Detection pipeline (how unused deps are found)
- Verified constants: `ENERGY_PER_GB`, `CARBON_INTENSITY_*`, `WATER_PER_KWH`,
  `TREES_PER_KG_CO2`, `CO2_PER_CAR_MILE`
- `getParentPackageDownloads()`, `getDownloadStatsFromNpm()`
- All existing flags except new `--quick-check`

### Output Transparency

Every report includes:
- Source attribution for each data point (npm API, IEA, EPA, etc.)
- The exact formula used
- Raw values before conversion (kWh before carbon, downloads before energy)
- Clear labeling of `dependency` vs `devDependency` category
- No numbers without traceable sources
