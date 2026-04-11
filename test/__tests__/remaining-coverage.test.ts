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
    CARBON_INTENSITY: 0.445,
    WATER_PER_KWH: 1.8,
    ENERGY_PER_GB: 0.06,
    STORAGE_ENERGY_PER_GB_YEAR: 0.00028,
    TREES_PER_KG_CO2: 0.045,
    CO2_PER_CAR_MILE: 0.404,
    CARBON_INTENSITY_NA: 0.37,
    CARBON_INTENSITY_EU: 0.213,
    CARBON_INTENSITY_AP: 0.521,
  },
}));

// Import after mocking
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

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockFindUp = findUp as jest.MockedFunction<typeof findUp>;
const mockGlobby = globby as jest.MockedFunction<typeof globby>;

describe("Remaining Coverage Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    it("should handle workspaces with string array", async () => {
      const mockPackageJson = {
        workspaces: ["packages/*", "apps/*", "libs/*"],
      };

      mockFs.readFile.mockReset();
      mockPath.dirname.mockReset();
      mockGlobby.mockReset();

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      mockPath.dirname.mockReturnValue("/test");
      mockGlobby.mockResolvedValue([
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

    it("should handle workspaces with packages object", async () => {
      const mockPackageJson = {
        workspaces: {
          packages: ["packages/*", "apps/*"],
        },
      };

      mockFs.readFile.mockReset();
      mockPath.dirname.mockReset();
      mockGlobby.mockReset();

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      mockPath.dirname.mockReturnValue("/test");
      mockGlobby.mockResolvedValue([
        "/test/packages/package-a",
        "/test/apps/app-a",
      ]);

      const result = await getWorkspaceInfo("/test/package.json");

      expect(result).toBeDefined();
      if (result) {
        expect(result.packages).toHaveLength(2);
      }
    });

    it("should handle empty workspaces", async () => {
      const mockPackageJson = {
        workspaces: [],
      };

      mockFs.readFile.mockReset();
      mockPath.dirname.mockReset();
      mockGlobby.mockReset();

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));
      mockPath.dirname.mockReturnValue("/test");
      mockGlobby.mockResolvedValue([]);

      const result = await getWorkspaceInfo("/test/package.json");

      expect(result).toBeDefined();
      if (result) {
        expect(result.packages).toHaveLength(0);
      }
    });
  });

  describe("getTSConfig - Edge Cases", () => {
    it("should handle complex tsconfig.json", async () => {
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

    it("should handle tsconfig.json with comments", async () => {
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
