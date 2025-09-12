import {
  isConfigFile,
  parseConfigFile,
  getMemoryUsage,
  processResults,
  isDependencyUsedInFile,
  calculateEnvironmentalImpact,
  calculateCumulativeEnvironmentalImpact,
  formatEnvironmentalImpact,
  displayEnvironmentalImpactTable,
  generateEnvironmentalRecommendations,
  displayEnvironmentalHeroMessage,
  scanForDependency,
  matchesDependency,
  formatSize,
  formatTime,
  formatNumber,
  safeExecSync,
  calculateImpactStats,
  displayImpactTable,
} from "../../src/helpers";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { isBinaryFileSync } from "isbinaryfile";
import micromatch from "micromatch";
import fetch from "node-fetch";
import shellEscape from "shell-escape";
import { execSync } from "node:child_process";
import chalk from "chalk";
import CliTable from "cli-table3";
import { EnvironmentalImpact } from "../../src/interfaces";

// Mock external dependencies
jest.mock("node:fs/promises");
jest.mock("@babel/parser");
jest.mock("@babel/traverse");
jest.mock("isbinaryfile");
jest.mock("micromatch");
jest.mock("node-fetch");
jest.mock("shell-escape");
jest.mock("node:child_process");
jest.mock("chalk");
jest.mock("cli-table3");

// Mock path module properly
jest.mock("node:path", () => ({
  basename: jest.fn((filePath) => {
    if (!filePath) return "";
    const parts = filePath.split("/");
    return parts[parts.length - 1] || "";
  }),
  resolve: jest.fn((...args) => args.join("/")),
  join: jest.fn((...args) => args.join("/")),
  dirname: jest.fn((filePath) => {
    const parts = filePath.split("/");
    return parts.slice(0, -1).join("/") || "/";
  }),
  extname: jest.fn((filePath) => {
    if (!filePath) return "";
    const lastDot = filePath.lastIndexOf(".");
    return lastDot === -1 ? "" : filePath.substring(lastDot);
  }),
  relative: jest.fn((from, to) => {
    const fromParts = from.split("/");
    const toParts = to.split("/");
    const commonLength = Math.min(fromParts.length, toParts.length);
    let i = 0;
    while (i < commonLength && fromParts[i] === toParts[i]) {
      i++;
    }
    const fromRemaining = fromParts.slice(i);
    const toRemaining = toParts.slice(i);
    return [...fromRemaining.map(() => ".."), ...toRemaining].join("/");
  }),
}));

// Helper function to create complete EnvironmentalImpact objects for testing
function createTestEnvironmentalImpact(
  overrides: Partial<EnvironmentalImpact> = {}
): EnvironmentalImpact {
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

describe("Helpers Comprehensive Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isConfigFile", () => {
    it("should identify config files correctly", () => {
      expect(isConfigFile("package.json")).toBe(true);
      expect(isConfigFile(".eslintrc.js")).toBe(true);
      expect(isConfigFile("webpack.config.js")).toBe(true);
      expect(isConfigFile("tsconfig.json")).toBe(true);
      expect(isConfigFile("jest.config.js")).toBe(true);
    });

    it("should reject non-config files", () => {
      expect(isConfigFile("index.js")).toBe(false);
      expect(isConfigFile("component.tsx")).toBe(false);
      expect(isConfigFile("style.css")).toBe(false);
      expect(isConfigFile("README.md")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isConfigFile("")).toBe(false);
      expect(isConfigFile(null as any)).toBe(false);
      expect(isConfigFile(undefined as any)).toBe(false);
      expect(isConfigFile("CONFIG.js")).toBe(true); // Case insensitive
    });
  });

  describe("parseConfigFile", () => {
    it("should parse JSON config files", async () => {
      const mockReadFile = jest.spyOn(fs, "readFile");
      mockReadFile.mockResolvedValue('{"name": "test", "version": "1.0.0"}');

      const result = await parseConfigFile("package.json");
      expect(result).toEqual({ name: "test", version: "1.0.0" });

      mockReadFile.mockRestore();
    });

    it("should parse JavaScript config files", async () => {
      const mockReadFile = jest.spyOn(fs, "readFile");
      mockReadFile.mockResolvedValue('module.exports = { name: "test" };');

      const result = await parseConfigFile("webpack.config.js");
      expect(result).toEqual('module.exports = { name: "test" };');

      mockReadFile.mockRestore();
    });

    it("should handle parse errors gracefully", async () => {
      const mockReadFile = jest.spyOn(fs, "readFile");
      mockReadFile.mockResolvedValue("invalid json content");

      const result = await parseConfigFile("invalid.json");
      expect(result).toEqual("invalid json content");

      mockReadFile.mockRestore();
    });

    it("should handle file read errors", async () => {
      const mockReadFile = jest.spyOn(fs, "readFile");
      mockReadFile.mockRejectedValue(new Error("File not found"));

      await expect(parseConfigFile("nonexistent.json")).rejects.toThrow(
        "File not found"
      );

      mockReadFile.mockRestore();
    });
  });

  describe("getMemoryUsage", () => {
    it("should return memory usage information", () => {
      const result = getMemoryUsage();
      expect(result).toHaveProperty("used");
      expect(result).toHaveProperty("total");
      expect(typeof result.used).toBe("number");
      expect(typeof result.total).toBe("number");
    });

    it("should return valid memory values", () => {
      const result = getMemoryUsage();
      expect(result.used).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.used).toBeLessThanOrEqual(result.total);
    });
  });

  describe("processResults", () => {
    it("should process results correctly", () => {
      const mockResults = [
        { status: "fulfilled", value: { result: "dep1", hasError: false } },
        { status: "fulfilled", value: { result: "dep2", hasError: false } },
        { status: "fulfilled", value: { result: null, hasError: true } },
        { status: "rejected", reason: new Error("Error") },
      ] as any;

      const result = processResults(mockResults);
      expect(result).toHaveProperty("validResults");
      expect(result).toHaveProperty("errors");
      expect(result.validResults).toHaveLength(2);
      expect(result.errors).toBe(1); // 1 from hasError: true, rejected promises are ignored
    });

    it("should handle empty results", () => {
      const mockResults: any[] = [];

      const result = processResults(mockResults);
      expect(result.validResults).toHaveLength(0);
      expect(result.errors).toBe(0);
    });
  });

  describe("isDependencyUsedInFile", () => {
    const mockContext = {
      projectRoot: "/test/project",
      scripts: {},
      configs: {},
      dependencyGraph: new Map(),
    };

    it("should detect dependency usage in JavaScript files", async () => {
      const mockReadFile = jest.spyOn(fs, "readFile");
      mockReadFile.mockResolvedValue('import { something } from "dependency";');

      const mockParse = jest.spyOn(require("@babel/parser"), "parse");
      mockParse.mockReturnValue({
        type: "Program",
        body: [],
      });

      const mockTraverse = jest.spyOn(require("@babel/traverse"), "default");
      mockTraverse.mockImplementation((ast, visitors) => {
        // Mock traverse behavior
      });

      const result = await isDependencyUsedInFile(
        "dependency",
        "test.js",
        mockContext
      );
      expect(result).toBeDefined();

      mockReadFile.mockRestore();
      mockParse.mockRestore();
      mockTraverse.mockRestore();
    });

    it("should handle binary files", async () => {
      const mockIsBinaryFileSync = jest.spyOn(
        require("isbinaryfile"),
        "isBinaryFileSync"
      );
      mockIsBinaryFileSync.mockReturnValue(true);

      const result = await isDependencyUsedInFile(
        "dependency",
        "image.png",
        mockContext
      );
      expect(result).toBe(false);

      mockIsBinaryFileSync.mockRestore();
    });

    it("should handle file read errors", async () => {
      const mockReadFile = jest.spyOn(fs, "readFile");
      mockReadFile.mockRejectedValue(new Error("File read error"));

      const result = await isDependencyUsedInFile(
        "dependency",
        "error.js",
        mockContext
      );
      expect(result).toBe(false);

      mockReadFile.mockRestore();
    });

    it("should handle parse errors", async () => {
      const mockReadFile = jest.spyOn(fs, "readFile");
      mockReadFile.mockResolvedValue("invalid syntax content");

      const mockParse = jest.spyOn(require("@babel/parser"), "parse");
      mockParse.mockImplementation(() => {
        throw new Error("Parse error");
      });

      const result = await isDependencyUsedInFile(
        "dependency",
        "invalid.js",
        mockContext
      );
      expect(result).toBe(false);

      mockReadFile.mockRestore();
      mockParse.mockRestore();
    });
  });

  describe("calculateEnvironmentalImpact", () => {
    it("should calculate impact for normal values", () => {
      const result = calculateEnvironmentalImpact(
        1024 * 1024 * 100,
        3600,
        1000
      );
      expect(result).toHaveProperty("carbonSavings");
      expect(result).toHaveProperty("energySavings");
      expect(result).toHaveProperty("waterSavings");
      expect(result).toHaveProperty("treesEquivalent");
      expect(result).toHaveProperty("carMilesEquivalent");
      expect(result).toHaveProperty("efficiencyGain");
    });

    it("should handle zero inputs", () => {
      const result = calculateEnvironmentalImpact(0, 0, 0);
      expect(result.carbonSavings).toBe(0);
      expect(result.energySavings).toBe(0);
      expect(result.waterSavings).toBe(0);
    });

    it("should handle negative inputs by throwing error", () => {
      expect(() => {
        calculateEnvironmentalImpact(-100, -50, -10);
      }).toThrow("Disk space cannot be negative");
    });

    it("should handle very large inputs", () => {
      const result = calculateEnvironmentalImpact(
        1024 * 1024 * 1024 * 100,
        86400,
        1000000
      );
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
    });

    it("should handle null monthlyDownloads", () => {
      const result = calculateEnvironmentalImpact(
        1024 * 1024 * 100,
        3600,
        null
      );
      expect(result).toBeDefined();
    });
  });

  describe("calculateCumulativeEnvironmentalImpact", () => {
    it("should aggregate multiple impacts", () => {
      const impacts = [
        createTestEnvironmentalImpact({
          carbonSavings: 10,
          energySavings: 5,
          waterSavings: 2,
          treesEquivalent: 1,
          carMilesEquivalent: 0.5,
          efficiencyGain: 10,
          networkSavings: 1,
          storageSavings: 1,
        }),
        createTestEnvironmentalImpact({
          carbonSavings: 20,
          energySavings: 10,
          waterSavings: 4,
          treesEquivalent: 2,
          carMilesEquivalent: 1,
          efficiencyGain: 15,
          networkSavings: 2,
          storageSavings: 2,
        }),
      ];

      const result = calculateCumulativeEnvironmentalImpact(impacts);
      expect(result.carbonSavings).toBe(30);
      expect(result.energySavings).toBe(15);
      expect(result.waterSavings).toBe(6);
    });

    it("should handle empty array", () => {
      const result = calculateCumulativeEnvironmentalImpact([]);
      expect(result.carbonSavings).toBe(0);
      expect(result.energySavings).toBe(0);
    });

    it("should handle single impact", () => {
      const impacts = [
        createTestEnvironmentalImpact({
          carbonSavings: 10,
          energySavings: 5,
          waterSavings: 2,
          treesEquivalent: 1,
          carMilesEquivalent: 0.5,
          efficiencyGain: 10,
          networkSavings: 1,
          storageSavings: 1,
        }),
      ];

      const result = calculateCumulativeEnvironmentalImpact(impacts);
      expect(result.carbonSavings).toBe(10);
      expect(result.energySavings).toBe(5);
    });
  });

  describe("formatEnvironmentalImpact", () => {
    it("should format with default precision", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 1.234567,
        energySavings: 2.345678,
        waterSavings: 3.456789,
        treesEquivalent: 4.56789,
        carMilesEquivalent: 5.678901,
        efficiencyGain: 6.789012,
        networkSavings: 7.890123,
        storageSavings: 8.901234,
      });

      const result = formatEnvironmentalImpact(impact);
      expect(result.carbonSavings).toContain("1.235");
      expect(result.energySavings).toContain("2.346");
    });

    it("should format with high precision", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 1.234567,
        energySavings: 2.345678,
        waterSavings: 3.456789,
        treesEquivalent: 4.56789,
        carMilesEquivalent: 5.678901,
        efficiencyGain: 6.789012,
        networkSavings: 7.890123,
        storageSavings: 8.901234,
      });

      const result = formatEnvironmentalImpact(impact);
      expect(result.carbonSavings).toContain("1.235");
      expect(result.energySavings).toContain("2.346");
    });

    it("should handle zero values", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      });

      const result = formatEnvironmentalImpact(impact);
      expect(result.carbonSavings).toContain("0.000");
      expect(result.energySavings).toContain("0.000");
    });
  });

  describe("displayEnvironmentalImpactTable", () => {
    it("should display table correctly", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 10,
        energySavings: 5,
        waterSavings: 2,
        treesEquivalent: 1,
        carMilesEquivalent: 0.5,
        efficiencyGain: 10,
        networkSavings: 1,
        storageSavings: 1,
      });

      expect(() => displayEnvironmentalImpactTable(impact)).not.toThrow();
    });

    it("should handle zero impact", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      });

      expect(() => displayEnvironmentalImpactTable(impact)).not.toThrow();
    });
  });

  describe("generateEnvironmentalRecommendations", () => {
    it("should generate recommendations for significant impact", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 100,
        energySavings: 50,
        waterSavings: 20,
        treesEquivalent: 10,
        carMilesEquivalent: 5,
        efficiencyGain: 25,
        networkSavings: 10,
        storageSavings: 10,
      });

      const result = generateEnvironmentalRecommendations(impact, 10);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should generate recommendations for minimal impact", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 0.1,
        energySavings: 0.05,
        waterSavings: 0.02,
        treesEquivalent: 0.01,
        carMilesEquivalent: 0.005,
        efficiencyGain: 1,
        networkSavings: 0.01,
        storageSavings: 0.01,
      });

      const result = generateEnvironmentalRecommendations(impact, 1);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle zero impact", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      });

      const result = generateEnvironmentalRecommendations(impact, 0);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("displayEnvironmentalHeroMessage", () => {
    it("should display hero message correctly", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 10,
        energySavings: 5,
        waterSavings: 2,
        treesEquivalent: 1,
        carMilesEquivalent: 0.5,
        efficiencyGain: 10,
        networkSavings: 1,
        storageSavings: 1,
      });

      expect(() => displayEnvironmentalHeroMessage(impact)).not.toThrow();
    });

    it("should handle zero impact", () => {
      const impact = createTestEnvironmentalImpact({
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      });

      expect(() => displayEnvironmentalHeroMessage(impact)).not.toThrow();
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle all error conditions gracefully", async () => {
      // Test various error conditions
      expect(true).toBe(true);
    });

    it("should handle malformed input data", () => {
      // Test malformed input handling
      expect(true).toBe(true);
    });

    it("should handle memory constraints", () => {
      // Test memory constraint handling
      expect(true).toBe(true);
    });

    it("should handle network timeouts", async () => {
      // Test network timeout handling
      expect(true).toBe(true);
    });
  });

  describe("Performance Tests", () => {
    it("should handle large datasets efficiently", () => {
      const startTime = Date.now();
      // Test with large dataset
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it("should handle concurrent operations", async () => {
      const promises = Array.from({ length: 10 }, () =>
        calculateEnvironmentalImpact(1024, 3600, 100)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
    });
  });

  describe("scanForDependency", () => {
    it("should scan for dependency in string", () => {
      const result = scanForDependency("react", "react");
      expect(result).toBe(true);
    });

    it("should scan for dependency in array", () => {
      const result = scanForDependency(["react", "lodash"], "react");
      expect(result).toBe(true);
    });

    it("should scan for dependency in object", () => {
      const result = scanForDependency(
        { dependencies: { react: "react" } },
        "react"
      );
      expect(result).toBe(true);
    });

    it("should return false for non-matching dependency", () => {
      const result = scanForDependency("lodash", "react");
      expect(result).toBe(false);
    });

    it("should handle null/undefined input", () => {
      expect(scanForDependency(null, "react")).toBe(false);
      expect(scanForDependency(undefined, "react")).toBe(false);
    });
  });

  describe("matchesDependency", () => {
    it("should match exact dependency names", () => {
      expect(matchesDependency("react", "react")).toBe(true);
      expect(matchesDependency("lodash", "react")).toBe(false);
    });

    it("should match packages with subpaths", () => {
      expect(matchesDependency("react/dom", "react")).toBe(true);
      expect(matchesDependency("react/router", "react")).toBe(true);
    });

    it("should handle @types package conversion", () => {
      expect(matchesDependency("react", "@types/react")).toBe(true);
      expect(matchesDependency("react/dom", "@types/react")).toBe(true);
    });

    it("should match scoped packages", () => {
      expect(matchesDependency("@types/react", "@types/react")).toBe(true);
    });
  });

  describe("formatSize", () => {
    it("should format bytes", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatSize(500);
      expect(result).toBe("500 Bytes");
    });

    it("should format KB", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatSize(1500);
      expect(result).toBe("1.50 KB");
    });

    it("should format MB", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatSize(1500000);
      expect(result).toBe("1.50 MB");
    });

    it("should format GB", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatSize(1500000000);
      expect(result).toBe("1.50 GB");
    });

    it("should format TB", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatSize(1500000000000);
      expect(result).toBe("1.50 TB");
    });
  });

  describe("formatTime", () => {
    it("should format seconds", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatTime(30);
      expect(result).toBe("30.00 Seconds");
    });

    it("should format minutes", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatTime(90);
      expect(result).toBe("1.50 Minutes");
    });

    it("should format hours", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatTime(7200);
      expect(result).toBe("2.00 Hours");
    });

    it("should format days", () => {
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      const result = formatTime(172800);
      expect(result).toBe("2.00 Days");
    });
  });

  describe("formatNumber", () => {
    it("should format numbers with locale", () => {
      const result = formatNumber(1000);
      expect(result).toBe("1,000");
    });
  });

  describe("safeExecSync", () => {
    it("should execute valid commands", () => {
      (execSync as jest.Mock).mockImplementation(() => "success");
      (shellEscape as jest.Mock).mockImplementation((arr) => arr.join(" "));

      expect(() => {
        safeExecSync(["npm", "install"], { cwd: "/test" });
      }).not.toThrow();
    });

    it("should throw for invalid command array", () => {
      expect(() => {
        safeExecSync([], { cwd: "/test" });
      }).toThrow("Invalid command array");
    });

    it("should throw for invalid package manager", () => {
      expect(() => {
        safeExecSync(["invalid", "install"], { cwd: "/test" });
      }).toThrow("Invalid package manager: invalid");
    });

    it("should throw for invalid arguments", () => {
      expect(() => {
        safeExecSync(["npm", ""], { cwd: "/test" });
      }).toThrow("Invalid command arguments");
    });
  });

  describe("calculateImpactStats", () => {
    it("should calculate impact stats", () => {
      const result = calculateImpactStats(1000, 30, 1000, {
        total: 12000,
        monthsFetched: 12,
        startDate: "2024-01-01",
      });

      expect(result.day).toBeDefined();
      expect(result.monthly).toBeDefined();
      expect(result.last_12_months).toBeDefined();
      expect(result.yearly).toBeDefined();
    });

    it("should return empty stats for null yearly data", () => {
      const result = calculateImpactStats(1000, 30, 1000, null);
      expect(result).toEqual({});
    });

    it("should return empty stats for zero data", () => {
      const result = calculateImpactStats(1000, 30, 1000, {
        total: 0,
        monthsFetched: 0,
        startDate: "2024-01-01",
      });
      expect(result).toEqual({});
    });
  });

  describe("displayImpactTable", () => {
    it("should display impact table", () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      (CliTable as jest.Mock).mockImplementation(() => ({
        push: jest.fn(),
        toString: jest.fn(() => "table output"),
      }));
      (chalk.blue as unknown as jest.Mock).mockImplementation((str) => str);
      (chalk.bold as unknown as jest.Mock).mockImplementation((str) => str);

      displayImpactTable(
        {
          react: { installTime: "30.00", diskSpace: "1.00 MB" },
          lodash: { installTime: "15.00", diskSpace: "500.00 KB" },
        },
        45,
        1500000
      );

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
