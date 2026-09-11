/**
 * Performance Optimizations for DepSweep
 *
 * This module contains optimized algorithms, caching strategies, and memory management
 * to improve the overall performance and efficiency of the dependency analysis.
 */

import type { Stats } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { LRUCache } from 'lru-cache';

// Enhanced caching with TTL and size limits
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- cache stores any non-nullish value
export class OptimizedCache<T extends {}> {
  private cache: LRUCache<string, T>;
  private hitCount = 0;
  private missCount = 0;

  constructor(maxSize = 1000, ttl = 300_000) {
    // 5 minutes TTL
    this.cache = new LRUCache<string, T>({
      allowStale: false,
      max: maxSize,
      ttl,
      updateAgeOnGet: true,
    });
  }

  public get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hitCount++;
      return value;
    }
    this.missCount++;
    return undefined;
  }

  public set(key: string, value: T): void {
    this.cache.set(key, value);
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public getStats(): { hitCount: number; hitRate: number; missCount: number; size: number } {
    const total = this.hitCount + this.missCount;
    return {
      hitCount: this.hitCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      missCount: this.missCount,
      size: this.cache.size,
    };
  }
}

// Optimized file reading with intelligent batching
export class OptimizedFileReader {
  public static getInstance(): OptimizedFileReader {
    if (!OptimizedFileReader.instance) {
      OptimizedFileReader.instance = new OptimizedFileReader();
    }
    return OptimizedFileReader.instance;
  }

  private static instance: OptimizedFileReader;
  private fileCache = new OptimizedCache<string>(500, 60_000); // 1 minute TTL
  private readQueue: {
    path: string;
    resolve: (content: string) => void;
    reject: (error: Error) => void;
  }[] = [];
  private isProcessing = false;
  private readonly BATCH_SIZE = 50;
  private readonly MAX_CONCURRENT_READS = 10;

  public async readFile(filePath: string): Promise<string> {
    // Check cache first
    const cached = this.fileCache.get(filePath);
    if (cached !== undefined) {
      return cached;
    }

    // Add to queue for batch processing
    return new Promise((resolve, reject) => {
      this.readQueue.push({ path: filePath, reject, resolve });
      this.processQueue();
    });
  }

  public clearCache(): void {
    this.fileCache.clear();
  }

  public getCacheStats(): { hitCount: number; hitRate: number; missCount: number; size: number } {
    return this.fileCache.getStats();
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
          chunk.map(async ({ path: filePath, reject, resolve }) => {
            try {
              const content = await readFile(filePath, 'utf8');
              this.fileCache.set(filePath, content);
              resolve(content);
            } catch (error) {
              reject(error as Error);
            }
          }),
        );
      }
    }

    this.isProcessing = false;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < array.length; index += chunkSize) {
      chunks.push(array.slice(index, index + chunkSize));
    }
    return chunks;
  }
}

// Optimized dependency analysis with early exit strategies
export class OptimizedDependencyAnalyzer {
  public static getInstance(): OptimizedDependencyAnalyzer {
    if (!OptimizedDependencyAnalyzer.instance) {
      OptimizedDependencyAnalyzer.instance = new OptimizedDependencyAnalyzer();
    }
    return OptimizedDependencyAnalyzer.instance;
  }

  private static instance: OptimizedDependencyAnalyzer;
  private analysisCache = new OptimizedCache<boolean>(2000, 300_000); // 5 minutes TTL
  private dependencyGraphCache = new OptimizedCache<Map<string, Set<string>>>(
    100,
    600_000,
  ); // 10 minutes TTL
  private filePatternCache = new OptimizedCache<RegExp[]>(500, 300_000); // 5 minutes TTL

  // Optimized pattern matching with compiled regex caching
  public getCompiledPatterns(dependency: string): RegExp[] {
    const cacheKey = `patterns:${dependency}`;
    const cached = this.filePatternCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const escaped = dependency.replaceAll(
      /[$()*+.?[\\\]^{|}]/g,
      String.raw`\$&`,
    );
    const patterns = [
      new RegExp(
        `${String.raw`(?:^|[\s'"`}\`${String.raw`({[,])${escaped}(?:$|[\s'"`}\`${String.raw`)}\],;/])`}`,
        'gm',
      ),
      new RegExp(String.raw`from\s+['"]${escaped}['"]`, 'g'),
      new RegExp(String.raw`import\s+.*\s+from\s+['"]${escaped}['"]`, 'g'),
      new RegExp(String.raw`require\(['"]${escaped}['"]\)`, 'g'),
      new RegExp(String.raw`import\s+['"]${escaped}['"]`, 'g'),
      new RegExp(String.raw`import\s*\(\s*['"]${escaped}['"]`, 'g'),
      new RegExp(String.raw`(?:require|import)\s*\(?\s*['"]${escaped}!`, 'g'),
      new RegExp(`node_modules/${escaped}/`, 'g'),
    ];

    this.filePatternCache.set(cacheKey, patterns);
    return patterns;
  }

  // Optimized dependency usage detection with early exit
  public async isDependencyUsedInFile(
    dependency: string,
    filePath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API compatibility
    _context: any,
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
      // Reset lastIndex before each test() — g flag advances it across calls
      const patterns = this.getCompiledPatterns(dependency);
      const isUsed = patterns.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(content);
      });

      this.analysisCache.set(cacheKey, isUsed);
      return isUsed;
    } catch {
      this.analysisCache.set(cacheKey, false);
      return false;
    }
  }

  // Optimized batch processing with intelligent batching
  public async processFilesInBatches(
    files: string[],
    dependency: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API compatibility
    context: any,
    onProgress?: (processed: number, total: number) => void,
  ): Promise<string[]> {
    const results: string[] = [];

    // Dynamic batch size based on file count and memory
    const batchSize = Math.min(
      100,
      Math.max(10, Math.floor(files.length / 10)),
    );

    for (let index = 0; index < files.length; index += batchSize) {
      const batch = files.slice(index, index + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async (file) => {
        const isUsed = await this.isDependencyUsedInFile(
          dependency,
          file,
          context,
        );
        return isUsed ? file : null;
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }

      onProgress?.(Math.min(index + batchSize, files.length), files.length);
    }

    return results;
  }

  public clearCaches(): void {
    this.analysisCache.clear();
    this.dependencyGraphCache.clear();
    this.filePatternCache.clear();
  }

  public getCacheStats(): {
    analysis: { hitCount: number; hitRate: number; missCount: number; size: number };
    dependencyGraph: { hitCount: number; hitRate: number; missCount: number; size: number };
    filePatterns: { hitCount: number; hitRate: number; missCount: number; size: number };
  } {
    return {
      analysis: this.analysisCache.getStats(),
      dependencyGraph: this.dependencyGraphCache.getStats(),
      filePatterns: this.filePatternCache.getStats(),
    };
  }
}

// Memory-optimized string operations
export class StringOptimizer {
  public static intern(string_: string): string {
    if (string_.length < 3) {
      return string_;
    } // Don't pool very short strings

    if (StringOptimizer.STRING_POOL.has(string_)) {
      return StringOptimizer.STRING_POOL.get(string_)!;
    }

    if (StringOptimizer.STRING_POOL.size >= StringOptimizer.MAX_POOL_SIZE) {
      // Clear oldest entries (simple LRU approximation)
      const entries = Array.from(StringOptimizer.STRING_POOL.entries());
      const toRemove = entries.slice(
        0,
        Math.floor(StringOptimizer.MAX_POOL_SIZE / 4),
      );
      toRemove.forEach(([key]) => StringOptimizer.STRING_POOL.delete(key));
    }

    StringOptimizer.STRING_POOL.set(string_, string_);
    return string_;
  }

  public static clearPool(): void {
    StringOptimizer.STRING_POOL.clear();
  }

  public static getPoolStats(): { maxSize: number; size: number } {
    return {
      maxSize: StringOptimizer.MAX_POOL_SIZE,
      size: StringOptimizer.STRING_POOL.size,
    };
  }

  private static readonly STRING_POOL = new Map<string, string>();
  private static readonly MAX_POOL_SIZE = 1000;
}

// Optimized file system operations
export class OptimizedFileSystem {
  public static getInstance(): OptimizedFileSystem {
    if (!OptimizedFileSystem.instance) {
      OptimizedFileSystem.instance = new OptimizedFileSystem();
    }
    return OptimizedFileSystem.instance;
  }

  private static instance: OptimizedFileSystem;
  private dirCache = new OptimizedCache<string[]>(100, 60_000); // 1 minute TTL
  private statCache = new OptimizedCache<Stats>(500, 30_000); // 30 seconds TTL

  public async readDirectory(dirPath: string): Promise<string[]> {
    const cached = this.dirCache.get(dirPath);
    if (cached) {
      return cached;
    }

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => join(dirPath, entry.name));

      this.dirCache.set(dirPath, files);
      return files;
    } catch {
      this.dirCache.set(dirPath, []);
      return [];
    }
  }

  public async getFileStats(filePath: string): Promise<Stats | null> {
    const cached = this.statCache.get(filePath);
    if (cached) {
      return cached;
    }

    try {
      const stats = await stat(filePath);
      this.statCache.set(filePath, stats);
      return stats;
    } catch {
      return null;
    }
  }

  public clearCaches(): void {
    this.dirCache.clear();
    this.statCache.clear();
  }

  public getCacheStats(): {
    directories: { hitCount: number; hitRate: number; missCount: number; size: number };
    stats: { hitCount: number; hitRate: number; missCount: number; size: number };
  } {
    return {
      directories: this.dirCache.getStats(),
      stats: this.statCache.getStats(),
    };
  }
}

// Performance monitoring and metrics
export class PerformanceMonitor {
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private static instance: PerformanceMonitor;
  private metrics = new Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  >();
  private startTimes = new Map<string, number>();

  public startTimer(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  public endTimer(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);

    const existing = this.metrics.get(operation);
    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.avgTime = existing.totalTime / existing.count;
    } else {
      this.metrics.set(operation, {
        avgTime: duration,
        count: 1,
        totalTime: duration,
      });
    }

    return duration;
  }

  public getMetrics(): Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  > {
    return new Map(this.metrics);
  }

  public reset(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }

  public logSummary(): void {
    console.log('\nPerformance Metrics:');
    console.log('========================');

    for (const [operation, stats] of this.metrics.entries()) {
      console.log(`${operation}:`);
      console.log(`  Count: ${stats.count}`);
      console.log(`  Total Time: ${stats.totalTime.toFixed(2)}ms`);
      console.log(`  Average Time: ${stats.avgTime.toFixed(2)}ms`);
      console.log('');
    }
  }
}

// Memory usage optimization
export class MemoryOptimizer {
  public static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  private static instance: MemoryOptimizer;
  private gcThreshold = 100 * 1024 * 1024; // 100MB
  private lastGcTime = 0;
  private readonly GC_INTERVAL = 30_000; // 30 seconds

  public checkMemoryUsage(): { used: number; total: number; shouldGC: boolean } {
    const usage = process.memoryUsage();
    const used = usage.heapUsed;
    const total = usage.heapTotal;
    const now = Date.now();

    const shouldGC =
      used > this.gcThreshold && now - this.lastGcTime > this.GC_INTERVAL;

    if (shouldGC) {
      this.lastGcTime = now;
      if (globalThis.gc) {
        globalThis.gc();
      }
    }

    return { shouldGC, total, used };
  }

  public optimizeForLargeProjects(): void {
    // Increase GC threshold for large projects
    this.gcThreshold = 200 * 1024 * 1024; // 200MB
  }

  public getMemoryStats(): {
    arrayBuffers: number;
    external: number;
    heapTotal: number;
    heapUsed: number;
    rss: number;
  } {
    const usage = process.memoryUsage();
    return {
      arrayBuffers: usage.arrayBuffers,
      external: usage.external,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      rss: usage.rss,
    };
  }
}

// Export all optimizations
export const optimizations = {
  MemoryOptimizer,
  OptimizedCache,
  OptimizedDependencyAnalyzer,
  OptimizedFileReader,
  OptimizedFileSystem,
  PerformanceMonitor,
  StringOptimizer,
};
