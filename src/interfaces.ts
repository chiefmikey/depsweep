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
    subdepCount?: number
  ) => void;
  totalAnalysisSteps: number;
}

export interface DependencyInfo {
  usedInFiles: string[];
  requiredByPackages: Set<string>;
  hasSubDependencyUsage: boolean;
}

// Enhanced environmental impact interfaces with comprehensive metrics
export interface EnvironmentalImpact {
  // === PRIMARY METRICS ===
  carbonSavings: number; // kg CO2e
  energySavings: number; // kWh
  waterSavings: number; // liters
  treesEquivalent: number;
  carMilesEquivalent: number;
  efficiencyGain: number; // percentage
  networkSavings: number; // kWh
  storageSavings: number; // kWh

  // === DETAILED ENERGY BREAKDOWN ===
  transferEnergy: number; // kWh
  cpuEnergy: number; // kWh
  memoryEnergy: number; // kWh
  latencyEnergy: number; // kWh
  buildEnergy: number; // kWh
  ciCdEnergy: number; // kWh
  registryEnergy: number; // kWh
  lifecycleEnergy: number; // kWh

  // === FINANCIAL IMPACT ===
  carbonOffsetValue: number; // USD
  waterTreatmentValue: number; // USD
  totalFinancialValue: number; // USD

  // === REGIONAL VARIATIONS ===
  carbonIntensityUsed: number; // kg CO2e per kWh
  regionalMultiplier: number; // Regional adjustment factor

  // === TIME-BASED FACTORS ===
  peakEnergySavings: number; // kWh (peak hours)
  offPeakEnergySavings: number; // kWh (off-peak hours)
  timeOfDayMultiplier: number; // Time-based adjustment

  // === RENEWABLE ENERGY IMPACT ===
  renewableEnergySavings: number; // kWh from renewable sources
  fossilFuelSavings: number; // kWh from fossil fuels
  renewablePercentage: number; // % of savings from renewables

  // === ADDITIONAL ENVIRONMENTAL METRICS ===
  ewasteReduction: number; // kg CO2e from e-waste reduction
  serverUtilizationImprovement: number; // % improvement
  developerProductivityGain: number; // hours saved per year
  buildTimeReduction: number; // seconds saved per build
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
