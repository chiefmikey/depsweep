import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import path from "node:path";

import { parse } from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import type {
  ImportDeclaration,
  CallExpression,
  TSImportType,
  TSExternalModuleReference,
} from "@babel/types";
import chalk from "chalk";

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
} from "./constants.js";
import type {
  DependencyContext,
} from "./interfaces.js";


// Custom sort function for scoped dependencies (defined here to avoid circular imports)
export function customSort(a: string, b: string): number {
  const aNormalized = a.replace(/^@/, "");
  const bNormalized = b.replace(/^@/, "");
  return aNormalized.localeCompare(bNormalized, "en", { sensitivity: "base" });
}

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
    throw new Error(`Command execution failed: ${(error as Error).message}`, { cause: error });
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
    } catch (_parseError) {
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
  } catch (_error) {
    // Silently handle errors - don't expose internal details
    return null;
  }
}

