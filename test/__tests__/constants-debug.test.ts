import { jest } from "@jest/globals";

// Test constants loading directly
describe("Constants Loading Debug", () => {
  it("should load constants correctly", async () => {
    console.log("Testing constants import...");

    try {
      const constants = await import("../../src/constants.js");
      console.log("Constants loaded successfully");
      console.log(
        "ENVIRONMENTAL_CONSTANTS keys:",
        Object.keys(constants.ENVIRONMENTAL_CONSTANTS)
      );
      console.log(
        "CARBON_INTENSITY_NA:",
        constants.ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_NA
      );
      console.log(
        "CARBON_INTENSITY_EU:",
        constants.ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_EU
      );
      console.log(
        "CARBON_INTENSITY_AP:",
        constants.ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_AP
      );

      expect(constants.ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_NA).toBe(0.387);
      expect(constants.ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_EU).toBe(0.298);
      expect(constants.ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY_AP).toBe(0.521);
    } catch (error) {
      console.error("Error loading constants:", error);
      throw error;
    }
  });

  it("should load enhanced calculations correctly", async () => {
    console.log("Testing enhanced calculations import...");

    try {
      const calc = await import(
        "../../src/enhanced-environmental-calculations.js"
      );
      console.log("Enhanced calculations loaded successfully");
      console.log("Available functions:", Object.keys(calc));

      // Test a simple function
      const region = calc.detectUserRegion();
      console.log("detectUserRegion result:", region);
      expect(region).toBeDefined();
    } catch (error) {
      console.error("Error loading enhanced calculations:", error);
      throw error;
    }
  });
});
