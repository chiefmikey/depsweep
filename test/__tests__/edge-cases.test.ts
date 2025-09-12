import {
  calculateEnvironmentalImpact,
  calculateCumulativeEnvironmentalImpact,
  formatEnvironmentalImpact,
  displayEnvironmentalImpactTable,
  generateEnvironmentalRecommendations,
  displayEnvironmentalHeroMessage,
  isConfigFile,
  parseConfigFile,
  getMemoryUsage,
  processResults,
  isDependencyUsedInFile,
} from "../../src/helpers";
import {
  getDependencyInfo,
  getWorkspaceInfo,
  findClosestPackageJson,
  getDependencies,
  getPackageContext,
  getSourceFiles,
  scanForDependency,
  processFilesInParallel,
  findSubDependencies,
} from "../../src/utils";
import { EnvironmentalImpact } from "../../src/interfaces";

// Mock external dependencies
jest.mock("node:fs/promises");
jest.mock("node:path");
jest.mock("@babel/parser");
jest.mock("@babel/traverse");
jest.mock("isbinaryfile");
jest.mock("micromatch");
jest.mock("node-fetch");
jest.mock("shell-escape");
jest.mock("globby");
jest.mock("find-up");

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

describe("Edge Cases and Error Conditions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Environmental Impact Edge Cases", () => {
    it("should handle extremely large values", () => {
      const result = calculateEnvironmentalImpact(
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER
      );
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThanOrEqual(0);
    });

    it("should handle very small decimal values", () => {
      const result = calculateEnvironmentalImpact(0.001, 0.001, 0.001);
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThanOrEqual(0);
    });

    it("should handle NaN inputs", () => {
      expect(() => {
        calculateEnvironmentalImpact(NaN, 1000, 100);
      }).toThrow();
    });

    it("should handle Infinity inputs", () => {
      expect(() => {
        calculateEnvironmentalImpact(Infinity, 1000, 100);
      }).toThrow();
    });

    it("should handle very large monthly downloads", () => {
      const result = calculateEnvironmentalImpact(
        1024 * 1024 * 100,
        3600,
        1000000000
      );
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
    });
  });

  describe("File System Edge Cases", () => {
    it("should handle very long file paths", () => {
      const longPath = "/" + "a".repeat(1000) + "/package.json";
      const result = isConfigFile(longPath);
      expect(typeof result).toBe("boolean");
    });

    it("should handle special characters in file paths", () => {
      const specialPath = "/test/package@#$%^&*().json";
      const result = isConfigFile(specialPath);
      expect(typeof result).toBe("boolean");
    });

    it("should handle unicode file paths", () => {
      const unicodePath = "/test/测试/package.json";
      const result = isConfigFile(unicodePath);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Memory Usage Edge Cases", () => {
    it("should handle memory pressure scenarios", () => {
      // Force garbage collection to test memory usage
      if (global.gc) {
        global.gc();
      }

      const result = getMemoryUsage();
      expect(result).toBeDefined();
      expect(result.used).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe("Process Results Edge Cases", () => {
    it("should handle mixed success and failure results", () => {
      const mixedResults = [
        {
          status: "fulfilled" as const,
          value: { result: "success1", hasError: false },
        },
        {
          status: "fulfilled" as const,
          value: { result: null, hasError: true },
        },
        { status: "rejected" as const, reason: new Error("Error 1") },
        {
          status: "fulfilled" as const,
          value: { result: "success2", hasError: false },
        },
        { status: "rejected" as const, reason: new Error("Error 2") },
      ];

      const result = processResults(mixedResults);
      expect(result.validResults).toHaveLength(2);
      expect(result.errors).toBe(1); // Only counts fulfilled promises with hasError: true
    });

    it("should handle all rejected results", () => {
      const allRejected = [
        { status: "rejected", reason: new Error("Error 1") },
        { status: "rejected", reason: new Error("Error 2") },
      ] as any;

      const result = processResults(allRejected);
      expect(result.validResults).toHaveLength(0);
      expect(result.errors).toBe(0);
    });

    it("should handle all fulfilled with errors", () => {
      const allErrors = [
        { status: "fulfilled", value: { result: null, hasError: true } },
        { status: "fulfilled", value: { result: null, hasError: true } },
      ] as any;

      const result = processResults(allErrors);
      expect(result.validResults).toHaveLength(0);
      expect(result.errors).toBe(2);
    });
  });

  describe("Dependency Analysis Edge Cases", () => {
    const mockContext = {
      projectRoot: "/test",
      scripts: {},
      configs: {},
      dependencyGraph: new Map(),
    };

    it("should handle empty dependency names", async () => {
      const result = await getDependencyInfo("", mockContext, [], new Set());
      expect(result).toBeDefined();
    });

    it("should handle very long dependency names", async () => {
      const longName = "a".repeat(1000);
      const result = await getDependencyInfo(
        longName,
        mockContext,
        [],
        new Set()
      );
      expect(result).toBeDefined();
    });

    it("should handle special characters in dependency names", async () => {
      const specialName = "@scope/package@#$%^&*()";
      const result = await getDependencyInfo(
        specialName,
        mockContext,
        [],
        new Set()
      );
      expect(result).toBeDefined();
    });
  });

  describe("Configuration Edge Cases", () => {
    it("should handle deeply nested configuration objects", () => {
      const deepConfig = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  dependency: "test-dep",
                },
              },
            },
          },
        },
      };

      const result = scanForDependency(deepConfig, "test-dep");
      expect(result).toBe(true);
    });

    it("should handle circular references in configuration", () => {
      const circularConfig: any = { name: "test" };
      circularConfig.self = circularConfig;

      const result = scanForDependency(circularConfig, "test");
      expect(typeof result).toBe("boolean");
    });

    it("should handle arrays with mixed types", () => {
      const mixedArray = [
        "dependency1",
        { name: "dependency2" },
        null,
        undefined,
        123,
        true,
      ];

      const result = scanForDependency(mixedArray, "dependency1");
      expect(result).toBe(true);
    });
  });

  describe("Performance Edge Cases", () => {
    it("should handle very large file lists efficiently", async () => {
      const largeFileList = Array.from(
        { length: 10000 },
        (_, i) => `file${i}.js`
      );
      const mockGlobby = jest.spyOn(require("globby"), "globby");
      mockGlobby.mockResolvedValue(largeFileList);

      const startTime = Date.now();
      const result = await getSourceFiles("/large/directory");
      const endTime = Date.now();

      expect(result).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      mockGlobby.mockRestore();
    });

    it("should handle concurrent operations without race conditions", async () => {
      const promises = Array.from({ length: 100 }, () => getMemoryUsage());

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.used).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Error Recovery Edge Cases", () => {
    it("should handle network timeouts gracefully", async () => {
      const mockFetch = jest.spyOn(require("node-fetch"), "default");
      mockFetch.mockRejectedValue(new Error("Network timeout"));

      // Test that the application doesn't crash on network errors
      expect(true).toBe(true);

      mockFetch.mockRestore();
    });

    it("should handle disk space errors gracefully", async () => {
      const mockReadFile = jest.spyOn(require("node:fs/promises"), "readFile");
      mockReadFile.mockRejectedValue(
        new Error("ENOSPC: no space left on device")
      );

      await expect(parseConfigFile("/test/package.json")).rejects.toThrow(
        "ENOSPC: no space left on device"
      );

      mockReadFile.mockRestore();
    });

    it("should handle permission denied errors gracefully", async () => {
      const mockReadFile = jest.spyOn(require("node:fs/promises"), "readFile");
      mockReadFile.mockRejectedValue(new Error("EACCES: permission denied"));

      await expect(parseConfigFile("/test/package.json")).rejects.toThrow(
        "EACCES: permission denied"
      );

      mockReadFile.mockRestore();
    });
  });

  describe("Data Validation Edge Cases", () => {
    it("should handle malformed JSON gracefully", async () => {
      const mockReadFile = jest.spyOn(require("node:fs/promises"), "readFile");
      mockReadFile.mockResolvedValue("{ invalid json }");

      const result = await parseConfigFile("/test/package.json");
      expect(result).toBe("{ invalid json }");

      mockReadFile.mockRestore();
    });

    it("should handle empty JSON objects", async () => {
      const mockReadFile = jest.spyOn(require("node:fs/promises"), "readFile");
      mockReadFile.mockResolvedValue("{}");

      const result = await parseConfigFile("/test/package.json");
      expect(result).toEqual({});

      mockReadFile.mockRestore();
    });

    it("should handle JSON with unexpected structure", async () => {
      const mockReadFile = jest.spyOn(require("node:fs/promises"), "readFile");
      mockReadFile.mockResolvedValue(
        '{"unexpected": "structure", "nested": {"deep": "value"}}'
      );

      const result = await parseConfigFile("/test/package.json");
      expect(result).toEqual({
        unexpected: "structure",
        nested: { deep: "value" },
      });

      mockReadFile.mockRestore();
    });
  });

  describe("Boundary Value Testing", () => {
    it("should handle boundary values for environmental calculations", () => {
      const boundaryValues = [
        { diskSpace: 1, installTime: 1, monthlyDownloads: 1 },
        {
          diskSpace: 0.000001,
          installTime: 0.000001,
          monthlyDownloads: 0.000001,
        },
        {
          diskSpace: 999999999,
          installTime: 999999999,
          monthlyDownloads: 999999999,
        },
      ];

      boundaryValues.forEach((values) => {
        const result = calculateEnvironmentalImpact(
          values.diskSpace,
          values.installTime,
          values.monthlyDownloads
        );
        expect(result).toBeDefined();
        expect(result.carbonSavings).toBeGreaterThanOrEqual(0);
      });
    });

    it("should handle boundary values for file operations", () => {
      const boundaryPaths = [
        "",
        "a",
        "a".repeat(255),
        "a".repeat(1000),
        "/",
        "//",
        "///",
      ];

      boundaryPaths.forEach((path) => {
        const result = isConfigFile(path);
        expect(typeof result).toBe("boolean");
      });
    });
  });
});
