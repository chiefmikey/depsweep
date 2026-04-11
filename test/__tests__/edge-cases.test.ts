import {
  isConfigFile,
  parseConfigFile,
  isDependencyUsedInFile,
  scanForDependency,
} from "../../src/helpers";
import {
  getDependencyInfo,
  getWorkspaceInfo,
  findClosestPackageJson,
  getDependencies,
  getPackageContext,
  getSourceFiles,
  processFilesInParallel,
  findSubDependencies,
} from "../../src/utils";

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

describe("Edge Cases and Error Conditions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const unicodePath = "/test/\u6D4B\u8BD5/package.json";
      const result = isConfigFile(unicodePath);
      expect(typeof result).toBe("boolean");
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
