/**
 * Detection Pipeline Tests
 *
 * Tests for the core dependency detection pipeline:
 * 1. OptimizedDependencyAnalyzer regex patterns (getCompiledPatterns)
 * 2. OptimizedDependencyAnalyzer.isDependencyUsedInFile (file-level detection)
 * 3. getDependencyInfo detection layers (scripts, config fields, plugin conventions, etc.)
 */

import { jest } from "@jest/globals";

// Mock node:fs/promises before any imports that use it
jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
}));

// Mock helpers to avoid pulling in Babel/traverse for these unit tests
jest.mock("../../src/helpers.js", () => ({
  isConfigFile: jest.fn(() => false),
  parseConfigFile: jest.fn(),
  isDependencyUsedInFile: jest.fn(() => Promise.resolve(false)),
  customSort: jest.fn((a: string, b: string) => a.localeCompare(b)),
}));

// Mock globby and other external deps that getDependencyInfo's module (utils) imports
jest.mock("globby", () => ({
  globby: jest.fn(() => Promise.resolve([])),
}));

jest.mock("find-up", () => ({
  findUp: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("isbinaryfile", () => ({
  isBinaryFileSync: jest.fn(() => false),
}));

import * as fs from "node:fs/promises";
import {
  OptimizedDependencyAnalyzer,
  OptimizedFileReader,
} from "../../src/performance-optimizations.js";
import { getDependencyInfo } from "../../src/utils.js";
import type { DependencyContext } from "../../src/interfaces.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- overloaded fs.readFile signature
const mockReadFile = fs.readFile as jest.MockedFunction<any>;

// ---------------------------------------------------------------------------
// Part 1: OptimizedDependencyAnalyzer regex patterns
// ---------------------------------------------------------------------------
describe("OptimizedDependencyAnalyzer", () => {
  let analyzer: OptimizedDependencyAnalyzer;

  beforeAll(() => {
    analyzer = OptimizedDependencyAnalyzer.getInstance();
  });

  afterEach(() => {
    analyzer.clearCaches();
  });

  /**
   * Helper: test whether at least one compiled pattern matches the content.
   * This mirrors the logic in isDependencyUsedInFile without needing file I/O.
   */
  function matchesAnyPattern(content: string, depName: string): boolean {
    const patterns = analyzer.getCompiledPatterns(depName);
    return patterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(content);
    });
  }

  describe("getCompiledPatterns -- ESM imports", () => {
    it("should detect named import with single quotes", () => {
      const content = `import { something } from 'lodash';`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect named import with double quotes", () => {
      const content = `import { something } from "lodash";`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect default import", () => {
      const content = `import lodash from 'lodash';`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect namespace import", () => {
      const content = `import * as _ from 'lodash';`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect side-effect import", () => {
      const content = `import 'lodash';`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect dynamic import", () => {
      const content = `const mod = await import('lodash');`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect dynamic import with double quotes", () => {
      const content = `const mod = await import("lodash");`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });
  });

  describe("getCompiledPatterns -- CommonJS require", () => {
    it("should detect require with single quotes", () => {
      const content = `const _ = require('lodash');`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect require with double quotes", () => {
      const content = `const _ = require("lodash");`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect inline require", () => {
      const content = `const result = require('lodash').merge({}, {});`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });
  });

  describe("getCompiledPatterns -- scoped packages", () => {
    it("should detect scoped package import", () => {
      const content = `import { parse } from '@babel/parser';`;
      expect(matchesAnyPattern(content, "@babel/parser")).toBe(true);
    });

    it("should detect scoped package require", () => {
      const content = `const parser = require('@babel/parser');`;
      expect(matchesAnyPattern(content, "@babel/parser")).toBe(true);
    });

    it("should detect scoped package dynamic import", () => {
      const content = `const mod = await import('@babel/parser');`;
      expect(matchesAnyPattern(content, "@babel/parser")).toBe(true);
    });

    it("should detect scoped package side-effect import", () => {
      const content = `import '@angular/core';`;
      expect(matchesAnyPattern(content, "@angular/core")).toBe(true);
    });
  });

  describe("getCompiledPatterns -- subpath imports", () => {
    it("should detect subpath import via context-boundary pattern", () => {
      const content = `import something from 'lodash/merge';`;
      // The from-pattern requires ending quote right after dep name, so
      // 'lodash/merge' won't match there. But the context-boundary pattern
      // matches 'lodash/ (quote before, slash after).
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should detect scoped subpath import", () => {
      const content = `import { something } from '@babel/parser/lib';`;
      expect(matchesAnyPattern(content, "@babel/parser")).toBe(true);
    });
  });

  describe("getCompiledPatterns -- webpack inline loader syntax", () => {
    it("should detect loader at start of webpack require chain", () => {
      // The webpack pattern matches require('<dep>!...' or import('<dep>!...')
      const content = `require('style-loader!css-loader!./file.css');`;
      expect(matchesAnyPattern(content, "style-loader")).toBe(true);
    });

    it("should not detect loader in the middle of webpack chain (known limitation)", () => {
      // Loaders after the first ! are not matched by the webpack inline regex.
      // The context-boundary pattern also doesn't match because '!' is not in
      // its boundary character class. This is a known limitation.
      const content = `require('!style-loader!css-loader!./styles.css');`;
      expect(matchesAnyPattern(content, "css-loader")).toBe(false);
    });
  });

  describe("getCompiledPatterns -- negative cases", () => {
    it("should not match when package is not present at all", () => {
      const content = `const x = 1;\nconst y = 2;`;
      expect(matchesAnyPattern(content, "lodash")).toBe(false);
    });

    it("should not match partial package name (lodash vs lodash-es)", () => {
      const content = `import { merge } from 'lodash-es';`;
      expect(matchesAnyPattern(content, "lodash")).toBe(false);
    });

    it("should match package name in plain text (known limitation, favoring recall)", () => {
      // The context-boundary pattern uses broad word boundaries so "lodash"
      // preceded by a space and followed by a space WILL match.
      // This is intentional: regex detection favors recall over precision.
      const content = `const msg = "please install lodash manually";`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });

    it("should not match node_modules reference for wrong package", () => {
      const content = `node_modules/express/index.js`;
      expect(matchesAnyPattern(content, "lodash")).toBe(false);
    });

    it("should match node_modules reference for correct package", () => {
      const content = `node_modules/lodash/index.js`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });
  });

  describe("getCompiledPatterns -- lastIndex reset safety", () => {
    it("should produce consistent results across repeated calls", () => {
      // The g flag on regex can cause alternating true/false if lastIndex
      // is not reset. Verify the fix works.
      const content = `import { x } from 'lodash';`;
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
      expect(matchesAnyPattern(content, "lodash")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // isDependencyUsedInFile -- integration with file reader
  // -------------------------------------------------------------------------
  describe("isDependencyUsedInFile", () => {
    beforeEach(() => {
      analyzer.clearCaches();
      OptimizedFileReader.getInstance().clearCache();
      jest.resetAllMocks();
    });

    it("should return true when file contains an import of the dependency", async () => {
      mockReadFile.mockResolvedValue(
        `import { merge } from 'lodash';\n`,
      );

      const result = await analyzer.isDependencyUsedInFile(
        "lodash",
        "/project/src/index.ts",
        {},
      );
      expect(result).toBe(true);
    });

    it("should return false when file does not reference the dependency", async () => {
      mockReadFile.mockResolvedValue(
        `const x = 1;\nconsole.log(x);\n`,
      );

      const result = await analyzer.isDependencyUsedInFile(
        "lodash",
        "/project/src/nolodash.ts",
        {},
      );
      expect(result).toBe(false);
    });

    it("should return false for very short files (< 10 chars)", async () => {
      mockReadFile.mockResolvedValue(`x = 1;`);

      const result = await analyzer.isDependencyUsedInFile(
        "lodash",
        "/project/src/tiny.ts",
        {},
      );
      expect(result).toBe(false);
    });

    it("should return false when file read fails", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await analyzer.isDependencyUsedInFile(
        "lodash",
        "/project/src/missing.ts",
        {},
      );
      expect(result).toBe(false);
    });

    it("should detect scoped package in file", async () => {
      mockReadFile.mockResolvedValue(
        `import traverse from '@babel/traverse';\n`,
      );

      const result = await analyzer.isDependencyUsedInFile(
        "@babel/traverse",
        "/project/src/ast.ts",
        {},
      );
      expect(result).toBe(true);
    });

    it("should use cache for repeated lookups on same file+dep", async () => {
      mockReadFile.mockResolvedValue(
        `import { x } from 'lodash';\n`,
      );

      const r1 = await analyzer.isDependencyUsedInFile(
        "lodash",
        "/project/src/cached.ts",
        {},
      );
      const r2 = await analyzer.isDependencyUsedInFile(
        "lodash",
        "/project/src/cached.ts",
        {},
      );

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      // File read only once -- analysis cache serves the second call.
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Part 2: getDependencyInfo detection layers
//
// Each test uses a unique projectRoot to avoid depInfoCache collisions
// (the module-internal cache keys on `projectRoot:depName`).
// ---------------------------------------------------------------------------
describe("getDependencyInfo detection layers", () => {
  let testCounter = 0;

  beforeEach(() => {
    testCounter++;
    jest.resetAllMocks();

    // Clear singleton caches to avoid cross-test pollution
    OptimizedFileReader.getInstance().clearCache();
    OptimizedDependencyAnalyzer.getInstance().clearCaches();
  });

  /** Unique project root per test to bypass the module-level depInfoCache. */
  function uniqueRoot(): string {
    return `/tmp/test-project-${testCounter}`;
  }

  function makeContext(
    root: string,
    overrides: Partial<DependencyContext> = {},
  ): DependencyContext {
    return {
      scripts: {},
      configs: {},
      projectRoot: root,
      ...overrides,
    };
  }

  // -----------------------------------------------------------------------
  // Layer: npm scripts
  // -----------------------------------------------------------------------
  describe("npm scripts detection", () => {
    it("should detect dependency referenced in scripts", async () => {
      const root = uniqueRoot();
      const context = makeContext(root, {
        scripts: { clean: "rimraf dist" },
      });

      const result = await getDependencyInfo(
        "rimraf",
        context,
        [],
        new Set(["rimraf"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(scripts)");
    });

    it("should detect dependency name embedded in a longer script", async () => {
      const root = uniqueRoot();
      const context = makeContext(root, {
        scripts: { test: "cross-env NODE_ENV=test jest" },
      });

      const result = await getDependencyInfo(
        "cross-env",
        context,
        [],
        new Set(["cross-env"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(scripts)");
    });

    it("should not detect dependency not in scripts", async () => {
      const root = uniqueRoot();
      const context = makeContext(root, {
        scripts: { test: "jest --coverage" },
      });

      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await getDependencyInfo(
        "lodash",
        context,
        [],
        new Set(["lodash"]),
      );

      expect(result.usedInFiles.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer: package.json config fields
  // -----------------------------------------------------------------------
  describe("package.json config field detection", () => {
    it("should detect dep referenced in eslintConfig field", async () => {
      const root = uniqueRoot();
      const context = makeContext(root, {
        configs: {
          "package.json": {
            eslintConfig: {
              extends: ["plugin:prettier/recommended"],
            },
          },
        },
      });

      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await getDependencyInfo(
        "prettier",
        context,
        [],
        new Set(["prettier"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(config fields)");
    });

    it("should detect dep when it has a top-level config key matching its name", async () => {
      const root = uniqueRoot();
      const context = makeContext(root, {
        configs: {
          "package.json": {
            commitlint: {
              extends: ["@commitlint/config-conventional"],
            },
          },
        },
      });

      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await getDependencyInfo(
        "commitlint",
        context,
        [],
        new Set(["commitlint"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(config fields)");
    });

    it("should detect dep in jest config field", async () => {
      const root = uniqueRoot();
      const context = makeContext(root, {
        configs: {
          "package.json": {
            jest: {
              transform: {
                "^.+\\.tsx?$": "ts-jest",
              },
            },
          },
        },
      });

      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await getDependencyInfo(
        "ts-jest",
        context,
        [],
        new Set(["ts-jest"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(config fields)");
    });

    it("should not treat standard package.json fields as config", async () => {
      const root = uniqueRoot();
      const context = makeContext(root, {
        configs: {
          "package.json": {
            name: "my-project",
          },
        },
      });

      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const result = await getDependencyInfo(
        "name",
        context,
        [],
        new Set(["name"]),
      );

      expect(result.usedInFiles.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer: framework plugin conventions
  // -----------------------------------------------------------------------
  describe("framework plugin convention detection", () => {
    it("should not detect eslint-plugin-* without matching config or scripts", async () => {
      const root = uniqueRoot();
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "eslint-plugin-import",
        context,
        [],
        new Set(["eslint", "eslint-plugin-import"]),
      );

      // No config files, no scripts, no source files containing "import" --
      // the plugin convention check falls through.
      expect(result.usedInFiles.length).toBe(0);
    });

    it("should detect eslint-formatter-* via short name in scripts", async () => {
      const root = uniqueRoot();
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const context = makeContext(root, {
        scripts: {
          lint: "eslint --format pretty .",
        },
      });

      const result = await getDependencyInfo(
        "eslint-formatter-pretty",
        context,
        [],
        new Set(["eslint", "eslint-formatter-pretty"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(eslint plugin:scripts)");
    });

    it("should detect karma-* plugin when karma is installed", async () => {
      const root = uniqueRoot();
      const confPath = `${root}/karma.conf.js`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === confPath) {
          return Promise.resolve(
            `module.exports = function(config) {\n  config.set({\n    browsers: ['chrome-launcher']\n  });\n};\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "karma-chrome-launcher",
        context,
        [confPath],
        new Set(["karma", "karma-chrome-launcher"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(karma plugin)");
    });

    it("should detect grunt-* plugin when grunt is installed", async () => {
      const root = uniqueRoot();
      const gruntPath = `${root}/Gruntfile.js`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === gruntPath) {
          return Promise.resolve(
            `module.exports = function(grunt) {\n  grunt.loadNpmTasks('contrib-uglify');\n};\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "grunt-contrib-uglify",
        context,
        [gruntPath],
        new Set(["grunt", "grunt-contrib-uglify"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(grunt plugin)");
    });
  });

  // -----------------------------------------------------------------------
  // Layer: vitest coverage provider
  // -----------------------------------------------------------------------
  describe("vitest coverage provider detection", () => {
    it("should detect @vitest/coverage-v8 via vitest config", async () => {
      const root = uniqueRoot();
      const configPath = `${root}/vitest.config.ts`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === configPath) {
          return Promise.resolve(
            `export default defineConfig({\n  test: {\n    coverage: {\n      provider: 'v8'\n    }\n  }\n});\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "@vitest/coverage-v8",
        context,
        [configPath],
        new Set(["vitest", "@vitest/coverage-v8"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(vitest coverage provider)");
    });

    it("should detect @vitest/coverage-istanbul via vite config", async () => {
      const root = uniqueRoot();
      const configPath = `${root}/vite.config.ts`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === configPath) {
          return Promise.resolve(
            `export default {\n  test: {\n    coverage: {\n      provider: "istanbul"\n    }\n  }\n};\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "@vitest/coverage-istanbul",
        context,
        [configPath],
        new Set(["vitest", "@vitest/coverage-istanbul"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(vitest coverage provider)");
    });

    it("should not detect vitest coverage when provider does not match", async () => {
      const root = uniqueRoot();
      const configPath = `${root}/vitest.config.ts`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === configPath) {
          return Promise.resolve(
            `export default defineConfig({\n  test: {\n    coverage: {\n      provider: 'istanbul'\n    }\n  }\n});\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "@vitest/coverage-v8",
        context,
        [configPath],
        new Set(["vitest", "@vitest/coverage-v8"]),
      );

      expect(result.usedInFiles.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer: jest environment detection
  // -----------------------------------------------------------------------
  describe("jest environment detection", () => {
    it("should detect jest-environment-jsdom via jest config file", async () => {
      const root = uniqueRoot();
      const configPath = `${root}/jest.config.js`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === configPath) {
          return Promise.resolve(
            `module.exports = {\n  testEnvironment: 'jsdom'\n};\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "jest-environment-jsdom",
        context,
        [configPath],
        new Set(["jest", "jest-environment-jsdom"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(jest testEnvironment)");
    });

    it("should detect jest-environment-jsdom via package.json jest field", async () => {
      const root = uniqueRoot();
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const context = makeContext(root, {
        configs: {
          "package.json": {
            jest: {
              testEnvironment: "jsdom",
            },
          },
        },
      });

      const result = await getDependencyInfo(
        "jest-environment-jsdom",
        context,
        [],
        new Set(["jest", "jest-environment-jsdom"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(jest testEnvironment)");
    });

    it("should not detect jest env when environment name does not match", async () => {
      const root = uniqueRoot();
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const context = makeContext(root, {
        configs: {
          "package.json": {
            jest: {
              testEnvironment: "node",
            },
          },
        },
      });

      const result = await getDependencyInfo(
        "jest-environment-jsdom",
        context,
        [],
        new Set(["jest", "jest-environment-jsdom"]),
      );

      expect(result.usedInFiles.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer: binary name detection in scripts
  // -----------------------------------------------------------------------
  describe("binary name detection", () => {
    it("should detect dep via its binary name in scripts", async () => {
      const root = uniqueRoot();

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p.includes("node_modules/@commitlint/cli/package.json")) {
          return Promise.resolve(
            JSON.stringify({
              name: "@commitlint/cli",
              bin: { commitlint: "./cli.js" },
            }),
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root, {
        scripts: {
          "commit-msg": "commitlint --edit $1",
        },
      });

      const result = await getDependencyInfo(
        "@commitlint/cli",
        context,
        [],
        new Set(["@commitlint/cli"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(scripts:bin)");
    });

    it("should detect dep with string bin field via inferred name", async () => {
      const root = uniqueRoot();

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p.includes("node_modules/rimraf/package.json")) {
          return Promise.resolve(
            JSON.stringify({
              name: "rimraf",
              bin: "./bin.js",
            }),
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root, {
        scripts: {
          clean: "rimraf dist",
        },
      });

      const result = await getDependencyInfo(
        "rimraf",
        context,
        [],
        new Set(["rimraf"]),
      );

      // "rimraf" is directly in scripts, so it is caught by the scripts layer
      // before the binary name layer. Either way, it should be detected.
      expect(result.usedInFiles.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer: peer dependency awareness
  // -----------------------------------------------------------------------
  describe("peer dependency detection", () => {
    it("should detect dep required as peer by another installed package", async () => {
      const root = uniqueRoot();

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p.includes("node_modules/eslint-plugin-react/package.json")) {
          return Promise.resolve(
            JSON.stringify({
              name: "eslint-plugin-react",
              peerDependencies: {
                eslint: ">=7",
                "eslint-plugin-react-hooks": ">=4",
              },
            }),
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "eslint-plugin-react-hooks",
        context,
        [],
        new Set(["eslint", "eslint-plugin-react", "eslint-plugin-react-hooks"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(required peer)");
    });

    it("should not match peer dep if no other package requires it", async () => {
      const root = uniqueRoot();

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p.includes("node_modules/express/package.json")) {
          return Promise.resolve(
            JSON.stringify({
              name: "express",
              peerDependencies: {},
            }),
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "lodash",
        context,
        [],
        new Set(["express", "lodash"]),
      );

      expect(result.usedInFiles.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer: source file regex detection (via OptimizedDependencyAnalyzer)
  // -----------------------------------------------------------------------
  describe("source file regex detection", () => {
    it("should detect dependency imported in a source file", async () => {
      const root = uniqueRoot();
      const srcFile = `${root}/src/index.ts`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === srcFile) {
          return Promise.resolve(
            `import { merge } from 'lodash';\nconst data = merge({}, {});\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "lodash",
        context,
        [srcFile],
        new Set(["lodash"]),
      );

      expect(result.usedInFiles).toContain(srcFile);
    });

    it("should detect dependency required in a source file", async () => {
      const root = uniqueRoot();
      const srcFile = `${root}/lib/util.js`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === srcFile) {
          return Promise.resolve(
            `const chalk = require('chalk');\nconsole.log(chalk.green('ok'));\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "chalk",
        context,
        [srcFile],
        new Set(["chalk"]),
      );

      expect(result.usedInFiles).toContain(srcFile);
    });

    it("should return empty usedInFiles when dep is not in any source file", async () => {
      const root = uniqueRoot();
      const srcFile = `${root}/src/app.ts`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === srcFile) {
          return Promise.resolve(
            `const x = 42;\nexport default x;\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "lodash",
        context,
        [srcFile],
        new Set(["lodash"]),
      );

      expect(result.usedInFiles.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer: subdependency usage
  // -----------------------------------------------------------------------
  describe("subdependency detection", () => {
    it("should flag hasSubDependencyUsage when a subdep is imported", async () => {
      const root = uniqueRoot();
      const srcFile = `${root}/src/index.ts`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === srcFile) {
          return Promise.resolve(`import qs from 'qs';\n`);
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root, {
        dependencyGraph: new Map([["express", new Set(["qs"])]]),
      });

      const result = await getDependencyInfo(
        "express",
        context,
        [srcFile],
        new Set(["express"]),
      );

      // express itself is not imported, so usedInFiles is empty
      expect(result.usedInFiles.length).toBe(0);
      // But its subdep "qs" IS imported
      expect(result.hasSubDependencyUsage).toBe(true);
    });

    it("should not flag hasSubDependencyUsage when subdeps are not imported", async () => {
      const root = uniqueRoot();
      const srcFile = `${root}/src/index.ts`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === srcFile) {
          return Promise.resolve(`const x = 1;\n`);
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root, {
        dependencyGraph: new Map([["express", new Set(["qs", "body-parser"])]]),
      });

      const result = await getDependencyInfo(
        "express",
        context,
        [srcFile],
        new Set(["express"]),
      );

      expect(result.hasSubDependencyUsage).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Layer: ESLint import resolver detection
  // -----------------------------------------------------------------------
  describe("ESLint import resolver detection", () => {
    it("should detect eslint-import-resolver-typescript via short name in source", async () => {
      // The import resolver convention (eslint-import-resolver-*) has no configPattern.
      // The pipeline first scans source files for the short name "typescript" via
      // processFilesInBatches. If found, it returns with "(eslint plugin:source)".
      // The explicit resolver check only runs if no prior match was found.
      const root = uniqueRoot();
      const configPath = `${root}/.eslintrc.js`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === configPath) {
          return Promise.resolve(
            `module.exports = {\n  settings: {\n    'import/resolver': {\n      'typescript': true\n    }\n  }\n};\n`,
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "eslint-import-resolver-typescript",
        context,
        [configPath],
        new Set(["eslint", "eslint-import-resolver-typescript"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      // The short name "typescript" is found in the file, so the plugin:source
      // check matches before the specific import resolver check runs.
      expect(result.usedInFiles[0]).toContain("(eslint plugin:source)");
    });
  });

  // -----------------------------------------------------------------------
  // Layer: ESLint plugin:NAME/config detection
  // -----------------------------------------------------------------------
  describe("ESLint plugin:NAME/config detection", () => {
    it("should detect eslint-plugin-mdx via plugin:mdx/ extends", async () => {
      const root = uniqueRoot();
      const configPath = `${root}/.eslintrc.json`;

      mockReadFile.mockImplementation((filePath: string) => {
        const p = String(filePath);
        if (p === configPath) {
          return Promise.resolve(
            JSON.stringify({
              extends: ["plugin:mdx/recommended"],
            }),
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const context = makeContext(root);

      const result = await getDependencyInfo(
        "eslint-plugin-mdx",
        context,
        [configPath],
        new Set(["eslint", "eslint-plugin-mdx"]),
      );

      expect(result.usedInFiles.length).toBeGreaterThan(0);
      expect(result.usedInFiles[0]).toContain("(eslint plugin:mdx)");
    });
  });

  // -----------------------------------------------------------------------
  // Framework-specific handling
  // -----------------------------------------------------------------------
  describe("framework development dependency detection", () => {
    it("should detect Angular dev dep when @angular/core is installed", async () => {
      const root = uniqueRoot();
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const context = makeContext(root, {
        configs: {
          "package.json": {
            dependencies: { "@angular/core": "^17.0.0" },
            devDependencies: { "@angular-devkit/build-angular": "^17.0.0" },
          },
        },
      });

      const result = await getDependencyInfo(
        "@angular-devkit/build-angular",
        context,
        [],
        new Set(["@angular/core", "@angular-devkit/build-angular"]),
      );

      // Framework dev deps get added to requiredByPackages, not usedInFiles
      expect(result.requiredByPackages.has("@angular/core")).toBe(true);
    });
  });
});
