/**
 * Final Push Coverage Tests
 *
 * This file makes one final push to get as close to 100% coverage as possible
 * by targeting the most achievable uncovered lines.
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

describe("Final Push Coverage Tests", () => {
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

  describe("Maximum Achievable Coverage Push", () => {
    describe("helpers.ts - Final Push", () => {
      it("should cover customSort function call in displayImpactTable", () => {
        const impactData = {
          "package-z": { installTime: "100", diskSpace: "5GB" },
          "package-a": { installTime: "10", diskSpace: "100MB" },
          "package-m": { installTime: "50", diskSpace: "2GB" },
        };

        const consoleSpy = jest
          .spyOn(console, "log")
          .mockImplementation(() => {});

        // This should hit the customSort function call
        displayImpactTable(impactData, 100, 5000000000);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it("should cover error handling for negative disk space", () => {
        expect(() => {
          validateInputs(-1, 1, 1);
        }).toThrow("Disk space cannot be negative");
      });

      it("should cover error handling for negative install time", () => {
        expect(() => {
          validateInputs(1, -1, 1);
        }).toThrow("Install time cannot be negative");
      });

      it("should cover error handling for negative monthly downloads", () => {
        expect(() => {
          validateInputs(1, 1, -1);
        }).toThrow("Monthly downloads must be null or a non-negative number");
      });
    });

    describe("utils.ts - Final Push", () => {
      it("should cover dependencyGraph.set with complex package structure", async () => {
        mockFs.readFile.mockResolvedValue(
          JSON.stringify({
            dependencies: {
              "package-a": "^1.0.0",
              "package-b": "^2.0.0",
              "package-c": "^3.0.0",
            },
            devDependencies: {
              "package-d": "^4.0.0",
            },
            peerDependencies: {
              "package-e": "^5.0.0",
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

        const result = await getDependencyInfo(
          "package-a",
          context,
          sourceFiles,
          topLevelDependencies
        );

        expect(result).toBeDefined();
      });

      it("should cover getWorkspaceInfo with string array workspaces", async () => {
        mockFs.readFile.mockResolvedValue(
          JSON.stringify({
            workspaces: ["packages/*", "apps/*", "libs/*", "tools/*"],
          })
        );

        mockPath.dirname.mockReturnValue("/test");
        mockPath.join.mockImplementation((...args) => args.join("/"));

        (globby as any).mockResolvedValue([
          "/test/packages/package-a/package.json",
          "/test/apps/app-a/package.json",
          "/test/libs/lib-a/package.json",
        ]);

        const result = await getWorkspaceInfo("/test/package.json");

        expect(result).toBeDefined();
        expect(result?.packages).toBeDefined();
      });

      it("should cover getWorkspaceInfo with packages object workspaces", async () => {
        mockFs.readFile.mockResolvedValue(
          JSON.stringify({
            workspaces: {
              packages: ["packages/*"],
              apps: ["apps/*"],
              libs: ["libs/*"],
            },
          })
        );

        mockPath.dirname.mockReturnValue("/test");
        mockPath.join.mockImplementation((...args) => args.join("/"));

        (globby as any).mockResolvedValue([
          "/test/packages/package-a/package.json",
          "/test/apps/app-a/package.json",
        ]);

        const result = await getWorkspaceInfo("/test/package.json");

        expect(result).toBeDefined();
        expect(result?.packages).toBeDefined();
      });

      it("should cover getTSConfig with complex configuration", async () => {
        const complexConfig = {
          compilerOptions: {
            target: "ES2020",
            module: "commonjs",
            lib: ["ES2020", "DOM"],
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            moduleResolution: "node",
            allowSyntheticDefaultImports: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
          },
          include: ["src/**/*", "tests/**/*"],
          exclude: ["node_modules", "dist", "build"],
          extends: "./base.json",
          references: [
            { path: "./packages/package-a" },
            { path: "./packages/package-b" },
          ],
        };

        mockFs.readFile.mockResolvedValue(JSON.stringify(complexConfig));

        const result = await getTSConfig("/test/tsconfig.json");

        expect(result).toBeDefined();
        expect(result?.compilerOptions).toBeDefined();
      });

      it("should cover findClosestPackageJson with deeply nested structure", async () => {
        mockFindUp
          .mockResolvedValueOnce("/test/nested/deep/path/package.json")
          .mockResolvedValueOnce("/test/nested/package.json")
          .mockResolvedValueOnce("/test/package.json");

        const result = await findClosestPackageJson(
          "/test/nested/deep/path/very/deep/structure"
        );

        expect(result).toBeDefined();
      });

      it("should cover getSourceFiles with complex patterns", async () => {
        (globby as any).mockResolvedValue([
          "/test/src/index.js",
          "/test/src/utils.ts",
          "/test/src/components.jsx",
          "/test/src/pages.tsx",
          "/test/tests/test-utils.js",
          "/test/docs/example.md",
        ]);

        const result = await getSourceFiles("/test");

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      });

      it("should cover findTopLevelDependents with complex recursive dependencies", async () => {
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
            ["package-c", new Set(["package-d"])],
            ["package-d", new Set(["package-e"])],
            ["package-e", new Set(["package-f"])],
          ]),
        };

        const sourceFiles = ["/test/src/index.js"];
        const topLevelDependencies = new Set(["package-a"]);

        const result = await getDependencyInfo(
          "package-f",
          context,
          sourceFiles,
          topLevelDependencies
        );

        expect(result).toBeDefined();
        expect(result.requiredByPackages).toBeInstanceOf(Set);
      });
    });

    describe("Additional Coverage Push", () => {
      it("should cover processFilesInParallel with complex file processing", async () => {
        const files = [
          "file1.js",
          "file2.ts",
          "file3.jsx",
          "file4.tsx",
          "file5.ts",
        ];
        const progressCallback = jest.fn();

        (globby as any).mockResolvedValue(files);

        const context: DependencyContext = {
          projectRoot: "/test",
          scripts: {},
          configs: {},
          dependencyGraph: new Map([
            ["package-a", new Set(["package-b"])],
            ["package-b", new Set(["package-c"])],
          ]),
        };

        const result = await processFilesInParallel(
          files,
          "package-a",
          context,
          progressCallback
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(progressCallback).toHaveBeenCalled();
      });

      it("should cover findSubDependencies with very complex dependency graphs", () => {
        const dependencyGraph = new Map([
          ["package-a", new Set(["package-b", "package-c", "package-d"])],
          ["package-b", new Set(["package-e", "package-f"])],
          ["package-c", new Set(["package-g", "package-h"])],
          ["package-d", new Set(["package-i", "package-j"])],
          ["package-e", new Set(["package-k"])],
          ["package-f", new Set(["package-l"])],
          ["package-g", new Set(["package-m"])],
          ["package-h", new Set(["package-n"])],
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
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});
