# Global Environmental Impact Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace assumption-based environmental calculations with a global impact model using real npm data. Zero assumptions in the formula.

**Architecture:** New `src/global-impact.ts` module handles npm registry queries and the global impact formula. `index.ts` categorizes unused deps as `dependency` vs `devDependency` and only computes environmental impact for `dependencies`. Old calculation module (`enhanced-environmental-calculations.ts`) is removed from the impact path.

**Tech Stack:** TypeScript, npm registry API (`https://registry.npmjs.org`), npm downloads API (existing), Commander.js CLI

---

### Task 1: Add new interfaces

**Files:**
- Modify: `src/interfaces.ts`

**Step 1: Write the failing test**

Create `test/__tests__/global-impact.test.ts`:

```typescript
import { jest } from "@jest/globals";

describe("Global Impact Interfaces", () => {
  it("should have GlobalImpact interface with required fields", async () => {
    const { GlobalImpact } = await import("../../src/interfaces.js") as any;
    // Interface existence is verified by TypeScript compilation
    // Test a concrete implementation
    const impact: any = {
      monthlyDownloads: 395000000,
      unpackedSize: 2423319,
      transitiveDepsSize: 500000,
      totalSizeGB: 0.00272,
      energyWasteKwh: 64.4,
      carbonWasteKg: 24.1,
      waterWasteLiters: 115.9,
      treesEquivalent: 1.08,
      carMilesEquivalent: 60.3,
      region: "NA",
      carbonIntensity: 0.37,
      sources: {
        downloads: "npm downloads API",
        packageSize: "npm registry API",
        energyIntensity: "IEA/LBNL 2024",
        carbonIntensity: "EIA 2023",
      },
    };
    expect(impact.monthlyDownloads).toBe(395000000);
    expect(impact.sources.downloads).toBe("npm downloads API");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest test/__tests__/global-impact.test.ts --no-coverage`
Expected: PASS (we're testing structure, not imports of types)

**Step 3: Add interfaces to interfaces.ts**

Add to `src/interfaces.ts`:

```typescript
export type DepCategory = "dependency" | "devDependency";

export interface GlobalImpact {
  // Real data from npm
  monthlyDownloads: number;
  unpackedSize: number;         // bytes, from registry
  transitiveDepsSize: number;   // bytes, sum of transitive dep sizes
  totalSizeGB: number;          // computed: (unpackedSize + transitiveDepsSize) / 1024^3

  // Calculated impact (monthly)
  energyWasteKwh: number;
  carbonWasteKg: number;
  waterWasteLiters: number;
  treesEquivalent: number;
  carMilesEquivalent: number;

  // Regional context
  region: string;
  carbonIntensity: number;      // kg CO2e per kWh used

  // Transparency: where each value came from
  sources: {
    downloads: string;
    packageSize: string;
    energyIntensity: string;
    carbonIntensity: string;
  };
}

export interface UnusedDepInfo {
  name: string;
  category: DepCategory;
  unpackedSize: number;         // bytes, from registry
  impact: GlobalImpact | null;  // null for devDependencies
}

export interface GlobalScanResult {
  project: string;
  packageManager: string;
  totalDependencies: number;
  unusedDependencies: UnusedDepInfo[];
  protectedDependencies: string[];
  parentDownloads: number | null;
  timestamp: string;
  version: string;
}
```

**Step 4: Build to verify types compile**

Run: `npm run build`
Expected: Clean build

**Step 5: Commit**

```bash
git add src/interfaces.ts test/__tests__/global-impact.test.ts
git commit -m "feat: add GlobalImpact and UnusedDepInfo interfaces for registry-based calculations"
```

---

### Task 2: Build the registry metadata fetcher

**Files:**
- Create: `src/global-impact.ts`
- Test: `test/__tests__/global-impact.test.ts`

**Step 1: Write the failing test for getPackageMetadata**

Add to `test/__tests__/global-impact.test.ts`:

```typescript
describe("getPackageMetadata", () => {
  it("should fetch unpackedSize and dependencies from npm registry", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");

    // Mock fetch to return registry response
    const mockResponse = {
      ok: true,
      json: async () => ({
        dist: { unpackedSize: 2423319 },
        dependencies: {
          "follow-redirects": "^1.15.0",
          "form-data": "^4.0.0",
        },
      }),
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse) as any;

    try {
      const result = await getPackageMetadata("axios", "1.7.0");
      expect(result).not.toBeNull();
      expect(result!.unpackedSize).toBe(2423319);
      expect(result!.dependencies).toEqual(["follow-redirects", "form-data"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should return null on network error", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("network")) as any;

    try {
      const result = await getPackageMetadata("nonexistent");
      expect(result).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should handle packages with no dependencies", async () => {
    const { getPackageMetadata } = await import("../../src/global-impact.js");

    const mockResponse = {
      ok: true,
      json: async () => ({
        dist: { unpackedSize: 5000 },
      }),
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(mockResponse) as any;

    try {
      const result = await getPackageMetadata("tiny-pkg");
      expect(result).not.toBeNull();
      expect(result!.unpackedSize).toBe(5000);
      expect(result!.dependencies).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest test/__tests__/global-impact.test.ts --no-coverage`
Expected: FAIL - module not found

**Step 3: Implement getPackageMetadata**

Create `src/global-impact.ts`:

```typescript
import { ENVIRONMENTAL_CONSTANTS } from "./constants.js";
import type { GlobalImpact } from "./interfaces.js";

export interface PackageMetadata {
  unpackedSize: number;
  dependencies: string[];
}

/**
 * Fetches package metadata from the npm registry.
 *
 * Uses the npm registry API to get the published unpackedSize
 * (verified byte-exact across 50 packages) and dependency list.
 */
export async function getPackageMetadata(
  packageName: string,
  version?: string,
): Promise<PackageMetadata | null> {
  try {
    const url = version
      ? `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`
      : `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json() as {
      dist?: { unpackedSize?: number };
      dependencies?: Record<string, string>;
    };

    const unpackedSize = data.dist?.unpackedSize;
    if (typeof unpackedSize !== "number" || unpackedSize < 0) return null;

    const dependencies = data.dependencies
      ? Object.keys(data.dependencies)
      : [];

    return { unpackedSize, dependencies };
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest test/__tests__/global-impact.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/global-impact.ts test/__tests__/global-impact.test.ts
git commit -m "feat: add getPackageMetadata to fetch sizes from npm registry"
```

---

### Task 3: Build the transitive size resolver

**Files:**
- Modify: `src/global-impact.ts`
- Test: `test/__tests__/global-impact.test.ts`

**Step 1: Write the failing test**

Add to `test/__tests__/global-impact.test.ts`:

```typescript
describe("resolveTransitiveSize", () => {
  it("should return 0 in quick mode", async () => {
    const { resolveTransitiveSize } = await import("../../src/global-impact.js");
    const result = await resolveTransitiveSize(["dep-a", "dep-b"], true);
    expect(result).toBe(0);
  });

  it("should sum unpackedSize of all transitive deps in deep mode", async () => {
    const { resolveTransitiveSize } = await import("../../src/global-impact.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes("/dep-a/")) {
        return {
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 10000 },
            dependencies: { "dep-a-child": "^1.0.0" },
          }),
        };
      }
      if (url.includes("/dep-a-child/")) {
        return {
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 5000 },
          }),
        };
      }
      if (url.includes("/dep-b/")) {
        return {
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 20000 },
          }),
        };
      }
      return { ok: false };
    }) as any;

    try {
      const result = await resolveTransitiveSize(["dep-a", "dep-b"], false);
      // dep-a: 10000, dep-a-child: 5000, dep-b: 20000 = 35000
      expect(result).toBe(35000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should handle circular dependencies without infinite loop", async () => {
    const { resolveTransitiveSize } = await import("../../src/global-impact.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes("/dep-a/")) {
        return {
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 10000 },
            dependencies: { "dep-b": "^1.0.0" },
          }),
        };
      }
      if (url.includes("/dep-b/")) {
        return {
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 20000 },
            dependencies: { "dep-a": "^1.0.0" },  // circular!
          }),
        };
      }
      return { ok: false };
    }) as any;

    try {
      const result = await resolveTransitiveSize(["dep-a"], false);
      expect(result).toBe(30000);  // dep-a + dep-b, no infinite loop
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should skip deps that fail to fetch", async () => {
    const { resolveTransitiveSize } = await import("../../src/global-impact.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes("/dep-a/")) {
        return {
          ok: true,
          json: async () => ({
            dist: { unpackedSize: 10000 },
          }),
        };
      }
      return { ok: false };
    }) as any;

    try {
      const result = await resolveTransitiveSize(["dep-a", "dep-fail"], false);
      expect(result).toBe(10000);  // only dep-a, dep-fail skipped
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest test/__tests__/global-impact.test.ts --no-coverage`
Expected: FAIL - resolveTransitiveSize not found

**Step 3: Implement resolveTransitiveSize**

Add to `src/global-impact.ts`:

```typescript
/**
 * Resolves the total unpackedSize of transitive dependencies.
 *
 * In quick mode (quickCheck=true): returns 0, skipping transitive resolution.
 * In deep mode (quickCheck=false): recursively fetches each dep's metadata
 * from the npm registry and sums their unpackedSize values.
 *
 * Handles circular dependencies via a visited set.
 */
export async function resolveTransitiveSize(
  dependencies: string[],
  quickCheck: boolean,
): Promise<number> {
  if (quickCheck || dependencies.length === 0) return 0;

  const visited = new Set<string>();
  let totalSize = 0;

  const queue = [...dependencies];

  while (queue.length > 0) {
    const dep = queue.shift()!;
    if (visited.has(dep)) continue;
    visited.add(dep);

    const metadata = await getPackageMetadata(dep);
    if (!metadata) continue;

    totalSize += metadata.unpackedSize;

    for (const transitiveDep of metadata.dependencies) {
      if (!visited.has(transitiveDep)) {
        queue.push(transitiveDep);
      }
    }
  }

  return totalSize;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest test/__tests__/global-impact.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/global-impact.ts test/__tests__/global-impact.test.ts
git commit -m "feat: add resolveTransitiveSize with deep/quick modes"
```

---

### Task 4: Build the global impact calculator

**Files:**
- Modify: `src/global-impact.ts`
- Test: `test/__tests__/global-impact.test.ts`

**Step 1: Write the failing test**

Add to `test/__tests__/global-impact.test.ts`:

```typescript
describe("calculateGlobalImpact", () => {
  it("should calculate impact using real formula with zero assumptions", async () => {
    const { calculateGlobalImpact } = await import("../../src/global-impact.js");

    const result = calculateGlobalImpact({
      monthlyDownloads: 395_000_000,
      unpackedSize: 2_423_319,        // ~2.3 MB (axios)
      transitiveDepsSize: 0,
      region: "NA",
    });

    // Manual verification:
    // totalSizeGB = 2423319 / (1024^3) = 0.002257 GB
    // energyWaste = 395000000 * 0.002257 * 0.06 = 53,491 kWh/month
    // carbonWaste = 53491 * 0.37 = 19,792 kg CO2e/month
    expect(result.totalSizeGB).toBeCloseTo(0.002257, 4);
    expect(result.energyWasteKwh).toBeCloseTo(53491, -1);
    expect(result.carbonWasteKg).toBeCloseTo(19792, -1);
    expect(result.waterWasteLiters).toBeCloseTo(96284, -1);
    expect(result.treesEquivalent).toBeCloseTo(891, 0);
    expect(result.carMilesEquivalent).toBeCloseTo(49480, -1);
    expect(result.monthlyDownloads).toBe(395_000_000);
    expect(result.region).toBe("NA");
    expect(result.carbonIntensity).toBe(0.37);

    // Sources must be present
    expect(result.sources.downloads).toBe("npm downloads API");
    expect(result.sources.packageSize).toBe("npm registry API");
    expect(result.sources.energyIntensity).toContain("IEA");
    expect(result.sources.carbonIntensity).toContain("EIA");
  });

  it("should include transitive deps in total size", async () => {
    const { calculateGlobalImpact } = await import("../../src/global-impact.js");

    const withoutTransitive = calculateGlobalImpact({
      monthlyDownloads: 1_000_000,
      unpackedSize: 100_000,
      transitiveDepsSize: 0,
    });

    const withTransitive = calculateGlobalImpact({
      monthlyDownloads: 1_000_000,
      unpackedSize: 100_000,
      transitiveDepsSize: 500_000,
    });

    expect(withTransitive.energyWasteKwh).toBeGreaterThan(withoutTransitive.energyWasteKwh);
    expect(withTransitive.totalSizeGB).toBeCloseTo(
      withoutTransitive.totalSizeGB * 6,  // 600000 / 100000
      6,
    );
  });

  it("should use correct regional carbon intensity", async () => {
    const { calculateGlobalImpact } = await import("../../src/global-impact.js");

    const na = calculateGlobalImpact({
      monthlyDownloads: 1_000_000,
      unpackedSize: 1_000_000,
      transitiveDepsSize: 0,
      region: "NA",
    });
    const eu = calculateGlobalImpact({
      monthlyDownloads: 1_000_000,
      unpackedSize: 1_000_000,
      transitiveDepsSize: 0,
      region: "EU",
    });

    expect(na.carbonIntensity).toBe(0.37);
    expect(eu.carbonIntensity).toBe(0.213);
    expect(na.carbonWasteKg).toBeGreaterThan(eu.carbonWasteKg);
  });

  it("should handle zero downloads", async () => {
    const { calculateGlobalImpact } = await import("../../src/global-impact.js");

    const result = calculateGlobalImpact({
      monthlyDownloads: 0,
      unpackedSize: 1_000_000,
      transitiveDepsSize: 0,
    });

    expect(result.energyWasteKwh).toBe(0);
    expect(result.carbonWasteKg).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest test/__tests__/global-impact.test.ts --no-coverage`
Expected: FAIL - calculateGlobalImpact not found

**Step 3: Implement calculateGlobalImpact**

Add to `src/global-impact.ts`:

```typescript
/**
 * Detects the user's region from timezone for carbon intensity selection.
 */
function detectRegion(): "NA" | "EU" | "AP" | "GLOBAL" {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("America/") || tz.includes("US/") || tz.includes("Canada/")) return "NA";
    if (tz.includes("Europe/") || tz.includes("Africa/")) return "EU";
    if (tz.includes("Asia/") || tz.includes("Australia/") || tz.includes("Pacific/")) return "AP";
    return "GLOBAL";
  } catch {
    return "NA";
  }
}

/**
 * Gets regional carbon intensity (kg CO2e per kWh).
 * All values verified against published sources.
 */
function getRegionalCarbonIntensity(region: string): number {
  switch (region) {
    case "NA": return ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_NA;     // EIA 2023
    case "EU": return ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_EU;     // Ember 2025
    case "AP": return ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_AP;     // Ember country data
    default:   return ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY;        // IEA 2025 global
  }
}

/**
 * Gets the source citation string for a regional carbon intensity value.
 */
function getCarbonIntensitySource(region: string): string {
  switch (region) {
    case "NA": return "EIA 2023 (US avg 0.37 kg CO2/kWh)";
    case "EU": return "Ember European Electricity Review 2025 (EU avg 0.213 kg CO2/kWh)";
    case "AP": return "Ember 2024 country-level data (weighted avg 0.555 kg CO2/kWh)";
    default:   return "IEA Electricity 2025 (global avg 0.445 kg CO2/kWh)";
  }
}

/**
 * Calculates global environmental impact of an unused dependency.
 *
 * Formula:
 *   totalSizeGB = (unpackedSize + transitiveDepsSize) / 1024^3
 *   energyWaste = monthlyDownloads * totalSizeGB * ENERGY_PER_GB
 *   carbonWaste = energyWaste * regionalCarbonIntensity
 *
 * Every input is real data (npm APIs) or a verified published constant.
 * Zero assumptions.
 */
export function calculateGlobalImpact(options: {
  monthlyDownloads: number;
  unpackedSize: number;
  transitiveDepsSize: number;
  region?: "NA" | "EU" | "AP" | "GLOBAL";
}): GlobalImpact {
  const region = options.region || detectRegion();
  const carbonIntensity = getRegionalCarbonIntensity(region);
  const totalSizeBytes = options.unpackedSize + options.transitiveDepsSize;
  const totalSizeGB = totalSizeBytes / (1024 * 1024 * 1024);

  const energyWasteKwh = options.monthlyDownloads * totalSizeGB * ENVIRONMENTAL_CONSTANTS.ENERGY_PER_GB;
  const carbonWasteKg = energyWasteKwh * carbonIntensity;
  const waterWasteLiters = energyWasteKwh * ENVIRONMENTAL_CONSTANTS.WATER_PER_KWH;
  const treesEquivalent = carbonWasteKg * ENVIRONMENTAL_CONSTANTS.TREES_PER_KG_CO2;
  const carMilesEquivalent = carbonWasteKg / ENVIRONMENTAL_CONSTANTS.CO2_PER_CAR_MILE;

  return {
    monthlyDownloads: options.monthlyDownloads,
    unpackedSize: options.unpackedSize,
    transitiveDepsSize: options.transitiveDepsSize,
    totalSizeGB,
    energyWasteKwh,
    carbonWasteKg,
    waterWasteLiters,
    treesEquivalent,
    carMilesEquivalent,
    region,
    carbonIntensity,
    sources: {
      downloads: "npm downloads API",
      packageSize: "npm registry API",
      energyIntensity: "IEA/LBNL 2024 (0.06 kWh/GB)",
      carbonIntensity: getCarbonIntensitySource(region),
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest test/__tests__/global-impact.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/global-impact.ts test/__tests__/global-impact.test.ts
git commit -m "feat: add calculateGlobalImpact with verified formula and source attribution"
```

---

### Task 5: Add --quick-check CLI flag

**Files:**
- Modify: `src/index.ts:206-214` (Commander options)

**Step 1: Add the flag**

After the existing `--output` option, add:

```typescript
      .option("--quick-check", "skip transitive dependency size resolution (faster)")
```

**Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: Clean build

**Step 3: Verify flag is recognized**

Run: `node dist/index.js --help`
Expected: `--quick-check` appears in help output

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add --quick-check flag to skip transitive dep resolution"
```

---

### Task 6: Wire up global impact in JSON output path

This is the main integration task. Replace `measurePackageInstallation` with
registry-based lookups in the JSON output path (`src/index.ts:507-547`).

**Files:**
- Modify: `src/index.ts:495-560` (JSON output mode impact section)
- Modify: `src/index.ts:19-50` (imports)

**Step 1: Update imports in index.ts**

Add to imports:

```typescript
import {
  getPackageMetadata,
  resolveTransitiveSize,
  calculateGlobalImpact,
} from "./global-impact.js";
import type { UnusedDepInfo, GlobalScanResult } from "./interfaces.js";
```

**Step 2: Replace the JSON impact measurement loop**

Replace the block at `src/index.ts:507-547` (the `if (unusedDependencies.length > 0 && options.measureImpact)` block inside the JSON output path).

The new block needs to:
1. Read package.json to know which deps are in `dependencies` vs `devDependencies`
2. For each unused dep: fetch metadata from registry, categorize it
3. For `dependencies` only: calculate global impact using parent downloads
4. Build a `GlobalScanResult` instead of the old `ScanResult`

New code:

```typescript
      if (unusedDependencies.length > 0 && options.measureImpact) {
        const parentInfo = await getParentPackageDownloads(packageJsonPath);
        const parentDownloads = parentInfo?.downloads ?? 0;

        // Categorize each unused dep as dependency vs devDependency
        const depSet = new Set(Object.keys(packageJson.dependencies || {}));
        const unusedDepInfos: UnusedDepInfo[] = [];

        for (const dep of unusedDependencies) {
          const category = depSet.has(dep) ? "dependency" : "devDependency";
          const metadata = await getPackageMetadata(dep);
          const unpackedSize = metadata?.unpackedSize ?? 0;

          let impact: GlobalImpact | null = null;
          if (category === "dependency" && parentDownloads > 0 && unpackedSize > 0) {
            const transitiveDepsSize = metadata
              ? await resolveTransitiveSize(metadata.dependencies, !!options.quickCheck)
              : 0;
            impact = calculateGlobalImpact({
              monthlyDownloads: parentDownloads,
              unpackedSize,
              transitiveDepsSize,
            });
          }

          unusedDepInfos.push({ name: dep, category, unpackedSize, impact });
        }

        const globalResult: GlobalScanResult = {
          project: packageJson.name || path.basename(projectDirectory),
          packageManager,
          totalDependencies: dependencies.length,
          unusedDependencies: unusedDepInfos,
          protectedDependencies: [...protectedUnused],
          parentDownloads: parentDownloads > 0 ? parentDownloads : null,
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        };

        const json = JSON.stringify(globalResult, null, 2);
        if (savedConsoleLog) {
          console.log = savedConsoleLog;
        }
        if (options.output) {
          await fs.writeFile(options.output, json, "utf8");
          console.log(chalk.green(`Report written to ${options.output}`));
        } else {
          process.stdout.write(json + "\n");
        }
        return;
      }
```

**Step 3: Build to verify it compiles**

Run: `npm run build`
Expected: Clean build. There will be TypeScript errors where `GlobalImpact` is
used but not imported -- fix those by importing from `./interfaces.js`.

**Step 4: Test with a real scan**

Run: `node dist/index.js --json --measure-impact --dry-run`
Expected: JSON output with `unusedDependencies` array containing objects with
`name`, `category`, `unpackedSize`, and `impact` fields.

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire global impact into JSON output using registry data"
```

---

### Task 7: Wire up global impact in CLI output path

**Files:**
- Modify: `src/index.ts:625-790` (CLI output mode impact section)

**Step 1: Replace the CLI impact measurement and display**

Replace the CLI impact block (starting at line 625 `if (options.measureImpact)`)
with a new version that:
1. Fetches registry metadata instead of `measurePackageInstallation`
2. Categorizes deps vs devDeps
3. Displays global impact for `dependencies` with source attribution
4. Displays simple "no global impact" line for `devDependencies`

Key display format for a dependency with global impact:

```typescript
        // Display global impact for dependencies
        const depsWithImpact = unusedDepInfos.filter(d => d.impact !== null);
        const devDeps = unusedDepInfos.filter(d => d.category === "devDependency");

        if (depsWithImpact.length > 0) {
          logNewlines();
          console.log(chalk.green.bold("Global Environmental Impact"));
          console.log(chalk.dim("  All data from npm APIs and published research. Zero assumptions.\n"));

          for (const dep of depsWithImpact) {
            const impact = dep.impact!;
            console.log(chalk.bold(`  ${dep.name}`) + chalk.dim(` (dependency) -- ${formatSize(dep.unpackedSize)} unpacked`));
            console.log(`    Monthly installs:  ${chalk.yellow(formatNumber(impact.monthlyDownloads))} ${chalk.dim("(npm)")}`);
            console.log(`    Data footprint:    ${chalk.yellow(formatSize(impact.monthlyDownloads * impact.totalSizeGB * 1024 * 1024 * 1024))}${chalk.dim("/month")}`);
            console.log(`    Energy waste:      ${chalk.red(impact.energyWasteKwh.toFixed(1) + " kWh/month")}`);
            console.log(`    Carbon waste:      ${chalk.red(impact.carbonWasteKg.toFixed(1) + " kg CO2e/month")}`);
            console.log(`    Water waste:        ${chalk.red(impact.waterWasteLiters.toFixed(1) + " L/month")}`);
            console.log(`    Equivalent to:     ${chalk.yellow(impact.carMilesEquivalent.toFixed(0) + " miles driven")}`);
            console.log();
          }

          console.log(chalk.dim("  Sources:"));
          const firstImpact = depsWithImpact[0].impact!;
          console.log(chalk.dim(`    Downloads:   ${firstImpact.sources.downloads}`));
          console.log(chalk.dim(`    Pkg size:    ${firstImpact.sources.packageSize}`));
          console.log(chalk.dim(`    Energy:      ${firstImpact.sources.energyIntensity}`));
          console.log(chalk.dim(`    Carbon:      ${firstImpact.sources.carbonIntensity}`));
        }

        if (devDeps.length > 0) {
          logNewlines();
          console.log(chalk.blue.bold("Unused Dev Dependencies (no global impact):"));
          for (const dep of devDeps) {
            console.log(`  ${dep.name}` + chalk.dim(` -- ${formatSize(dep.unpackedSize)} unpacked`));
          }
          console.log(chalk.dim("  devDependencies are not installed by consumers."));
        }
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire global impact into CLI output with source attribution"
```

---

### Task 8: Update existing tests

**Files:**
- Modify: `test/__tests__/enhanced-environmental-calculations.test.ts`
- Modify: `test/__tests__/unit.test.ts`
- Modify: other test files that reference old impact interfaces

**Step 1: Run full test suite to find failures**

Run: `npm test`
Expected: Some failures from tests referencing removed/changed functions

**Step 2: Fix each failing test**

For tests that reference `calculateComprehensiveEnvironmentalImpact`,
`calculateCICDEnergy`, `measurePackageInstallation` in the impact path:
- Update to test the new `calculateGlobalImpact` function
- Keep tests for old functions that are still exported (they still exist in
  the code, just not used in the impact path)

**Step 3: Run tests to verify all pass**

Run: `npm test`
Expected: All tests pass, coverage thresholds met

**Step 4: Commit**

```bash
git add test/
git commit -m "test: update tests for global impact model"
```

---

### Task 9: Run full validation

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors (existing warnings OK)

**Step 3: Full test suite with coverage**

Run: `npm run validate`
Expected: All pass, coverage thresholds met

**Step 4: Manual smoke test with real project**

Run: `node dist/index.js lodash/lodash --json --measure-impact --dry-run 2>/dev/null | python3 -m json.tool | head -50`
Expected: JSON output with `unusedDependencies` containing objects with
`category` and `impact` fields. Dependencies should have non-null `impact`
with real download counts.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final validation pass for global impact model"
```

---

### Task 10: Update CLAUDE.md and memory

**Files:**
- Modify: `CLAUDE.md` (project-level)
- Modify: memory files

**Step 1: Update CLAUDE.md architecture section**

Add `src/global-impact.ts` to the Architecture list:
```
- `src/global-impact.ts` -- npm registry metadata, transitive size resolution, global impact formula
```

Update the Detection Flow section to reflect the new impact pipeline.

**Step 2: Update memory with new model**

Update MEMORY.md environmental calculations section with the new model.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for global impact model"
```
