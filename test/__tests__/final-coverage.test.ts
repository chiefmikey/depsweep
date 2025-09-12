import { jest } from "@jest/globals";

// Mock all dependencies
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

jest.mock("@babel/parser", () => ({
  parse: jest.fn(),
}));

jest.mock("@babel/traverse", () => ({
  default: jest.fn(),
}));

jest.mock("isbinaryfile", () => ({
  isBinaryFileSync: jest.fn(),
}));

jest.mock("micromatch", () => ({
  isMatch: jest.fn(),
}));

jest.mock("node-fetch", () => jest.fn());

jest.mock("shell-escape", () => jest.fn());

jest.mock("globby", () => ({
  globby: jest.fn(),
}));

jest.mock("find-up", () => ({
  findUp: jest.fn(),
}));

jest.mock("node:child_process", () => ({
  execSync: jest.fn(),
}));

jest.mock("chalk", () => {
  const mockChalk = (text: string) => text;
  mockChalk.red = jest.fn((text: string) => text);
  mockChalk.bold = jest.fn((text: string) => text);
  mockChalk.blue = jest.fn((text: string) => text);
  mockChalk.green = jest.fn((text: string) => text);
  mockChalk.yellow = jest.fn((text: string) => text);
  mockChalk.cyan = jest.fn((text: string) => text);
  mockChalk.magenta = jest.fn((text: string) => text);
  mockChalk.white = jest.fn((text: string) => text);
  mockChalk.gray = jest.fn((text: string) => text);

  // Support method chaining
  (mockChalk.blue as any).bold = jest.fn((text: string) => text);
  (mockChalk.green as any).bold = jest.fn((text: string) => text);
  (mockChalk.red as any).bold = jest.fn((text: string) => text);
  (mockChalk.yellow as any).bold = jest.fn((text: string) => text);
  (mockChalk.cyan as any).bold = jest.fn((text: string) => text);
  (mockChalk.magenta as any).bold = jest.fn((text: string) => text);
  (mockChalk.white as any).bold = jest.fn((text: string) => text);
  (mockChalk.gray as any).bold = jest.fn((text: string) => text);

  return mockChalk;
});

jest.mock("cli-table3", () => {
  return jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    toString: jest.fn(() => "mock table"),
  }));
});

jest.mock("../../src/constants.js", () => ({
  FILE_PATTERNS: {
    PACKAGE_JSON: "package.json",
    CONFIG_REGEX: /\.(config|rc)(\.|\b)/,
  },
  MESSAGES: {
    noPackageJson: "No package.json found",
  },
  ENVIRONMENTAL_CONSTANTS: {
    CARBON_INTENSITY: 0.5,
    WATER_PER_KWH: 2.5,
    TREE_CARBON_CAPACITY: 22,
    CAR_MILES_PER_KG_CO2: 0.4,
    NETWORK_ENERGY_PER_MB: 0.001,
    STORAGE_ENERGY_PER_GB: 0.002,
    EWASTE_ENERGY_PER_GB: 0.0005,
    EFFICIENCY_ENERGY_PER_HOUR: 0.1,
    SERVER_EFFICIENCY_ENERGY_PER_GB: 0.003,
    ENERGY_PER_GB: 0.072,
    STORAGE_ENERGY_PER_GB_YEAR: 0.00028,
    EWASTE_IMPACT_PER_GB: 0.0005,
    EFFICIENCY_IMPROVEMENT: 0.1,
    SERVER_UTILIZATION_IMPROVEMENT: 0.15,
  },
}));

// Import after mocking
import {
  calculateEnvironmentalImpact,
  validateInputs,
  calculateImpactStats,
  displayImpactTable,
  formatEnvironmentalImpact,
  displayEnvironmentalImpactTable,
  generateEnvironmentalRecommendations,
  displayEnvironmentalHeroMessage,
} from "../../src/helpers.js";
import {
  getDependencyInfo,
  getWorkspaceInfo,
  getTSConfig,
  findClosestPackageJson,
  getDependencies,
  getPackageContext,
  getSourceFiles,
  processFilesInParallel,
  findSubDependencies,
} from "../../src/utils.js";
import type { DependencyContext } from "../../src/interfaces.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findUp } from "find-up";
import { globby } from "globby";
import { execSync } from "node:child_process";
import chalk from "chalk";
import CliTable from "cli-table3";

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockFindUp = findUp as jest.MockedFunction<typeof findUp>;
const mockGlobby = globby as any;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockChalk = chalk as jest.Mocked<typeof chalk>;
const mockCliTable = CliTable as jest.MockedClass<typeof CliTable>;

describe("Final Coverage Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateInputs - Comprehensive Coverage", () => {
    it("should throw error for negative disk space", () => {
      expect(() => validateInputs(-1, 30, 1000)).toThrow(
        "Disk space cannot be negative"
      );
    });

    it("should throw error for negative install time", () => {
      expect(() => validateInputs(1024, -1, 1000)).toThrow(
        "Install time cannot be negative"
      );
    });

    it("should throw error for disk space exceeding MAX_SAFE_INTEGER", () => {
      expect(() =>
        validateInputs(Number.MAX_SAFE_INTEGER + 1, 30, 1000)
      ).toThrow("Disk space exceeds maximum safe integer");
    });

    it("should throw error for install time exceeding MAX_SAFE_INTEGER", () => {
      expect(() =>
        validateInputs(1024, Number.MAX_SAFE_INTEGER + 1, 1000)
      ).toThrow("Install time exceeds maximum safe integer");
    });

    it("should throw error for negative monthly downloads", () => {
      expect(() => validateInputs(1024, 30, -1)).toThrow(
        "Monthly downloads must be null or a non-negative number"
      );
    });

    it("should not throw for valid inputs", () => {
      expect(() => validateInputs(1024, 30, 1000)).not.toThrow();
      expect(() => validateInputs(1024, 30, null)).not.toThrow();
    });
  });

  describe("calculateEnvironmentalImpact - Comprehensive Coverage", () => {
    it("should handle zero inputs", () => {
      const result = calculateEnvironmentalImpact(0, 0, 1000);
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBe(0);
      expect(result.energySavings).toBe(0);
    });

    it("should handle normal inputs", () => {
      const result = calculateEnvironmentalImpact(1024, 30, 1000);
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
      expect(result.energySavings).toBeGreaterThan(0);
    });

    it("should handle null monthly downloads", () => {
      const result = calculateEnvironmentalImpact(1024, 30, null);
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
    });

    it("should handle very large inputs", () => {
      const result = calculateEnvironmentalImpact(
        Number.MAX_SAFE_INTEGER - 1,
        Number.MAX_SAFE_INTEGER - 1,
        1000000
      );
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
    });
  });

  describe("calculateImpactStats - Comprehensive Coverage", () => {
    it("should handle yearly data with 12+ months", () => {
      const yearlyData = {
        total: 1000,
        monthsFetched: 12,
        startDate: "2024-01-01",
      };
      const result = calculateImpactStats(1024, 30, 1000, yearlyData);
      expect(result).toHaveProperty("yearly");
      expect(result.yearly).toBeDefined();
    });

    it("should handle yearly data with less than 12 months", () => {
      const yearlyData = {
        total: 1000,
        monthsFetched: 6,
        startDate: "2024-01-01",
      };
      const result = calculateImpactStats(1024, 30, 1000, yearlyData);
      expect(result).not.toHaveProperty("yearly");
      expect(result).toHaveProperty("last_6_months");
    });

    it("should handle zero days count", () => {
      const yearlyData = {
        total: 0,
        monthsFetched: 0,
        startDate: "2024-01-01",
      };
      const result = calculateImpactStats(1024, 30, 1000, yearlyData);
      expect(result).toEqual({});
    });

    it("should handle zero total", () => {
      const yearlyData = {
        total: 0,
        monthsFetched: 12,
        startDate: "2024-01-01",
      };
      const result = calculateImpactStats(1024, 30, 1000, yearlyData);
      expect(result).toEqual({});
    });
  });

  describe("displayImpactTable - Comprehensive Coverage", () => {
    it("should create and display impact table", () => {
      const impactData = {
        "package-a": { installTime: "10.5", diskSpace: "1.2 MB" },
        "package-b": { installTime: "5.0", diskSpace: "500 KB" },
      };
      const totalInstallTime = 15.5;
      const totalDiskSpace = 1700000;

      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      displayImpactTable(impactData, totalInstallTime, totalDiskSpace);

      expect(mockCliTable).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle empty impact data", () => {
      const impactData = {};
      const totalInstallTime = 0;
      const totalDiskSpace = 0;

      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      displayImpactTable(impactData, totalInstallTime, totalDiskSpace);

      expect(mockCliTable).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should call customSort function when sorting impact data", () => {
      const impactData = {
        "package-b": { installTime: "20", diskSpace: "500MB" },
        "package-a": { installTime: "30", diskSpace: "1GB" },
      };
      const totalInstallTime = 50;
      const totalDiskSpace = 1500000000;

      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      displayImpactTable(impactData, totalInstallTime, totalDiskSpace);

      expect(mockCliTable).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle single package impact data", () => {
      const impactData = {
        "package-a": { installTime: "30", diskSpace: "1GB" },
      };
      const totalInstallTime = 30;
      const totalDiskSpace = 1000000000;

      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      displayImpactTable(impactData, totalInstallTime, totalDiskSpace);

      expect(mockCliTable).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle multiple packages with different sorting", () => {
      const impactData = {
        "package-c": { installTime: "10", diskSpace: "200MB" },
        "package-a": { installTime: "30", diskSpace: "1GB" },
        "package-b": { installTime: "20", diskSpace: "500MB" },
      };
      const totalInstallTime = 60;
      const totalDiskSpace = 1700000000;

      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      displayImpactTable(impactData, totalInstallTime, totalDiskSpace);

      expect(mockCliTable).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("formatEnvironmentalImpact - Comprehensive Coverage", () => {
    it("should format environmental impact with default precision", () => {
      const impact = {
        carbonSavings: 1.234567,
        energySavings: 2.345678,
        waterSavings: 3.456789,
        treesEquivalent: 4.56789,
        carMilesEquivalent: 5.678901,
        efficiencyGain: 6.789012,
        networkSavings: 7.890123,
        storageSavings: 8.901234,
      };

      const result = formatEnvironmentalImpact(impact);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should format environmental impact with default precision", () => {
      const impact = {
        carbonSavings: 1.234567,
        energySavings: 2.345678,
        waterSavings: 3.456789,
        treesEquivalent: 4.56789,
        carMilesEquivalent: 5.678901,
        efficiencyGain: 6.789012,
        networkSavings: 7.890123,
        storageSavings: 8.901234,
      };

      const result = formatEnvironmentalImpact(impact);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });
  });

  describe("displayEnvironmentalImpactTable - Comprehensive Coverage", () => {
    it("should display environmental impact table", () => {
      const impact = {
        carbonSavings: 1.234567,
        energySavings: 2.345678,
        waterSavings: 3.456789,
        treesEquivalent: 4.56789,
        carMilesEquivalent: 5.678901,
        efficiencyGain: 6.789012,
        networkSavings: 7.890123,
        storageSavings: 8.901234,
      };

      expect(() => displayEnvironmentalImpactTable(impact)).not.toThrow();
    });
  });

  describe("generateEnvironmentalRecommendations - Comprehensive Coverage", () => {
    it("should generate recommendations for significant impact", () => {
      const impact = {
        carbonSavings: 100,
        energySavings: 200,
        waterSavings: 300,
        treesEquivalent: 400,
        carMilesEquivalent: 500,
        efficiencyGain: 600,
        networkSavings: 700,
        storageSavings: 800,
      };

      const result = generateEnvironmentalRecommendations(impact, 5);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should generate recommendations for minimal impact", () => {
      const impact = {
        carbonSavings: 0.1,
        energySavings: 0.2,
        waterSavings: 0.3,
        treesEquivalent: 0.4,
        carMilesEquivalent: 0.5,
        efficiencyGain: 0.6,
        networkSavings: 0.7,
        storageSavings: 0.8,
      };

      const result = generateEnvironmentalRecommendations(impact, 3);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("displayEnvironmentalHeroMessage - Comprehensive Coverage", () => {
    it("should display hero message for significant impact", () => {
      const impact = {
        carbonSavings: 100,
        energySavings: 200,
        waterSavings: 300,
        treesEquivalent: 400,
        carMilesEquivalent: 500,
        efficiencyGain: 600,
        networkSavings: 700,
        storageSavings: 800,
      };

      expect(() => displayEnvironmentalHeroMessage(impact)).not.toThrow();
    });

    it("should display hero message for zero impact", () => {
      const impact = {
        carbonSavings: 0,
        energySavings: 0,
        waterSavings: 0,
        treesEquivalent: 0,
        carMilesEquivalent: 0,
        efficiencyGain: 0,
        networkSavings: 0,
        storageSavings: 0,
      };

      expect(() => displayEnvironmentalHeroMessage(impact)).not.toThrow();
    });
  });

  describe("getDependencies - Comprehensive Coverage", () => {
    it("should get dependencies from package.json", async () => {
      const mockPackageJson = {
        dependencies: {
          "package-a": "^1.0.0",
          "package-b": "^2.0.0",
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await getDependencies("/test/package.json");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain("package-a");
      expect(result).toContain("package-b");
    });

    it("should handle missing dependencies", async () => {
      const mockPackageJson = {
        name: "test-package",
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await getDependencies("/test/package.json");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    it("should handle file read errors", async () => {
      mockFs.readFile.mockRejectedValue(new Error("File not found"));

      await expect(getDependencies("/test/package.json")).rejects.toThrow();
    });
  });

  describe("getPackageContext - Comprehensive Coverage", () => {
    it("should get package context", async () => {
      const mockPackageJson = {
        name: "test-package",
        dependencies: {
          "package-a": "^1.0.0",
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      mockPath.dirname.mockReturnValue("/test");
      mockGlobby.mockResolvedValue([
        "/test/src/index.js",
        "/test/src/utils.js",
      ]);

      const result = await getPackageContext("/test/package.json");

      expect(result).toBeDefined();
      expect(result.projectRoot).toBe("/test");
    });

    it("should handle missing package.json", async () => {
      mockFs.readFile.mockRejectedValue(new Error("File not found"));

      await expect(getPackageContext("/test/package.json")).rejects.toThrow();
    });
  });

  describe("getSourceFiles - Comprehensive Coverage", () => {
    it("should get source files using globby", async () => {
      mockGlobby.mockResolvedValue([
        "/test/src/index.js",
        "/test/src/utils.js",
      ]);

      const result = await getSourceFiles("/test", ["**/*.js"]);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it("should handle globby errors", async () => {
      mockGlobby.mockRejectedValue(new Error("Globby error"));

      await expect(getSourceFiles("/test", ["**/*.js"])).rejects.toThrow();
    });

    it("should handle empty results", async () => {
      mockGlobby.mockResolvedValue([]);

      const result = await getSourceFiles("/test", ["**/*.js"]);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe("processFilesInParallel - Comprehensive Coverage", () => {
    it("should process files in parallel", async () => {
      const files = ["/test/file1.js", "/test/file2.js"];
      const dependency = "test-dependency";
      const context = {
        projectRoot: "/test",
        scripts: {},
        configs: {},
        dependencyGraph: new Map(),
      } as DependencyContext;

      const result = await processFilesInParallel(files, dependency, context);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle empty file list", async () => {
      const files: string[] = [];
      const dependency = "test-dependency";
      const context = {
        projectRoot: "/test",
        scripts: {},
        configs: {},
        dependencyGraph: new Map(),
      } as DependencyContext;

      const result = await processFilesInParallel(files, dependency, context);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("should handle progress callback", async () => {
      const files = ["/test/file1.js", "/test/file2.js"];
      const dependency = "test-dependency";
      const context = {
        projectRoot: "/test",
        scripts: {},
        configs: {},
        dependencyGraph: new Map(),
      } as DependencyContext;
      const progressCallback = jest.fn();

      const result = await processFilesInParallel(
        files,
        dependency,
        context,
        progressCallback
      );

      expect(result).toBeDefined();
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe("findSubDependencies - Comprehensive Coverage", () => {
    it("should find sub dependencies from dependency context", () => {
      const dependencyGraph = new Map([
        ["package-a", new Set(["package-b", "package-c"])],
        ["package-b", new Set(["package-d"])],
        ["package-c", new Set(["package-e"])],
      ]);

      const context = {
        projectRoot: "/test",
        scripts: {},
        configs: {},
        dependencyGraph,
      } as DependencyContext;

      const result = findSubDependencies("package-a", context);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain("package-b");
      expect(result).toContain("package-c");
    });

    it("should return empty array when no sub dependencies", () => {
      const dependencyGraph = new Map([
        ["package-a", new Set([])],
        ["package-b", new Set(["package-c"])],
      ]);

      const context = {
        projectRoot: "/test",
        scripts: {},
        configs: {},
        dependencyGraph,
      } as DependencyContext;

      const result = findSubDependencies("package-a", context);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it("should handle missing dependency in graph", () => {
      const dependencyGraph = new Map([
        ["package-a", new Set(["package-b"])],
        ["package-b", new Set(["package-c"])],
      ]);

      const context = {
        projectRoot: "/test",
        scripts: {},
        configs: {},
        dependencyGraph,
      } as DependencyContext;

      const result = findSubDependencies("package-x", context);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
});
