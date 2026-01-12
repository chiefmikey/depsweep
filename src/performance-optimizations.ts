/**
 * Performance Optimizations for DepSweep
 *
 * This module contains optimized algorithms, caching strategies, and memory management
 * to improve the overall performance and efficiency of the dependency analysis.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { LRUCache } from "lru-cache";

// Enhanced caching with TTL and size limits
export class OptimizedCache<T extends {}> {
  private cache: LRUCache<string, T>;
  private hitCount = 0;
  private missCount = 0;

  constructor(maxSize = 1000, ttl = 300000) {
    // 5 minutes TTL
    this.cache = new LRUCache<string, T>({
      max: maxSize,
      ttl: ttl,
      updateAgeOnGet: true,
      allowStale: false,
    });
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hitCount++;
      return value;
    }
    this.missCount++;
    return undefined;
  }

  set(key: string, value: T): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      hitRate: total > 0 ? this.hitCount / total : 0,
      hitCount: this.hitCount,
      missCount: this.missCount,
      size: this.cache.size,
    };
  }
}

// Optimized file reading with intelligent batching
export class OptimizedFileReader {
  private static instance: OptimizedFileReader;
  private fileCache = new OptimizedCache<string>(500, 60000); // 1 minute TTL
  private readQueue: Array<{
    path: string;
    resolve: (content: string) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessing = false;
  private readonly BATCH_SIZE = 50;
  private readonly MAX_CONCURRENT_READS = 10;

  static getInstance(): OptimizedFileReader {
    if (!OptimizedFileReader.instance) {
      OptimizedFileReader.instance = new OptimizedFileReader();
    }
    return OptimizedFileReader.instance;
  }

  async readFile(filePath: string): Promise<string> {
    // Check cache first
    const cached = this.fileCache.get(filePath);
    if (cached !== undefined) {
      return cached;
    }

    // Add to queue for batch processing
    return new Promise((resolve, reject) => {
      this.readQueue.push({ path: filePath, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.readQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.readQueue.length > 0) {
      const batch = this.readQueue.splice(0, this.BATCH_SIZE);

      // Process batch in parallel with concurrency limit
      const chunks = this.chunkArray(batch, this.MAX_CONCURRENT_READS);

      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map(async ({ path: filePath, resolve, reject }) => {
            try {
              const content = await fs.readFile(filePath, "utf8");
              this.fileCache.set(filePath, content);
              resolve(content);
            } catch (error) {
              reject(error as Error);
            }
          })
        );
      }
    }

    this.isProcessing = false;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  clearCache(): void {
    this.fileCache.clear();
  }

  getCacheStats() {
    return this.fileCache.getStats();
  }
}

// Optimized dependency analysis with early exit strategies
export class OptimizedDependencyAnalyzer {
  private static instance: OptimizedDependencyAnalyzer;
  private analysisCache = new OptimizedCache<any>(2000, 300000); // 5 minutes TTL
  private dependencyGraphCache = new OptimizedCache<Map<string, Set<string>>>(
    100,
    600000
  ); // 10 minutes TTL
  private filePatternCache = new OptimizedCache<RegExp[]>(500, 300000); // 5 minutes TTL

  static getInstance(): OptimizedDependencyAnalyzer {
    if (!OptimizedDependencyAnalyzer.instance) {
      OptimizedDependencyAnalyzer.instance = new OptimizedDependencyAnalyzer();
    }
    return OptimizedDependencyAnalyzer.instance;
  }

  // Optimized pattern matching with compiled regex caching
  getCompiledPatterns(dependency: string): RegExp[] {
    const cacheKey = `patterns:${dependency}`;
    const cached = this.filePatternCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const patterns = [
      new RegExp(
        `\\b${dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "g"
      ),
      new RegExp(
        `from\\s+['"]${dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`,
        "g"
      ),
      new RegExp(
        `import\\s+.*\\s+from\\s+['"]${dependency.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}['"]`,
        "g"
      ),
      new RegExp(
        `require\\(['"]${dependency.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}['"]\\)`,
        "g"
      ),
    ];

    this.filePatternCache.set(cacheKey, patterns);
    return patterns;
  }

  // Optimized dependency usage detection with early exit
  async isDependencyUsedInFile(
    dependency: string,
    filePath: string,
    context: any
  ): Promise<boolean> {
    const cacheKey = `usage:${dependency}:${filePath}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const fileReader = OptimizedFileReader.getInstance();
      const content = await fileReader.readFile(filePath);

      // Early exit for obvious cases
      if (content.length < 10) {
        this.analysisCache.set(cacheKey, false);
        return false;
      }

      // Quick string search before regex
      if (!content.includes(dependency)) {
        this.analysisCache.set(cacheKey, false);
        return false;
      }

      // Use compiled patterns for efficient matching
      const patterns = this.getCompiledPatterns(dependency);
      const isUsed = patterns.some((pattern) => pattern.test(content));

      this.analysisCache.set(cacheKey, isUsed);
      return isUsed;
    } catch {
      this.analysisCache.set(cacheKey, false);
      return false;
    }
  }

  // Optimized batch processing with intelligent batching
  async processFilesInBatches(
    files: string[],
    dependency: string,
    context: any,
    onProgress?: (processed: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = [];
    const fileReader = OptimizedFileReader.getInstance();

    // Dynamic batch size based on file count and memory
    const batchSize = Math.min(
      100,
      Math.max(10, Math.floor(files.length / 10))
    );

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async (file) => {
        const isUsed = await this.isDependencyUsedInFile(
          dependency,
          file,
          context
        );
        return isUsed ? file : null;
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          results.push(result.value);
        }
      }

      onProgress?.(Math.min(i + batchSize, files.length), files.length);
    }

    return results;
  }

  clearCaches(): void {
    this.analysisCache.clear();
    this.dependencyGraphCache.clear();
    this.filePatternCache.clear();
  }

  getCacheStats() {
    return {
      analysis: this.analysisCache.getStats(),
      dependencyGraph: this.dependencyGraphCache.getStats(),
      filePatterns: this.filePatternCache.getStats(),
    };
  }
}

// Memory-optimized string operations
export class StringOptimizer {
  private static readonly STRING_POOL = new Map<string, string>();
  private static readonly MAX_POOL_SIZE = 1000;

  static intern(str: string): string {
    if (str.length < 3) return str; // Don't pool very short strings

    if (StringOptimizer.STRING_POOL.has(str)) {
      return StringOptimizer.STRING_POOL.get(str)!;
    }

    if (StringOptimizer.STRING_POOL.size >= StringOptimizer.MAX_POOL_SIZE) {
      // Clear oldest entries (simple LRU approximation)
      const entries = Array.from(StringOptimizer.STRING_POOL.entries());
      const toRemove = entries.slice(
        0,
        Math.floor(StringOptimizer.MAX_POOL_SIZE / 4)
      );
      toRemove.forEach(([key]) => StringOptimizer.STRING_POOL.delete(key));
    }

    StringOptimizer.STRING_POOL.set(str, str);
    return str;
  }

  static clearPool(): void {
    StringOptimizer.STRING_POOL.clear();
  }

  static getPoolStats() {
    return {
      size: StringOptimizer.STRING_POOL.size,
      maxSize: StringOptimizer.MAX_POOL_SIZE,
    };
  }
}

// Optimized file system operations
export class OptimizedFileSystem {
  private static instance: OptimizedFileSystem;
  private dirCache = new OptimizedCache<string[]>(100, 60000); // 1 minute TTL
  private statCache = new OptimizedCache<any>(500, 30000); // 30 seconds TTL

  static getInstance(): OptimizedFileSystem {
    if (!OptimizedFileSystem.instance) {
      OptimizedFileSystem.instance = new OptimizedFileSystem();
    }
    return OptimizedFileSystem.instance;
  }

  async readDirectory(dirPath: string): Promise<string[]> {
    const cached = this.dirCache.get(dirPath);
    if (cached) {
      return cached;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(dirPath, entry.name));

      this.dirCache.set(dirPath, files);
      return files;
    } catch {
      this.dirCache.set(dirPath, []);
      return [];
    }
  }

  async getFileStats(filePath: string): Promise<any> {
    const cached = this.statCache.get(filePath);
    if (cached) {
      return cached;
    }

    try {
      const stats = await fs.stat(filePath);
      this.statCache.set(filePath, stats);
      return stats;
    } catch {
      return null;
    }
  }

  clearCaches(): void {
    this.dirCache.clear();
    this.statCache.clear();
  }

  getCacheStats() {
    return {
      directories: this.dirCache.getStats(),
      stats: this.statCache.getStats(),
    };
  }
}

// Performance monitoring and metrics
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics = new Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  >();
  private startTimes = new Map<string, number>();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  endTimer(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);

    const existing = this.metrics.get(operation);
    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.avgTime = existing.totalTime / existing.count;
    } else {
      this.metrics.set(operation, {
        count: 1,
        totalTime: duration,
        avgTime: duration,
      });
    }

    return duration;
  }

  getMetrics(): Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  > {
    return new Map(this.metrics);
  }

  reset(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }

  logSummary(): void {
    console.log("\nPerformance Metrics:");
    console.log("========================");

    for (const [operation, stats] of this.metrics.entries()) {
      console.log(`${operation}:`);
      console.log(`  Count: ${stats.count}`);
      console.log(`  Total Time: ${stats.totalTime.toFixed(2)}ms`);
      console.log(`  Average Time: ${stats.avgTime.toFixed(2)}ms`);
      console.log("");
    }
  }
}

// Memory usage optimization
export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private gcThreshold = 100 * 1024 * 1024; // 100MB
  private lastGcTime = 0;
  private readonly GC_INTERVAL = 30000; // 30 seconds

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  checkMemoryUsage(): { used: number; total: number; shouldGC: boolean } {
    const usage = process.memoryUsage();
    const used = usage.heapUsed;
    const total = usage.heapTotal;
    const now = Date.now();

    const shouldGC =
      used > this.gcThreshold && now - this.lastGcTime > this.GC_INTERVAL;

    if (shouldGC) {
      this.lastGcTime = now;
      if (global.gc) {
        global.gc();
      }
    }

    return { used, total, shouldGC };
  }

  optimizeForLargeProjects(): void {
    // Increase GC threshold for large projects
    this.gcThreshold = 200 * 1024 * 1024; // 200MB
  }

  getMemoryStats() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers,
    };
  }
}

// Export all optimizations
export const optimizations = {
  OptimizedCache,
  OptimizedFileReader,
  OptimizedDependencyAnalyzer,
  StringOptimizer,
  OptimizedFileSystem,
  PerformanceMonitor,
  MemoryOptimizer,
};
