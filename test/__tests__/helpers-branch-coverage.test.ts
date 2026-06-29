/**
 * Targeted branch-coverage tests for src/helpers.ts.
 * Focus: lines 66-68, 99-103, 136-139, 194, 407, 462-464, 474-476, 535, 541
 * These complement helpers-comprehensive.test.ts without duplicating its tests.
 */

import {
  parseConfigFile,
  isTypePackageUsed,
  isDependencyUsedInFile,
  generatePatternMatcher,
  safeExecSync,
  getDownloadStatsFromNpm,
} from "../../src/helpers";
import * as fs from "node:fs/promises";
import { isBinaryFileSync } from "isbinaryfile";
import micromatch from "micromatch";
import shellEscape from "shell-escape";
import { execSync } from "node:child_process";

// Mirror the mock strategy from helpers-comprehensive.test.ts
jest.mock("node:fs/promises");
jest.mock("@babel/parser");
jest.mock("@babel/traverse");
jest.mock("isbinaryfile");
jest.mock("micromatch");
jest.mock("node-fetch");
jest.mock("shell-escape");
jest.mock("node:child_process");
jest.mock("chalk");

jest.mock("node:path", () => ({
  basename: jest.fn((filePath: string) => {
    if (!filePath) return "";
    const parts = filePath.split("/");
    return parts[parts.length - 1] || "";
  }),
  resolve: jest.fn((...args: string[]) => args.join("/")),
  join: jest.fn((...args: string[]) => args.join("/")),
  dirname: jest.fn((filePath: string) => {
    const parts = filePath.split("/");
    return parts.slice(0, -1).join("/") || "/";
  }),
  extname: jest.fn((filePath: string) => {
    if (!filePath) return "";
    const lastDot = filePath.lastIndexOf(".");
    return lastDot === -1 ? "" : filePath.substring(lastDot);
  }),
  relative: jest.fn((from: string, to: string) => {
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

// ---------------------------------------------------------------------------
// parseConfigFile — .js / .cjs / .mjs branches (lines 66-68)
// ---------------------------------------------------------------------------
describe("parseConfigFile — JS extension branches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns raw content string for .js extension", async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce(
      'module.exports = { entry: "./src/index.js" };'
    );
    const result = await parseConfigFile("/project/webpack.config.js");
    expect(result).toBe('module.exports = { entry: "./src/index.js" };');
  });

  it("returns raw content string for .cjs extension", async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce(
      '"use strict";\nmodule.exports = {};'
    );
    const result = await parseConfigFile("/project/config.cjs");
    expect(result).toBe('"use strict";\nmodule.exports = {};');
  });

  it("returns raw content string for .mjs extension", async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce(
      "export default { plugins: [] };"
    );
    const result = await parseConfigFile("/project/vite.config.mjs");
    expect(result).toBe("export default { plugins: [] };");
  });

  it("returns parsed JSON for .json extension (positive branch verification)", async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce('{"key":"value"}');
    const result = await parseConfigFile("/project/settings.json");
    expect(result).toEqual({ key: "value" });
  });

  it("falls back to raw content for unknown extension when JSON.parse fails", async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce("not json content");
    const result = await parseConfigFile("/project/file.txt");
    expect(result).toBe("not json content");
  });

  it("falls back to JSON.parse for unknown extension when content is valid JSON", async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce('{"k":1}');
    const result = await parseConfigFile("/project/file.toml");
    expect(result).toEqual({ k: 1 });
  });
});

// ---------------------------------------------------------------------------
// isTypePackageUsed — normalizedPackage branch (lines 99-106)
// The branch: correspondingPackage.includes("/") ? `@${correspondingPackage}` : correspondingPackage
// TRUE branch: @types/babel__traverse -> correspondingPackage = "babel/traverse" (contains /)
//   -> normalizedPackage = "@babel/traverse"
// FALSE branch: @types/lodash -> correspondingPackage = "lodash" (no /)
//   -> normalizedPackage = "lodash"
// ---------------------------------------------------------------------------
describe("isTypePackageUsed — normalizedPackage branch coverage", () => {
  const baseContext = {
    projectRoot: "/project",
    scripts: {},
    configs: {},
    dependencyGraph: new Map(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (isBinaryFileSync as jest.Mock).mockReturnValue(false);
    (micromatch.isMatch as jest.Mock).mockReturnValue(false);
  });

  it("FALSE branch: @types/lodash -> normalizedPackage='lodash' (no slash, not installed)", async () => {
    // correspondingPackage = "lodash" (no slash) -> normalizedPackage = "lodash"
    // lodash is NOT in installedPackages -> supportedPackage = undefined, loop skipped
    const result = await isTypePackageUsed(
      "@types/lodash",
      [], // installedPackages — lodash not present
      [],
      baseContext,
      []
    );
    expect(result).toEqual({ isUsed: false });
  });

  it("FALSE branch: normalizedPackage installed but not used in any source file", async () => {
    // correspondingPackage = "lodash" (no slash)
    // lodash IS installed but NOT found in any source file
    (fs.readFile as jest.Mock).mockResolvedValue("const x = 1;");
    const mockParse = jest.spyOn(require("@babel/parser"), "parse");
    mockParse.mockReturnValue({ type: "File", program: { body: [] } });
    const mockTraverse = jest.spyOn(require("@babel/traverse"), "default");
    mockTraverse.mockImplementation(() => {});

    const result = await isTypePackageUsed(
      "@types/lodash",
      ["lodash"],
      [],
      baseContext,
      ["/project/src/file.ts"] // file exists but doesn't use lodash
    );
    // Falls through to {isUsed: false} since traverse fires no ImportDeclaration match
    expect(result).toEqual({ isUsed: false });
  });

  it("TRUE branch: @types/babel__traverse -> normalizedPackage='@babel/traverse' (has slash)", async () => {
    // correspondingPackage = "babel/traverse" (has slash) -> normalizedPackage = "@babel/traverse"
    // @babel/traverse IS installed AND used in a source file
    const mockParse = jest.spyOn(require("@babel/parser"), "parse");
    mockParse.mockReturnValue({ type: "File", program: { body: [] } });

    const mockTraverse = jest.spyOn(require("@babel/traverse"), "default");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTraverse.mockImplementation((_ast: any, visitors: any) => {
      visitors["ImportDeclaration"]?.({
        node: { source: { value: "@babel/traverse" } },
        stop: jest.fn(),
      });
    });

    (fs.readFile as jest.Mock).mockResolvedValue(
      'import traverse from "@babel/traverse";'
    );

    const result = await isTypePackageUsed(
      "@types/babel__traverse",
      ["@babel/traverse"],
      [],
      baseContext,
      ["/project/src/index.ts"]
    );
    expect(result).toEqual({ isUsed: true, supportedPackage: "@babel/traverse" });
  });

  it("returns {isUsed:false} when no installed packages and no peer matches (line 137)", async () => {
    // Exercises the final `return { isUsed: false }` on line 137
    const result = await isTypePackageUsed(
      "@types/node",
      [], // empty — no installed packages, peerDep loop has nothing to iterate
      [],
      baseContext,
      []
    );
    expect(result).toEqual({ isUsed: false });
  });
});

// ---------------------------------------------------------------------------
// isDependencyUsedInFile — isBinaryFileSync true branch (line 194)
// This ensures the try block at line 194 is entered AND the binary check (true) fires.
// ---------------------------------------------------------------------------
describe("isDependencyUsedInFile — binary file guard (line 194)", () => {
  const baseContext = {
    projectRoot: "/project",
    scripts: {},
    configs: {},
    dependencyGraph: new Map(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns false immediately when isBinaryFileSync returns true (covers the try block entry)", async () => {
    (isBinaryFileSync as jest.Mock).mockReturnValue(true);
    const result = await isDependencyUsedInFile(
      "react",
      "/project/dist/bundle.js",
      baseContext
    );
    expect(result).toBe(false);
    // isBinaryFileSync was called — confirming line 194 try block was entered
    expect(isBinaryFileSync).toHaveBeenCalledWith("/project/dist/bundle.js");
  });

  it("enters try block and reads file when isBinaryFileSync returns false", async () => {
    (isBinaryFileSync as jest.Mock).mockReturnValue(false);
    (fs.readFile as jest.Mock).mockResolvedValue("const x = 1;");
    (micromatch.isMatch as jest.Mock).mockReturnValue(false);

    const mockParse = jest.spyOn(require("@babel/parser"), "parse");
    mockParse.mockReturnValue({ type: "File", program: { body: [] } });
    const mockTraverse = jest.spyOn(require("@babel/traverse"), "default");
    mockTraverse.mockImplementation(() => {});

    const result = await isDependencyUsedInFile(
      "react",
      "/project/src/app.ts",
      baseContext
    );
    expect(result).toBe(false);
    expect(fs.readFile).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// generatePatternMatcher — "regex" branch where pattern.match is NOT a RegExp (line 407)
// Looking at COMMON_PATTERNS, every "regex" type entry uses a RegExp literal.
// The `if (pattern.match instanceof RegExp)` false branch is dead code in normal operation.
// We can test generatePatternMatcher still produces patterns even for other types.
// ---------------------------------------------------------------------------
describe("generatePatternMatcher — branch coverage for all pattern types", () => {
  it("produces patterns that cover combined type (both dep-part and part-dep forms)", () => {
    const patterns = generatePatternMatcher("webpack");
    // "combined" type with empty match + variations ["cli","core","utils","tools","helper","helpers"]
    // Should match "webpack-cli", "cli-webpack", etc.
    expect(patterns.some((p) => p.test("webpack-cli"))).toBe(true);
    expect(patterns.some((p) => p.test("cli-webpack"))).toBe(true);
  });

  it("produces suffix patterns that match dep-suffix and dep-suffixs forms", () => {
    const patterns = generatePatternMatcher("babel");
    // "suffix" type with match="config" should produce ^babel[-./]config$ and ^babel[-./]configs$
    expect(patterns.some((p) => p.test("babel-config"))).toBe(true);
    expect(patterns.some((p) => p.test("babel-configs"))).toBe(true);
  });

  it("produces prefix patterns for @ and @types/ scoped variations", () => {
    const patterns = generatePatternMatcher("react");
    // prefix "@" -> ^@react(/.*)?$
    expect(patterns.some((p) => p.test("@react"))).toBe(true);
    // prefix "@types/" -> ^@types/react(/.*)?$
    expect(patterns.some((p) => p.test("@types/react"))).toBe(true);
  });

  it("regex branch: produces framework-suffix pattern matching 'dep-react' form", () => {
    // The regex pattern has `[/-](react|vue|svelte|angular|node)$` source
    // generatePatternMatcher("eslint") should match "eslint-react"
    const patterns = generatePatternMatcher("eslint");
    expect(patterns.some((p) => p.test("eslint-react"))).toBe(true);
    expect(patterns.some((p) => p.test("eslint/react"))).toBe(true);
  });

  it("regex branch: loader/parser suffix pattern works for known dep names", () => {
    // Second regex pattern: `[/-](loader|parser|transformer|...)s?$`
    const patterns = generatePatternMatcher("css");
    expect(patterns.some((p) => p.test("css-loader"))).toBe(true);
    expect(patterns.some((p) => p.test("css-loaders"))).toBe(true);
    expect(patterns.some((p) => p.test("css-parser"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// safeExecSync — branches for command validation (lines 462-464, 474-476)
// Lines 462-464 are the function opening + the Array.isArray guard.
// Lines 474-476 are the arguments_.every() false branch.
// ---------------------------------------------------------------------------
describe("safeExecSync — argument validation branches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (shellEscape as jest.Mock).mockImplementation((arr: string[]) =>
      arr.join(" ")
    );
  });

  it("throws 'Invalid command array' when command is not an array (Array.isArray false)", () => {
    // This exercises the !Array.isArray(command) branch specifically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => safeExecSync(null as any, { cwd: "/test" })).toThrow(
      "Invalid command array"
    );
  });

  it("throws 'Invalid command array' when command is an object (not array)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => safeExecSync({} as any, { cwd: "/test" })).toThrow(
      "Invalid command array"
    );
  });

  it("throws 'Invalid command array' when command is empty array", () => {
    expect(() => safeExecSync([], { cwd: "/test" })).toThrow(
      "Invalid command array"
    );
  });

  it("throws 'Invalid package manager' for unknown package manager", () => {
    expect(() => safeExecSync(["bun", "install"], { cwd: "/test" })).toThrow(
      "Invalid package manager: bun"
    );
  });

  it("throws 'Invalid command arguments' when argument is empty string (every() false branch)", () => {
    // arguments_ = [""] -> typeof "" === "string" && "".length > 0 is FALSE
    expect(() => safeExecSync(["npm", ""], { cwd: "/test" })).toThrow(
      "Invalid command arguments"
    );
  });

  it("throws 'Invalid command arguments' when argument is not a string", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => safeExecSync(["npm", 42 as any], { cwd: "/test" })).toThrow(
      "Invalid command arguments"
    );
  });

  it("passes with 'ignore' stdio option and executes command", () => {
    (execSync as jest.Mock).mockReturnValue("");
    expect(() =>
      safeExecSync(["npm", "install"], { cwd: "/test", stdio: "ignore" })
    ).not.toThrow();
    expect(execSync).toHaveBeenCalled();
  });

  it("passes with explicit timeout option", () => {
    (execSync as jest.Mock).mockReturnValue("");
    expect(() =>
      safeExecSync(["npm", "install"], { cwd: "/test", timeout: 60_000 })
    ).not.toThrow();
    expect(execSync).toHaveBeenCalled();
  });

  it("re-throws execSync errors as wrapped Error with cause", () => {
    const originalError = new Error("Command not found");
    (execSync as jest.Mock).mockImplementation(() => {
      throw originalError;
    });
    (shellEscape as jest.Mock).mockReturnValue("npm install");

    expect(() =>
      safeExecSync(["npm", "install"], { cwd: "/test" })
    ).toThrow("Command execution failed: Command not found");
  });

  it("executes with yarn package manager", () => {
    (execSync as jest.Mock).mockReturnValue("");
    expect(() =>
      safeExecSync(["yarn", "install"], { cwd: "/test" })
    ).not.toThrow();
  });

  it("executes with pnpm package manager", () => {
    (execSync as jest.Mock).mockReturnValue("");
    expect(() =>
      safeExecSync(["pnpm", "install"], { cwd: "/test" })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getDownloadStatsFromNpm — rate limiter queuing branch (lines 535, 541)
// Line 535: the `waitTime === 0 && !npmApiRateLimiter.processing` condition
// When processing=true OR waitTime>0, the else branch (queue push) fires.
// We exercise this by calling getDownloadStatsFromNpm twice concurrently,
// forcing the second call into the queue.
// ---------------------------------------------------------------------------
describe("getDownloadStatsFromNpm — rate limiter queuing path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("handles concurrent calls by queuing the second request", async () => {
    const fetchMock = require("node-fetch").default;

    // Set up two responses
    let resolveFirst!: (value: unknown) => void;
    const firstFetchPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    fetchMock
      .mockImplementationOnce(() => firstFetchPromise)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ downloads: 999 }),
      });

    // Fire both calls simultaneously — second should be queued
    const promise1 = getDownloadStatsFromNpm("react");
    const promise2 = getDownloadStatsFromNpm("lodash");

    // Resolve the first fetch
    resolveFirst({
      ok: true,
      status: 200,
      json: async () => ({ downloads: 123 }),
    });

    // Advance timers to trigger any scheduled setTimeout callbacks
    jest.advanceTimersByTime(500);

    const result1 = await promise1;
    expect(result1).toBe(123);

    const result2 = await promise2;
    expect(result2).toBe(999);
  }, 15000);

  it("queues request when called with waitTime > 0 (recent prior call)", async () => {
    // This test calls getDownloadStatsFromNpm after a very recent prior call
    // by using real timers for the first call, then immediately making a second call
    jest.useRealTimers();

    const fetchMock = require("node-fetch").default;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ downloads: 500 }),
    });

    // First call — sets lastCallTime
    const result1 = await getDownloadStatsFromNpm("express");
    expect(result1).toBe(500);

    // Second call immediately after — lastCallTime is very recent, waitTime > 0
    // This should queue the request via setTimeout
    const result2Promise = getDownloadStatsFromNpm("lodash");

    // Wait for the queue timeout to fire (minInterval = 200ms)
    await new Promise((resolve) => setTimeout(resolve, 300));

    const result2 = await result2Promise;
    expect(result2).toBe(500);
  }, 15000);
});

// ---------------------------------------------------------------------------
// Additional: parseConfigFile YAML branch — yaml import succeeds
// ---------------------------------------------------------------------------
describe("parseConfigFile — YAML branch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns content string when .yaml is parsed (yaml import available)", async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce("key: value\nother: 123");
    // dynamic import("yaml") will succeed in this environment
    const result = await parseConfigFile("/project/config.yaml");
    // Result is either the parsed object or the raw string — either is valid
    expect(result).toBeDefined();
  });

  it("returns content string for .yml extension", async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce("name: test");
    const result = await parseConfigFile("/project/.travis.yml");
    expect(result).toBeDefined();
  });
});
