import { jest } from "@jest/globals";

// Mock only what's absolutely necessary for environmental calculations
Object.defineProperty(global, "Intl", {
  value: {
    DateTimeFormat: jest.fn(() => ({
      resolvedOptions: () => ({ timeZone: "America/New_York" }),
    })),
  },
  writable: true,
});

const mockDate = new Date("2024-01-15T14:30:00Z");
jest.spyOn(global, "Date").mockImplementation(() => mockDate);

// Import the functions we want to test
import {
  calculateEnvironmentalImpact,
  calculateCumulativeEnvironmentalImpact,
  formatEnvironmentalImpact,
  displayEnvironmentalImpactTable,
  generateEnvironmentalRecommendations,
  displayEnvironmentalHeroMessage,
  createZeroEnvironmentalImpact,
} from "../../src/helpers.js";

// Helper function to create complete EnvironmentalImpact objects for testing
function createTestEnvironmentalImpact(overrides = {}) {
  return {
    // Primary metrics
    carbonSavings: 0,
    energySavings: 0,
    waterSavings: 0,
    treesEquivalent: 0,
    carMilesEquivalent: 0,
    efficiencyGain: 0,
    networkSavings: 0,
    storageSavings: 0,

    // Detailed energy breakdown
    transferEnergy: 0,
    cpuEnergy: 0,
    memoryEnergy: 0,
    latencyEnergy: 0,
    buildEnergy: 0,
    ciCdEnergy: 0,
    registryEnergy: 0,
    lifecycleEnergy: 0,

    // Financial impact
    carbonOffsetValue: 0,
    waterTreatmentValue: 0,
    totalFinancialValue: 0,

    // Regional variations
    carbonIntensityUsed: 0.456,
    regionalMultiplier: 1.0,

    // Time-based factors
    peakEnergySavings: 0,
    offPeakEnergySavings: 0,
    timeOfDayMultiplier: 1.0,

    // Renewable energy impact
    renewableEnergySavings: 0,
    fossilFuelSavings: 0,
    renewablePercentage: 0,

    // Additional environmental metrics
    ewasteReduction: 0,
    serverUtilizationImprovement: 0,
    developerProductivityGain: 0,
    buildTimeReduction: 0,

    // Apply overrides
    ...overrides,
  };
}

describe("Environmental Impact Comprehensive Tests", () => {
  describe("calculateEnvironmentalImpact", () => {
    it("should handle zero values", () => {
      const result = calculateEnvironmentalImpact(0, 0, 0);

      expect(result.carbonSavings).toBe(0);
      expect(result.energySavings).toBe(0);
      expect(result.waterSavings).toBe(0);
    });

    it("should handle very large values", () => {
      const result = calculateEnvironmentalImpact(1000000000, 3600, 1000000);

      expect(result.carbonSavings).toBeGreaterThan(0);
      expect(result.energySavings).toBeGreaterThan(0);
      expect(result.waterSavings).toBeGreaterThan(0);
      expect(result.carbonIntensityUsed).toBeDefined();
      expect(result.timeOfDayMultiplier).toBeDefined();
    });

    it("should handle null monthlyDownloads", () => {
      const result = calculateEnvironmentalImpact(1000000, 3600, null);

      expect(result.carbonSavings).toBeGreaterThan(0);
      expect(result.energySavings).toBeGreaterThan(0);
      expect(result.waterSavings).toBeGreaterThan(0);
    });

    it("should handle very large inputs", () => {
      const result = calculateEnvironmentalImpact(
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        1000000
      );

      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
      expect(result.energySavings).toBeGreaterThan(0);
    });

    it("should handle edge case with zero values", () => {
      const result = calculateEnvironmentalImpact(0, 0, 1000);

      expect(result).toBeDefined();
      expect(result.carbonSavings).toBe(0);
      expect(result.energySavings).toBe(0);
    });

    it("should handle normal values with monthly downloads", () => {
      const result = calculateEnvironmentalImpact(1000, 30, 1000);

      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
      expect(result.energySavings).toBeGreaterThan(0);
    });
  });

  describe("calculateCumulativeEnvironmentalImpact", () => {
    it("should handle complex environmental impact calculations", () => {
      const impact1 = createTestEnvironmentalImpact({
        carbonSavings: 100,
        energySavings: 200,
        waterSavings: 300,
        treesEquivalent: 10,
        carMilesEquivalent: 20,
        networkSavings: 30,
        storageSavings: 40,
        efficiencyGain: 50,
      });

      const impact2 = createTestEnvironmentalImpact({
        carbonSavings: 200,
        energySavings: 400,
        waterSavings: 600,
        treesEquivalent: 20,
        carMilesEquivalent: 40,
        networkSavings: 60,
        storageSavings: 80,
        efficiencyGain: 100,
      });

      const result = calculateCumulativeEnvironmentalImpact([impact1, impact2]);

      expect(result.carbonSavings).toBe(300);
      expect(result.energySavings).toBe(600);
      expect(result.waterSavings).toBe(900);
    });
  });

  describe("formatEnvironmentalImpact", () => {
    it("should format large numbers correctly", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 123456.789,
        energySavings: 987654.321,
        waterSavings: 456789.123,
        treesEquivalent: 1234.567,
        carMilesEquivalent: 5678.901,
        networkSavings: 2345.678,
        storageSavings: 3456.789,
        efficiencyGain: 4567.89,
      });

      const result = formatEnvironmentalImpact(impact);

      expect(result.carbonSavings).toContain("123456.789");
      expect(result.energySavings).toContain("987654.321");
      expect(result.waterSavings).toContain("456789.1");
    });
  });

  describe("generateEnvironmentalRecommendations", () => {
    it("should generate recommendations for high impact", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 1000,
        energySavings: 2000,
        waterSavings: 3000,
        treesEquivalent: 100,
        carMilesEquivalent: 200,
        networkSavings: 300,
        storageSavings: 400,
        efficiencyGain: 500,
      });

      const result = generateEnvironmentalRecommendations(impact, 10);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain("1000.000");
    });

    it("should generate recommendations for low impact", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 1,
        energySavings: 2,
        waterSavings: 3,
        treesEquivalent: 0.1,
        carMilesEquivalent: 0.2,
        networkSavings: 0.3,
        storageSavings: 0.4,
        efficiencyGain: 0.5,
      });

      const result = generateEnvironmentalRecommendations(impact, 1);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain("1.000");
    });
  });

  describe("displayEnvironmentalImpactTable", () => {
    it("should display table without errors", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 100,
        energySavings: 200,
        waterSavings: 300,
        treesEquivalent: 10,
        carMilesEquivalent: 20,
        networkSavings: 30,
        storageSavings: 40,
        efficiencyGain: 50,
      });

      expect(() => displayEnvironmentalImpactTable(impact)).not.toThrow();
    });
  });

  describe("displayEnvironmentalHeroMessage", () => {
    it("should display hero message without errors", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 100,
        energySavings: 200,
        waterSavings: 300,
        treesEquivalent: 10,
        carMilesEquivalent: 20,
        networkSavings: 30,
        storageSavings: 40,
        efficiencyGain: 50,
      });

      expect(() => displayEnvironmentalHeroMessage(impact)).not.toThrow();
    });
  });

  describe("createZeroEnvironmentalImpact", () => {
    it("should create zero impact object", () => {
      const result = createZeroEnvironmentalImpact();

      expect(result.carbonSavings).toBe(0);
      expect(result.energySavings).toBe(0);
      expect(result.waterSavings).toBe(0);
      expect(result.treesEquivalent).toBe(0);
      expect(result.carMilesEquivalent).toBe(0);
      expect(result.efficiencyGain).toBe(0);
      expect(result.networkSavings).toBe(0);
      expect(result.storageSavings).toBe(0);
    });
  });
});
