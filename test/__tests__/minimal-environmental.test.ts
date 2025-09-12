import { jest } from "@jest/globals";

// Mock only what's absolutely necessary
jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
  stat: jest.fn(),
}));

jest.mock("node:path", () => ({
  join: jest.fn((...args: string[]) => args.join("/")),
  dirname: jest.fn((path: string) => path.split("/").slice(0, -1).join("/")),
  extname: jest.fn((path: string) => {
    const ext = path.split(".").pop();
    return ext ? `.${ext}` : "";
  }),
  basename: jest.fn((path: string) => path.split("/").pop() || ""),
  relative: jest.fn((from: string, to: string) => to.replace(from, "")),
}));

// Mock Intl and Date for consistent testing
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
import { calculateEnvironmentalImpact } from "../../src/helpers.js";

describe("Minimal Environmental Impact Tests", () => {
  it("should calculate environmental impact correctly", () => {
    const result = calculateEnvironmentalImpact(1000000, 3600, 1000000);

    console.log("Result:", {
      carbonSavings: result.carbonSavings,
      energySavings: result.energySavings,
      waterSavings: result.waterSavings,
      carbonIntensityUsed: result.carbonIntensityUsed,
      timeOfDayMultiplier: result.timeOfDayMultiplier,
    });

    expect(result.carbonSavings).toBeGreaterThan(0);
    expect(result.energySavings).toBeGreaterThan(0);
    expect(result.waterSavings).toBeGreaterThan(0);
    expect(result.carbonIntensityUsed).toBeDefined();
    expect(result.timeOfDayMultiplier).toBeDefined();
  });

  it("should handle zero values", () => {
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
});
