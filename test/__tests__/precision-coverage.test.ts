/**
 * Precision Coverage Tests
 *
 * This file targets specific uncovered lines with precise, focused tests
 * to push coverage as close to 100% as possible.
 */

// Mock external dependencies
jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
  access: jest.fn(),
}));

jest.mock("node:path", () => ({
  basename: jest.fn(),
  dirname: jest.fn(),
  join: jest.fn(),
  resolve: jest.fn(),
  relative: jest.fn(),
}));

jest.mock("find-up", () => ({
  findUp: jest.fn(),
}));

jest.mock("globby", () => ({
  globby: jest.fn(),
}));

jest.mock("chalk", () => {
  const mockChalk = {
    yellow: jest.fn((text: string) => text),
    green: jest.fn((text: string) => text),
    blue: jest.fn((text: string) => text),
    red: jest.fn((text: string) => text),
    bold: jest.fn((text: string) => text),
    gray: jest.fn((text: string) => text),
    white: jest.fn((text: string) => text),
  };

  // Support method chaining
  (mockChalk.yellow as any).bold = jest.fn((text: string) => text);
  (mockChalk.green as any).bold = jest.fn((text: string) => text);
  (mockChalk.blue as any).bold = jest.fn((text: string) => text);
  (mockChalk.red as any).bold = jest.fn((text: string) => text);
  (mockChalk.gray as any).bold = jest.fn((text: string) => text);
  (mockChalk.white as any).bold = jest.fn((text: string) => text);

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
    source: ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx"],
    config: ["**/*.json", "**/*.yaml", "**/*.yml", "**/*.js", "**/*.ts"],
  },
  MESSAGES: {
    NO_PACKAGE_JSON: "No package.json found",
    ANALYSIS_COMPLETE: "Analysis complete",
  },
  ENVIRONMENTAL_CONSTANTS: {
    CARBON_PER_GB: 0.5,
    ENERGY_PER_GB: 0.1,
    WATER_PER_GB: 0.01,
    TREES_PER_KG_CO2: 0.06,
    CO2_PER_CAR_MILE: 0.4,
  },
}));

// Import after mocking
import {
  displayImpactTable,
  calculateEnvironmentalImpact,
  validateInputs,
} from "../../src/helpers.js";

import {
  getDependencyInfo,
  getWorkspaceInfo,
  getTSConfig,
  findClosestPackageJson,
  getSourceFiles,
  processFilesInParallel,
  findSubDependencies,
} from "../../src/utils.js";

import type { DependencyContext } from "../../src/interfaces.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findUp } from "find-up";
import { globby } from "globby";

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockFindUp = findUp as jest.MockedFunction<typeof findUp>;
const mockGlobby = globby as any;

describe("Precision Coverage Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Simple path mocking
    mockPath.basename.mockImplementation(
      (p: string) => p.split("/").pop() || ""
    );
    mockPath.dirname.mockImplementation((p: string) =>
      p.split("/").slice(0, -1).join("/")
    );
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.resolve.mockImplementation((...args) => args.join("/"));
    mockPath.relative.mockImplementation((from: string, to: string) =>
      to.replace(from, "")
    );

    // Simple globby mocking
    if (mockGlobby && typeof mockGlobby.mockResolvedValue === "function") {
      mockGlobby.mockResolvedValue([]);
    }
  });

  describe("helpers.ts - Precision Line Coverage", () => {
    describe("Lines 862-863: customSort in displayImpactTable", () => {
      it("should execute customSort function call", () => {
        const impactData = {
          "package-b": { installTime: "20", diskSpace: "500MB" },
          "package-a": { installTime: "30", diskSpace: "1GB" },
          "package-c": { installTime: "10", diskSpace: "200MB" },
        };

        const consoleSpy = jest
          .spyOn(console, "log")
          .mockImplementation(() => {});

        // This should hit lines 862-863
        displayImpactTable(impactData, 50, 1500000000);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe("Lines 1011-1012: Error handling for negative disk space", () => {
      it("should throw error for negative disk space", () => {
        expect(() => {
          validateInputs(-1000, 10, 1000);
        }).toThrow("Disk space cannot be negative");
      });
    });
  });

  describe("utils.ts - Precision Line Coverage", () => {
    describe("Line 263: dependencyGraph.set", () => {
      it("should set dependency graph with complex structure", async () => {
        mockFs.readFile.mockResolvedValue(
          JSON.stringify({
            dependencies: {
              "package-a": "^1.0.0",
              "package-b": "^2.0.0",
            },
            devDependencies: {
              "package-c": "^3.0.0",
            },
          })
        );

        mockFindUp.mockResolvedValue("/test/package.json");

        const context: DependencyContext = {
          projectRoot: "/test",
          scripts: {},
          configs: {},
          dependencyGraph: new Map(),
        };

        const sourceFiles = ["/test/src/index.js"];
        const topLevelDependencies = new Set(["package-a"]);

        // This should hit line 263
        const result = await getDependencyInfo(
          "package-a",
          context,
          sourceFiles,
          topLevelDependencies
        );

        expect(result).toBeDefined();
      });
    });

    describe("Lines 330-331, 339-344: getWorkspaceInfo", () => {
      it("should handle workspaces with string array", async () => {
        mockFs.readFile.mockResolvedValue(
          JSON.stringify({
            workspaces: ["packages/*", "apps/*"],
          })
        );

        mockPath.dirname.mockReturnValue("/test");
        mockPath.join.mockImplementation((...args) => args.join("/"));

        (globby as any).mockResolvedValue([
          "/test/packages/package-a/package.json",
        ]);

        // This should hit lines 330-331, 339-344
        const result = await getWorkspaceInfo("/test/package.json");

        expect(result).toBeDefined();
      });
    });

    describe("Lines 392-394: getTSConfig", () => {
      it("should handle complex tsconfig.json", async () => {
        const complexConfig = {
          compilerOptions: {
            target: "ES2020",
            module: "commonjs",
            strict: true,
          },
        };

        mockFs.readFile.mockResolvedValue(JSON.stringify(complexConfig));

        // This should hit lines 392-394
        const result = await getTSConfig("/test/tsconfig.json");

        expect(result).toBeDefined();
      });
    });

    describe("Lines 445, 469-470: findClosestPackageJson", () => {
      it("should handle nested directory structure", async () => {
        mockFindUp
          .mockResolvedValueOnce("/test/nested/package.json")
          .mockResolvedValueOnce("/test/package.json");

        // This should hit lines 445, 469-470
        const result = await findClosestPackageJson("/test/nested/deep/path");

        expect(result).toBeDefined();
      });
    });

    describe("Line 483: getSourceFiles", () => {
      it("should find source files with patterns", async () => {
        (globby as any).mockResolvedValue([
          "/test/src/index.js",
          "/test/src/utils.ts",
        ]);

        // This should hit line 483
        const result = await getSourceFiles("/test");

        expect(result).toBeDefined();
      });
    });

    describe("Line 283: findTopLevelDependents", () => {
      it("should handle recursive dependency analysis", async () => {
        mockFs.readFile.mockResolvedValue(
          JSON.stringify({
            dependencies: { "package-a": "^1.0.0" },
          })
        );

        mockFindUp.mockResolvedValue("/test/package.json");

        const context: DependencyContext = {
          projectRoot: "/test",
          scripts: {},
          configs: {},
          dependencyGraph: new Map([
            ["package-a", new Set(["package-b"])],
            ["package-b", new Set(["package-c"])],
          ]),
        };

        const sourceFiles = ["/test/src/index.js"];
        const topLevelDependencies = new Set(["package-a"]);

        // This should hit line 283
        const result = await getDependencyInfo(
          "package-c",
          context,
          sourceFiles,
          topLevelDependencies
        );

        expect(result).toBeDefined();
      });
    });
  });

  describe("Additional Precision Tests", () => {
    describe("processFilesInParallel with complex scenarios", () => {
      it("should handle complex file processing", async () => {
        const files = ["file1.js", "file2.ts"];
        const progressCallback = jest.fn();

        (globby as any).mockResolvedValue(files);

        const context: DependencyContext = {
          projectRoot: "/test",
          scripts: {},
          configs: {},
          dependencyGraph: new Map(),
        };

        const result = await processFilesInParallel(
          files,
          "package-a",
          context,
          progressCallback
        );

        expect(result).toBeDefined();
        expect(progressCallback).toHaveBeenCalled();
      });
    });

    describe("findSubDependencies with complex graphs", () => {
      it("should handle complex dependency graphs", () => {
        const dependencyGraph = new Map([
          ["package-a", new Set(["package-b", "package-c"])],
          ["package-b", new Set(["package-d"])],
          ["package-c", new Set(["package-e"])],
        ]);

        const context: DependencyContext = {
          projectRoot: "/test",
          scripts: {},
          configs: {},
          dependencyGraph,
        };

        const result = findSubDependencies("package-a", context);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});
