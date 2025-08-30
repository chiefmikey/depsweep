import { jest } from "@jest/globals";

// Import interfaces for testing
import type {
  EnvironmentalImpact,
  ImpactMetrics,
  EnvironmentalReport,
} from "../../src/interfaces.js";

describe("Interface Definitions and Type Safety", () => {
  describe("EnvironmentalImpact Interface", () => {
    it("should have all required properties with correct types", () => {
      const mockImpact: EnvironmentalImpact = {
        carbonSavings: 1.5,
        energySavings: 2.3,
        waterSavings: 15.7,
        treesEquivalent: 0.12,
        carMilesEquivalent: 3.4,
        efficiencyGain: 15.0,
        networkSavings: 0.8,
        storageSavings: 1.2,
      };

      expect(mockImpact).toBeDefined();
      expect(typeof mockImpact.carbonSavings).toBe("number");
      expect(typeof mockImpact.energySavings).toBe("number");
      expect(typeof mockImpact.waterSavings).toBe("number");
      expect(typeof mockImpact.treesEquivalent).toBe("number");
      expect(typeof mockImpact.carMilesEquivalent).toBe("number");
      expect(typeof mockImpact.efficiencyGain).toBe("number");
      expect(typeof mockImpact.networkSavings).toBe("number");
      expect(typeof mockImpact.storageSavings).toBe("number");
    });

    it("should allow zero values for all properties", () => {
      const zeroImpact: EnvironmentalImpact = {
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      };

      expect(zeroImpact.carbonSavings).toBe(0);
      expect(zeroImpact.energySavings).toBe(0);
      expect(zeroImpact.waterSavings).toBe(0);
      expect(zeroImpact.treesEquivalent).toBe(0);
      expect(zeroImpact.carMilesEquivalent).toBe(0);
      expect(zeroImpact.efficiencyGain).toBe(0);
      expect(zeroImpact.networkSavings).toBe(0);
      expect(zeroImpact.storageSavings).toBe(0);
    });

    it("should allow large positive values", () => {
      const largeImpact: EnvironmentalImpact = {
        carbonSavings: 1000.5,
        energySavings: 2500.75,
        waterSavings: 15000.25,
        treesEquivalent: 50.0,
        carMilesEquivalent: 500.0,
        efficiencyGain: 99.9,
        networkSavings: 100.0,
        storageSavings: 200.0,
      };

      expect(largeImpact.carbonSavings).toBe(1000.5);
      expect(largeImpact.energySavings).toBe(2500.75);
      expect(largeImpact.waterSavings).toBe(15000.25);
      expect(largeImpact.treesEquivalent).toBe(50.0);
      expect(largeImpact.carMilesEquivalent).toBe(500.0);
      expect(largeImpact.efficiencyGain).toBe(99.9);
      expect(largeImpact.networkSavings).toBe(100.0);
      expect(largeImpact.storageSavings).toBe(200.0);
    });

    it("should allow decimal precision", () => {
      const preciseImpact: EnvironmentalImpact = {
        carbonSavings: 0.001,
        energySavings: 0.002,
        waterSavings: 0.003,
        treesEquivalent: 0.0001,
        carMilesEquivalent: 0.0002,
        efficiencyGain: 0.1,
        networkSavings: 0.0001,
        storageSavings: 0.0002,
      };

      expect(preciseImpact.carbonSavings).toBe(0.001);
      expect(preciseImpact.energySavings).toBe(0.002);
      expect(preciseImpact.waterSavings).toBe(0.003);
      expect(preciseImpact.treesEquivalent).toBe(0.0001);
      expect(preciseImpact.carMilesEquivalent).toBe(0.0002);
      expect(preciseImpact.efficiencyGain).toBe(0.1);
      expect(preciseImpact.networkSavings).toBe(0.0001);
      expect(preciseImpact.storageSavings).toBe(0.0002);
    });

    it("should validate property constraints", () => {
      // All values should be non-negative
      const validImpact: EnvironmentalImpact = {
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      };

      Object.values(validImpact).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("ImpactMetrics Interface", () => {
    it("should have all required properties with correct types", () => {
      const mockMetrics: ImpactMetrics = {
        installTime: 30,
        diskSpace: 1073741824,
      };

      expect(mockMetrics).toBeDefined();
      expect(typeof mockMetrics.installTime).toBe("number");
      expect(typeof mockMetrics.diskSpace).toBe("number");
    });

    it("should allow optional properties", () => {
      const metricsWithErrors: ImpactMetrics = {
        installTime: 45,
        diskSpace: 2147483648,
        errors: ["Network timeout", "Package not found"],
      };

      expect(metricsWithErrors.errors).toBeDefined();
      expect(Array.isArray(metricsWithErrors.errors)).toBe(true);
      expect(metricsWithErrors.errors).toHaveLength(2);
      expect(metricsWithErrors.errors).toContain("Network timeout");
      expect(metricsWithErrors.errors).toContain("Package not found");
    });

    it("should allow optional environmental impact", () => {
      const metricsWithImpact: ImpactMetrics = {
        installTime: 60,
        diskSpace: 5368709120,
        environmentalImpact: {
          carbonSavings: 2.5,
          energySavings: 5.0,
          waterSavings: 25.0,
          treesEquivalent: 0.2,
          carMilesEquivalent: 5.0,
          efficiencyGain: 20.0,
          networkSavings: 1.5,
          storageSavings: 3.0,
        },
      };

      expect(metricsWithImpact.environmentalImpact).toBeDefined();
      expect(metricsWithImpact.environmentalImpact?.carbonSavings).toBe(2.5);
      expect(metricsWithImpact.environmentalImpact?.energySavings).toBe(5.0);
    });

    it("should handle zero values", () => {
      const zeroMetrics: ImpactMetrics = {
        installTime: 0,
        diskSpace: 0,
      };

      expect(zeroMetrics.installTime).toBe(0);
      expect(zeroMetrics.diskSpace).toBe(0);
    });

    it("should handle large values", () => {
      const largeMetrics: ImpactMetrics = {
        installTime: 3600, // 1 hour
        diskSpace: 107374182400, // 100 GB
      };

      expect(largeMetrics.installTime).toBe(3600);
      expect(largeMetrics.diskSpace).toBe(107374182400);
    });
  });

  describe("EnvironmentalReport Interface", () => {
    it("should have all required properties with correct types", () => {
      const mockReport: EnvironmentalReport = {
        totalImpact: {
          carbonSavings: 5.0,
          energySavings: 10.0,
          waterSavings: 50.0,
          treesEquivalent: 0.4,
          carMilesEquivalent: 10.0,
          efficiencyGain: 25.0,
          networkSavings: 2.0,
          storageSavings: 5.0,
        },
        perPackageImpact: {
          lodash: {
            carbonSavings: 1.0,
            energySavings: 2.0,
            waterSavings: 10.0,
            treesEquivalent: 0.08,
            carMilesEquivalent: 2.0,
            efficiencyGain: 15.0,
            networkSavings: 0.5,
            storageSavings: 1.0,
          },
          moment: {
            carbonSavings: 2.0,
            energySavings: 4.0,
            waterSavings: 20.0,
            treesEquivalent: 0.16,
            carMilesEquivalent: 4.0,
            efficiencyGain: 20.0,
            networkSavings: 1.0,
            storageSavings: 2.0,
          },
        },
        timeframes: {
          daily: {
            carbonSavings: 0.2,
            energySavings: 0.4,
            waterSavings: 2.0,
            treesEquivalent: 0.016,
            carMilesEquivalent: 0.4,
            efficiencyGain: 25.0,
            networkSavings: 0.08,
            storageSavings: 0.2,
          },
          monthly: {
            carbonSavings: 5.0,
            energySavings: 10.0,
            waterSavings: 50.0,
            treesEquivalent: 0.4,
            carMilesEquivalent: 10.0,
            efficiencyGain: 25.0,
            networkSavings: 2.0,
            storageSavings: 5.0,
          },
        },
        recommendations: [
          "Remove unused dependencies to reduce environmental impact",
          "Consider using tree-shaking to reduce bundle size",
          "Implement lazy loading for better performance",
        ],
      };

      expect(mockReport).toBeDefined();
      expect(mockReport.totalImpact).toBeDefined();
      expect(mockReport.perPackageImpact).toBeDefined();
      expect(mockReport.timeframes).toBeDefined();
      expect(mockReport.recommendations).toBeDefined();
    });

    it("should validate totalImpact structure", () => {
      const report: EnvironmentalReport = {
        totalImpact: global.testUtils.createMockEnvironmentalImpact(),
        perPackageImpact: {},
        timeframes: {
          daily: global.testUtils.createMockEnvironmentalImpact(),
          monthly: global.testUtils.createMockEnvironmentalImpact(),
        },
        recommendations: [],
      };

      expect(report.totalImpact).toBeValidEnvironmentalImpact();
    });

    it("should validate perPackageImpact structure", () => {
      const report: EnvironmentalReport = {
        totalImpact: global.testUtils.createMockEnvironmentalImpact(),
        perPackageImpact: {
          package1: global.testUtils.createMockEnvironmentalImpact({
            carbonSavings: 1.0,
          }),
          package2: global.testUtils.createMockEnvironmentalImpact({
            carbonSavings: 2.0,
          }),
        },
        timeframes: {
          daily: global.testUtils.createMockEnvironmentalImpact(),
          monthly: global.testUtils.createMockEnvironmentalImpact(),
        },
        recommendations: [],
      };

      expect(Object.keys(report.perPackageImpact)).toHaveLength(2);
      expect(
        report.perPackageImpact["package1"]
      ).toBeValidEnvironmentalImpact();
      expect(
        report.perPackageImpact["package2"]
      ).toBeValidEnvironmentalImpact();
    });

    it("should validate timeframes structure", () => {
      const report: EnvironmentalReport = {
        totalImpact: global.testUtils.createMockEnvironmentalImpact(),
        perPackageImpact: {},
        timeframes: {
          daily: global.testUtils.createMockEnvironmentalImpact({
            carbonSavings: 0.1,
          }),
          monthly: global.testUtils.createMockEnvironmentalImpact({
            carbonSavings: 3.0,
          }),
          yearly: global.testUtils.createMockEnvironmentalImpact({
            carbonSavings: 36.0,
          }),
        },
        recommendations: [],
      };

      expect(report.timeframes.daily).toBeValidEnvironmentalImpact();
      expect(report.timeframes.monthly).toBeValidEnvironmentalImpact();
      expect(report.timeframes.yearly).toBeValidEnvironmentalImpact();
    });

    it("should validate recommendations array", () => {
      const report: EnvironmentalReport = {
        totalImpact: global.testUtils.createMockEnvironmentalImpact(),
        perPackageImpact: {},
        timeframes: {
          daily: global.testUtils.createMockEnvironmentalImpact(),
          monthly: global.testUtils.createMockEnvironmentalImpact(),
        },
        recommendations: [
          "First recommendation",
          "Second recommendation",
          "Third recommendation",
        ],
      };

      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations).toHaveLength(3);
      report.recommendations.forEach((rec) => {
        expect(typeof rec).toBe("string");
        expect(rec.length).toBeGreaterThan(0);
      });
    });

    it("should handle empty perPackageImpact", () => {
      const report: EnvironmentalReport = {
        totalImpact: global.testUtils.createMockEnvironmentalImpact(),
        perPackageImpact: {},
        timeframes: {
          daily: global.testUtils.createMockEnvironmentalImpact(),
          monthly: global.testUtils.createMockEnvironmentalImpact(),
        },
        recommendations: [],
      };

      expect(Object.keys(report.perPackageImpact)).toHaveLength(0);
    });

    it("should handle empty recommendations", () => {
      const report: EnvironmentalReport = {
        totalImpact: global.testUtils.createMockEnvironmentalImpact(),
        perPackageImpact: {},
        timeframes: {
          daily: global.testUtils.createMockEnvironmentalImpact(),
          monthly: global.testUtils.createMockEnvironmentalImpact(),
        },
        recommendations: [],
      };

      expect(report.recommendations).toHaveLength(0);
    });
  });

  describe("Interface Integration Tests", () => {
    it("should allow creating complete environmental report", () => {
      const totalImpact: EnvironmentalImpact = {
        carbonSavings: 10.0,
        energySavings: 20.0,
        waterSavings: 100.0,
        treesEquivalent: 0.8,
        carMilesEquivalent: 20.0,
        efficiencyGain: 30.0,
        networkSavings: 4.0,
        storageSavings: 10.0,
      };

      const metrics: ImpactMetrics = {
        installTime: 120,
        diskSpace: 2147483648,
        environmentalImpact: totalImpact,
      };

      const report: EnvironmentalReport = {
        totalImpact,
        perPackageImpact: {
          lodash: { ...totalImpact, carbonSavings: 2.0 },
          moment: { ...totalImpact, carbonSavings: 3.0 },
        },
        timeframes: {
          daily: { ...totalImpact, carbonSavings: 0.33 },
          monthly: { ...totalImpact, carbonSavings: 10.0 },
          yearly: { ...totalImpact, carbonSavings: 120.0 },
        },
        recommendations: ["Remove unused dependencies", "Optimize bundle size"],
      };

      expect(metrics.environmentalImpact).toEqual(totalImpact);
      expect(report.totalImpact).toEqual(totalImpact);
      expect(report.perPackageImpact["lodash"].carbonSavings).toBe(2.0);
      expect(report.timeframes.yearly?.carbonSavings).toBe(120.0);
    });

    it("should validate nested environmental impact objects", () => {
      const baseImpact: EnvironmentalImpact = {
        carbonSavings: 1.0,
        energySavings: 2.0,
        waterSavings: 10.0,
        treesEquivalent: 0.08,
        carMilesEquivalent: 2.0,
        efficiencyGain: 15.0,
        networkSavings: 0.5,
        storageSavings: 1.0,
      };

      const report: EnvironmentalReport = {
        totalImpact: baseImpact,
        perPackageImpact: {
          package1: { ...baseImpact, carbonSavings: 0.5 },
          package2: { ...baseImpact, carbonSavings: 1.5 },
        },
        timeframes: {
          daily: { ...baseImpact, carbonSavings: 0.033 },
          monthly: { ...baseImpact, carbonSavings: 1.0 },
        },
        recommendations: ["Test recommendation"],
      };

      // Validate all nested objects
      expect(report.totalImpact).toBeValidEnvironmentalImpact();
      expect(
        report.perPackageImpact["package1"]
      ).toBeValidEnvironmentalImpact();
      expect(
        report.perPackageImpact["package2"]
      ).toBeValidEnvironmentalImpact();
      expect(report.timeframes.daily).toBeValidEnvironmentalImpact();
      expect(report.timeframes.monthly).toBeValidEnvironmentalImpact();
    });
  });

  describe("Type Safety and Validation", () => {
    it("should enforce correct property types", () => {
      // This test ensures TypeScript compilation works correctly
      const validImpact: EnvironmentalImpact = {
        carbonSavings: 1.0,
        energySavings: 2.0,
        waterSavings: 10.0,
        treesEquivalent: 0.08,
        carMilesEquivalent: 2.0,
        efficiencyGain: 15.0,
        networkSavings: 0.5,
        storageSavings: 1.0,
      };

      // All properties should be numbers
      Object.values(validImpact).forEach((value) => {
        expect(typeof value).toBe("number");
        expect(Number.isFinite(value)).toBe(true);
      });
    });

    it("should handle optional properties correctly", () => {
      const metrics: ImpactMetrics = {
        installTime: 30,
        diskSpace: 1073741824,
      };

      // Optional properties should be undefined by default
      expect(metrics.errors).toBeUndefined();
      expect(metrics.environmentalImpact).toBeUndefined();

      // Should allow setting optional properties
      metrics.errors = ["Test error"];
      metrics.environmentalImpact =
        global.testUtils.createMockEnvironmentalImpact();

      expect(metrics.errors).toBeDefined();
      expect(metrics.environmentalImpact).toBeDefined();
    });

    it("should validate array types", () => {
      const report: EnvironmentalReport = {
        totalImpact: global.testUtils.createMockEnvironmentalImpact(),
        perPackageImpact: {},
        timeframes: {
          daily: global.testUtils.createMockEnvironmentalImpact(),
          monthly: global.testUtils.createMockEnvironmentalImpact(),
        },
        recommendations: ["First", "Second", "Third"],
      };

      expect(Array.isArray(report.recommendations)).toBe(true);
      report.recommendations.forEach((item) => {
        expect(typeof item).toBe("string");
      });
    });
  });
});
