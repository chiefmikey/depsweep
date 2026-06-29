/**
 * Extra coverage tests for src/utils.ts
 * Targets: @types/ branch, config-field scanning, bin-name source scanning,
 * PLUGIN_CONVENTIONS, peer deps, subdeps, getTSConfig, getWorkspaceInfo,
 * findClosestPackageJson monorepo paths, getDependencies edge cases,
 * getPackageContext, processFilesInParallel, findSubDependencies.
 */

// ---- MODULE MOCKS (must come before any import) ----

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
}));

jest.mock("globby", () => ({
  globby: jest.fn(),
}));

jest.mock("find-up", () => ({
  findUp: jest.fn(),
}));

jest.mock("isbinaryfile", () => ({
  isBinaryFileSync: jest.fn().mockReturnValue(false),
}));

jest.mock("../../src/helpers.js", () => ({
  isConfigFile: jest.fn().mockReturnValue(false),
  parseConfigFile: jest.fn().mockResolvedValue({}),
  isDependencyUsedInFile: jest.fn().mockResolvedValue(false),
  customSort: jest.fn((a: string, b: string) => a.localeCompare(b)),
}));

jest.mock("../../src/constants.js", () => ({
  FILE_PATTERNS: {
    PACKAGE_JSON: "package.json",
    NODE_MODULES: "node_modules",
    PACKAGE_NAME_REGEX: /^[\w./@-]+$/,
  },
  MESSAGES: {
    noPackageJson: "No package.json found",
    monorepoDetected: "\nMonorepo detected, using root package.json",
  },
}));

// Mock the performance-optimizations module so the singleton
// processFilesInBatches is controllable in tests.
jest.mock("../../src/performance-optimizations.js", () => {
  const mockProcessFilesInBatches = jest.fn().mockResolvedValue([]);
  const mockReadFile = jest.fn().mockResolvedValue("");

  const mockDependencyAnalyzerInstance = {
    processFilesInBatches: mockProcessFilesInBatches,
    clearCaches: jest.fn(),
  };

  const mockFileReaderInstance = {
    readFile: mockReadFile,
    clearCache: jest.fn(),
  };

  return {
    OptimizedCache: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockReturnValue(undefined),
      set: jest.fn(),
      clear: jest.fn(),
    })),
    OptimizedFileReader: {
      getInstance: jest.fn().mockReturnValue(mockFileReaderInstance),
    },
    OptimizedDependencyAnalyzer: {
      getInstance: jest.fn().mockReturnValue(mockDependencyAnalyzerInstance),
    },
    StringOptimizer: {
      intern: jest.fn((s: string) => s),
    },
    PerformanceMonitor: {
      getInstance: jest.fn().mockReturnValue({
        startTimer: jest.fn(),
        endTimer: jest.fn(),
      }),
    },
    MemoryOptimizer: {
      getInstance: jest.fn().mockReturnValue({
        checkMemoryUsage: jest.fn().mockReturnValue({ shouldGC: false }),
      }),
    },
  };
});

// ---- IMPORTS (after mocks) ----

import * as fs from "node:fs/promises";
import { globby } from "globby";
import { findUp } from "find-up";

import {
  getDependencyInfo,
  getTSConfig,
  getWorkspaceInfo,
  findClosestPackageJson,
  getDependencies,
  getPackageContext,
  getSourceFiles,
  processFilesInParallel,
  findSubDependencies,
} from "../../src/utils.js";

import { isDependencyUsedInFile } from "../../src/helpers.js";
import { OptimizedDependencyAnalyzer, OptimizedFileReader } from "../../src/performance-optimizations.js";

// ---- TYPED MOCK HELPERS ----

const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockGlobby = globby as jest.MockedFunction<typeof globby>;
const mockFindUp = findUp as jest.MockedFunction<typeof findUp>;
const mockIsDependencyUsedInFile = isDependencyUsedInFile as jest.MockedFunction<typeof isDependencyUsedInFile>;

// Grab the mocked processFilesInBatches from the singleton
function getProcessFilesInBatches(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing mock internals
  return (OptimizedDependencyAnalyzer.getInstance() as any).processFilesInBatches as jest.Mock;
}

function getFileReaderReadFile(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing mock internals
  return (OptimizedFileReader.getInstance() as any).readFile as jest.Mock;
}

// ---- SHARED CONTEXT FACTORY ----

function makeContext(overrides: Record<string, unknown> = {}): Parameters<typeof getDependencyInfo>[1] {
  return {
    projectRoot: "/proj",
    scripts: {},
    configs: {
      "package.json": { name: "test", version: "1.0.0" },
    },
    dependencyGraph: new Map(),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper
  } as any;
}

// ============================================================
// TESTS
// ============================================================

describe("utils-extra-coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: processFilesInBatches returns empty (dep not found in source)
    getProcessFilesInBatches().mockResolvedValue([]);
    // Default: fs.readFile throws so optional reads fail gracefully
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    // Default: globby returns empty
    mockGlobby.mockResolvedValue([]);
    // Default: fileReader returns empty string
    getFileReaderReadFile().mockResolvedValue("");
  });

  // ----------------------------------------------------------
  // getTSConfig
  // ----------------------------------------------------------

  describe("getTSConfig", () => {
    it("returns parsed tsconfig when file exists", async () => {
      const config = { compilerOptions: { strict: true }, include: ["src"] };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(config));

      const result = await getTSConfig("/proj");

      expect(result).toEqual(config);
    });

    it("returns null when tsconfig.json is missing", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await getTSConfig("/proj");

      expect(result).toBeNull();
    });

    it("returns null when tsconfig.json contains invalid JSON", async () => {
      mockReadFile.mockResolvedValueOnce("not-valid-json{{");

      const result = await getTSConfig("/proj");

      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // getWorkspaceInfo
  // ----------------------------------------------------------

  describe("getWorkspaceInfo", () => {
    it("returns undefined when package.json has no workspaces field", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ name: "root" }));

      const result = await getWorkspaceInfo("/proj/package.json");

      expect(result).toBeUndefined();
    });

    it("handles workspaces as a plain array", async () => {
      const pkg = { workspaces: ["packages/*", "apps/*"] };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(pkg));
      mockGlobby.mockResolvedValueOnce(["/proj/packages/a", "/proj/apps/b"]);

      const result = await getWorkspaceInfo("/proj/package.json");

      expect(result).toBeDefined();
      expect(result!.root).toBe("/proj/package.json");
      expect(result!.packages).toEqual(["/proj/packages/a", "/proj/apps/b"]);
    });

    it("handles workspaces as an object with packages array", async () => {
      const pkg = { workspaces: { packages: ["packages/*"] } };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(pkg));
      mockGlobby.mockResolvedValueOnce(["/proj/packages/lib"]);

      const result = await getWorkspaceInfo("/proj/package.json");

      expect(result).toBeDefined();
      expect(result!.packages).toEqual(["/proj/packages/lib"]);
    });

    it("returns undefined when readFile throws", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await getWorkspaceInfo("/proj/package.json");

      expect(result).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // findClosestPackageJson
  // ----------------------------------------------------------

  describe("findClosestPackageJson", () => {
    it("returns found package.json when there is no parent package.json", async () => {
      mockFindUp.mockResolvedValueOnce("/proj/package.json");
      // All subsequent readFile calls for parent dirs fail (no monorepo)
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await findClosestPackageJson("/proj/src");

      expect(result).toBe("/proj/package.json");
    });

    it("exits process when no package.json found", async () => {
      mockFindUp.mockResolvedValueOnce(undefined as unknown as string);
      const exitSpy = jest.spyOn(process, "exit").mockImplementation((): never => {
        throw new Error("process.exit called");
      });

      await expect(findClosestPackageJson("/no/such/dir")).rejects.toThrow("process.exit called");

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

    it("returns monorepo root when parent package.json has workspaces", async () => {
      // findUp returns a deeply nested package.json
      mockFindUp.mockResolvedValueOnce("/monorepo/packages/app/package.json");

      // The loop walks up from /monorepo/packages/app:
      // Iteration 1: parentDir=/monorepo/packages, checks /monorepo/packages/package.json
      //   - try block reads it → ENOENT
      //   - getWorkspaceInfo reads it → ENOENT (returns undefined)
      // Iteration 2: parentDir=/monorepo, checks /monorepo/package.json
      //   - try block reads it → returns JSON with workspaces → returns potentialRootPackageJson
      mockReadFile
        .mockRejectedValueOnce(new Error("ENOENT"))   // /monorepo/packages/package.json (try block)
        .mockRejectedValueOnce(new Error("ENOENT"))   // /monorepo/packages/package.json (getWorkspaceInfo)
        .mockResolvedValueOnce(                        // /monorepo/package.json (try block)
          JSON.stringify({ name: "root", workspaces: ["packages/*"] })
        );

      const result = await findClosestPackageJson("/monorepo/packages/app/src");

      expect(result).toBe("/monorepo/package.json");
    });
  });

  // ----------------------------------------------------------
  // getDependencies
  // ----------------------------------------------------------

  describe("getDependencies", () => {
    it("returns empty array when package.json is empty string", async () => {
      mockReadFile.mockResolvedValueOnce("");

      const result = await getDependencies("/proj/package.json");

      expect(result).toEqual([]);
    });

    it("returns empty array when package.json contains invalid JSON", async () => {
      mockReadFile.mockResolvedValueOnce("{bad json}");

      const result = await getDependencies("/proj/package.json");

      expect(result).toEqual([]);
    });

    it("returns empty array when package.json is not an object (array)", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify([1, 2, 3]));

      const result = await getDependencies("/proj/package.json");

      expect(result).toEqual([]);
    });

    it("filters out npm: alias dependencies", async () => {
      const pkg = {
        dependencies: {
          "real-dep": "^1.0.0",
          "aliased-dep": "npm:other-package@^2.0.0",
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(pkg));

      const result = await getDependencies("/proj/package.json");

      expect(result).toContain("real-dep");
      expect(result).not.toContain("aliased-dep");
    });

    it("returns sorted unique dependencies via customSort", async () => {
      const pkg = {
        dependencies: { "zebra": "^1.0.0", "apple": "^1.0.0" },
        devDependencies: { "apple": "^1.0.0", "mango": "^1.0.0" },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(pkg));

      const result = await getDependencies("/proj/package.json");

      // Duplicates removed (apple appears once)
      expect(result.filter((d) => d === "apple")).toHaveLength(1);
      // All three unique deps present
      expect(result).toContain("zebra");
      expect(result).toContain("mango");
    });

    it("returns empty array when readFile throws", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("EPERM"));

      const result = await getDependencies("/proj/package.json");

      expect(result).toEqual([]);
    });

    it("skips invalid dependency names and returns valid ones", async () => {
      const pkg = {
        dependencies: {
          "valid-dep": "^1.0.0",
          "!!!invalid": "^1.0.0",
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(pkg));

      const result = await getDependencies("/proj/package.json");

      expect(result).toContain("valid-dep");
    });
  });

  // ----------------------------------------------------------
  // getSourceFiles
  // ----------------------------------------------------------

  describe("getSourceFiles", () => {
    it("returns filtered non-binary files", async () => {
      mockGlobby.mockResolvedValueOnce(["/proj/src/index.ts", "/proj/src/util.ts"]);

      const result = await getSourceFiles("/proj");

      expect(result).toEqual(["/proj/src/index.ts", "/proj/src/util.ts"]);
    });

    it("returns empty array when globby returns non-array", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing edge case
      mockGlobby.mockResolvedValueOnce(null as any);

      const result = await getSourceFiles("/proj");

      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // findSubDependencies
  // ----------------------------------------------------------

  describe("findSubDependencies", () => {
    it("returns subdeps from dependencyGraph when present", () => {
      const graph = new Map<string, Set<string>>();
      graph.set("lodash", new Set(["lodash-is-empty", "lodash-merge"]));
      const ctx = makeContext({ dependencyGraph: graph });

      const result = findSubDependencies("lodash", ctx);

      expect(result).toContain("lodash-is-empty");
      expect(result).toContain("lodash-merge");
    });

    it("returns empty array when dependency not in graph", () => {
      const ctx = makeContext({ dependencyGraph: new Map() });

      const result = findSubDependencies("unknown-pkg", ctx);

      expect(result).toEqual([]);
    });

    it("returns empty array when dependencyGraph is missing", () => {
      const ctx = makeContext({ dependencyGraph: undefined });

      const result = findSubDependencies("some-pkg", ctx);

      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // processFilesInParallel
  // ----------------------------------------------------------

  describe("processFilesInParallel", () => {
    it("returns files where dependency is used", async () => {
      getProcessFilesInBatches().mockResolvedValueOnce(["/proj/src/app.ts"]);

      const result = await processFilesInParallel(
        ["/proj/src/app.ts", "/proj/src/other.ts"],
        "express",
        makeContext(),
      );

      expect(result).toContain("/proj/src/app.ts");
    });

    it("returns empty array when no files use the dependency", async () => {
      getProcessFilesInBatches().mockResolvedValueOnce([]);

      const result = await processFilesInParallel(
        ["/proj/src/app.ts"],
        "unused-pkg",
        makeContext(),
      );

      expect(result).toEqual([]);
    });

    it("calls onProgress callback when provided", async () => {
      getProcessFilesInBatches().mockImplementationOnce(
        async (_files: unknown, _dep: unknown, _ctx: unknown, onProgress?: (p: number, t: number) => void) => {
          onProgress?.(1, 1);
          return [];
        },
      );
      const onProgress = jest.fn();

      await processFilesInParallel(["/proj/src/app.ts"], "dep", makeContext(), onProgress);

      expect(onProgress).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // getDependencyInfo — @types/ branch
  // ----------------------------------------------------------

  describe("getDependencyInfo — @types/ packages", () => {
    it("marks @types/node as required by typescript when TS files exist", async () => {
      // tsconfig.json read will fail (no tsconfig needed for this path)
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await getDependencyInfo(
        "@types/node",
        makeContext(),
        ["/proj/src/index.ts"],       // has TS file → hasTSFiles returns true
        new Set(["typescript"]),
      );

      expect(result.requiredByPackages.has("typescript")).toBe(true);
    });

    it("marks @types/X as required by base package when base package is installed", async () => {
      // tsconfig read fails
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await getDependencyInfo(
        "@types/lodash",
        makeContext(),
        ["/proj/src/util.js"],        // .js file only → hasTSFiles false
        new Set(["lodash"]),
      );

      expect(result.requiredByPackages.has("lodash")).toBe(true);
    });

    it("adds @types/X to usedInFiles when isDependencyUsedInFile returns true for TS file", async () => {
      // tsconfig read
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));
      // isDependencyUsedInFile returns true for our TS file
      mockIsDependencyUsedInFile.mockResolvedValueOnce(true);

      const result = await getDependencyInfo(
        "@types/express",
        makeContext(),
        ["/proj/src/server.ts"],
        new Set([]),
      );

      expect(result.usedInFiles).toContain("/proj/src/server.ts");
    });

    it("marks @types/X as required by typescript when tsconfig types includes base package", async () => {
      const tsconfig = {
        compilerOptions: {
          types: ["express"],
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(tsconfig));

      const result = await getDependencyInfo(
        "@types/express",
        makeContext(),
        ["/proj/src/server.ts"],       // has TS file
        new Set([]),
      );

      expect(result.requiredByPackages.has("typescript")).toBe(true);
    });

    it("marks @types/X as required by typescript when tsconfig typeRoots includes base package", async () => {
      const tsconfig = {
        compilerOptions: {
          typeRoots: ["./node_modules/@types", "./node_modules/jest-circus"],
        },
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(tsconfig));

      const result = await getDependencyInfo(
        "@types/jest-circus",
        makeContext(),
        ["/proj/src/test.ts"],
        new Set([]),
      );

      expect(result.requiredByPackages.has("typescript")).toBe(true);
    });

    it("handles scoped @types like @types/babel__traverse", async () => {
      // @types/babel__traverse → @babel/traverse
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await getDependencyInfo(
        "@types/babel__traverse",
        makeContext(),
        ["/proj/src/index.js"],
        new Set(["@babel/traverse"]),
      );

      // base package is @babel/traverse which IS in topLevelDependencies
      expect(result.requiredByPackages.has("@babel/traverse")).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // getDependencyInfo — package.json config-field scanning
  // ----------------------------------------------------------

  describe("getDependencyInfo — package.json config fields", () => {
    it("finds dep referenced in a known config field (jest)", async () => {
      const ctx = makeContext({
        configs: {
          "package.json": {
            name: "test",
            jest: {
              transform: {
                "^.+\\.ts$": "ts-jest",
              },
            },
          },
        },
      });

      const result = await getDependencyInfo(
        "ts-jest",
        ctx,
        [],
        new Set(["ts-jest"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("(config fields)"))).toBe(true);
    });

    it("finds dep referenced as a top-level key in package.json (exact name match)", async () => {
      // dep name matches a top-level key that is not a standard pkg field
      const ctx = makeContext({
        configs: {
          "package.json": {
            name: "test",
            // commitlint is both a dep name and a top-level config key
            commitlint: { extends: ["@commitlint/config-conventional"] },
          },
        },
      });

      const result = await getDependencyInfo(
        "commitlint",
        ctx,
        [],
        new Set(["commitlint"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("(config fields)"))).toBe(true);
    });

    it("does NOT flag standard package.json fields as config matches", async () => {
      // 'scripts' is a standard field — should not trigger config-field detection
      const ctx = makeContext({
        configs: {
          "package.json": {
            name: "test",
            scripts: { test: "jest" },
          },
        },
        scripts: { test: "jest" },
      });

      // processFilesInBatches returns empty so we enter the config block
      getProcessFilesInBatches().mockResolvedValue([]);

      const result = await getDependencyInfo(
        "scripts",   // package name that matches standard field
        ctx,
        [],
        new Set(["scripts"]),
      );

      // 'scripts' is in STANDARD_PKG_FIELDS so it should NOT match
      expect(result.usedInFiles.some((f) => f.includes("(config fields)"))).toBe(false);
    });

    it("finds dep referenced in eslintConfig string field", async () => {
      const ctx = makeContext({
        configs: {
          "package.json": {
            name: "test",
            eslintConfig: "eslint-config-airbnb",
          },
        },
      });

      const result = await getDependencyInfo(
        "eslint-config-airbnb",
        ctx,
        [],
        new Set(["eslint-config-airbnb"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("(config fields)"))).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // getDependencyInfo — bin-name source scanning
  // ----------------------------------------------------------

  describe("getDependencyInfo — bin-name source scanning", () => {
    it("finds dep via bin object when bin name is used in source files", async () => {
      // No match in source files for the dep name itself
      getProcessFilesInBatches()
        .mockResolvedValueOnce([])           // first call: dep name in source
        .mockResolvedValueOnce(["/proj/.husky/pre-commit"]); // second call: bin name in source

      // readFile for the dep's package.json (node_modules/lint-staged/package.json)
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ bin: { "lint-staged": "bin/lint-staged.js" } })
      );

      const ctx = makeContext({ scripts: {} });

      const result = await getDependencyInfo(
        "lint-staged",
        ctx,
        ["/proj/.husky/pre-commit"],
        new Set(["lint-staged"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("(bin)"))).toBe(true);
    });

    it("finds dep via string bin field used in scripts (dep name !== binary name)", async () => {
      // processFilesInBatches returns empty (dep not in source)
      getProcessFilesInBatches().mockResolvedValue([]);

      // @commitlint/cli installs binary "commitlint".
      // Scripts reference "commitlint" but NOT "@commitlint/cli", so:
      //  - script check at line 303 finds "@commitlint/cli" in scripts → false
      //  - bin detection reads node_modules/@commitlint/cli/package.json → bin: string
      //  - binary name = "cli" (scope stripped) → check scripts for "cli" → YES
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ bin: "./cli.js" })
      );

      const ctx = makeContext({
        // Scripts contain "cli" but NOT "@commitlint/cli"
        scripts: { lint: "cli --config .commitlintrc" },
      });

      const result = await getDependencyInfo(
        "@commitlint/cli",
        ctx,
        [],
        new Set(["@commitlint/cli"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("scripts:bin"))).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // getDependencyInfo — PLUGIN_CONVENTIONS
  // ----------------------------------------------------------

  describe("getDependencyInfo — PLUGIN_CONVENTIONS", () => {
    it("detects karma plugin via karma.conf config file", async () => {
      getProcessFilesInBatches().mockResolvedValue([]);

      // fileReader.readFile returns content mentioning the short name
      getFileReaderReadFile().mockResolvedValueOnce("plugins: ['karma-jasmine']");

      const ctx = makeContext({ scripts: {} });
      const result = await getDependencyInfo(
        "karma-jasmine",
        ctx,
        ["/proj/karma.conf.js"],
        new Set(["karma"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("karma plugin"))).toBe(true);
    });

    it("detects eslint-plugin via scripts reference", async () => {
      getProcessFilesInBatches().mockResolvedValue([]);

      const ctx = makeContext({
        scripts: { lint: "eslint --format friendly src/" },
      });

      const result = await getDependencyInfo(
        "eslint-formatter-friendly",
        ctx,
        [],
        new Set(["eslint"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("eslint plugin:scripts"))).toBe(true);
    });

    it("detects eslint-plugin via plugin:NAME/ extends in eslint config", async () => {
      getProcessFilesInBatches().mockResolvedValue([]);

      getFileReaderReadFile().mockResolvedValueOnce(
        'extends: ["plugin:mdx/recommended"]'
      );

      const ctx = makeContext({ scripts: {} });

      const result = await getDependencyInfo(
        "eslint-plugin-mdx",
        ctx,
        ["/proj/.eslintrc.js"],
        new Set(["eslint"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("eslint plugin:mdx"))).toBe(true);
    });

    it("detects eslint-import-resolver via resolver key in eslint config", async () => {
      getProcessFilesInBatches().mockResolvedValue([]);

      getFileReaderReadFile().mockResolvedValueOnce(
        "settings: { 'import/resolver': { typescript: true } }"
      );

      const ctx = makeContext({ scripts: {} });

      const result = await getDependencyInfo(
        "eslint-import-resolver-typescript",
        ctx,
        ["/proj/.eslintrc.js"],
        new Set(["eslint"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("eslint import resolver"))).toBe(true);
    });

    it("detects eslint-plugin via source file scan fallback", async () => {
      // first processFilesInBatches call (dep name) returns empty
      // second call (short plugin name) returns a source file
      getProcessFilesInBatches()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["/proj/Makefile"]);

      getFileReaderReadFile().mockResolvedValue(""); // config files don't mention it

      const ctx = makeContext({ scripts: {} });

      const result = await getDependencyInfo(
        "eslint-plugin-custom",
        ctx,
        ["/proj/Makefile", "/proj/.eslintrc.js"],
        new Set(["eslint"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("eslint plugin:source"))).toBe(true);
    });

    it("detects grunt plugin via gruntfile", async () => {
      getProcessFilesInBatches().mockResolvedValue([]);

      getFileReaderReadFile().mockResolvedValueOnce("grunt.loadNpmTasks('grunt-contrib-uglify')");

      const ctx = makeContext({ scripts: {} });

      const result = await getDependencyInfo(
        "grunt-contrib-uglify",
        ctx,
        ["/proj/Gruntfile.js"],
        new Set(["grunt"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("grunt plugin"))).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // getDependencyInfo — peer dependency awareness
  // ----------------------------------------------------------

  describe("getDependencyInfo — peer dependency awareness", () => {
    it("marks dep as used when another dep lists it as a peer", async () => {
      getProcessFilesInBatches().mockResolvedValue([]);

      // Call order in getDependencyInfo after source-file scan finds nothing:
      //   1. bin detection: reads /proj/node_modules/react/package.json → ENOENT
      //   2. peer dep loop for "react-dom": reads /proj/node_modules/react-dom/package.json → success
      mockReadFile
        .mockRejectedValueOnce(new Error("ENOENT"))  // bin detection for "react"
        .mockResolvedValueOnce(
          JSON.stringify({ peerDependencies: { react: "^18.0.0" } })
        );

      const ctx = makeContext({ scripts: {} });

      const result = await getDependencyInfo(
        "react",
        ctx,
        [],
        new Set(["react", "react-dom"]),
      );

      expect(result.usedInFiles.some((f) => f.includes("required peer"))).toBe(true);
    });

    it("skips itself in peer dependency loop", async () => {
      // No peer files readable
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      getProcessFilesInBatches().mockResolvedValue([]);

      const ctx = makeContext({ scripts: {} });

      const result = await getDependencyInfo(
        "only-dep",
        ctx,
        [],
        new Set(["only-dep"]),  // only itself in topLevel
      );

      // Should not crash and should not falsely add itself
      expect(result.usedInFiles).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // getDependencyInfo — subdependency loop
  // ----------------------------------------------------------

  describe("getDependencyInfo — subdependency detection", () => {
    it("sets hasSubDependencyUsage when a subdep is found in source files", async () => {
      // First processFilesInBatches: main dep not found
      // Second processFilesInBatches: subdep IS found
      getProcessFilesInBatches()
        .mockResolvedValueOnce([])           // dep name search
        .mockResolvedValueOnce(["/proj/src/app.ts"]); // subdep search

      const graph = new Map<string, Set<string>>();
      graph.set("lodash", new Set(["lodash.merge"]));

      const ctx = makeContext({ scripts: {}, dependencyGraph: graph });

      const result = await getDependencyInfo(
        "lodash",
        ctx,
        ["/proj/src/app.ts"],
        new Set(["lodash"]),
      );

      expect(result.hasSubDependencyUsage).toBe(true);
    });

    it("calls onProgress during subdep loop", async () => {
      getProcessFilesInBatches()
        .mockResolvedValueOnce([])   // dep name
        .mockResolvedValueOnce([]); // subdep (not found — progress still fires)

      const graph = new Map<string, Set<string>>();
      graph.set("some-pkg", new Set(["some-pkg-internal"]));

      const ctx = makeContext({ dependencyGraph: graph });
      const onProgress = jest.fn();

      await getDependencyInfo(
        "some-pkg",
        ctx,
        ["/proj/src/index.ts"],
        new Set(["some-pkg"]),
        { onProgress, totalAnalysisSteps: 2 },
      );

      expect(onProgress).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // getDependencyInfo — framework detection paths
  // ----------------------------------------------------------

  describe("getDependencyInfo — framework dev dependency shortcircuit", () => {
    it("returns early when dep is a framework dev dep (Angular)", async () => {
      const ctx = makeContext({
        configs: {
          "package.json": {
            name: "my-app",
            dependencies: { "@angular/core": "^16.0.0" },
            devDependencies: { "@angular-devkit/build-angular": "^16.0.0" },
          },
        },
      });

      const result = await getDependencyInfo(
        "@angular-devkit/build-angular",
        ctx,
        [],
        new Set(["@angular/core", "@angular-devkit/build-angular"]),
      );

      expect(result.requiredByPackages.has("@angular/core")).toBe(true);
      // usedInFiles should be empty (early return without scanning)
      expect(result.usedInFiles).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // getPackageContext
  // ----------------------------------------------------------

  describe("getPackageContext", () => {
    it("returns a DependencyContext with projectRoot, scripts, configs, dependencyGraph", async () => {
      const pkg = {
        name: "my-project",
        version: "1.0.0",
        scripts: { build: "tsc" },
        dependencies: { express: "^4.0.0" },
      };
      // readFile called for getDependencies (first) and then for package.json context (second)
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(pkg))   // getDependencies
        .mockResolvedValueOnce(JSON.stringify(pkg));   // getPackageContext final readFile

      // getSourceFiles uses globby
      mockGlobby.mockResolvedValueOnce([]);

      const result = await getPackageContext("/proj/package.json");

      expect(result.projectRoot).toBe("/proj");
      expect(result.scripts).toEqual({ build: "tsc" });
      expect(result.configs?.["package.json"]).toBeDefined();
      expect(result.dependencyGraph).toBeInstanceOf(Map);
    });
  });
});
