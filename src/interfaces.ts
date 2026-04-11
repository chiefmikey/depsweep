export interface DependencyContext {
  scripts?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- config files have arbitrary shapes
  configs?: Record<string, any>;
  projectRoot: string;
  dependencyGraph?: Map<string, Set<string>>; // Added dependencyGraph
}

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  scripts?: Record<string, string>;
  repository?: { url: string };
  homepage?: string;
}

export interface WorkspaceInfo {
  root: string;
  packages: string[];
}

export interface ProgressOptions {
  onProgress?: (
    filePath: string,
    subdepIndex?: number,
    subdepCount?: number,
  ) => void;
  totalAnalysisSteps: number;
}

export interface DependencyInfo {
  usedInFiles: string[];
  requiredByPackages: Set<string>;
  hasSubDependencyUsage: boolean;
}

export interface ScanResult {
  project: string;
  packageManager: string;
  totalDependencies: number;
  unusedDependencies: string[];
  protectedDependencies: string[];
  timestamp: string;
  version: string;
}

export type DepCategory = "dependency" | "devDependency";

export interface GlobalImpact {
  // Real data from npm
  monthlyDownloads: number;
  unpackedSize: number; // bytes, from registry
  transitiveDepsSize: number; // bytes, sum of transitive dep sizes
  totalSizeGB: number; // computed: (unpackedSize + transitiveDepsSize) / 1024^3

  // Calculated impact (monthly)
  energyWasteKwh: number;
  carbonWasteKg: number;
  waterWasteLiters: number;
  treesEquivalent: number;
  carMilesEquivalent: number;

  // Regional context
  region: string;
  carbonIntensity: number; // kg CO2e per kWh used

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
  unpackedSize: number; // bytes, from registry
  impact: GlobalImpact | null; // null for devDependencies
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
