import {
  calculateEnvironmentalImpact,
  calculateCumulativeEnvironmentalImpact,
  formatEnvironmentalImpact,
  displayEnvironmentalImpactTable,
  generateEnvironmentalRecommendations,
  displayEnvironmentalHeroMessage,
} from "../../src/helpers";
import {
  isProtectedDependency,
  getProtectionReason,
} from "../../src/constants";
import { ENVIRONMENTAL_CONSTANTS } from "../../src/constants";
import { EnvironmentalImpact } from "../../src/interfaces";

describe("Environmental Impact Calculations", () => {
  describe("calculateEnvironmentalImpact", () => {
    it("should calculate environmental impact correctly", () => {
      const diskSpace = 100; // MB
      const networkTransfer = 50; // MB
      const processingTime = 30; // seconds

      const impact = calculateEnvironmentalImpact(
        diskSpace,
        networkTransfer,
        processingTime
      );

      expect(impact.carbonSavings).toBeGreaterThan(0);
      expect(impact.energySavings).toBeGreaterThan(0);
      expect(impact.waterSavings).toBeGreaterThan(0);
      expect(impact.treesEquivalent).toBeGreaterThan(0);
      expect(impact.carMilesEquivalent).toBeGreaterThan(0);
      expect(impact.efficiencyGain).toBeGreaterThan(0);
      expect(impact.networkSavings).toBeGreaterThan(0);
      expect(impact.storageSavings).toBeGreaterThan(0);
    });

    it("should handle zero inputs", () => {
      const impact = calculateEnvironmentalImpact(0, 0, 0);

      expect(impact.carbonSavings).toBe(0);
      expect(impact.energySavings).toBe(0);
      expect(impact.waterSavings).toBe(0);
      expect(impact.treesEquivalent).toBe(0);
      expect(impact.carMilesEquivalent).toBe(0);
      expect(impact.efficiencyGain).toBe(0);
      expect(impact.networkSavings).toBe(0);
      expect(impact.storageSavings).toBe(0);
    });

    it("should handle negative inputs by using absolute values", () => {
      expect(() => calculateEnvironmentalImpact(-100, -50, -30)).toThrow(
        "Disk space cannot be negative"
      );
    });

    it("should scale linearly with input values", () => {
      const impact1 = calculateEnvironmentalImpact(100, 50, 30);
      const impact2 = calculateEnvironmentalImpact(200, 100, 60);

      expect(impact2.carbonSavings).toBeCloseTo(impact1.carbonSavings * 2, 3);
      expect(impact2.energySavings).toBeCloseTo(impact1.energySavings * 2, 3);
    });
  });

  describe("calculateCumulativeEnvironmentalImpact", () => {
    it("should aggregate multiple environmental impacts correctly", () => {
      const impact1: EnvironmentalImpact = {
        carbonSavings: 1.5,
        energySavings: 2.3,
        waterSavings: 15.0,
        treesEquivalent: 0.8,
        carMilesEquivalent: 3.2,
        efficiencyGain: 12.5,
        networkSavings: 25.0,
        storageSavings: 100.0,
      };

      const impact2: EnvironmentalImpact = {
        carbonSavings: 2.1,
        energySavings: 1.7,
        waterSavings: 12.0,
        treesEquivalent: 1.1,
        carMilesEquivalent: 4.1,
        efficiencyGain: 8.3,
        networkSavings: 18.0,
        storageSavings: 75.0,
      };

      const cumulative = calculateCumulativeEnvironmentalImpact([
        impact1,
        impact2,
      ]);

      expect(cumulative.carbonSavings).toBeCloseTo(3.6, 3);
      expect(cumulative.energySavings).toBeCloseTo(4.0, 3);
      expect(cumulative.waterSavings).toBeCloseTo(27.0, 3);
      expect(cumulative.treesEquivalent).toBeCloseTo(1.9, 3);
      expect(cumulative.carMilesEquivalent).toBeCloseTo(7.3, 3);
      expect(cumulative.efficiencyGain).toBe(12.5); // efficiencyGain uses Math.max, not addition
      expect(cumulative.networkSavings).toBeCloseTo(43.0, 3);
      expect(cumulative.storageSavings).toBeCloseTo(175.0, 3);
    });

    it("should handle empty array", () => {
      const cumulative = calculateCumulativeEnvironmentalImpact([]);

      expect(cumulative.carbonSavings).toBe(0);
      expect(cumulative.energySavings).toBe(0);
      expect(cumulative.waterSavings).toBe(0);
      expect(cumulative.treesEquivalent).toBe(0);
      expect(cumulative.carMilesEquivalent).toBe(0);
      expect(cumulative.efficiencyGain).toBe(0);
      expect(cumulative.networkSavings).toBe(0);
      expect(cumulative.storageSavings).toBe(0);
    });

    it("should handle single impact", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 1.5,
        energySavings: 2.3,
        waterSavings: 15.0,
        treesEquivalent: 0.8,
        carMilesEquivalent: 3.2,
        efficiencyGain: 12.5,
        networkSavings: 25.0,
        storageSavings: 100.0,
      };

      const cumulative = calculateCumulativeEnvironmentalImpact([impact]);

      expect(cumulative.carbonSavings).toBe(impact.carbonSavings);
      expect(cumulative.energySavings).toBe(impact.energySavings);
      expect(cumulative.waterSavings).toBe(impact.waterSavings);
    });
  });

  describe("formatEnvironmentalImpact", () => {
    it("should format environmental impact with default precision", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 1.5,
        energySavings: 2.3,
        waterSavings: 15.0,
        treesEquivalent: 0.8,
        carMilesEquivalent: 3.2,
        efficiencyGain: 12.5,
        networkSavings: 25.0,
        storageSavings: 100.0,
      };

      const formatted = formatEnvironmentalImpact(impact);

      expect(formatted).toHaveProperty("carbonSavings");
      expect(formatted).toHaveProperty("energySavings");
      expect(formatted).toHaveProperty("waterSavings");
      expect(formatted).toHaveProperty("treesEquivalent");
      expect(formatted).toHaveProperty("carMilesEquivalent");
      expect(formatted).toHaveProperty("efficiencyGain");
      expect(formatted).toHaveProperty("networkSavings");
      expect(formatted).toHaveProperty("storageSavings");

      expect(formatted.carbonSavings).toBe("1.500 kg CO2e");
      expect(formatted.energySavings).toBe("2.300 kWh");
      expect(formatted.waterSavings).toBe("15.0 L");
    });

    it("should format with default precision", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 1.56789,
        energySavings: 2.34567,
        waterSavings: 15.6789,
        treesEquivalent: 0.87654,
        carMilesEquivalent: 3.23456,
        efficiencyGain: 12.5678,
        networkSavings: 25.6789,
        storageSavings: 100.5678,
      };

      const formatted = formatEnvironmentalImpact(impact);

      expect(formatted.carbonSavings).toBe("1.568 kg CO2e");
      expect(formatted.energySavings).toBe("2.346 kWh");
      expect(formatted.waterSavings).toBe("15.7 L");
    });

    it("should handle zero values", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      };

      const formatted = formatEnvironmentalImpact(impact);

      expect(formatted.carbonSavings).toBe("0.000 kg CO2e");
      expect(formatted.energySavings).toBe("0.000 kWh");
      expect(formatted.waterSavings).toBe("0.0 L");
    });
  });

  describe("displayEnvironmentalImpactTable", () => {
    it("should display environmental impact table correctly", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 1.5,
        energySavings: 2.3,
        waterSavings: 15.0,
        treesEquivalent: 0.8,
        carMilesEquivalent: 3.2,
        efficiencyGain: 12.5,
        networkSavings: 25.0,
        storageSavings: 100.0,
      };

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      displayEnvironmentalImpactTable(impact, "Test Impact");

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle zero impact", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      };

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      displayEnvironmentalImpactTable(impact, "Zero Impact");

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("generateEnvironmentalRecommendations", () => {
    it("should generate recommendations for significant impact", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 0.5,
        energySavings: 0.1,
        waterSavings: 5.0,
        treesEquivalent: 0.3,
        carMilesEquivalent: 2.0,
        efficiencyGain: 8.0,
        networkSavings: 15.0,
        storageSavings: 75.0,
      };

      const recommendations = generateEnvironmentalRecommendations(impact, 10);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r) => r.includes("🌍"))).toBe(true);
      expect(recommendations.some((r) => r.includes("⚡"))).toBe(true);
      expect(recommendations.some((r) => r.includes("💧"))).toBe(true);
      expect(recommendations.some((r) => r.includes("🎯"))).toBe(true);
      expect(recommendations.some((r) => r.includes("🚗"))).toBe(true);
      expect(recommendations.some((r) => r.includes("🌟"))).toBe(true);
    });

    it("should generate recommendations for minimal impact", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 0.05,
        energySavings: 0.005,
        waterSavings: 0.5,
        treesEquivalent: 0.02,
        carMilesEquivalent: 0.1,
        efficiencyGain: 1.0,
        networkSavings: 2.0,
        storageSavings: 10.0,
      };

      const recommendations = generateEnvironmentalRecommendations(impact, 2);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      // Should still include the general encouragement message
      expect(recommendations.some((r) => r.includes("🌟"))).toBe(true);
    });

    it("should handle zero impact", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      };

      const recommendations = generateEnvironmentalRecommendations(impact, 0);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      // Should still include the general encouragement message
      expect(recommendations.some((r) => r.includes("🌟"))).toBe(true);
    });
  });

  describe("displayEnvironmentalHeroMessage", () => {
    it("should display hero message correctly", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 1.5,
        energySavings: 2.3,
        waterSavings: 15.0,
        treesEquivalent: 0.8,
        carMilesEquivalent: 3.2,
        efficiencyGain: 12.5,
        networkSavings: 25.0,
        storageSavings: 100.0,
      };

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      displayEnvironmentalHeroMessage(impact);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle zero impact", () => {
      const impact: EnvironmentalImpact = {
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      };

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      displayEnvironmentalHeroMessage(impact);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

describe("Protected Dependencies", () => {
  describe("isProtectedDependency", () => {
    it("should identify protected dependencies correctly", () => {
      expect(isProtectedDependency("react")).toBe(true);
      expect(isProtectedDependency("typescript")).toBe(true);
      expect(isProtectedDependency("jest")).toBe(true);
      expect(isProtectedDependency("webpack")).toBe(true);
    });

    it("should identify non-protected dependencies correctly", () => {
      expect(isProtectedDependency("lodash")).toBe(false);
      expect(isProtectedDependency("some-random-package")).toBe(false);
      expect(isProtectedDependency("utility-library")).toBe(false);
      expect(isProtectedDependency("test-helper")).toBe(false);
    });

    it("should handle scoped packages", () => {
      expect(isProtectedDependency("@angular/core")).toBe(true);
      expect(isProtectedDependency("@vue/runtime")).toBe(true);
      expect(isProtectedDependency("@types/node")).toBe(true);
    });

    it("should handle edge cases", () => {
      expect(isProtectedDependency("")).toBe(false);
      expect(isProtectedDependency("@")).toBe(false);
      expect(isProtectedDependency("@/")).toBe(false);
    });
  });

  describe("getProtectionReason", () => {
    it("should return correct protection reasons", () => {
      expect(getProtectionReason("react")).toBe("framework core");
      expect(getProtectionReason("typescript")).toBe("build tools");
      expect(getProtectionReason("jest")).toBe("testing");
      expect(getProtectionReason("webpack")).toBe("build tools");
    });

    it("should return null for non-protected dependencies", () => {
      expect(getProtectionReason("lodash")).toBeNull();
      expect(getProtectionReason("some-random-package")).toBeNull();
      expect(getProtectionReason("utility-library")).toBeNull();
    });

    it("should handle scoped packages", () => {
      expect(getProtectionReason("@angular/core")).toBe("framework core");
      expect(getProtectionReason("@vue/runtime-core")).toBe("framework core");
      expect(getProtectionReason("@types/node")).toBe("type definitions");
    });

    it("should handle edge cases", () => {
      expect(getProtectionReason("")).toBeNull();
      expect(getProtectionReason("@")).toBeNull();
      expect(getProtectionReason("@/")).toBeNull();
    });
  });
});

describe("ENVIRONMENTAL_CONSTANTS", () => {
  it("should contain all required constants", () => {
    expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("ENERGY_PER_GB");
    expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("CARBON_INTENSITY");
    expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("WATER_PER_KWH");
    expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("TREES_PER_KG_CO2");
    expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("CO2_PER_CAR_MILE");
    expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("NETWORK_ENERGY_PER_MB");
    expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty(
      "STORAGE_ENERGY_PER_GB_YEAR"
    );
  });

  it("should have valid numeric values", () => {
    expect(typeof ENVIRONMENTAL_CONSTANTS.ENERGY_PER_GB).toBe("number");
    expect(typeof ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY).toBe("number");
    expect(typeof ENVIRONMENTAL_CONSTANTS.WATER_PER_KWH).toBe("number");
    expect(typeof ENVIRONMENTAL_CONSTANTS.TREES_PER_KG_CO2).toBe("number");
    expect(typeof ENVIRONMENTAL_CONSTANTS.CO2_PER_CAR_MILE).toBe("number");
    expect(typeof ENVIRONMENTAL_CONSTANTS.NETWORK_ENERGY_PER_MB).toBe("number");
    expect(typeof ENVIRONMENTAL_CONSTANTS.STORAGE_ENERGY_PER_GB_YEAR).toBe(
      "number"
    );
  });

  it("should have positive values", () => {
    expect(ENVIRONMENTAL_CONSTANTS.ENERGY_PER_GB).toBeGreaterThan(0);
    expect(ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY).toBeGreaterThan(0);
    expect(ENVIRONMENTAL_CONSTANTS.WATER_PER_KWH).toBeGreaterThan(0);
    expect(ENVIRONMENTAL_CONSTANTS.TREES_PER_KG_CO2).toBeGreaterThan(0);
    expect(ENVIRONMENTAL_CONSTANTS.CO2_PER_CAR_MILE).toBeGreaterThan(0);
    expect(ENVIRONMENTAL_CONSTANTS.NETWORK_ENERGY_PER_MB).toBeGreaterThan(0);
    expect(ENVIRONMENTAL_CONSTANTS.STORAGE_ENERGY_PER_GB_YEAR).toBeGreaterThan(
      0
    );
  });
});
