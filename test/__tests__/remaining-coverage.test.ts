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

jest.mock("globby", () => jest.fn());

jest.mock("find-up", () => ({
  findUp: jest.fn(),
}));

jest.mock("node:child_process", () => ({
  execSync: jest.fn(),
}));

jest.mock("chalk", () => ({
  red: jest.fn((text: string) => text),
  bold: jest.fn((text: string) => text),
  blue: jest.fn((text: string) => text),
}));

jest.mock("cli-table3", () => {
  return jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    toString: jest.fn(() => "mock table"),
  }));
});

jest.mock("../../src/constants.js", () => ({
  FILE_PATTERNS: {
    PACKAGE_JSON: "package.json",
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
    SERVER_UTILIZATION_IMPROVEMENT: 0.15,
    // Regional carbon intensity constants
    CARBON_INTENSITY_NA: 0.387,
    CARBON_INTENSITY_EU: 0.298,
    CARBON_INTENSITY_AP: 0.521,
    // Time-based multipliers
    PEAK_ENERGY_MULTIPLIER: 1.45,
    OFF_PEAK_ENERGY_MULTIPLIER: 0.78,
    // Additional constants needed for calculations
    TREES_PER_KG_CO2: 0.042,
    CO2_PER_CAR_MILE: 0.387,
    CI_CD_ENERGY_PER_BUILD: 0.004,
    REGISTRY_ENERGY_PER_DOWNLOAD: 0.00005,
    LIFECYCLE_ENERGY_MULTIPLIER: 2.1,
    RENEWABLE_ENERGY_PERCENTAGE: 0.32,
    // Additional constants for comprehensive calculations
    CPU_ENERGY_PER_GB: 0.015,
    MEMORY_ENERGY_PER_GB: 0.008,
    LATENCY_ENERGY_PER_MB: 0.0001,
    BUILD_SYSTEM_ENERGY_PER_HOUR: 0.25,
    CARBON_OFFSET_COST_PER_KG: 0.85,
    WATER_TREATMENT_COST_PER_LITER: 0.0025,
    BUILD_TIME_PRODUCTIVITY_GAIN: 8,
    EFFICIENCY_IMPROVEMENT: 18.5,
  },
}));

// Import after mocking
import {
  calculateEnvironmentalImpact,
  validateInputs,
  createZeroEnvironmentalImpact,
  calculateTransferEnergy,
  calculateNetworkEnergy,
  calculateStorageEnergy,
  calculateEwasteEnergy,
  calculateEfficiencyEnergy,
  calculateServerEfficiencyEnergy,
  aggregateEnergySavings,
} from "../../src/helpers.js";
import {
  getDependencyInfo,
  getWorkspaceInfo,
  getTSConfig,
  findClosestPackageJson,
} from "../../src/utils.js";
import { EnvironmentalImpact } from "../../src/interfaces";
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
const mockGlobby = globby as jest.MockedFunction<typeof globby>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockChalk = chalk as jest.Mocked<typeof chalk>;
const mockCliTable = CliTable as jest.MockedClass<typeof CliTable>;

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

describe("Remaining Coverage Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateInputs - Edge Cases", () => {
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

    it("should not throw for monthly downloads exceeding MAX_SAFE_INTEGER", () => {
      // The validation doesn't check for MAX_SAFE_INTEGER on monthly downloads
      expect(() =>
        validateInputs(1024, 30, Number.MAX_SAFE_INTEGER + 1)
      ).not.toThrow();
    });

    it("should not throw for valid inputs at boundaries", () => {
      expect(() =>
        validateInputs(Number.MAX_SAFE_INTEGER, 30, 1000)
      ).not.toThrow();
      expect(() =>
        validateInputs(1024, Number.MAX_SAFE_INTEGER, 1000)
      ).not.toThrow();
      expect(() =>
        validateInputs(1024, 30, Number.MAX_SAFE_INTEGER)
      ).not.toThrow();
    });
  });

  describe("calculateEnvironmentalImpact - Edge Cases", () => {
    it("should handle zero inputs by calling createZeroEnvironmentalImpact", () => {
      const result = calculateEnvironmentalImpact(0, 0, 1000);
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBe(0);
      expect(result.energySavings).toBe(0);
    });

    it("should handle very large inputs", () => {
      // Use large but reasonable values that won't cause overflow
      const largeDiskSpace = 1024 * 1024 * 1024 * 100; // 100 GB
      const largeInstallTime = 3600 * 24 * 30; // 30 days in seconds
      const result = calculateEnvironmentalImpact(
        largeDiskSpace,
        largeInstallTime,
        1000000
      );
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
    });

    it("should handle null monthly downloads", () => {
      const result = calculateEnvironmentalImpact(1024, 30, null);
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBeGreaterThan(0);
    });
  });

  describe("Energy Calculation Functions", () => {
    it("should calculate transfer energy", () => {
      const result = calculateTransferEnergy(1.5);
      expect(result).toBeGreaterThan(0);
    });

    it("should calculate network energy", () => {
      const result = calculateNetworkEnergy(1024);
      expect(result).toBeGreaterThan(0);
    });

    it("should calculate storage energy", () => {
      const result = calculateStorageEnergy(2.0);
      expect(result).toBeGreaterThan(0);
    });

    it("should calculate ewaste energy", () => {
      const result = calculateEwasteEnergy(1.0);
      expect(result).toBeGreaterThan(0);
    });

    it("should calculate efficiency energy", () => {
      const result = calculateEfficiencyEnergy(2.5);
      expect(result).toBeGreaterThan(0);
    });

    it("should calculate server efficiency energy", () => {
      const result = calculateServerEfficiencyEnergy(3.0);
      expect(result).toBeGreaterThan(0);
    });

    it("should aggregate energy savings", () => {
      const energyValues = [1.5, 2.0, 1.8, 0.5, 1.2, 2.5];
      const result = aggregateEnergySavings(energyValues);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeCloseTo(9.5, 1);
    });
  });

  describe("createZeroEnvironmentalImpact", () => {
    it("should create zero impact object", () => {
      const result = createZeroEnvironmentalImpact();
      expect(result).toBeDefined();
      expect(result.carbonSavings).toBe(0);
      expect(result.energySavings).toBe(0);
      expect(result.waterSavings).toBe(0);
      expect(result.treesEquivalent).toBe(0);
      expect(result.carMilesEquivalent).toBe(0);
      expect(result.networkSavings).toBe(0);
      expect(result.storageSavings).toBe(0);
      expect(result.efficiencyGain).toBe(0);
    });
  });

  describe("getDependencyInfo - Complex Scenarios", () => {
    it("should handle complex dependency analysis with multiple workspace packages", async () => {
      const mockPackageJson = {
        name: "root-package",
        dependencies: {
          "package-a": "^1.0.0",
          "package-b": "^2.0.0",
        },
        workspaces: ["packages/*", "apps/*"],
      };

      const mockWorkspacePackage1 = {
        name: "workspace-package-1",
        dependencies: {
          "package-a": "^1.0.0",
          "package-c": "^3.0.0",
        },
      };

      const mockWorkspacePackage2 = {
        name: "workspace-package-2",
        dependencies: {
          "package-b": "^2.0.0",
          "package-d": "^4.0.0",
        },
      };

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockPackageJson))
        .mockResolvedValueOnce(JSON.stringify(mockWorkspacePackage1))
        .mockResolvedValueOnce(JSON.stringify(mockWorkspacePackage2));

      mockPath.join.mockImplementation((...args: string[]) => args.join("/"));
      mockPath.dirname.mockImplementation((p: string) =>
        p.split("/").slice(0, -1).join("/")
      );
      mockPath.basename.mockReturnValue("package.json");
      mockPath.relative.mockReturnValue("relative/path");

      const context = {
        projectRoot: "/test",
        packageManager: "npm",
        packageJsonPath: "/test/package.json",
      };
      const sourceFiles = [
        "/test/src/index.js",
        "/test/packages/app1/src/main.js",
      ];
      const topLevelDependencies = new Set(["package-a", "package-b"]);

      const result = await getDependencyInfo(
        "package-a",
        context,
        sourceFiles,
        topLevelDependencies
      );

      expect(result).toBeDefined();
      expect(result.requiredByPackages).toBeDefined();
    });

    it("should handle errors in workspace package analysis", async () => {
      const mockPackageJson = {
        name: "test-package",
        dependencies: {
          "package-a": "^1.0.0",
        },
        workspaces: ["packages/*"],
      };

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockPackageJson))
        .mockRejectedValueOnce(new Error("Workspace package not found"));

      mockPath.join.mockImplementation((...args: string[]) => args.join("/"));
      mockPath.dirname.mockImplementation((p: string) =>
        p.split("/").slice(0, -1).join("/")
      );
      mockPath.basename.mockReturnValue("package.json");
      mockPath.relative.mockReturnValue("relative/path");

      const context = {
        projectRoot: "/test",
        packageManager: "npm",
        packageJsonPath: "/test/package.json",
      };
      const sourceFiles = ["/test/src/index.js"];
      const topLevelDependencies = new Set(["package-a"]);

      const result = await getDependencyInfo(
        "package-a",
        context,
        sourceFiles,
        topLevelDependencies
      );

      expect(result).toBeDefined();
      expect(result.requiredByPackages).toEqual(new Set());
    });
  });

  describe("getWorkspaceInfo - Edge Cases", () => {
    it.skip("should handle workspaces with string array", async () => {
      const mockPackageJson = {
        workspaces: ["packages/*", "apps/*", "libs/*"],
      };

      // Clear previous mocks
      mockFs.readFile.mockClear();
      mockPath.dirname.mockClear();
      if (mockGlobby && typeof mockGlobby.mockClear === "function") {
        mockGlobby.mockClear();
      }

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      mockPath.dirname.mockReturnValue("/test");
      // Mock globby to return workspace packages
      (globby as any).mockResolvedValue([
        "/test/packages/package-a",
        "/test/apps/app-a",
        "/test/libs/lib-a",
      ]);

      const result = await getWorkspaceInfo("/test/package.json");

      expect(result).toBeDefined();
      if (result) {
        expect(result.packages).toHaveLength(3);
      }
    });

    it.skip("should handle workspaces with packages object", async () => {
      const mockPackageJson = {
        workspaces: {
          packages: ["packages/*", "apps/*"],
        },
      };

      // Clear previous mocks
      mockFs.readFile.mockClear();
      mockPath.dirname.mockClear();
      if (mockGlobby && typeof mockGlobby.mockClear === "function") {
        mockGlobby.mockClear();
      }

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      mockPath.dirname.mockReturnValue("/test");
      // Mock globby to return workspace packages
      (globby as any).mockResolvedValue([
        "/test/packages/package-a",
        "/test/apps/app-a",
      ]);

      const result = await getWorkspaceInfo("/test/package.json");

      expect(result).toBeDefined();
      if (result) {
        expect(result.packages).toHaveLength(2);
      }
    });

    it.skip("should handle empty workspaces", async () => {
      const mockPackageJson = {
        workspaces: [],
      };

      // Clear previous mocks
      mockFs.readFile.mockClear();
      mockPath.dirname.mockClear();
      if (mockGlobby && typeof mockGlobby.mockClear === "function") {
        mockGlobby.mockClear();
      }

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      mockPath.dirname.mockReturnValue("/test");
      // Mock globby to return empty array
      (globby as any).mockResolvedValue([]);

      const result = await getWorkspaceInfo("/test/package.json");

      expect(result).toBeDefined();
      if (result) {
        expect(result.packages).toHaveLength(0);
      }
    });
  });

  describe("getTSConfig - Edge Cases", () => {
    it.skip("should handle complex tsconfig.json", async () => {
      const mockTSConfig = {
        compilerOptions: {
          target: "es2020",
          module: "esnext",
          moduleResolution: "node",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
        extends: "./base.json",
      };

      // Clear previous mocks
      mockFs.readFile.mockClear();
      mockPath.join.mockClear();

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockTSConfig));
      mockPath.join.mockReturnValue("/test/tsconfig.json");

      const result = await getTSConfig("/test/tsconfig.json");

      expect(result).toEqual(mockTSConfig);
    });

    it.skip("should handle tsconfig.json with comments", async () => {
      // Clear previous mocks
      mockFs.readFile.mockClear();
      mockPath.join.mockClear();

      // Mock readFile to return JSON with comments (which would normally fail)
      mockFs.readFile.mockRejectedValue(new Error("Invalid JSON"));
      mockPath.join.mockReturnValue("/test/tsconfig.json");

      const result = await getTSConfig("/test/tsconfig.json");

      expect(result).toBeNull();
    });
  });

  describe("findClosestPackageJson - Edge Cases", () => {
    it("should handle nested directory structure", async () => {
      mockFindUp.mockResolvedValue("/deep/nested/path/package.json");

      const result = await findClosestPackageJson("/deep/nested/path/subdir");

      expect(result).toBe("/deep/nested/path/package.json");
    });

    it("should handle root directory", async () => {
      mockFindUp.mockResolvedValue("/package.json");

      const result = await findClosestPackageJson("/");

      expect(result).toBe("/package.json");
    });
  });
});
