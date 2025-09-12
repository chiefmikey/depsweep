/**
 * Enhanced Environmental Calculations Tests
 *
 * This file tests the comprehensive environmental impact calculations
 * to ensure they are scientifically accurate and thorough.
 */

import {
  detectUserRegion,
  getRegionalCarbonIntensity,
  getTimeOfDayMultiplier,
  calculateCPUEnergy,
  calculateMemoryEnergy,
  calculateLatencyEnergy,
  calculateBuildEnergy,
  calculateCICDEnergy,
  calculateRegistryEnergy,
  calculateLifecycleEnergy,
  calculateRenewableEnergyBreakdown,
  calculateFinancialValue,
  calculateEwasteReduction,
  calculateServerUtilizationImprovement,
  calculateDeveloperProductivityGain,
  calculateBuildTimeReduction,
  calculateComprehensiveEnvironmentalImpact,
  validateEnvironmentalCalculations,
  formatEnvironmentalImpact,
} from "../../src/enhanced-environmental-calculations.js";

// Mock Date for consistent testing
const mockDate = new Date("2024-01-15T14:30:00Z"); // Monday, 2:30 PM UTC
jest.spyOn(global, "Date").mockImplementation(() => mockDate);

describe("Enhanced Environmental Calculations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Region Detection", () => {
    it("should detect North America region", () => {
      // Mock timezone for North America
      jest.spyOn(Intl, "DateTimeFormat").mockReturnValue({
        resolvedOptions: () => ({ timeZone: "America/New_York" }),
      } as any);

      const region = detectUserRegion();
      expect(region).toBe("NA");
    });

    it("should detect Europe region", () => {
      jest.spyOn(Intl, "DateTimeFormat").mockReturnValue({
        resolvedOptions: () => ({ timeZone: "Europe/London" }),
      } as any);

      const region = detectUserRegion();
      expect(region).toBe("EU");
    });

    it("should detect Asia Pacific region", () => {
      jest.spyOn(Intl, "DateTimeFormat").mockReturnValue({
        resolvedOptions: () => ({ timeZone: "Asia/Tokyo" }),
      } as any);

      const region = detectUserRegion();
      expect(region).toBe("AP");
    });

    it("should default to global for unknown timezones", () => {
      jest.spyOn(Intl, "DateTimeFormat").mockReturnValue({
        resolvedOptions: () => ({ timeZone: "Unknown/Timezone" }),
      } as any);

      const region = detectUserRegion();
      expect(region).toBe("GLOBAL");
    });
  });

  describe("Regional Carbon Intensity", () => {
    it("should return correct carbon intensity for each region", () => {
      expect(getRegionalCarbonIntensity("NA")).toBe(0.387);
      expect(getRegionalCarbonIntensity("EU")).toBe(0.298);
      expect(getRegionalCarbonIntensity("AP")).toBe(0.521);
      expect(getRegionalCarbonIntensity("GLOBAL")).toBe(0.456);
    });
  });

  describe("Time of Day Multiplier", () => {
    it("should return peak multiplier during peak hours", () => {
      const peakDate = new Date("2024-01-15T08:00:00"); // 8 AM local time (peak hour)
      jest.spyOn(global, "Date").mockImplementation(() => peakDate);

      const multiplier = getTimeOfDayMultiplier();
      expect(multiplier).toBe(1.45);
    });

    it("should return off-peak multiplier during off-peak hours", () => {
      const offPeakDate = new Date("2024-01-15T14:00:00"); // 2 PM local time (off-peak)
      jest.spyOn(global, "Date").mockImplementation(() => offPeakDate);

      const multiplier = getTimeOfDayMultiplier();
      expect(multiplier).toBe(0.78);
    });

    it("should return off-peak multiplier on weekends", () => {
      const weekendDate = new Date("2024-01-13T08:00:00"); // Saturday 8 AM
      jest.spyOn(global, "Date").mockImplementation(() => weekendDate);

      const multiplier = getTimeOfDayMultiplier();
      expect(multiplier).toBe(0.78);
    });
  });

  describe("CPU Energy Calculation", () => {
    it("should calculate CPU energy with default complexity", () => {
      const energy = calculateCPUEnergy(10); // 10 GB
      expect(energy).toBe(0.15); // 10 * 0.015
    });

    it("should apply complexity multiplier", () => {
      const energy = calculateCPUEnergy(10, 2.0); // 2x complexity
      expect(energy).toBe(0.3); // 10 * 0.015 * 2.0
    });

    it("should handle edge cases", () => {
      expect(calculateCPUEnergy(0)).toBe(0);
      expect(calculateCPUEnergy(-5)).toBe(0);
      expect(calculateCPUEnergy(10, 0.5)).toBe(0.075);
    });
  });

  describe("Memory Energy Calculation", () => {
    it("should calculate memory energy with default frequency", () => {
      const energy = calculateMemoryEnergy(10); // 10 GB
      expect(energy).toBe(0.08); // 10 * 0.008
    });

    it("should apply frequency multiplier", () => {
      const energy = calculateMemoryEnergy(10, 2.0); // 2x frequency
      expect(energy).toBe(0.16); // 10 * 0.008 * 2.0
    });

    it("should handle edge cases", () => {
      expect(calculateMemoryEnergy(0)).toBe(0);
      expect(calculateMemoryEnergy(-5)).toBe(0);
    });
  });

  describe("Latency Energy Calculation", () => {
    it("should calculate latency energy with default latency", () => {
      const energy = calculateLatencyEnergy(100); // 100 MB
      expect(energy).toBe(0.008); // 100 * 0.00008
    });

    it("should apply latency multiplier", () => {
      const energy = calculateLatencyEnergy(100, 100); // 100ms latency
      expect(energy).toBe(0.016); // 100 * 0.00008 * 2.0
    });
  });

  describe("Build Energy Calculation", () => {
    it("should calculate build energy with default complexity", () => {
      const energy = calculateBuildEnergy(2); // 2 hours
      expect(energy).toBe(0.5); // 2 * 0.25
    });

    it("should apply complexity multiplier", () => {
      const energy = calculateBuildEnergy(2, 2.0); // 2x complexity
      expect(energy).toBe(1.0); // 2 * 0.25 * 2.0
    });
  });

  describe("CI/CD Energy Calculation", () => {
    it("should calculate CI/CD energy with monthly downloads", () => {
      const energy = calculateCICDEnergy(3000, 1.0); // 3000 downloads/month
      expect(energy).toBeGreaterThan(0);
    });

    it("should return 0 for null downloads", () => {
      const energy = calculateCICDEnergy(null);
      expect(energy).toBe(0);
    });

    it("should return 0 for zero downloads", () => {
      const energy = calculateCICDEnergy(0);
      expect(energy).toBe(0);
    });
  });

  describe("Registry Energy Calculation", () => {
    it("should calculate registry energy with monthly downloads", () => {
      const energy = calculateRegistryEnergy(1000);
      expect(energy).toBe(0.05); // 1000 * 0.00005
    });

    it("should return 0 for null downloads", () => {
      const energy = calculateRegistryEnergy(null);
      expect(energy).toBe(0);
    });
  });

  describe("Lifecycle Energy Calculation", () => {
    it("should calculate lifecycle energy multiplier", () => {
      const energy = calculateLifecycleEnergy(100);
      expect(energy).toBeCloseTo(110, 5); // 100 * (2.1 - 1)
    });
  });

  describe("Renewable Energy Breakdown", () => {
    it("should calculate renewable vs fossil fuel breakdown", () => {
      const breakdown = calculateRenewableEnergyBreakdown(1000);

      expect(breakdown.renewable).toBe(320); // 1000 * 0.32
      expect(breakdown.fossil).toBeCloseTo(680, 5); // 1000 * 0.68
      expect(breakdown.percentage).toBe(32);
    });
  });

  describe("Financial Value Calculation", () => {
    it("should calculate financial value of savings", () => {
      const value = calculateFinancialValue(100, 500); // 100 kg CO2, 500 L water

      expect(value.carbonOffsetValue).toBe(85); // 100 * 0.85
      expect(value.waterTreatmentValue).toBe(1.25); // 500 * 0.0025
      expect(value.totalValue).toBe(86.25);
    });
  });

  describe("E-waste Reduction Calculation", () => {
    it("should calculate e-waste reduction", () => {
      const reduction = calculateEwasteReduction(10); // 10 GB
      expect(reduction).toBeCloseTo(0.0015, 5); // 10 * 0.00015
    });
  });

  describe("Server Utilization Improvement", () => {
    it("should calculate server utilization improvement", () => {
      const improvement = calculateServerUtilizationImprovement(10); // 10 GB
      expect(improvement).toBe(12.3); // Base improvement
    });

    it("should scale with disk space", () => {
      const improvement = calculateServerUtilizationImprovement(20); // 20 GB
      expect(improvement).toBeGreaterThan(12.3);
    });
  });

  describe("Developer Productivity Gain", () => {
    it("should calculate developer productivity gain", () => {
      const gain = calculateDeveloperProductivityGain(10, 5); // 10 hours, 5 team members
      expect(gain).toBe(40); // 10 * 0.8 * 5
    });
  });

  describe("Build Time Reduction", () => {
    it("should calculate build time reduction", () => {
      const reduction = calculateBuildTimeReduction(100); // 100 seconds
      expect(reduction).toBe(18.5); // 100 * 0.185
    });
  });

  describe("Comprehensive Environmental Impact", () => {
    it("should calculate comprehensive impact with all factors", () => {
      const impact = calculateComprehensiveEnvironmentalImpact(
        1073741824, // 1 GB
        3600, // 1 hour
        1000, // 1000 monthly downloads
        {
          region: "NA",
          processingComplexity: 1.5,
          accessFrequency: 2.0,
          averageLatency: 75,
          buildComplexity: 1.2,
          buildFrequency: 1.5,
          teamSize: 3,
        }
      );

      // Check primary metrics
      expect(impact.carbonSavings).toBeGreaterThan(0);
      expect(impact.energySavings).toBeGreaterThan(0);
      expect(impact.waterSavings).toBeGreaterThan(0);
      expect(impact.treesEquivalent).toBeGreaterThan(0);
      expect(impact.carMilesEquivalent).toBeGreaterThan(0);

      // Check detailed breakdown
      expect(impact.transferEnergy).toBeGreaterThan(0);
      expect(impact.cpuEnergy).toBeGreaterThan(0);
      expect(impact.memoryEnergy).toBeGreaterThan(0);
      expect(impact.latencyEnergy).toBeGreaterThan(0);
      expect(impact.buildEnergy).toBeGreaterThan(0);
      expect(impact.ciCdEnergy).toBeGreaterThan(0);
      expect(impact.registryEnergy).toBeGreaterThan(0);
      expect(impact.lifecycleEnergy).toBeGreaterThan(0);

      // Check financial impact
      expect(impact.carbonOffsetValue).toBeGreaterThan(0);
      expect(impact.waterTreatmentValue).toBeGreaterThan(0);
      expect(impact.totalFinancialValue).toBeGreaterThan(0);

      // Check regional factors
      expect(impact.carbonIntensityUsed).toBe(0.387); // NA region
      expect(impact.regionalMultiplier).toBe(1.1);

      // Check time-based factors
      expect(impact.peakEnergySavings).toBeGreaterThan(0);
      expect(impact.offPeakEnergySavings).toBeGreaterThan(0);
      expect(impact.timeOfDayMultiplier).toBeGreaterThan(0);

      // Check renewable energy
      expect(impact.renewableEnergySavings).toBeGreaterThan(0);
      expect(impact.fossilFuelSavings).toBeGreaterThan(0);
      expect(impact.renewablePercentage).toBe(32);

      // Check additional metrics
      expect(impact.ewasteReduction).toBeGreaterThan(0);
      expect(impact.serverUtilizationImprovement).toBeGreaterThan(0);
      expect(impact.developerProductivityGain).toBeGreaterThan(0);
      expect(impact.buildTimeReduction).toBeGreaterThan(0);
    });

    it("should handle zero inputs", () => {
      const impact = calculateComprehensiveEnvironmentalImpact(0, 0, null);

      expect(impact.carbonSavings).toBe(0);
      expect(impact.energySavings).toBe(0);
      expect(impact.waterSavings).toBe(0);
    });

    it("should use default options when not provided", () => {
      const impact = calculateComprehensiveEnvironmentalImpact(
        1073741824, // 1 GB
        3600, // 1 hour
        1000
      );

      // The region detection will determine the carbon intensity
      expect(impact.carbonIntensityUsed).toBeGreaterThan(0);
      expect(impact.regionalMultiplier).toBeGreaterThan(0);
    });
  });

  describe("Validation", () => {
    it("should validate correct environmental impact", () => {
      const impact = calculateComprehensiveEnvironmentalImpact(
        1073741824, // 1 GB
        3600, // 1 hour
        1000
      );

      const validation = validateEnvironmentalCalculations(impact);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect invalid values", () => {
      const invalidImpact = {
        carbonSavings: -100,
        energySavings: -50,
        waterSavings: -25,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
        transferEnergy: 0,
        cpuEnergy: 0,
        memoryEnergy: 0,
        latencyEnergy: 0,
        buildEnergy: 0,
        ciCdEnergy: 0,
        registryEnergy: 0,
        lifecycleEnergy: 0,
        carbonOffsetValue: 0,
        waterTreatmentValue: 0,
        totalFinancialValue: 0,
        carbonIntensityUsed: 0.456,
        regionalMultiplier: 1.0,
        peakEnergySavings: 0,
        offPeakEnergySavings: 0,
        timeOfDayMultiplier: 1.0,
        renewableEnergySavings: 0,
        fossilFuelSavings: 0,
        renewablePercentage: 0,
        ewasteReduction: 0,
        serverUtilizationImprovement: 0,
        developerProductivityGain: 0,
        buildTimeReduction: 0,
      };

      const validation = validateEnvironmentalCalculations(
        invalidImpact as any
      );
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Formatting", () => {
    it("should format environmental impact correctly", () => {
      const impact = calculateComprehensiveEnvironmentalImpact(
        1073741824, // 1 GB
        3600, // 1 hour
        1000
      );

      const formatted = formatEnvironmentalImpact(impact);

      expect(formatted.carbonSavings).toMatch(/kg CO2e$/);
      expect(formatted.energySavings).toMatch(/kWh$/);
      expect(formatted.waterSavings).toMatch(/L$/);
      expect(formatted.treesEquivalent).toMatch(/trees$/);
      expect(formatted.carMilesEquivalent).toMatch(/miles$/);
      expect(formatted.financialValue).toMatch(/^\$/);
      expect(formatted.renewablePercentage).toMatch(/%$/);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large values", () => {
      const impact = calculateComprehensiveEnvironmentalImpact(
        1073741824000, // 1 TB
        86400, // 24 hours
        1000000 // 1M downloads
      );

      expect(impact.carbonSavings).toBeGreaterThan(0);
      expect(impact.energySavings).toBeGreaterThan(0);
    });

    it("should handle very small values", () => {
      const impact = calculateComprehensiveEnvironmentalImpact(
        1024, // 1 KB
        1, // 1 second
        1 // 1 download
      );

      expect(impact.carbonSavings).toBeGreaterThanOrEqual(0);
      expect(impact.energySavings).toBeGreaterThanOrEqual(0);
    });

    it("should handle null monthly downloads", () => {
      const impact = calculateComprehensiveEnvironmentalImpact(
        1073741824, // 1 GB
        3600, // 1 hour
        null
      );

      expect(impact.ciCdEnergy).toBe(0);
      expect(impact.registryEnergy).toBe(0);
    });
  });
});
