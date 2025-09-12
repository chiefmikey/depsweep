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
}));

// Mock process.exit
const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

// Import after mocking
import {
  calculateImpactStats,
  displayImpactTable,
  validateInputs,
} from "../../src/helpers.js";
import {
  getDependencyInfo,
  getWorkspaceInfo,
  getTSConfig,
  findClosestPackageJson,
} from "../../src/utils.js";
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

describe("Coverage Gaps Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExit.mockClear();
  });

  describe("calculateImpactStats", () => {
    it("should handle yearly data with 12+ months", () => {
      const yearlyData = {
        total: 1000,
        monthsFetched: 12,
        startDate: "2024-01-01",
      };
      const diskSpace = 1024;
      const installTime = 30;
      const monthlyDownloads = 1000;

      const result = calculateImpactStats(
        diskSpace,
        installTime,
        monthlyDownloads,
        yearlyData
      );

      expect(result).toHaveProperty("yearly");
      expect(result.yearly).toBeDefined();
      expect(result.yearly.downloads).toBeGreaterThan(0);
    });

    it("should handle yearly data with less than 12 months", () => {
      const yearlyData = {
        total: 1000,
        monthsFetched: 6,
        startDate: "2024-01-01",
      };
      const diskSpace = 1024;
      const installTime = 30;
      const monthlyDownloads = 1000;

      const result = calculateImpactStats(
        diskSpace,
        installTime,
        monthlyDownloads,
        yearlyData
      );

      expect(result).not.toHaveProperty("yearly");
      expect(result).toHaveProperty("last_6_months");
    });

    it("should handle zero days count", () => {
      const yearlyData = {
        total: 0,
        monthsFetched: 0,
        startDate: "2024-01-01",
      };
      const diskSpace = 1024;
      const installTime = 30;
      const monthlyDownloads = 1000;

      const result = calculateImpactStats(
        diskSpace,
        installTime,
        monthlyDownloads,
        yearlyData
      );

      expect(result).toEqual({});
    });

    it("should handle zero total", () => {
      const yearlyData = {
        total: 0,
        monthsFetched: 12,
        startDate: "2024-01-01",
      };
      const diskSpace = 1024;
      const installTime = 30;
      const monthlyDownloads = 1000;

      const result = calculateImpactStats(
        diskSpace,
        installTime,
        monthlyDownloads,
        yearlyData
      );

      expect(result).toEqual({});
    });
  });

  describe("displayImpactTable", () => {
    it("should create and display impact table", () => {
      const impactData = {
        "package-a": { installTime: "10.5", diskSpace: "1.2 MB" },
        "package-b": { installTime: "5.0", diskSpace: "500 KB" },
      };
      const totalInstallTime = 15.5;
      const totalDiskSpace = 1700000;

      // Mock console.log to capture output
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      displayImpactTable(impactData, totalInstallTime, totalDiskSpace);

      expect(mockCliTable).toHaveBeenCalledWith({
        head: ["Package", "Install Time", "Disk Space"],
        colWidths: [29, 25, 25],
        wordWrap: true,
        style: {
          head: ["cyan"],
          border: ["grey"],
        },
      });

      // Verify table instance methods were called
      const tableInstance = mockCliTable.mock.results[0].value as any;
      expect(tableInstance.push).toHaveBeenCalled();
      expect(tableInstance.toString).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("mock table");

      consoleSpy.mockRestore();
    });
  });

  describe("validateInputs", () => {
    it("should throw error for invalid disk space", () => {
      expect(() => validateInputs(NaN, 30, 1000)).toThrow(
        "Disk space must be a valid number"
      );
      expect(() => validateInputs("invalid" as any, 30, 1000)).toThrow(
        "Disk space must be a valid number"
      );
    });

    it("should throw error for invalid install time", () => {
      expect(() => validateInputs(1024, NaN, 1000)).toThrow(
        "Install time must be a valid number"
      );
      expect(() => validateInputs(1024, "invalid" as any, 1000)).toThrow(
        "Install time must be a valid number"
      );
    });

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

  describe("getDependencyInfo", () => {
    it("should handle workspace packages with complex dependency graph", async () => {
      const mockPackageJson = {
        name: "test-package",
        dependencies: {
          "package-a": "^1.0.0",
          "package-b": "^2.0.0",
        },
        workspaces: ["packages/*"],
      };

      const mockWorkspacePackage = {
        name: "workspace-package",
        dependencies: {
          "package-a": "^1.0.0",
          "package-c": "^3.0.0",
        },
      };

      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockPackageJson))
        .mockResolvedValueOnce(JSON.stringify(mockWorkspacePackage));

      mockPath.join.mockImplementation((...args: string[]) => args.join("/"));
      mockPath.dirname.mockImplementation((p: string) =>
        p.split("/").slice(0, -1).join("/")
      );

      const context = {
        projectRoot: "/test",
        packageManager: "npm",
        packageJsonPath: "/test/package.json",
      };
      const sourceFiles = ["/test/src/index.js"];
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

    it("should handle errors in dependency analysis gracefully", async () => {
      mockFs.readFile.mockRejectedValue(new Error("File not found"));

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

  describe("getWorkspaceInfo", () => {
    it.skip("should handle workspaces with packages array", async () => {
      const mockPackageJson = {
        workspaces: {
          packages: ["packages/*", "apps/*"],
        },
      };

      // Clear any previous mocks
      mockFs.readFile.mockClear();
      mockPath.dirname.mockClear();

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      mockPath.dirname.mockReturnValue("/test");

      // Mock globby properly
      const mockGlobby = require("globby") as jest.MockedFunction<any>;
      mockGlobby.mockResolvedValue([
        "/test/packages/package-a",
        "/test/apps/app-a",
      ]);

      const result = await getWorkspaceInfo("/test/package.json");

      expect(result).toBeDefined();
      expect(result?.packages).toHaveLength(2);
    });

    it("should handle errors gracefully", async () => {
      mockFs.readFile.mockRejectedValue(new Error("File not found"));

      const result = await getWorkspaceInfo("/test/package.json");

      expect(result).toBeUndefined();
    });
  });

  describe("getTSConfig", () => {
    it("should parse tsconfig.json successfully", async () => {
      const mockTSConfig = {
        compilerOptions: {
          target: "es2020",
          module: "esnext",
        },
      };

      // Clear any previous mocks
      mockFs.readFile.mockClear();
      mockPath.join.mockClear();

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockTSConfig));
      mockPath.join.mockReturnValue("/test/tsconfig.json");

      const result = await getTSConfig("/test");

      expect(result).toEqual(mockTSConfig);
    });

    it("should return null on error", async () => {
      mockFs.readFile.mockRejectedValue(new Error("File not found"));

      const result = await getTSConfig("/test");

      expect(result).toBeNull();
    });
  });

  describe("findClosestPackageJson", () => {
    it.skip("should call process.exit when no package.json found", async () => {
      // Reset the mock before setting up the test
      mockExit.mockClear();
      mockFindUp.mockResolvedValue(undefined);
      mockChalk.red.mockReturnValue("No package.json found");

      await expect(findClosestPackageJson("/test")).rejects.toThrow(
        "process.exit called"
      );

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should return package.json path when found", async () => {
      mockFindUp.mockResolvedValue("/test/package.json");

      const result = await findClosestPackageJson("/test");

      expect(result).toBe("/test/package.json");
    });
  });
});
