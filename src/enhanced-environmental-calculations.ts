/**
 * Enhanced Environmental Impact Calculations
 *
 * This module provides comprehensive, scientifically accurate environmental impact
 * calculations based on the latest research and industry data from 2024-2025.
 *
 * All formulas are based on peer-reviewed research and industry standards.
 */

import { ENVIRONMENTAL_CONSTANTS } from "./constants.js";
import type { EnvironmentalImpact } from "./interfaces.js";

/**
 * Detects the user's region for carbon intensity calculations
 * Based on timezone and other factors
 */
export function detectUserRegion(): "NA" | "EU" | "AP" | "GLOBAL" {
  try {
    // Simple timezone-based detection (can be enhanced with IP geolocation)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (
      timezone.includes("America/") ||
      timezone.includes("US/") ||
      timezone.includes("Canada/")
    ) {
      return "NA";
    } else if (timezone.includes("Europe/") || timezone.includes("Africa/")) {
      return "EU";
    } else if (
      timezone.includes("Asia/") ||
      timezone.includes("Australia/") ||
      timezone.includes("Pacific/")
    ) {
      return "AP";
    }

    return "GLOBAL";
  } catch {
    return "NA"; // Default to NA if Intl fails
  }
}

/**
 * Gets the appropriate carbon intensity for the user's region
 */
export function getRegionalCarbonIntensity(
  region: "NA" | "EU" | "AP" | "GLOBAL",
): number {
  switch (region) {
    case "NA":
      return ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_NA;
    case "EU":
      return ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_EU;
    case "AP":
      return ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_AP;
    default:
      return ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY;
  }
}

/**
 * Calculates time-of-day energy multiplier based on current time
 */
export function getTimeOfDayMultiplier(): number {
  try {
    const hour = new Date().getHours();

    // Peak hours: 6-10 AM and 6-10 PM (weekdays)
    // Off-peak hours: 10 PM - 6 AM and 10 AM - 6 PM (weekdays)
    // Weekend: generally off-peak
    const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
    const isPeakHour = (hour >= 6 && hour < 10) || (hour >= 18 && hour < 22);

    if (isWeekend) {
      return ENVIRONMENTAL_CONSTANTS.OFF_PEAK_ENERGY_MULTIPLIER;
    } else if (isPeakHour) {
      return ENVIRONMENTAL_CONSTANTS.PEAK_ENERGY_MULTIPLIER;
    } else {
      return ENVIRONMENTAL_CONSTANTS.OFF_PEAK_ENERGY_MULTIPLIER;
    }
  } catch {
    return 1.0; // Default multiplier if Date fails
  }
}

/**
 * Enhanced CPU energy calculation with processor efficiency factors
 */
export function calculateCPUEnergy(
  diskSpaceGB: number,
  processingComplexity: number = 1.0,
): number {
  const baseEnergy = diskSpaceGB * ENVIRONMENTAL_CONSTANTS.CPU_ENERGY_PER_GB;
  const complexityMultiplier = Math.max(
    0.5,
    Math.min(2.0, processingComplexity),
  );
  return Math.max(0, baseEnergy * complexityMultiplier);
}

/**
 * Enhanced memory energy calculation with access patterns
 */
export function calculateMemoryEnergy(
  diskSpaceGB: number,
  accessFrequency: number = 1.0,
): number {
  const baseEnergy = diskSpaceGB * ENVIRONMENTAL_CONSTANTS.MEMORY_ENERGY_PER_GB;
  const frequencyMultiplier = Math.max(0.1, Math.min(3.0, accessFrequency));
  return Math.max(0, baseEnergy * frequencyMultiplier);
}

/**
 * Enhanced network latency energy calculation
 */
export function calculateLatencyEnergy(
  diskSpaceMB: number,
  averageLatency: number = 50,
): number {
  const baseEnergy =
    diskSpaceMB * ENVIRONMENTAL_CONSTANTS.LATENCY_ENERGY_PER_MB;
  const latencyMultiplier = Math.max(0.5, Math.min(2.0, averageLatency / 50));
  return Math.max(0, baseEnergy * latencyMultiplier);
}

/**
 * Enhanced build system energy calculation
 */
export function calculateBuildEnergy(
  installTimeHours: number,
  buildComplexity: number = 1.0,
): number {
  const baseEnergy =
    installTimeHours * ENVIRONMENTAL_CONSTANTS.BUILD_SYSTEM_ENERGY_PER_HOUR;
  const complexityMultiplier = Math.max(0.5, Math.min(2.5, buildComplexity));
  return Math.max(0, baseEnergy * complexityMultiplier);
}

/**
 * CI/CD energy calculation — marginal energy saved by not installing this dep
 * in the project's own CI pipeline.
 *
 * Parent package npm downloads are NOT used as a multiplier because:
 * 1. DevDependencies are not installed by downstream consumers (`npm install pkg`
 *    only installs `dependencies`, not `devDependencies`)
 * 2. Even for regular deps, the locally-measured install time doesn't represent
 *    the marginal cost in a consumer's dependency resolution
 * 3. Using downloads as a multiplier inflated results by 4-5 orders of magnitude
 *    (e.g., jQuery at 81M downloads/month → 33.6 tonnes CO2e for removing 51MB)
 *
 * Instead, we estimate the project's own CI build frequency:
 * - Published npm package (has downloads): ~100 builds/month
 * - Private project (no downloads): ~60 builds/month (~2/day weekdays)
 */
export function calculateCICDEnergy(
  monthlyDownloads: number | null,
  installTimeHours: number = 0,
  buildFrequency: number = 1.0,
): number {
  if (installTimeHours <= 0) return 0;

  // Estimate the project's own CI build frequency
  const ciBuildsPerMonth =
    monthlyDownloads && monthlyDownloads > 0 ? 100 : 60;

  // Marginal energy per build = install time for this dep × power draw
  const marginalEnergyPerBuild =
    installTimeHours * ENVIRONMENTAL_CONSTANTS.BUILD_SYSTEM_ENERGY_PER_HOUR;

  const frequencyMultiplier = Math.max(0.5, Math.min(2.0, buildFrequency));
  return Math.max(
    0,
    ciBuildsPerMonth * marginalEnergyPerBuild * frequencyMultiplier,
  );
}

/**
 * Registry energy calculation.
 *
 * Removing an unused dependency from YOUR project does not reduce the global
 * npm registry load — the package is still hosted and downloaded by other
 * projects. The marginal registry energy savings is effectively zero.
 *
 * The only savings (your CI/dev not fetching the tarball) is already captured
 * in the transfer energy and CI/CD energy calculations.
 */
export function calculateRegistryEnergy(
  _monthlyDownloads: number | null,
): number {
  return 0;
}

/**
 * Enhanced lifecycle energy calculation
 */
export function calculateLifecycleEnergy(totalEnergy: number): number {
  return Math.max(
    0,
    totalEnergy * (ENVIRONMENTAL_CONSTANTS.LIFECYCLE_ENERGY_MULTIPLIER - 1),
  );
}

/**
 * Calculates renewable vs fossil fuel energy breakdown
 */
export function calculateRenewableEnergyBreakdown(totalEnergy: number): {
  renewable: number;
  fossil: number;
  percentage: number;
} {
  const renewablePercentage =
    ENVIRONMENTAL_CONSTANTS.RENEWABLE_ENERGY_PERCENTAGE;
  const renewable = totalEnergy * renewablePercentage;
  const fossil = totalEnergy * (1 - renewablePercentage);

  return {
    renewable,
    fossil,
    percentage: renewablePercentage * 100,
  };
}

/**
 * Calculates financial value of environmental savings
 */
export function calculateFinancialValue(
  carbonSavings: number,
  waterSavings: number,
): {
  carbonOffsetValue: number;
  waterTreatmentValue: number;
  totalValue: number;
} {
  const carbonOffsetValue =
    carbonSavings * ENVIRONMENTAL_CONSTANTS.CARBON_OFFSET_COST_PER_KG;
  const waterTreatmentValue =
    waterSavings * ENVIRONMENTAL_CONSTANTS.WATER_TREATMENT_COST_PER_LITER;
  const totalValue = carbonOffsetValue + waterTreatmentValue;

  return {
    carbonOffsetValue,
    waterTreatmentValue,
    totalValue,
  };
}

/**
 * Enhanced e-waste reduction calculation
 */
export function calculateEwasteReduction(diskSpaceGB: number): number {
  return Math.max(
    0,
    diskSpaceGB * ENVIRONMENTAL_CONSTANTS.EWASTE_IMPACT_PER_GB,
  );
}

/**
 * Enhanced server utilization improvement calculation
 */
export function calculateServerUtilizationImprovement(
  diskSpaceGB: number,
): number {
  const baseImprovement =
    ENVIRONMENTAL_CONSTANTS.SERVER_UTILIZATION_IMPROVEMENT;
  const sizeMultiplier = Math.max(0.5, Math.min(2.0, diskSpaceGB / 10)); // Scale with size
  return Math.max(0, baseImprovement * sizeMultiplier);
}

/**
 * Enhanced developer productivity calculation
 */
export function calculateDeveloperProductivityGain(
  installTimeHours: number,
  teamSize: number = 1,
): number {
  const baseGain =
    installTimeHours * ENVIRONMENTAL_CONSTANTS.BUILD_TIME_PRODUCTIVITY_GAIN;
  const teamMultiplier = Math.max(1, teamSize);
  return Math.max(0, baseGain * teamMultiplier);
}

/**
 * Enhanced build time reduction calculation
 */
export function calculateBuildTimeReduction(
  installTimeSeconds: number,
): number {
  const efficiencyGain = ENVIRONMENTAL_CONSTANTS.EFFICIENCY_IMPROVEMENT / 100;
  return Math.max(0, installTimeSeconds * efficiencyGain);
}

/**
 * Comprehensive environmental impact calculation with all enhanced factors
 */
export function calculateComprehensiveEnvironmentalImpact(
  diskSpace: number, // bytes
  installTime: number, // seconds
  monthlyDownloads: number | null,
  options: {
    region?: "NA" | "EU" | "AP" | "GLOBAL";
    processingComplexity?: number;
    accessFrequency?: number;
    averageLatency?: number;
    buildComplexity?: number;
    buildFrequency?: number;
    teamSize?: number;
  } = {},
): EnvironmentalImpact {
  // Detect region if not provided
  const region = options.region || detectUserRegion();
  const carbonIntensity = getRegionalCarbonIntensity(region);
  const timeOfDayMultiplier = getTimeOfDayMultiplier();

  // Convert to appropriate units with bounds checking to prevent NaN/Infinity
  const diskSpaceGB = Math.max(
    0,
    Math.min(diskSpace / (1024 * 1024 * 1024), 1e6),
  ); // Cap at 1M GB
  const installTimeHours = Math.max(0, Math.min(installTime / 3600, 8760)); // Cap at 1 year

  // Calculate energy breakdown (monthly savings estimate)
  //
  // Two non-overlapping energy sources:
  // 1. CI runner compute (monthly): 15W runner × install time × builds/month
  //    - Includes CPU, memory, disk I/O on the runner machine
  //    - This is the dominant term (~75-90% of total)
  // 2. Transfer energy (per-install): data center + CDN + ISP infrastructure
  //    - NOT multiplied by builds because most CI pipelines cache deps
  //    - Conservative: counts one download, caching makes actual savings higher
  // 3. Storage (monthly): ongoing disk footprint (negligible)
  //
  // Excluded from total (set to 0):
  // - cpuEnergy/memoryEnergy: already in runner's 15W power draw (ciCdEnergy)
  // - networkEnergy/latencyEnergy: already included in ENERGY_PER_GB
  // - buildEnergy: single-build subset of ciCdEnergy (would double-count)
  // - lifecycleEnergy: 2.1x multiplier source cannot be verified
  const transferEnergy = diskSpaceGB * ENVIRONMENTAL_CONSTANTS.ENERGY_PER_GB;
  const networkEnergy = 0; // included in ENERGY_PER_GB
  const storageEnergy =
    (diskSpaceGB * ENVIRONMENTAL_CONSTANTS.STORAGE_ENERGY_PER_GB_YEAR) / 12;
  const cpuEnergy = 0; // included in CI runner's power draw (ciCdEnergy)
  const memoryEnergy = 0; // included in CI runner's power draw (ciCdEnergy)
  const latencyEnergy = 0; // included in ENERGY_PER_GB
  const buildEnergy = calculateBuildEnergy(
    installTimeHours,
    options.buildComplexity,
  );
  const ciCdEnergy = calculateCICDEnergy(
    monthlyDownloads,
    installTimeHours,
    options.buildFrequency,
  );
  const registryEnergy = calculateRegistryEnergy(monthlyDownloads);

  // Total monthly energy savings — only non-overlapping components
  const baseEnergySavings = transferEnergy + storageEnergy + ciCdEnergy;

  const lifecycleEnergy = 0; // source "Software Sustainability Institute 2024" is unverifiable
  const totalEnergySavings = baseEnergySavings;

  // Peak/off-peak fields kept for interface compatibility but not applied
  // to primary metrics — the savings are permanent and don't depend on
  // when the tool is run
  const peakEnergySavings = totalEnergySavings;
  const offPeakEnergySavings = totalEnergySavings;

  // Calculate environmental impacts
  const carbonSavings = Math.max(0, totalEnergySavings * carbonIntensity);
  const waterSavings = Math.max(
    0,
    totalEnergySavings * ENVIRONMENTAL_CONSTANTS.WATER_PER_KWH,
  );
  const treesEquivalent = Math.max(
    0,
    carbonSavings * ENVIRONMENTAL_CONSTANTS.TREES_PER_KG_CO2,
  );
  const carMilesEquivalent = Math.max(
    0,
    carbonSavings / ENVIRONMENTAL_CONSTANTS.CO2_PER_CAR_MILE,
  );

  // Calculate renewable energy breakdown
  const renewableBreakdown =
    calculateRenewableEnergyBreakdown(totalEnergySavings);

  // Calculate financial value
  const financialValue = calculateFinancialValue(carbonSavings, waterSavings);

  // Calculate additional metrics
  const ewasteReduction = calculateEwasteReduction(diskSpaceGB);
  const serverUtilizationImprovement =
    calculateServerUtilizationImprovement(diskSpaceGB);
  const developerProductivityGain = calculateDeveloperProductivityGain(
    installTimeHours,
    options.teamSize,
  );
  // Build time reduction = full install time saved (not 18.5% — removing
  // a dep saves 100% of its install time, not a fraction)
  const buildTimeReduction = Math.max(0, installTime);

  // Efficiency gain cannot be meaningfully computed without knowing total
  // project size. Set to 0 rather than reporting a fixed 18.5% regardless
  // of what's being removed.
  const efficiencyGain = 0;

  return {
    // Primary metrics
    carbonSavings,
    energySavings: totalEnergySavings,
    waterSavings,
    treesEquivalent,
    carMilesEquivalent,
    efficiencyGain,
    networkSavings: networkEnergy,
    storageSavings: storageEnergy,

    // Detailed energy breakdown
    transferEnergy,
    cpuEnergy,
    memoryEnergy,
    latencyEnergy,
    buildEnergy,
    ciCdEnergy,
    registryEnergy,
    lifecycleEnergy,

    // Financial impact
    carbonOffsetValue: financialValue.carbonOffsetValue,
    waterTreatmentValue: financialValue.waterTreatmentValue,
    totalFinancialValue: financialValue.totalValue,

    // Regional variations
    carbonIntensityUsed: carbonIntensity,
    regionalMultiplier: region === "GLOBAL" ? 1.0 : 1.1,

    // Time-based factors
    peakEnergySavings,
    offPeakEnergySavings,
    timeOfDayMultiplier,

    // Renewable energy impact
    renewableEnergySavings: renewableBreakdown.renewable,
    fossilFuelSavings: renewableBreakdown.fossil,
    renewablePercentage: renewableBreakdown.percentage,

    // Additional environmental metrics
    ewasteReduction,
    serverUtilizationImprovement,
    developerProductivityGain,
    buildTimeReduction,
  };
}

/**
 * Validates environmental impact calculations for accuracy
 */
export function validateEnvironmentalCalculations(
  impact: EnvironmentalImpact,
): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for negative values
  if (impact.carbonSavings < 0)
    errors.push("Carbon savings cannot be negative");
  if (impact.energySavings < 0)
    errors.push("Energy savings cannot be negative");
  if (impact.waterSavings < 0) errors.push("Water savings cannot be negative");

  // Check for unrealistic values
  if (impact.carbonSavings > 10000)
    warnings.push("Carbon savings seems unusually high");
  if (impact.energySavings > 50000)
    warnings.push("Energy savings seems unusually high");
  if (impact.treesEquivalent > 1000)
    warnings.push("Tree equivalent seems unusually high");

  // Check for consistency
  const expectedCarbon = impact.energySavings * impact.carbonIntensityUsed;
  const carbonDifference = Math.abs(impact.carbonSavings - expectedCarbon);
  if (carbonDifference > 0.01) {
    warnings.push(
      `Carbon calculation inconsistency: ${carbonDifference.toFixed(
        3,
      )} kg CO2e difference`,
    );
  }

  // Check renewable energy percentage
  if (impact.renewablePercentage < 0 || impact.renewablePercentage > 100) {
    errors.push("Renewable energy percentage must be between 0 and 100");
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Formats environmental impact for display with proper units and precision
 */
export function formatEnvironmentalImpact(impact: EnvironmentalImpact): {
  carbonSavings: string;
  energySavings: string;
  waterSavings: string;
  treesEquivalent: string;
  carMilesEquivalent: string;
  financialValue: string;
  renewablePercentage: string;
} {
  return {
    carbonSavings: `${impact.carbonSavings.toFixed(3)} kg CO2e`,
    energySavings: `${impact.energySavings.toFixed(2)} kWh`,
    waterSavings: `${impact.waterSavings.toFixed(1)} L`,
    treesEquivalent: `${impact.treesEquivalent.toFixed(2)} trees`,
    carMilesEquivalent: `${impact.carMilesEquivalent.toFixed(1)} miles`,
    financialValue: `$${impact.totalFinancialValue.toFixed(2)}`,
    renewablePercentage: `${impact.renewablePercentage.toFixed(1)}%`,
  };
}
