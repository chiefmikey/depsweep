export interface DependencyContext {
  scripts?: Record<string, string>;
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

// New environmental impact interfaces
export interface EnvironmentalImpact {
  carbonSavings: number; // kg CO2e
  energySavings: number; // kWh
  waterSavings: number; // liters
  treesEquivalent: number;
  carMilesEquivalent: number;
  efficiencyGain: number; // percentage
  networkSavings: number; // kWh
  storageSavings: number; // kWh
}

export interface ImpactMetrics {
  installTime: number;
  diskSpace: number;
  errors?: string[];
  environmentalImpact?: EnvironmentalImpact;
}

export interface EnvironmentalReport {
  totalImpact: EnvironmentalImpact;
  perPackageImpact: Record<string, EnvironmentalImpact>;
  timeframes: {
    daily: EnvironmentalImpact;
    monthly: EnvironmentalImpact;
    yearly?: EnvironmentalImpact;
  };
  recommendations: string[];
}
