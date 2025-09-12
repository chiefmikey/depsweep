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

// Import the function we want to test
import { calculateEnvironmentalImpact } from "../../src/helpers.js";

describe("Environmental Impact Calculation", () => {
  it("should calculate environmental impact with correct values", () => {
    const result = calculateEnvironmentalImpact(1000000, 3600, 1000000);

    console.log("Environmental Impact Result:", {
      carbonSavings: result.carbonSavings,
      energySavings: result.energySavings,
      waterSavings: result.waterSavings,
      carbonIntensityUsed: result.carbonIntensityUsed,
      timeOfDayMultiplier: result.timeOfDayMultiplier,
    });

    // Check that all values are valid numbers
    expect(result.carbonSavings).toBeGreaterThan(0);
    expect(result.energySavings).toBeGreaterThan(0);
    expect(result.waterSavings).toBeGreaterThan(0);
    expect(result.carbonIntensityUsed).toBeDefined();
    expect(result.timeOfDayMultiplier).toBeDefined();

    // Check that the values are not NaN
    expect(isNaN(result.carbonSavings)).toBe(false);
    expect(isNaN(result.energySavings)).toBe(false);
    expect(isNaN(result.waterSavings)).toBe(false);
  });

  it("should handle zero values correctly", () => {
    const result = calculateEnvironmentalImpact(0, 0, 0);

    expect(result.carbonSavings).toBe(0);
    expect(result.energySavings).toBe(0);
    expect(result.waterSavings).toBe(0);
  });

  it("should handle null monthly downloads", () => {
    const result = calculateEnvironmentalImpact(1000000, 3600, null);

    expect(result.carbonSavings).toBeGreaterThan(0);
    expect(result.energySavings).toBeGreaterThan(0);
    expect(result.waterSavings).toBeGreaterThan(0);
  });

  it("should handle very large values", () => {
    const result = calculateEnvironmentalImpact(1000000000, 3600, 1000000);

    expect(result.carbonSavings).toBeGreaterThan(0);
    expect(result.energySavings).toBeGreaterThan(0);
    expect(result.waterSavings).toBeGreaterThan(0);
  });
});
