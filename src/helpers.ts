import { execSync, spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import * as fs from "node:fs/promises";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import v8 from "node:v8";

import { parse } from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import type {
  ImportDeclaration,
  CallExpression,
  TSImportType,
  TSExternalModuleReference,
} from "@babel/types";
import chalk from "chalk";
import CliTable from "cli-table3";

import { isBinaryFileSync } from "isbinaryfile";
import micromatch from "micromatch";
import fetch from "node-fetch";
import type { Response } from "node-fetch";
import shellEscape from "shell-escape";

import {
  FILE_PATTERNS,
  DEPENDENCY_PATTERNS,
  PACKAGE_MANAGERS,
  RAW_CONTENT_PATTERNS,
  ENVIRONMENTAL_CONSTANTS,
} from "./constants.js";
import type {
  DependencyContext,
  ProgressOptions,
  DependencyInfo,
  EnvironmentalImpact,
  ImpactMetrics,
  EnvironmentalReport,
} from "./interfaces.js";
import {
  calculateComprehensiveEnvironmentalImpact,
  validateEnvironmentalCalculations,
  formatEnvironmentalImpact as formatEnhancedImpact,
} from "./enhanced-environmental-calculations.js";
import { findSubDependencies } from "./utils.js";

import { customSort } from "./index.js";

export function isConfigFile(filePath: string): boolean {
  if (!filePath || typeof filePath !== "string") {
    return false;
  }
  const filename = path.basename(filePath).toLowerCase();
  return (
    filename.includes("config") ||
    filename.startsWith(".") ||
    filename === FILE_PATTERNS.PACKAGE_JSON ||
    FILE_PATTERNS.CONFIG_REGEX.test(filename)
  );
}

export async function parseConfigFile(filePath: string): Promise<unknown> {
  const extension = path.extname(filePath).toLowerCase();
  const content = await fs.readFile(filePath, "utf8");

  try {
    switch (extension) {
      case ".json": {
        return JSON.parse(content);
      }
      case ".yaml":
      case ".yml": {
        const yaml = await import("yaml").catch(() => null);
        return yaml ? yaml.parse(content) : content;
      }
      case ".js":
      case ".cjs":
      case ".mjs": {
        return content;
      }
      default: {
        try {
          return JSON.parse(content);
        } catch {
          return content;
        }
      }
    }
  } catch {
    return content;
  }
}

const traverseFunction = ((traverse as any).default || traverse) as (
  ast: any,
  options: any
) => void;

export async function isTypePackageUsed(
  dependency: string,
  installedPackages: string[],
  unusedDependencies: string[],
  context: DependencyContext,
  sourceFiles: string[]
): Promise<{ isUsed: boolean; supportedPackage?: string }> {
  if (!dependency.startsWith(DEPENDENCY_PATTERNS.TYPES_PREFIX)) {
    return { isUsed: false };
  }

  const correspondingPackage = dependency
    .replace(/^@types\//, "")
    .replaceAll("__", "/");

  const normalizedPackage = correspondingPackage.includes("/")
    ? `@${correspondingPackage}`
    : correspondingPackage;

  const supportedPackage = installedPackages.find(
    (package_) => package_ === normalizedPackage
  );

  if (supportedPackage) {
    for (const file of sourceFiles) {
      if (await isDependencyUsedInFile(supportedPackage, file, context)) {
        return { isUsed: true, supportedPackage };
      }
    }
  }

  for (const package_ of installedPackages) {
    try {
      const packageJsonPath = require.resolve(`${package_}/package.json`, {
        paths: [process.cwd()],
      });
      const packageJsonBuffer = await fs.readFile(packageJsonPath);
      const packageJson = JSON.parse(packageJsonBuffer.toString("utf8")) as {
        peerDependencies?: Record<string, string>;
      };
      if (packageJson.peerDependencies?.[dependency]) {
        return { isUsed: true, supportedPackage: package_ };
      }
    } catch {
      // Ignore errors
    }
  }

  return { isUsed: false };
}

export function scanForDependency(
  object: unknown,
  dependency: string
): boolean {
  if (typeof object === "string") {
    const matchers = generatePatternMatcher(dependency);
    return matchers.some((pattern) => pattern.test(object));
  }

  if (Array.isArray(object)) {
    return object.some((item) => scanForDependency(item, dependency));
  }

  if (object && typeof object === "object") {
    return Object.values(object).some((value) =>
      scanForDependency(value, dependency)
    );
  }

  return false;
}

export async function isDependencyUsedInFile(
  dependency: string,
  filePath: string,
  context: DependencyContext
): Promise<boolean> {
  // Don't consider dependencies as "used" just because they're in package.json
  // Only check actual source code files for dependency usage
  if (path.basename(filePath) === FILE_PATTERNS.PACKAGE_JSON) {
    return false;
  }

  const configKey = path.relative(path.dirname(filePath), filePath);
  const config = context.configs?.[configKey];
  if (config) {
    if (typeof config === "string") {
      if (config.includes(dependency)) {
        return true;
      }
    } else if (scanForDependency(config, dependency)) {
      return true;
    }
  }

  if (context.scripts) {
    for (const script of Object.values(context.scripts)) {
      const scriptParts = script.split(" ");
      if (scriptParts.includes(dependency)) {
        return true;
      }
    }
  }

  try {
    if (isBinaryFileSync(filePath)) {
      return false;
    }

    const content = await fs.readFile(filePath, "utf8");

    const dynamicImportRegex = new RegExp(
      `${DEPENDENCY_PATTERNS.DYNAMIC_IMPORT_BASE}${dependency.replaceAll(
        /[/@-]/g,
        "[/@-]"
      )}${DEPENDENCY_PATTERNS.DYNAMIC_IMPORT_END}`,
      "i"
    );
    if (dynamicImportRegex.test(content)) {
      return true;
    }

    try {
      const ast = parse(content, {
        sourceType: "unambiguous",
        plugins: [
          "typescript",
          "jsx",
          "decorators-legacy",
          "classProperties",
          "dynamicImport",
          "exportDefaultFrom",
          "exportNamespaceFrom",
          "importMeta",
        ],
      });

      let isUsed = false;
      traverseFunction(ast, {
        ImportDeclaration(importPath: NodePath<ImportDeclaration>) {
          const importSource = importPath.node.source.value;
          if (matchesDependency(importSource, dependency)) {
            isUsed = true;
            importPath.stop();
          }
        },
        CallExpression(importPath: NodePath<CallExpression>) {
          if (
            importPath.node.callee.type === "Identifier" &&
            importPath.node.callee.name === "require" &&
            importPath.node.arguments[0]?.type === "StringLiteral" &&
            matchesDependency(importPath.node.arguments[0].value, dependency)
          ) {
            isUsed = true;
            importPath.stop();
          }
        },
        TSImportType(importPath: NodePath<TSImportType>) {
          const importSource = importPath.node.argument.value;
          if (matchesDependency(importSource, dependency)) {
            isUsed = true;
            importPath.stop();
          }
        },
        TSExternalModuleReference(
          importPath: NodePath<TSExternalModuleReference>
        ) {
          const importSource = importPath.node.expression.value;
          if (matchesDependency(importSource, dependency)) {
            isUsed = true;
            importPath.stop();
          }
        },
      });

      if (isUsed) return true;

      for (const [base, patterns] of RAW_CONTENT_PATTERNS.entries()) {
        if (
          dependency.startsWith(base) &&
          patterns.some((pattern: string) =>
            micromatch.isMatch(dependency, pattern)
          )
        ) {
          const searchPattern = new RegExp(
            `\\b${dependency.replaceAll(/[/@-]/g, "[/@-]")}\\b`,
            "i"
          );
          if (searchPattern.test(content)) {
            return true;
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    for (const [base, patterns] of RAW_CONTENT_PATTERNS.entries()) {
      if (
        dependency.startsWith(base) &&
        patterns.some((pattern: string) =>
          micromatch.isMatch(dependency, pattern)
        )
      ) {
        const searchPattern = new RegExp(
          `\\b${dependency.replaceAll(/[/@-]/g, "[/@-]")}\\b`,
          "i"
        );
        if (searchPattern.test(content)) {
          return true;
        }
      }
    }
  } catch {
    // Ignore file read errors
  }

  return false;
}

export function getMemoryUsage(): { used: number; total: number } {
  const heapStats = v8.getHeapStatistics();
  return {
    used: heapStats.used_heap_size,
    total: heapStats.heap_size_limit,
  };
}

interface DependencyPattern {
  type: "exact" | "prefix" | "suffix" | "combined" | "regex";
  match: string | RegExp;
  variations?: string[];
}

const COMMON_PATTERNS: DependencyPattern[] = [
  // Direct matches
  { type: "exact", match: "" }, // Base name
  { type: "prefix", match: "@" }, // Scoped packages

  // Common package organization patterns
  { type: "prefix", match: "@types/" },
  { type: "prefix", match: "@storybook/" },
  { type: "prefix", match: "@testing-library/" },

  // Config patterns
  {
    type: "suffix",
    match: "config",
    variations: ["rc", "settings", "configuration", "setup", "options"],
  },

  // Plugin patterns
  {
    type: "suffix",
    match: "plugin",
    variations: ["plugins", "extension", "extensions", "addon", "addons"],
  },

  // Preset patterns
  {
    type: "suffix",
    match: "preset",
    variations: ["presets", "recommended", "standard", "defaults"],
  },

  // Tool patterns
  {
    type: "combined",
    match: "",
    variations: ["cli", "core", "utils", "tools", "helper", "helpers"],
  },

  // Framework integration patterns
  {
    type: "regex",
    match: /[/-](react|vue|svelte|angular|node)$/i,
  },

  // Common package naming patterns
  {
    type: "regex",
    match: /[/-](loader|parser|transformer|formatter|linter|compiler)s?$/i,
  },
];

export function generatePatternMatcher(dependency: string): RegExp[] {
  const patterns: RegExp[] = [];
  const escapedDep = dependency.replaceAll(
    /[$()*+.?[\\\]^{|}]/g,
    String.raw`\$&`
  );

  for (const pattern of COMMON_PATTERNS) {
    switch (pattern.type) {
      case "exact": {
        patterns.push(new RegExp(`^${escapedDep}$`));
        break;
      }
      case "prefix": {
        patterns.push(new RegExp(`^${pattern.match}${escapedDep}(/.*)?$`));
        break;
      }
      case "suffix": {
        const suffixes = [pattern.match, ...(pattern.variations || [])];
        for (const suffix of suffixes) {
          patterns.push(
            new RegExp(`^${escapedDep}[-./]${suffix}$`),
            new RegExp(`^${escapedDep}[-./]${suffix}s$`)
          );
        }
        break;
      }
      case "combined": {
        const parts = [pattern.match, ...(pattern.variations || [])];
        for (const part of parts) {
          patterns.push(
            new RegExp(`^${escapedDep}[-./]${part}$`),
            new RegExp(`^${part}[-./]${escapedDep}$`)
          );
        }
        break;
      }
      case "regex": {
        if (pattern.match instanceof RegExp) {
          patterns.push(
            new RegExp(
              `^${escapedDep}${pattern.match.source}`,
              pattern.match.flags
            )
          );
        }
        break;
      }
    }
  }

  return patterns;
}

export function matchesDependency(
  importSource: string,
  dependency: string
): boolean {
  const depWithoutScope = dependency.startsWith("@")
    ? dependency.split("/")[1]
    : dependency;
  const sourceWithoutScope = importSource.startsWith("@")
    ? importSource.split("/")[1]
    : importSource;

  return (
    importSource === dependency ||
    importSource.startsWith(`${dependency}/`) ||
    sourceWithoutScope === depWithoutScope ||
    sourceWithoutScope.startsWith(`${depWithoutScope}/`) ||
    (dependency.startsWith("@types/") &&
      (importSource === dependency.replace(/^@types\//, "") ||
        importSource.startsWith(`${dependency.replace(/^@types\//, "")}/`)))
  );
}

export function processResults(
  batchResults: PromiseSettledResult<{
    result: string | null;
    hasError: boolean;
  }>[]
): { validResults: string[]; errors: number } {
  const validResults: string[] = [];
  let errors = 0;

  for (const result of batchResults) {
    if (result.status === "fulfilled") {
      if (result.value.hasError) {
        errors++;
      } else if (result.value.result) {
        validResults.push(result.value.result);
      }
    }
  }

  return { validResults, errors };
}

interface InstallMetrics {
  installTime: number;
  diskSpace: number;
  errors?: string[];
}

function getDirectorySize(directory: string): number {
  let total = 0;
  const files = readdirSync(directory, { withFileTypes: true });
  for (const f of files) {
    const fullPath = path.join(directory, f.name);
    total += f.isDirectory()
      ? getDirectorySize(fullPath)
      : statSync(fullPath).size;
  }
  return total;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1e12) {
    return `${(bytes / 1e12).toFixed(2)} ${chalk.blue("TB")}`;
  } else if (bytes >= 1e9) {
    return `${(bytes / 1e9).toFixed(2)} ${chalk.blue("GB")}`;
  } else if (bytes >= 1e6) {
    return `${(bytes / 1e6).toFixed(2)} ${chalk.blue("MB")}`;
  } else if (bytes >= 1e3) {
    return `${(bytes / 1e3).toFixed(2)} ${chalk.blue("KB")}`;
  }
  return `${bytes} ${chalk.blue("Bytes")}`;
}

export function formatTime(seconds: number): string {
  if (seconds >= 86_400) {
    return `${(seconds / 86_400).toFixed(2)} ${chalk.blue("Days")}`;
  } else if (seconds >= 3600) {
    return `${(seconds / 3600).toFixed(2)} ${chalk.blue("Hours")}`;
  } else if (seconds >= 60) {
    return `${(seconds / 60).toFixed(2)} ${chalk.blue("Minutes")}`;
  }
  return `${seconds.toFixed(2)} ${chalk.blue("Seconds")}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function safeExecSync(
  command: string[],
  options: { cwd: string; stdio?: "inherit" | "ignore"; timeout?: number }
): void {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error("Invalid command array");
  }

  const [packageManager, ...arguments_] = command;

  if (!Object.values(PACKAGE_MANAGERS).includes(packageManager)) {
    throw new Error(`Invalid package manager: ${packageManager}`);
  }

  // Validate all arguments
  if (
    !arguments_.every(
      (argument) => typeof argument === "string" && argument.length > 0
    )
  ) {
    throw new Error("Invalid command arguments");
  }

  try {
    execSync(shellEscape(command), {
      stdio: options.stdio || "inherit",
      cwd: options.cwd,
      timeout: options.timeout ?? 300_000,
      encoding: "utf8",
    });
  } catch (error) {
    throw new Error(`Command execution failed: ${(error as Error).message}`);
  }
}

export async function detectPackageManager(
  projectDirectory: string
): Promise<string> {
  if (
    await fs
      .access(path.join(projectDirectory, FILE_PATTERNS.YARN_LOCK))
      .then(() => true)
      .catch(() => false)
  ) {
    return PACKAGE_MANAGERS.YARN;
  } else if (
    await fs
      .access(path.join(projectDirectory, FILE_PATTERNS.PNPM_LOCK))
      .then(() => true)
      .catch(() => false)
  ) {
    return PACKAGE_MANAGERS.PNPM;
  }
  return PACKAGE_MANAGERS.NPM;
}

export async function createTemporaryPackageJson(
  package_: string
): Promise<string> {
  const minimalPackageJson = {
    name: "depsweep-temp",
    version: "1.0.0",
    private: true,
    dependencies: { [package_]: "*" },
  };

  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "depsweep-"));
  const packageJsonPath = path.join(temporaryDirectory, "package.json");
  await writeFile(packageJsonPath, JSON.stringify(minimalPackageJson, null, 2));

  return temporaryDirectory;
}

export async function measurePackageInstallation(
  packageName: string
): Promise<InstallMetrics> {
  const metrics: InstallMetrics = {
    installTime: 0,
    diskSpace: 0,
    errors: [],
  };

  // Validate package name to prevent command injection
  if (!packageName || typeof packageName !== 'string' || !/^[\w./@-]+$/.test(packageName)) {
    metrics.errors?.push('Invalid package name');
    return metrics;
  }

  let temporaryDirectory: string | null = null;

  try {
    // Create temp directory with package.json
    temporaryDirectory = await createTemporaryPackageJson(packageName);

    // Measure install time with timeout
    const startTime = Date.now();
    const INSTALL_TIMEOUT = 120000; // 2 minutes max for install

    try {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          install.kill('SIGTERM');
          reject(new Error('Installation timeout'));
        }, INSTALL_TIMEOUT);

        const install = spawn("npm", ["install", "--no-package-lock", "--no-audit", "--no-fund"], {
          cwd: temporaryDirectory!,
          stdio: "ignore",
          shell: false, // Prevent shell injection
        });

        install.on("close", (code) => {
          clearTimeout(timeoutId);
          if (code === 0) resolve();
          else reject(new Error(`npm install failed with code ${code}`));
        });

        install.on("error", (error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown install error';
      metrics.errors?.push(`Install error: ${errorMessage}`);
    }

    metrics.installTime = (Date.now() - startTime) / 1000;

    // Measure disk space
    const nodeModulesPath = path.join(temporaryDirectory, "node_modules");
    try {
      metrics.diskSpace = getDirectorySize(nodeModulesPath);
    } catch (error) {
      metrics.errors?.push('Failed to measure disk space');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown measurement error';
    metrics.errors?.push(`Measurement error: ${errorMessage}`);
  } finally {
    // Always cleanup, even on error
    if (temporaryDirectory) {
      try {
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return metrics;
}

// Rate limiting for npm API calls
const npmApiRateLimiter = {
  lastCallTime: 0,
  minInterval: 200, // Minimum 200ms between calls (5 requests/second max)
  queue: [] as Array<() => void>,
  processing: false,
};

async function rateLimitedFetch(url: string, timeout = 10000): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const now = Date.now();
    const timeSinceLastCall = now - npmApiRateLimiter.lastCallTime;
    const waitTime = Math.max(0, npmApiRateLimiter.minInterval - timeSinceLastCall);

    const executeFetch = async () => {
      npmApiRateLimiter.lastCallTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'depsweep/1.0.0',
            'Accept': 'application/json',
          },
        });
        clearTimeout(timeoutId);
        resolve(response as Response);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    };

    if (waitTime === 0 && !npmApiRateLimiter.processing) {
      npmApiRateLimiter.processing = true;
      executeFetch().finally(() => {
        npmApiRateLimiter.processing = false;
        if (npmApiRateLimiter.queue.length > 0) {
          const next = npmApiRateLimiter.queue.shift();
          if (next) next();
        }
      });
    } else {
      npmApiRateLimiter.queue.push(() => {
        npmApiRateLimiter.processing = true;
        executeFetch().finally(() => {
          npmApiRateLimiter.processing = false;
          if (npmApiRateLimiter.queue.length > 0) {
            const next = npmApiRateLimiter.queue.shift();
            if (next) next();
          }
        });
      });
      setTimeout(() => {
        if (npmApiRateLimiter.queue.length > 0 && !npmApiRateLimiter.processing) {
          const next = npmApiRateLimiter.queue.shift();
          if (next) next();
        }
      }, waitTime);
    }
  });
}

export async function getDownloadStatsFromNpm(
  packageName: string
): Promise<number | null> {
  // Validate package name to prevent injection
  if (!packageName || typeof packageName !== 'string' || !/^[\w./@-]+$/.test(packageName)) {
    return null;
  }

  try {
    const encodedPackageName = encodeURIComponent(packageName);
    const response = await rateLimitedFetch(
      `https://api.npmjs.org/downloads/point/last-month/${encodedPackageName}`,
      10000 // 10 second timeout
    );

    if (!response.ok) {
      // Handle rate limiting (429) and other errors gracefully
      if (response.status === 429) {
        // Rate limited - wait longer before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        return null;
      }
      return null;
    }

    const data = await response.json();
    const downloadData = data as { downloads: number };

    // Validate response data
    if (typeof downloadData.downloads === 'number' && downloadData.downloads >= 0) {
      return downloadData.downloads;
    }

    return null;
  } catch (error) {
    // Silently handle network errors - don't spam console
    if (error instanceof Error && error.name === 'AbortError') {
      // Timeout - expected in some cases
      return null;
    }
    return null;
  }
}

export async function getParentPackageDownloads(
  packageJsonPath: string,
  verbose = false
): Promise<{
  name: string;
  downloads: number;
  repository?: { url: string };
  homepage?: string;
} | null> {
  try {
    const packageJsonString =
      (await fs.readFile(packageJsonPath, "utf8")) || "{}";

    // Validate JSON structure
    let packageJson: any;
    try {
      packageJson = JSON.parse(packageJsonString);
    } catch (parseError) {
      if (verbose) {
        console.error(chalk.red("Invalid package.json format"));
      }
      return null;
    }

    // Validate package.json structure
    if (typeof packageJson !== 'object' || packageJson === null) {
      return null;
    }

    const { name, repository, homepage } = packageJson;

    // Validate name field
    if (!name || typeof name !== 'string' || !/^[\w./@-]+$/.test(name)) {
      return null;
    }

    const downloads = await getDownloadStatsFromNpm(name);
    if (!downloads && downloads !== 0) {
      if (verbose) {
        console.log(
          chalk.yellow(`\nUnable to find download stats for '${name}'`)
        );
      }
      return null;
    }

    return {
      name,
      downloads,
      repository: typeof repository === 'object' ? repository : undefined,
      homepage: typeof homepage === 'string' ? homepage : undefined
    };
  } catch (error) {
    // Silently handle errors - don't expose internal details
    return null;
  }
}

export async function getYearlyDownloads(
  packageName: string,
  months = 12
): Promise<{ total: number; monthsFetched: number; startDate: string } | null> {
  // Validate package name
  if (!packageName || typeof packageName !== 'string' || !/^[\w./@-]+$/.test(packageName)) {
    return null;
  }

  // Limit months to reasonable range
  const validMonths = Math.max(1, Math.min(months, 24));

  const monthlyDownloads: number[] = [];
  const currentDate = new Date();
  let startDate = "";
  let monthsFetched = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 3;

  for (let index = 0; index < validMonths; index++) {
    const start = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - index,
      1
    );
    const end = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - index + 1,
      0
    );
    const [startString] = start.toISOString().split("T");
    const [endString] = end.toISOString().split("T");

    try {
      const encodedPackageName = encodeURIComponent(packageName);
      const response = await rateLimitedFetch(
        `https://api.npmjs.org/downloads/range/${startString}:${endString}/${encodedPackageName}`,
        10000 // 10 second timeout
      );

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait before continuing
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          break;
        }
        continue;
      }

      consecutiveErrors = 0; // Reset on success

      const data = (await response.json()) as {
        downloads: { downloads: number; day: string }[];
      };

      if (data.downloads && Array.isArray(data.downloads)) {
        // Sum all daily downloads for that month
        const monthTotal = data.downloads.reduce(
          (accumulator, dayItem) => {
            const downloads = typeof dayItem.downloads === 'number' && dayItem.downloads >= 0
              ? dayItem.downloads
              : 0;
            return accumulator + downloads;
          },
          0
        );
        monthlyDownloads.push(monthTotal);

        // Capture the earliest date containing non-zero data
        if (monthTotal > 0 && !startDate) {
          startDate = startString;
        }
        monthsFetched++;
      }
    } catch (error) {
      consecutiveErrors++;
      if (consecutiveErrors >= maxConsecutiveErrors) {
        break;
      }
      // Continue to next month on error rather than breaking immediately
      continue;
    }
  }

  // Trim trailing zero months
  let lastNonZeroIndex = -1;
  for (let index = monthlyDownloads.length - 1; index >= 0; index--) {
    if (monthlyDownloads[index] > 0) {
      lastNonZeroIndex = index;
      break;
    }
  }

  // If no non-zero data found, return null
  if (lastNonZeroIndex === -1) {
    return null;
  }

  // Recalculate monthsFetched and remove trailing zeros
  monthlyDownloads.splice(lastNonZeroIndex + 1);
  monthsFetched = monthlyDownloads.length;

  // If the recorded startDate is empty (all leading zero months?), set it to the latest non-zero period
  if (!startDate) {
    const validMonthsAgo = monthsFetched - 1;
    const trimmedStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - validMonthsAgo,
      1
    );
    [startDate] = trimmedStart.toISOString().split("T");
  }

  // Sum total
  const totalDownloads = monthlyDownloads.reduce((a, b) => a + b, 0);
  return { total: totalDownloads, monthsFetched, startDate };
}

export function calculateImpactStats(
  diskSpace: number,
  installTime: number,
  monthlyDownloads: number | null,
  yearlyData: {
    total: number;
    monthsFetched: number;
    startDate: string;
  } | null
): any {
  const stats: any = {};

  if (!yearlyData) {
    return stats;
  }

  const { total, monthsFetched } = yearlyData;
  const daysCount = monthsFetched * 30;
  if (daysCount === 0 || total === 0) {
    return stats;
  }

  // Compute daily average
  const dailyAvg = total / daysCount;

  // Replace with day based on up to 30 days
  const relevantDays = Math.min(30, daysCount);
  const daySum = dailyAvg * relevantDays;
  const dayAverage = daySum / relevantDays;
  stats.day = {
    downloads: Math.round(dayAverage),
    diskSpace: diskSpace * dayAverage,
    installTime: installTime * dayAverage,
  };

  // 30-day (Monthly)
  stats.monthly = {
    downloads: Math.round(dailyAvg * 30),
    diskSpace: diskSpace * dailyAvg * 30,
    installTime: installTime * dailyAvg * 30,
  };

  // Last X months
  stats[`last_${monthsFetched}_months`] = {
    downloads: Math.round(dailyAvg * daysCount),
    diskSpace: diskSpace * dailyAvg * daysCount,
    installTime: installTime * dailyAvg * daysCount,
  };

  // If we have at least 12 months, add yearly
  if (monthsFetched >= 12) {
    const yearlyDays = 12 * 30;
    stats.yearly = {
      downloads: Math.round(dailyAvg * yearlyDays),
      diskSpace: diskSpace * dailyAvg * yearlyDays,
      installTime: installTime * dailyAvg * yearlyDays,
    };
  }

  return stats;
}

export function displayImpactTable(
  impactData: Record<string, { installTime: string; diskSpace: string }>,
  totalInstallTime: number,
  totalDiskSpace: number
) {
  const table = new CliTable({
    head: ["Package", "Install Time", "Disk Space"],
    colWidths: [29, 25, 25],
    wordWrap: true,
    style: {
      head: ["cyan"],
      border: ["grey"],
    },
  });

  const sortedImpactData = Object.entries(impactData).sort(([a], [b]) =>
    customSort(a, b)
  );

  for (const [package_, data] of sortedImpactData) {
    const numericTime = Number.parseFloat(data.installTime);
    table.push([package_, formatTime(numericTime), data.diskSpace]);
  }

  // Add totals row with separator
  table.push([
    chalk.bold("Total"),
    chalk.bold(formatTime(totalInstallTime)),
    chalk.bold(formatSize(totalDiskSpace)),
  ]);

  console.log(table.toString());
}

// New environmental impact calculation functions
/**
 * Calculates comprehensive environmental impact of removing unused dependencies
 *
 * This function implements scientifically validated algorithms based on:
 * - International Energy Agency (IEA) 2024 data center energy reports
 * - EPA 2024 transportation emissions data
 * - USDA Forest Service 2024 carbon sequestration studies
 * - Uptime Institute 2024 water usage research
 * - Greenpeace 2024 network infrastructure analysis
 *
 * @param diskSpace - Disk space in bytes that would be saved
 * @param installTime - Installation time in seconds that would be saved
 * @param monthlyDownloads - Monthly download count for scaling calculations
 * @returns EnvironmentalImpact object with validated metrics
 *
 * @example
 * ```typescript
 * const impact = calculateEnvironmentalImpact(1073741824, 30, 1000);
 * console.log(`Carbon savings: ${impact.carbonSavings} kg CO2e`);
 * ```
 *
 * @throws {Error} When inputs are invalid or calculations fail
 */
export function calculateEnvironmentalImpact(
  diskSpace: number, // bytes
  installTime: number, // seconds
  monthlyDownloads: number | null,
  options: {
    region?: "NA" | "EU" | "AP" | "GLOBAL";
    processingComplexity?: number;
    accessFrequency?: number;
    averageLatency?: number;
    buildComplexity?: number;
    buildFrequency?: number;
    teamSize?: number;
  } = {}
): EnvironmentalImpact {
  try {
    // Comprehensive input validation
    validateInputs(diskSpace, installTime, monthlyDownloads);

    // Handle edge cases
    if (diskSpace === 0 && installTime === 0) {
      return createZeroEnvironmentalImpact();
    }

    // Use enhanced comprehensive calculation with all factors

    const enhancedImpact = calculateComprehensiveEnvironmentalImpact(
      diskSpace,
      installTime,
      monthlyDownloads,
      options
    );

    // Validate the calculations
    const validation = validateEnvironmentalCalculations(enhancedImpact);
    if (!validation.isValid) {
      console.warn(
        "Environmental impact validation failed:",
        validation.errors
      );
    }
    if (validation.warnings.length > 0) {
      console.warn("Environmental impact warnings:", validation.warnings);
    }

    return enhancedImpact;
  } catch (error) {
    // Re-throw validation errors so they can be caught by tests
    if (
      error instanceof Error &&
      error.message.includes("cannot be negative")
    ) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("must be")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("exceeds maximum")) {
      throw error;
    }
    console.error("Error calculating environmental impact:", error);
    return createZeroEnvironmentalImpact();
  }
}

/**
 * Validates input parameters for environmental impact calculations
 */
export function validateInputs(
  diskSpace: number,
  installTime: number,
  monthlyDownloads: number | null
): void {
  if (typeof diskSpace !== "number" || isNaN(diskSpace)) {
    throw new Error("Disk space must be a valid number");
  }

  if (typeof installTime !== "number" || isNaN(installTime)) {
    throw new Error("Install time must be a valid number");
  }

  if (diskSpace < 0) {
    throw new Error("Disk space cannot be negative");
  }

  if (installTime < 0) {
    throw new Error("Install time cannot be negative");
  }

  if (diskSpace > Number.MAX_SAFE_INTEGER) {
    throw new Error("Disk space exceeds maximum safe integer");
  }

  if (installTime > Number.MAX_SAFE_INTEGER) {
    throw new Error("Install time exceeds maximum safe integer");
  }

  if (
    monthlyDownloads !== null &&
    (typeof monthlyDownloads !== "number" || monthlyDownloads < 0)
  ) {
    throw new Error("Monthly downloads must be null or a non-negative number");
  }
}

/**
 * Calculates data transfer energy with bounds checking
 */
export function calculateTransferEnergy(diskSpaceGB: number): number {
  const energy = diskSpaceGB * ENVIRONMENTAL_CONSTANTS.ENERGY_PER_GB;
  return Math.max(0, Math.min(energy, 1000)); // Cap at 1000 kWh for safety
}

/**
 * Calculates network infrastructure energy with bounds checking
 */
export function calculateNetworkEnergy(diskSpaceMB: number): number {
  const energy = diskSpaceMB * ENVIRONMENTAL_CONSTANTS.NETWORK_ENERGY_PER_MB;
  return Math.max(0, Math.min(energy, 100)); // Cap at 100 kWh for safety
}

/**
 * Calculates storage energy with bounds checking
 */
export function calculateStorageEnergy(diskSpaceGB: number): number {
  const energy =
    (diskSpaceGB * ENVIRONMENTAL_CONSTANTS.STORAGE_ENERGY_PER_GB_YEAR) / 12;
  return Math.max(0, Math.min(energy, 500)); // Cap at 500 kWh/month for safety
}

/**
 * Calculates e-waste impact energy with bounds checking
 */
export function calculateEwasteEnergy(diskSpaceGB: number): number {
  const energy = diskSpaceGB * ENVIRONMENTAL_CONSTANTS.EWASTE_IMPACT_PER_GB;
  return Math.max(0, Math.min(energy, 50)); // Cap at 50 kWh for safety
}

/**
 * Calculates efficiency energy with bounds checking
 */
export function calculateEfficiencyEnergy(installTimeHours: number): number {
  const energy =
    (installTimeHours * ENVIRONMENTAL_CONSTANTS.EFFICIENCY_IMPROVEMENT) / 100;
  return Math.max(0, Math.min(energy, 100)); // Cap at 100 kWh for safety
}

/**
 * Calculates server efficiency energy with bounds checking
 */
export function calculateServerEfficiencyEnergy(diskSpaceGB: number): number {
  const energy =
    (diskSpaceGB * ENVIRONMENTAL_CONSTANTS.SERVER_UTILIZATION_IMPROVEMENT) /
    100;
  return Math.max(0, Math.min(energy, 200)); // Cap at 200 kWh for safety
}

/**
 * Aggregates energy savings with validation
 */
export function aggregateEnergySavings(energies: number[]): number {
  const total = energies.reduce((sum, energy) => sum + energy, 0);

  // Validate total energy savings
  if (total > 10000) {
    console.warn(
      "Total energy savings exceed typical ranges, capping at 10,000 kWh"
    );
    return 10000;
  }

  return Math.max(0, total);
}

/**
 * Creates an EnvironmentalImpact object with zero values.
 * This is useful for cases where no dependencies are removed.
 */
export function createZeroEnvironmentalImpact(): EnvironmentalImpact {
  return {
    // Primary metrics
    carbonSavings: 0,
    energySavings: 0,
    waterSavings: 0,
    treesEquivalent: 0,
    carMilesEquivalent: 0,
    efficiencyGain: 0,
    networkSavings: 0,
    storageSavings: 0,

    // Detailed energy breakdown
    transferEnergy: 0,
    cpuEnergy: 0,
    memoryEnergy: 0,
    latencyEnergy: 0,
    buildEnergy: 0,
    ciCdEnergy: 0,
    registryEnergy: 0,
    lifecycleEnergy: 0,

    // Financial impact
    carbonOffsetValue: 0,
    waterTreatmentValue: 0,
    totalFinancialValue: 0,

    // Regional variations
    carbonIntensityUsed: ENVIRONMENTAL_CONSTANTS.CARBON_INTENSITY,
    regionalMultiplier: 1.0,

    // Time-based factors
    peakEnergySavings: 0,
    offPeakEnergySavings: 0,
    timeOfDayMultiplier: 1.0,

    // Renewable energy impact
    renewableEnergySavings: 0,
    fossilFuelSavings: 0,
    renewablePercentage: 0,

    // Additional environmental metrics
    ewasteReduction: 0,
    serverUtilizationImprovement: 0,
    developerProductivityGain: 0,
    buildTimeReduction: 0,
  };
}

/**
 * Validates the calculated EnvironmentalImpact object.
 * Returns an object with isValid and warnings.
 */
function validateEnvironmentalImpact(impact: EnvironmentalImpact): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const isValid = true;

  if (impact.carbonSavings < 0) {
    warnings.push("Carbon savings cannot be negative.");
  }
  if (impact.energySavings < 0) {
    warnings.push("Energy savings cannot be negative.");
  }
  if (impact.waterSavings < 0) {
    warnings.push("Water savings cannot be negative.");
  }
  if (impact.treesEquivalent < 0) {
    warnings.push("Trees equivalent cannot be negative.");
  }
  if (impact.carMilesEquivalent < 0) {
    warnings.push("Car miles equivalent cannot be negative.");
  }
  if (impact.efficiencyGain < 0) {
    warnings.push("Efficiency gain cannot be negative.");
  }
  if (impact.networkSavings < 0) {
    warnings.push("Network savings cannot be negative.");
  }
  if (impact.storageSavings < 0) {
    warnings.push("Storage savings cannot be negative.");
  }

  return { isValid, warnings };
}

export function calculateCumulativeEnvironmentalImpact(
  impacts: EnvironmentalImpact[]
): EnvironmentalImpact {
  return impacts.reduce(
    (total, impact) => ({
      // Primary metrics
      carbonSavings: total.carbonSavings + impact.carbonSavings,
      energySavings: total.energySavings + impact.energySavings,
      waterSavings: total.waterSavings + impact.waterSavings,
      treesEquivalent: total.treesEquivalent + impact.treesEquivalent,
      carMilesEquivalent: total.carMilesEquivalent + impact.carMilesEquivalent,
      efficiencyGain: Math.max(total.efficiencyGain, impact.efficiencyGain),
      networkSavings: total.networkSavings + impact.networkSavings,
      storageSavings: total.storageSavings + impact.storageSavings,

      // Detailed energy breakdown
      transferEnergy: total.transferEnergy + impact.transferEnergy,
      cpuEnergy: total.cpuEnergy + impact.cpuEnergy,
      memoryEnergy: total.memoryEnergy + impact.memoryEnergy,
      latencyEnergy: total.latencyEnergy + impact.latencyEnergy,
      buildEnergy: total.buildEnergy + impact.buildEnergy,
      ciCdEnergy: total.ciCdEnergy + impact.ciCdEnergy,
      registryEnergy: total.registryEnergy + impact.registryEnergy,
      lifecycleEnergy: total.lifecycleEnergy + impact.lifecycleEnergy,

      // Financial impact
      carbonOffsetValue: total.carbonOffsetValue + impact.carbonOffsetValue,
      waterTreatmentValue:
        total.waterTreatmentValue + impact.waterTreatmentValue,
      totalFinancialValue:
        total.totalFinancialValue + impact.totalFinancialValue,

      // Regional variations (use the first impact's values as they should be consistent)
      carbonIntensityUsed: total.carbonIntensityUsed,
      regionalMultiplier: total.regionalMultiplier,

      // Time-based factors
      peakEnergySavings: total.peakEnergySavings + impact.peakEnergySavings,
      offPeakEnergySavings:
        total.offPeakEnergySavings + impact.offPeakEnergySavings,
      timeOfDayMultiplier: total.timeOfDayMultiplier,

      // Renewable energy impact
      renewableEnergySavings:
        total.renewableEnergySavings + impact.renewableEnergySavings,
      fossilFuelSavings: total.fossilFuelSavings + impact.fossilFuelSavings,
      renewablePercentage: total.renewablePercentage,

      // Additional environmental metrics
      ewasteReduction: total.ewasteReduction + impact.ewasteReduction,
      serverUtilizationImprovement:
        total.serverUtilizationImprovement +
        impact.serverUtilizationImprovement,
      developerProductivityGain:
        total.developerProductivityGain + impact.developerProductivityGain,
      buildTimeReduction: total.buildTimeReduction + impact.buildTimeReduction,
    }),
    createZeroEnvironmentalImpact()
  );
}

export function formatEnvironmentalImpact(
  impact: EnvironmentalImpact
): Record<string, string> {
  return {
    carbonSavings: `${impact.carbonSavings.toFixed(3)} kg CO2e`,
    energySavings: `${impact.energySavings.toFixed(3)} kWh`,
    waterSavings: `${impact.waterSavings.toFixed(1)} L`,
    treesEquivalent: `${impact.treesEquivalent.toFixed(2)} trees/year`,
    carMilesEquivalent: `${impact.carMilesEquivalent.toFixed(1)} miles`,
    efficiencyGain: `${impact.efficiencyGain}%`,
    networkSavings: `${impact.networkSavings.toFixed(4)} kWh`,
    storageSavings: `${impact.storageSavings.toFixed(4)} kWh`,
  };
}

export function displayEnvironmentalImpactTable(
  impact: EnvironmentalImpact,
  title: string = "Environmental Impact"
) {
  const formatted = formatEnvironmentalImpact(impact);

  const table = new CliTable({
    head: ["Metric", "Value", "Impact"],
    colWidths: [25, 20, 35],
    wordWrap: true,
    style: {
      head: ["green"],
      border: ["grey"],
    },
  });

  table.push(
    [
      "Carbon Savings",
      formatted.carbonSavings,
      `Equivalent to ${formatted.treesEquivalent} trees planted`,
    ],
    [
      "Energy Savings",
      formatted.energySavings,
      "Reduced data center energy consumption",
    ],
    [
      "Water Savings",
      formatted.waterSavings,
      "Reduced data center cooling needs",
    ],
    [
      "Car Miles Equivalent",
      formatted.carMilesEquivalent,
      "CO2 savings equivalent to driving",
    ],
    [
      "Efficiency Gain",
      formatted.efficiencyGain,
      "Improved build and runtime performance",
    ]
  );

  console.log(chalk.green(`\n${title}`));
  console.log(table.toString());
}

export function generateEnvironmentalRecommendations(
  impact: EnvironmentalImpact,
  packageCount: number
): string[] {
  const recommendations: string[] = [];

  if (impact.carbonSavings > 0.1) {
    recommendations.push(
      `Carbon savings: ${impact.carbonSavings.toFixed(
        3
      )} kg CO2e - equivalent to ${impact.treesEquivalent.toFixed(
        2
      )} trees planted annually`
    );
  }

  if (impact.energySavings > 0.01) {
    recommendations.push(
      `Energy savings: ${impact.energySavings.toFixed(
        3
      )} kWh - sufficient to power a laptop for ${(
        impact.energySavings * 10
      ).toFixed(1)} hours`
    );
  }

  if (impact.waterSavings > 1) {
    recommendations.push(
      `Water savings: ${impact.waterSavings.toFixed(
        1
      )}L - equivalent to ${(impact.waterSavings / 2).toFixed(
        1
      )} standard water bottles`
    );
  }

  if (packageCount > 5) {
    recommendations.push(
      `Removing ${packageCount} unused dependencies significantly reduces your project's environmental footprint`
    );
  }

  if (impact.carMilesEquivalent > 0.1) {
    recommendations.push(
      `CO2 savings equivalent to driving ${impact.carMilesEquivalent.toFixed(
        1
      )} fewer miles`
    );
  }

  recommendations.push(
    `Your actions are making a measurable difference. Share your environmental impact analysis with your team to encourage sustainable development practices.`
  );

  return recommendations;
}

export function displayEnvironmentalHeroMessage(
  impact: EnvironmentalImpact
): void {
  const totalSavings =
    impact.carbonSavings + impact.energySavings + impact.waterSavings;

  if (totalSavings > 1) {
    console.log(chalk.green.bold("\nEnvironmental Impact: Significant"));
    console.log(
      chalk.green(
        "Your dependency cleanup is making a measurable positive environmental impact"
      )
    );
  } else if (totalSavings > 0.1) {
    console.log(chalk.yellow.bold("\nEnvironmental Impact: Positive"));
    console.log(
      chalk.yellow("Every optimization contributes to sustainable development practices")
    );
  } else {
    console.log(chalk.blue.bold("\nEnvironmental Impact: Measured"));
    console.log(
      chalk.blue("You are contributing to a more efficient and sustainable codebase")
    );
  }
}
