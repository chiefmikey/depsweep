import {
  isProtectedDependency,
  getProtectionReason,
} from "../../src/constants";
import { ENVIRONMENTAL_CONSTANTS } from "../../src/constants";

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
      expect(isProtectedDependency("@vue/runtime-core")).toBe(true);
      expect(isProtectedDependency("@types/node")).toBe(true);
      // Packages not explicitly listed should NOT be protected
      expect(isProtectedDependency("@vue/runtime")).toBe(false);
      expect(isProtectedDependency("@types/ip")).toBe(false);
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
    expect(ENVIRONMENTAL_CONSTANTS.STORAGE_ENERGY_PER_GB_YEAR).toBeGreaterThan(
      0
    );
  });
});
