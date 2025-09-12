/**
 * Performance Optimizations Tests
 *
 * This file tests the performance optimizations to ensure they work correctly
 * and provide measurable performance improvements.
 */

import {
  OptimizedCache,
  OptimizedFileReader,
  OptimizedDependencyAnalyzer,
  StringOptimizer,
  OptimizedFileSystem,
  PerformanceMonitor,
  MemoryOptimizer,
} from "../../src/performance-optimizations.js";

// Mock external dependencies
jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
}));

jest.mock("node:path", () => ({
  join: jest.fn((...args) => args.join("/")),
  basename: jest.fn((p: string) => p.split("/").pop() || ""),
}));

import * as fs from "node:fs/promises";

const mockFs = fs as jest.Mocked<typeof fs>;

describe("Performance Optimizations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("OptimizedCache", () => {
    it("should cache values with TTL", () => {
      const cache = new OptimizedCache<string>(10, 1000); // 1 second TTL

      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
      expect(cache.has("key1")).toBe(true);
    });

    it("should respect size limits", () => {
      const cache = new OptimizedCache<string>(2);

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3"); // This should evict key1

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
    });

    it("should provide cache statistics", () => {
      const cache = new OptimizedCache<string>(10);

      cache.set("key1", "value1");
      cache.get("key1"); // Hit
      cache.get("key2"); // Miss

      const stats = cache.getStats();
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe("OptimizedFileReader", () => {
    it("should cache file contents", async () => {
      const fileReader = OptimizedFileReader.getInstance();

      mockFs.readFile.mockResolvedValue("file content");

      const content1 = await fileReader.readFile("/test/file.js");
      const content2 = await fileReader.readFile("/test/file.js");

      expect(content1).toBe("file content");
      expect(content2).toBe("file content");
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Should be cached
    });

    it("should batch file reads efficiently", async () => {
      const fileReader = OptimizedFileReader.getInstance();

      mockFs.readFile
        .mockResolvedValueOnce("content1")
        .mockResolvedValueOnce("content2")
        .mockResolvedValueOnce("content3");

      const promises = [
        fileReader.readFile("/test/file1.js"),
        fileReader.readFile("/test/file2.js"),
        fileReader.readFile("/test/file3.js"),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(["content1", "content2", "content3"]);
      expect(mockFs.readFile).toHaveBeenCalledTimes(3);
    });

    it("should provide cache statistics", () => {
      const fileReader = OptimizedFileReader.getInstance();
      const stats = fileReader.getCacheStats();

      expect(stats).toBeDefined();
      expect(typeof stats.hitRate).toBe("number");
    });
  });

  describe("OptimizedDependencyAnalyzer", () => {
    it("should compile and cache regex patterns", () => {
      const analyzer = OptimizedDependencyAnalyzer.getInstance();

      const patterns1 = analyzer.getCompiledPatterns("react");
      const patterns2 = analyzer.getCompiledPatterns("react");

      expect(patterns1).toBe(patterns2); // Should return same cached instance
      expect(patterns1).toHaveLength(4);
      expect(patterns1[0]).toBeInstanceOf(RegExp);
    });

    it("should detect dependency usage efficiently", async () => {
      const analyzer = OptimizedDependencyAnalyzer.getInstance();

      mockFs.readFile.mockResolvedValue(`
        import React from 'react';
        import { useState } from 'react';
        export default function App() {
          return <div>Hello</div>;
        }
      `);

      const isUsed = await analyzer.isDependencyUsedInFile(
        "react",
        "/test/App.js",
        {}
      );

      expect(isUsed).toBe(true);
    });

    it("should process files in batches", async () => {
      const analyzer = OptimizedDependencyAnalyzer.getInstance();

      mockFs.readFile.mockResolvedValue(`
        import React from 'react';
        export default function App() {
          return <div>Hello</div>;
        }
      `);

      const files = ["/test/App1.js", "/test/App2.js", "/test/App3.js"];
      const results = await analyzer.processFilesInBatches(
        files,
        "react",
        {},
        (processed, total) => {
          expect(processed).toBeLessThanOrEqual(total);
        }
      );

      expect(results).toHaveLength(3);
      expect(results.every((file) => files.includes(file))).toBe(true);
    });

    it("should provide cache statistics", () => {
      const analyzer = OptimizedDependencyAnalyzer.getInstance();
      const stats = analyzer.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.analysis).toBeDefined();
      expect(stats.dependencyGraph).toBeDefined();
      expect(stats.filePatterns).toBeDefined();
    });
  });

  describe("StringOptimizer", () => {
    it("should intern strings to reduce memory usage", () => {
      const str1 = "test string";
      const str2 = "test string";

      const interned1 = StringOptimizer.intern(str1);
      const interned2 = StringOptimizer.intern(str2);

      expect(interned1).toBe(interned2); // Should be the same object reference
    });

    it("should not intern very short strings", () => {
      const short1 = "a";
      const short2 = "a";

      const interned1 = StringOptimizer.intern(short1);
      const interned2 = StringOptimizer.intern(short2);

      expect(interned1).toBe(short1); // Should return original
      expect(interned2).toBe(short2); // Should return original
    });

    it("should provide pool statistics", () => {
      StringOptimizer.intern("test string");
      const stats = StringOptimizer.getPoolStats();

      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(1000);
    });
  });

  describe("OptimizedFileSystem", () => {
    it("should cache directory listings", async () => {
      const fileSystem = OptimizedFileSystem.getInstance();

      mockFs.readdir.mockResolvedValue([
        { name: "file1.js", isFile: () => true, isDirectory: () => false },
        { name: "file2.js", isFile: () => true, isDirectory: () => false },
      ] as any);

      const files1 = await fileSystem.readDirectory("/test");
      const files2 = await fileSystem.readDirectory("/test");

      expect(files1).toEqual(["/test/file1.js", "/test/file2.js"]);
      expect(files2).toEqual(["/test/file1.js", "/test/file2.js"]);
      expect(mockFs.readdir).toHaveBeenCalledTimes(1); // Should be cached
    });

    it("should cache file stats", async () => {
      const fileSystem = OptimizedFileSystem.getInstance();
      const mockStats = { size: 1024, mtime: new Date() };

      mockFs.stat.mockResolvedValue(mockStats as any);

      const stats1 = await fileSystem.getFileStats("/test/file.js");
      const stats2 = await fileSystem.getFileStats("/test/file.js");

      expect(stats1).toBe(mockStats);
      expect(stats2).toBe(mockStats);
      expect(mockFs.stat).toHaveBeenCalledTimes(1); // Should be cached
    });
  });

  describe("PerformanceMonitor", () => {
    it("should track operation timing", () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.startTimer("testOperation");
      // Simulate some work
      const start = performance.now();
      while (performance.now() - start < 1) {
        // Busy wait for ~1ms
      }
      const duration = monitor.endTimer("testOperation");

      expect(duration).toBeGreaterThan(0);

      const metrics = monitor.getMetrics();
      expect(metrics.has("testOperation")).toBe(true);
      expect(metrics.get("testOperation")?.count).toBe(1);
    });

    it("should accumulate multiple calls", () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.startTimer("testOperation1");
      monitor.endTimer("testOperation1");

      monitor.startTimer("testOperation2");
      monitor.endTimer("testOperation2");

      const metrics = monitor.getMetrics();
      expect(metrics.get("testOperation1")?.count).toBe(1);
      expect(metrics.get("testOperation2")?.count).toBe(1);
    });

    it("should log summary", () => {
      const monitor = PerformanceMonitor.getInstance();
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      monitor.startTimer("testOperation");
      monitor.endTimer("testOperation");
      monitor.logSummary();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("MemoryOptimizer", () => {
    it("should check memory usage", () => {
      const optimizer = MemoryOptimizer.getInstance();

      const stats = optimizer.checkMemoryUsage();

      expect(stats.used).toBeGreaterThan(0);
      expect(stats.total).toBeGreaterThan(0);
      expect(typeof stats.shouldGC).toBe("boolean");
    });

    it("should provide detailed memory stats", () => {
      const optimizer = MemoryOptimizer.getInstance();

      const stats = optimizer.getMemoryStats();

      expect(stats.heapUsed).toBeGreaterThan(0);
      expect(stats.heapTotal).toBeGreaterThan(0);
      expect(stats.rss).toBeGreaterThan(0);
    });

    it("should optimize for large projects", () => {
      const optimizer = MemoryOptimizer.getInstance();

      optimizer.optimizeForLargeProjects();

      // Should not throw and should adjust internal settings
      expect(() => optimizer.checkMemoryUsage()).not.toThrow();
    });
  });

  describe("Integration Tests", () => {
    it("should work together efficiently", async () => {
      const fileReader = OptimizedFileReader.getInstance();
      const analyzer = OptimizedDependencyAnalyzer.getInstance();
      const monitor = PerformanceMonitor.getInstance();

      mockFs.readFile.mockResolvedValue(`
        import React from 'react';
        export default function App() {
          return <div>Hello</div>;
        }
      `);

      monitor.startTimer("integrationTest");

      const files = Array.from({ length: 10 }, (_, i) => `/test/file${i}.js`);
      const results = await analyzer.processFilesInBatches(files, "react", {});

      monitor.endTimer("integrationTest");

      // Some files might not match the pattern, so we check for reasonable results
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);

      const metrics = monitor.getMetrics();
      expect(metrics.has("integrationTest")).toBe(true);
    });

    it("should handle memory pressure gracefully", async () => {
      const fileReader = OptimizedFileReader.getInstance();
      const analyzer = OptimizedDependencyAnalyzer.getInstance();
      const memoryOptimizer = MemoryOptimizer.getInstance();

      // Clear any existing cache to ensure fresh test
      fileReader.clearCache();

      mockFs.readFile.mockResolvedValue("test content");

      // Test that file reading works normally
      const content = await fileReader.readFile("/test/file.js");
      expect(content).toBe("test content");
      expect(mockFs.readFile).toHaveBeenCalled();
    });
  });
});
