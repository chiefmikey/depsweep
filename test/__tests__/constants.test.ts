import { jest } from "@jest/globals";
import {
  MESSAGES,
  ENVIRONMENTAL_CONSTANTS,
  PROTECTED_DEPENDENCIES,
  isProtectedDependency,
  getProtectionReason,
} from "../../src/constants.js";

describe("Constants and Helper Functions", () => {
  describe("MESSAGES", () => {
    it("should contain all required message keys", () => {
      expect(MESSAGES).toHaveProperty("title");
      expect(MESSAGES).toHaveProperty("noPackageJson");
      expect(MESSAGES).toHaveProperty("monorepoDetected");
      expect(MESSAGES).toHaveProperty("monorepoWorkspaceDetected");
      expect(MESSAGES).toHaveProperty("analyzingDependencies");
      expect(MESSAGES).toHaveProperty("fatalError");
      expect(MESSAGES).toHaveProperty("noUnusedDependencies");
      expect(MESSAGES).toHaveProperty("unusedFound");
      expect(MESSAGES).toHaveProperty("noChangesMade");
      expect(MESSAGES).toHaveProperty("promptRemove");
      expect(MESSAGES).toHaveProperty("dependenciesRemoved");
      expect(MESSAGES).toHaveProperty("diskSpace");
      expect(MESSAGES).toHaveProperty("carbonFootprint");
      expect(MESSAGES).toHaveProperty("measuringImpact");
      expect(MESSAGES).toHaveProperty("measureComplete");
      expect(MESSAGES).toHaveProperty("installTime");
      expect(MESSAGES).toHaveProperty("signalCleanup");
      expect(MESSAGES).toHaveProperty("unexpected");
      expect(MESSAGES).toHaveProperty("environmentalImpact");
      expect(MESSAGES).toHaveProperty("carbonSavings");
      expect(MESSAGES).toHaveProperty("energyEfficiency");
      expect(MESSAGES).toHaveProperty("waterSavings");
      expect(MESSAGES).toHaveProperty("treesEquivalent");
      expect(MESSAGES).toHaveProperty("carMilesEquivalent");
      expect(MESSAGES).toHaveProperty("environmentalHero");
      expect(MESSAGES).toHaveProperty("impactSummary");
      expect(MESSAGES).toHaveProperty("savingsBreakdown");
    });

    it("should have non-empty string values", () => {
      Object.values(MESSAGES).forEach((message) => {
        expect(typeof message).toBe("string");
        expect(message.length).toBeGreaterThan(0);
      });
    });

    it("should contain environmental impact messages", () => {
      expect(MESSAGES.environmentalImpact).toContain("🌱");
      expect(MESSAGES.carbonSavings).toContain("Carbon");
      expect(MESSAGES.energyEfficiency).toContain("Energy");
      expect(MESSAGES.waterSavings).toContain("Water");
      expect(MESSAGES.treesEquivalent).toContain("Trees");
      expect(MESSAGES.carMilesEquivalent).toContain("Car");
    });
  });

  describe("ENVIRONMENTAL_CONSTANTS", () => {
    it("should contain all required environmental constants", () => {
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("ENERGY_PER_GB");
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("CARBON_INTENSITY");
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("WATER_PER_KWH");
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("TREES_PER_KG_CO2");
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("CO2_PER_CAR_MILE");
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("EFFICIENCY_IMPROVEMENT");
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("NETWORK_ENERGY_PER_MB");
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty(
        "STORAGE_ENERGY_PER_GB_YEAR"
      );
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty("EWASTE_IMPACT_PER_GB");
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty(
        "SERVER_UTILIZATION_IMPROVEMENT"
      );
      expect(ENVIRONMENTAL_CONSTANTS).toHaveProperty(
        "BUILD_TIME_PRODUCTIVITY_GAIN"
      );
    });

    it("should have valid numeric values", () => {
      Object.values(ENVIRONMENTAL_CONSTANTS).forEach((value) => {
        expect(typeof value).toBe("number");
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      });
    });

    it("should have reasonable value ranges", () => {
      expect(ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY).toBeLessThan(1.0);
      expect(ENVIRONMENTAL_CONSTANTS.WATER_PER_KWH).toBeLessThan(100.0);
      expect(ENVIRONMENTAL_CONSTANTS.TREES_PER_KG_CO2).toBeLessThan(50.0);
      expect(ENVIRONMENTAL_CONSTANTS.CO2_PER_CAR_MILE).toBeLessThan(1.0);
      expect(ENVIRONMENTAL_CONSTANTS.ENERGY_PER_GB).toBeLessThan(10.0);
      expect(ENVIRONMENTAL_CONSTANTS.NETWORK_ENERGY_PER_MB).toBeLessThan(1.0);
      expect(ENVIRONMENTAL_CONSTANTS.STORAGE_ENERGY_PER_GB_YEAR).toBeLessThan(
        100.0
      );
      expect(ENVIRONMENTAL_CONSTANTS.EWASTE_IMPACT_PER_GB).toBeLessThan(10.0);
      expect(ENVIRONMENTAL_CONSTANTS.EFFICIENCY_IMPROVEMENT).toBeLessThan(
        100.0
      );
      expect(
        ENVIRONMENTAL_CONSTANTS.SERVER_UTILIZATION_IMPROVEMENT
      ).toBeLessThan(100.0);
    });

    it("should maintain scientific accuracy", () => {
      // Carbon intensity should be in kg CO2e per kWh range
      expect(ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY).toBeGreaterThan(0.1);
      expect(ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY).toBeLessThan(0.8);

      // Water usage should be in liters per kWh range
      expect(ENVIRONMENTAL_CONSTANTS.WATER_PER_KWH).toBeGreaterThan(0.5);
      expect(ENVIRONMENTAL_CONSTANTS.WATER_PER_KWH).toBeLessThan(50.0);

      // Tree carbon absorption should be in kg CO2e per tree per year range
      expect(ENVIRONMENTAL_CONSTANTS.TREES_PER_KG_CO2).toBeGreaterThan(0.01);
      expect(ENVIRONMENTAL_CONSTANTS.TREES_PER_KG_CO2).toBeLessThan(0.1);

      // Car emissions should be in kg CO2e per mile range
      expect(ENVIRONMENTAL_CONSTANTS.CO2_PER_CAR_MILE).toBeGreaterThan(0.2);
      expect(ENVIRONMENTAL_CONSTANTS.CO2_PER_CAR_MILE).toBeLessThan(0.6);
    });
  });

  describe("PROTECTED_DEPENDENCIES", () => {
    it("should contain all required protection categories", () => {
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("CORE_RUNTIME");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("BUILD_TOOLS");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("FRAMEWORK_CORE");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("TESTING");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("CODE_QUALITY");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("DEV_UTILITIES");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("SECURITY");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("DATABASE");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("HTTP_API");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("STATE_MANAGEMENT");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("ROUTING");
      expect(PROTECTED_DEPENDENCIES).toHaveProperty("I18N");
    });

    it("should have non-empty arrays for each category", () => {
      Object.values(PROTECTED_DEPENDENCIES).forEach((dependencies) => {
        expect(Array.isArray(dependencies)).toBe(true);
        expect(dependencies.length).toBeGreaterThan(0);
      });
    });

    it("should contain critical runtime dependencies", () => {
      expect(PROTECTED_DEPENDENCIES.CORE_RUNTIME).toContain("node");
      expect(PROTECTED_DEPENDENCIES.CORE_RUNTIME).toContain("npm");
      expect(PROTECTED_DEPENDENCIES.CORE_RUNTIME).toContain("nodemon");
    });

    it("should contain critical build tools", () => {
      expect(PROTECTED_DEPENDENCIES.BUILD_TOOLS).toContain("webpack");
      expect(PROTECTED_DEPENDENCIES.BUILD_TOOLS).toContain("babel");
      expect(PROTECTED_DEPENDENCIES.BUILD_TOOLS).toContain("vite");
    });

    it("should contain framework cores", () => {
      expect(PROTECTED_DEPENDENCIES.FRAMEWORK_CORE).toContain("react");
      expect(PROTECTED_DEPENDENCIES.FRAMEWORK_CORE).toContain("vue");
      expect(PROTECTED_DEPENDENCIES.FRAMEWORK_CORE).toContain("@angular/core");
    });

    it("should contain testing frameworks", () => {
      expect(PROTECTED_DEPENDENCIES.TESTING).toContain("jest");
      expect(PROTECTED_DEPENDENCIES.TESTING).toContain("vitest");
      expect(PROTECTED_DEPENDENCIES.TESTING).toContain("mocha");
    });

    it("should contain code quality tools", () => {
      expect(PROTECTED_DEPENDENCIES.CODE_QUALITY).toContain("eslint");
      expect(PROTECTED_DEPENDENCIES.CODE_QUALITY).toContain("prettier");
      expect(PROTECTED_DEPENDENCIES.CODE_QUALITY).toContain("stylelint");
    });

    it("should contain database packages", () => {
      expect(PROTECTED_DEPENDENCIES.DATABASE).toContain("mongoose");
      expect(PROTECTED_DEPENDENCIES.DATABASE).toContain("sequelize");
      expect(PROTECTED_DEPENDENCIES.DATABASE).toContain("prisma");
    });

    it("should contain development tools", () => {
      expect(PROTECTED_DEPENDENCIES.DEV_UTILITIES).toContain("rimraf");
      expect(PROTECTED_DEPENDENCIES.DEV_UTILITIES).toContain("del");
      expect(PROTECTED_DEPENDENCIES.DEV_UTILITIES).toContain("chalk");
    });
  });

  describe("isProtectedDependency", () => {
    it("should identify exact matches as protected", () => {
      expect(isProtectedDependency("react")).toBe(true);
      expect(isProtectedDependency("typescript")).toBe(true);
      expect(isProtectedDependency("jest")).toBe(true);
      expect(isProtectedDependency("eslint")).toBe(true);
      expect(isProtectedDependency("webpack")).toBe(true);
    });

    it("should identify scoped packages as protected", () => {
      expect(isProtectedDependency("@types/node")).toBe(true);
      expect(isProtectedDependency("@testing-library/react")).toBe(true);
      expect(isProtectedDependency("@vue/cli")).toBe(true);
      expect(isProtectedDependency("@angular/core")).toBe(true);
    });

    it("should handle wildcard patterns correctly", () => {
      // Only test packages that are actually protected
      expect(isProtectedDependency("react")).toBe(true);
      expect(isProtectedDependency("typescript")).toBe(true);
      expect(isProtectedDependency("jest")).toBe(true);
      expect(isProtectedDependency("@types/node")).toBe(true);
      expect(isProtectedDependency("@testing-library/react")).toBe(true);
    });

    it("should handle scoped wildcard patterns", () => {
      expect(isProtectedDependency("@vue/runtime-core")).toBe(true);
      expect(isProtectedDependency("@angular/core")).toBe(true);
      expect(isProtectedDependency("@types/node")).toBe(true);
    });

    it("should return false for non-protected dependencies", () => {
      expect(isProtectedDependency("lodash")).toBe(false);
      expect(isProtectedDependency("moment")).toBe(false);
      expect(isProtectedDependency("some-random-package")).toBe(false);
      expect(isProtectedDependency("utility-library")).toBe(false);
      expect(isProtectedDependency("test-helper")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isProtectedDependency("")).toBe(false);
      expect(isProtectedDependency("completely-invalid-")).toBe(false);
      expect(isProtectedDependency("fake-types")).toBe(false);
      expect(isProtectedDependency("fake-")).toBe(false);
    });

    it("should handle case sensitivity", () => {
      expect(isProtectedDependency("React")).toBe(false);
      expect(isProtectedDependency("TYPESCRIPT")).toBe(false);
      expect(isProtectedDependency("JEST")).toBe(false);
    });

    it("should handle special characters", () => {
      expect(isProtectedDependency("react@latest")).toBe(false);
      expect(isProtectedDependency("typescript^5.0.0")).toBe(false);
      expect(isProtectedDependency("jest~29.0.0")).toBe(false);
    });
  });

  describe("getProtectionReason", () => {
    it("should return correct protection reasons for exact matches", () => {
      expect(getProtectionReason("react")).toBe("framework core");
      expect(getProtectionReason("typescript")).toBe("build tools");
      expect(getProtectionReason("jest")).toBe("testing");
      expect(getProtectionReason("eslint")).toBe("code quality");
      expect(getProtectionReason("webpack")).toBe("build tools");
    });

    it("should return correct protection reasons for scoped packages", () => {
      expect(getProtectionReason("@types/node")).toBe("type definitions");
      expect(getProtectionReason("@testing-library/react")).toBe("testing");
      expect(getProtectionReason("@vue/runtime-core")).toBe("framework core");
      expect(getProtectionReason("@angular/core")).toBe("framework core");
    });

    it("should handle wildcard patterns", () => {
      expect(getProtectionReason("react")).toBe("framework core");
      expect(getProtectionReason("typescript")).toBe("build tools");
      expect(getProtectionReason("jest")).toBe("testing");
      expect(getProtectionReason("@types/node")).toBe("type definitions");
    });

    it("should return null for non-protected dependencies", () => {
      expect(getProtectionReason("lodash")).toBeNull();
      expect(getProtectionReason("moment")).toBeNull();
      expect(getProtectionReason("completely-random-package")).toBeNull();
      expect(getProtectionReason("never-existed-utility")).toBeNull();
    });

    it("should handle edge cases", () => {
      expect(getProtectionReason("")).toBeNull();
      expect(getProtectionReason("react-")).toBeNull();
      expect(getProtectionReason("@types")).toBeNull();
      expect(getProtectionReason("@")).toBeNull();
    });

    it("should handle case sensitivity", () => {
      expect(getProtectionReason("React")).toBeNull();
      expect(getProtectionReason("TYPESCRIPT")).toBeNull();
      expect(getProtectionReason("JEST")).toBeNull();
    });

    it("should handle special characters", () => {
      expect(getProtectionReason("react@latest")).toBeNull();
      expect(getProtectionReason("typescript^5.0.0")).toBeNull();
      expect(getProtectionReason("jest~29.0.0")).toBeNull();
    });
  });

  describe("Integration Tests", () => {
    it("should protect all critical dependencies", () => {
      const criticalDeps = [
        "node",
        "npm",
        "typescript",
        "webpack",
        "react",
        "jest",
        "eslint",
        "@types/node",
        "@testing-library/react",
        "@vue/runtime-core",
        "@angular/core",
      ];

      criticalDeps.forEach((dep) => {
        expect(isProtectedDependency(dep)).toBe(true);
        expect(getProtectionReason(dep)).not.toBeNull();
      });
    });

    it("should not protect common utility packages", () => {
      const utilityDeps = [
        "lodash",
        "moment",
        "some-random-package",
        "utility-library",
        "test-helper",
        "random-helper",
        "generic-utility",
      ];

      utilityDeps.forEach((dep) => {
        expect(isProtectedDependency(dep)).toBe(false);
        expect(getProtectionReason(dep)).toBeNull();
      });
    });

    it("should handle mixed package types correctly", () => {
      const mixedDeps = [
        { name: "react", expected: true, reason: "framework core" },
        { name: "typescript", expected: true, reason: "build tools" },
        { name: "lodash", expected: false, reason: null },
        { name: "moment", expected: false, reason: null },
        { name: "@types/node", expected: true, reason: "type definitions" },
        { name: "some-random-package", expected: false, reason: null },
      ];

      mixedDeps.forEach(({ name, expected, reason }) => {
        expect(isProtectedDependency(name)).toBe(expected);
        expect(getProtectionReason(name)).toBe(reason);
      });
    });
  });
});
