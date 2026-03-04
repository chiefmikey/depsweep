import * as fs from "node:fs/promises";
import path from "node:path";

import chalk from "chalk";
import { findUp } from "find-up";
import { globby } from "globby";
import { isBinaryFileSync } from "isbinaryfile";

import { FILE_PATTERNS, MESSAGES } from "./constants.js";
import {
  isConfigFile,
  parseConfigFile,
  isDependencyUsedInFile,
  customSort,
} from "./helpers.js";
import type {
  DependencyContext,
  PackageJson,
  WorkspaceInfo,
} from "./interfaces.js";
import {
  OptimizedCache,
  OptimizedFileReader,
  OptimizedDependencyAnalyzer,
  StringOptimizer,
  PerformanceMonitor,
  MemoryOptimizer,
} from "./performance-optimizations.js";


interface DependencyInfo {
  usedInFiles: string[];
  requiredByPackages: Set<string>;
  hasSubDependencyUsage: boolean;
}

// Use optimized caching with TTL and size limits
const depInfoCache = new OptimizedCache<DependencyInfo>(2000, 300000); // 5 minutes TTL
const performanceMonitor = PerformanceMonitor.getInstance();
const memoryOptimizer = MemoryOptimizer.getInstance();
const fileReader = OptimizedFileReader.getInstance();
const dependencyAnalyzer = OptimizedDependencyAnalyzer.getInstance();

function normalizeTypesPackage(typesPackage: string): string {
  // Remove @types/ prefix
  const basePackage = typesPackage.replace("@types/", "");
  // Convert double underscore to @
  // e.g., babel__traverse -> @babel/traverse
  if (basePackage.includes("__")) {
    return `@${basePackage.replace("__", "/")}`;
  }
  // Handle regular packages
  return basePackage.includes("/") ? `@${basePackage}` : basePackage;
}

interface ProgressOptions {
  onProgress?: (
    filePath: string,
    subdepIndex?: number,
    totalSubdeps?: number,
  ) => void;
  totalAnalysisSteps: number;
}

function getFrameworkInfo(context: DependencyContext): {
  name: string;
  corePackage: string;
  devDependencies: string[];
} | null {
  const packageJson = context.configs?.["package.json"];
  if (!packageJson) return null;

  const deps = packageJson.dependencies || {};
  const developmentDeps = packageJson.devDependencies || {};
  const allDeps = { ...deps, ...developmentDeps };

  // Framework detection patterns
  const frameworks = [
    {
      name: "angular",
      corePackage: "@angular/core",
      devDependencies: [
        "@angular-builders/",
        "@angular-devkit/",
        "@angular/cli",
        "@webcomponents/custom-elements",
      ],
    },
    {
      name: "react",
      corePackage: "react",
      devDependencies: [
        "react-scripts",
        "@testing-library/react",
        "react-app-rewired",
      ],
    },
    // Add more frameworks as needed
  ];

  for (const framework of frameworks) {
    if (allDeps[framework.corePackage]) {
      return framework;
    }
  }

  return null;
}

function isFrameworkDevelopmentDependency(
  dependency: string,
  frameworkInfo: ReturnType<typeof getFrameworkInfo>,
): boolean {
  if (!frameworkInfo) return false;

  return frameworkInfo.devDependencies.some(
    (prefix) => dependency.startsWith(prefix) || dependency === prefix,
  );
}

export async function getDependencyInfo(
  dependency: string,
  context: DependencyContext,
  sourceFiles: string[],
  topLevelDependencies: Set<string>, // Add this parameter
  progressOptions?: ProgressOptions,
): Promise<DependencyInfo> {
  performanceMonitor.startTimer("getDependencyInfo");

  // Check memory usage and optimize if needed
  const memoryStats = memoryOptimizer.checkMemoryUsage();
  if (memoryStats.shouldGC) {
    // Clear caches if memory pressure is high
    depInfoCache.clear();
    fileReader.clearCache();
    dependencyAnalyzer.clearCaches();
  }

  // Check cache with optimized key
  const cacheKey = StringOptimizer.intern(
    `${context.projectRoot}:${dependency}`,
  );
  const cached = depInfoCache.get(cacheKey);
  if (cached !== undefined) {
    performanceMonitor.endTimer("getDependencyInfo");
    return cached;
  }

  const info: DependencyInfo = {
    usedInFiles: [],
    requiredByPackages: new Set(),
    hasSubDependencyUsage: false,
  };

  // Framework-specific handling
  const frameworkInfo = getFrameworkInfo(context);
  if (
    frameworkInfo &&
    isFrameworkDevelopmentDependency(dependency, frameworkInfo)
  ) {
    info.requiredByPackages.add(frameworkInfo.corePackage);
    return info;
  }

  // Special handling for @types packages
  if (dependency.startsWith("@types/")) {
    const basePackage = normalizeTypesPackage(dependency);
    const tsConfig = await getTSConfig(context.projectRoot);

    // Check if this is a compiler-required types package
    if (basePackage === "node" && hasTSFiles(sourceFiles)) {
      info.requiredByPackages.add("typescript");
      return info;
    }

    // Check if the base package is installed
    if (topLevelDependencies.has(basePackage)) {
      info.requiredByPackages.add(basePackage);
    }

    // Check if any TypeScript files use types from this package
    let subdepIndex = 0;
    for (const file of sourceFiles) {
      subdepIndex++;
      if (
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        ((await isDependencyUsedInFile(dependency, file, context)) ||
          (await isDependencyUsedInFile(basePackage, file, context)))
      ) {
        info.usedInFiles.push(file);
      }
      progressOptions?.onProgress?.(file, subdepIndex);
      await new Promise((res) => setImmediate(res)); // Tiny pause
    }

    // If we have TypeScript files and tsconfig includes this in types/typeRoots, mark as used
    if (tsConfig && hasTSFiles(sourceFiles)) {
      const { types = [], typeRoots = [] } = tsConfig.compilerOptions || {};
      if (
        types.includes(basePackage) ||
        typeRoots.some((root: string) => root.includes(basePackage))
      ) {
        info.requiredByPackages.add("typescript");
      }
    }

    return info;
  }

  // Count subdependencies from the dependency graph
  const subdeps = context.dependencyGraph?.get(dependency) || new Set<string>();
  const subdepsArray = [...subdeps]; // Convert to array for indexed access
  const totalSubdeps = subdepsArray.length;

  // Optimized file processing with batch operations
  performanceMonitor.startTimer("fileProcessing");

  // Use optimized dependency analyzer for better performance
  const usedFiles = await dependencyAnalyzer.processFilesInBatches(
    sourceFiles,
    dependency,
    context,
    (processed, total) => {
      progressOptions?.onProgress?.(
        sourceFiles[processed - 1],
        processed,
        total,
      );
    },
  );

  info.usedInFiles = usedFiles;

  // Check package.json config fields for dependency name references.
  // package.json is excluded from getSourceFiles(), so it never reaches
  // isDependencyUsedInFile(). We compensate here by scanning known config
  // fields that embed dependency names (e.g. eslintConfig, prettier, babel).
  const packageJsonConfig = context.configs?.["package.json"];
  if (info.usedInFiles.length === 0 && packageJsonConfig) {
    // Well-known config fields that commonly reference dependency names.
    const CONFIG_FIELDS = [
      "eslintConfig",
      "prettier",
      "stylelint",
      "babel",
      "jest",
      "browserslist",
      "commitlint",
      "lint-staged",
      "husky",
      "mocha",
      "ava",
      "nyc",
      "c8",
      "gitHooks",
    ] as const;

    // Standard package.json fields that must never be treated as config.
    const STANDARD_PKG_FIELDS = new Set([
      "name", "version", "description", "main", "module", "browser",
      "exports", "imports", "bin", "man", "files", "directories",
      "scripts", "dependencies", "devDependencies", "peerDependencies",
      "peerDependenciesMeta", "optionalDependencies", "bundledDependencies",
      "bundleDependencies", "engines", "os", "cpu", "private", "publishConfig",
      "workspaces", "repository", "bugs", "homepage", "license", "author",
      "contributors", "funding", "keywords", "type", "types", "typings",
      "sideEffects", "unpkg", "jsdelivr",
    ]);

    let foundInConfig = false;

    // Check each known config field.
    for (const field of CONFIG_FIELDS) {
      if (packageJsonConfig[field] !== undefined) {
        const fieldValue = packageJsonConfig[field];
        // For string values, do a direct includes check; for objects/arrays
        // delegate to the existing recursive scanForDependency utility.
        const matched =
          typeof fieldValue === "string"
            ? fieldValue.includes(dependency)
            : scanForDependency(fieldValue, dependency);
        if (matched) {
          foundInConfig = true;
          break;
        }
      }
    }

    // Also check any top-level key that matches the dependency name exactly
    // (e.g., a "commitlint" dep may have a top-level "commitlint" config key).
    if (!foundInConfig && packageJsonConfig[dependency] !== undefined && !STANDARD_PKG_FIELDS.has(dependency)) {
      foundInConfig = true;
    }

    if (foundInConfig) {
      const packageJsonPath = path.join(context.projectRoot, "package.json");
      info.usedInFiles.push(`${packageJsonPath} (config fields)`);
    }
  }

  // Check package.json scripts for dependency name references.
  // Tools like nyc, rimraf, cross-env are only referenced in scripts.
  if (info.usedInFiles.length === 0 && context.scripts) {
    const scriptValues = Object.values(context.scripts) as string[];
    const foundInScripts = scriptValues.some(
      (script) => typeof script === "string" && script.includes(dependency),
    );
    if (foundInScripts) {
      const packageJsonPath = path.join(context.projectRoot, "package.json");
      info.usedInFiles.push(`${packageJsonPath} (scripts)`);
    }
  }

  // Check if dep's CLI binary name (often different from package name) is used in scripts.
  // e.g., @commitlint/cli installs binary "commitlint", npm-run-all2 installs "run-s"/"run-p".
  if (info.usedInFiles.length === 0 && context.scripts) {
    try {
      const depPkgPath = path.join(context.projectRoot, "node_modules", dependency, "package.json");
      const depPkgContent = await fs.readFile(depPkgPath, "utf8");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsing external JSON
      const depPkg: any = JSON.parse(depPkgContent);
      const binNames: string[] = [];
      if (typeof depPkg.bin === "string") {
        const baseName = dependency.startsWith("@") ? dependency.split("/")[1] : dependency;
        if (baseName) binNames.push(baseName);
      } else if (depPkg.bin && typeof depPkg.bin === "object") {
        binNames.push(...Object.keys(depPkg.bin));
      }
      if (binNames.length > 0) {
        // Check package.json scripts for binary names
        const scriptValues = Object.values(context.scripts) as string[];
        const foundBin = binNames.some((bin) =>
          scriptValues.some((script) => typeof script === "string" && script.includes(bin)),
        );
        if (foundBin) {
          const packageJsonPath = path.join(context.projectRoot, "package.json");
          info.usedInFiles.push(`${packageJsonPath} (scripts:bin)`);
        }

        // Also scan source files for binary names (catches .husky/ hooks,
        // Makefiles, shell scripts, and CLI argument conventions).
        if (info.usedInFiles.length === 0) {
          for (const bin of binNames) {
            const binUsedFiles = await dependencyAnalyzer.processFilesInBatches(
              sourceFiles,
              bin,
              context,
            );
            if (binUsedFiles.length > 0) {
              info.usedInFiles.push(`${binUsedFiles[0]} (bin)`);
              break;
            }
          }
        }
      }
    } catch {
      // node_modules not available or dep not installed, skip
    }
  }

  // Vitest coverage provider detection.
  // vitest dynamically loads @vitest/coverage-{provider} based on config string.
  // e.g., coverage: { provider: 'v8' } → @vitest/coverage-v8
  if (info.usedInFiles.length === 0 && dependency.startsWith("@vitest/coverage-")) {
    const providerName = dependency.slice("@vitest/coverage-".length);
    const vitestConfigPatterns = ["vitest.config", "vite.config"];
    const vitestConfigFiles = sourceFiles.filter((f) => {
      const base = path.basename(f);
      return vitestConfigPatterns.some((p) => base.startsWith(p));
    });
    for (const configFile of vitestConfigFiles) {
      const content = await OptimizedFileReader.getInstance().readFile(configFile);
      if (
        content.includes(`provider: '${providerName}'`) ||
        content.includes(`provider: "${providerName}"`) ||
        content.includes(`provider: \`${providerName}\``)
      ) {
        info.usedInFiles.push(`${configFile} (vitest coverage provider)`);
        break;
      }
    }
  }

  // Framework plugin convention detection.
  // Tools like karma auto-discover karma-* packages. Check if the plugin's short
  // name appears in a config file for the parent tool.
  if (info.usedInFiles.length === 0) {
    const PLUGIN_CONVENTIONS: Array<{
      prefix: string;
      parent: string;
      configPattern?: RegExp;
    }> = [
      { prefix: "karma-", parent: "karma", configPattern: /karma\.conf/ },
      { prefix: "grunt-", parent: "grunt", configPattern: /[Gg]runtfile/ },
      { prefix: "gulp-", parent: "gulp", configPattern: /gulpfile/ },
      { prefix: "eslint-formatter-", parent: "eslint" },
      { prefix: "eslint-plugin-", parent: "eslint" },
      { prefix: "eslint-config-", parent: "eslint" },
      { prefix: "eslint-import-resolver-", parent: "eslint" },
    ];

    for (const conv of PLUGIN_CONVENTIONS) {
      if (dependency.startsWith(conv.prefix) && topLevelDependencies.has(conv.parent)) {
        const shortName = dependency.slice(conv.prefix.length).split("-")[0];

        // Check config files for short name
        if (conv.configPattern) {
          const configFiles = sourceFiles.filter((f) => conv.configPattern!.test(path.basename(f)));
          for (const configFile of configFiles) {
            const content = await OptimizedFileReader.getInstance().readFile(configFile);
            if (content.toLowerCase().includes(shortName.toLowerCase())) {
              info.usedInFiles.push(`${configFile} (${conv.parent} plugin)`);
              break;
            }
          }
        }

        // Also check scripts for short name (e.g., eslint --format friendly)
        if (info.usedInFiles.length === 0 && context.scripts) {
          const scriptValues = Object.values(context.scripts) as string[];
          const foundInScripts = scriptValues.some(
            (s) => typeof s === "string" && s.toLowerCase().includes(shortName.toLowerCase()),
          );
          if (foundInScripts) {
            const packageJsonPath = path.join(context.projectRoot, "package.json");
            info.usedInFiles.push(`${packageJsonPath} (${conv.parent} plugin:scripts)`);
          }
        }

        // Check source files for short name (e.g., eslint --format codeframe in Makefile.source.ts)
        if (info.usedInFiles.length === 0) {
          const shortUsedFiles = await dependencyAnalyzer.processFilesInBatches(
            sourceFiles, shortName, context,
          );
          if (shortUsedFiles.length > 0) {
            info.usedInFiles.push(`${shortUsedFiles[0]} (${conv.parent} plugin:source)`);
          }
        }

        // Check for ESLint plugin:NAME/config extends syntax (e.g., plugin:mdx/recommended)
        if (info.usedInFiles.length === 0 && conv.prefix === "eslint-plugin-") {
          const pluginShortName = dependency.slice(conv.prefix.length);
          const eslintConfigFiles = sourceFiles.filter((f) => {
            const base = path.basename(f);
            return base.startsWith("eslint.config") || base === ".eslintrc.js" ||
              base === ".eslintrc.cjs" || base === ".eslintrc.json" || base === ".eslintrc.yml";
          });
          for (const configFile of eslintConfigFiles) {
            const content = await OptimizedFileReader.getInstance().readFile(configFile);
            if (content.includes(`plugin:${pluginShortName}/`) || content.includes(`plugin:${pluginShortName}'`) || content.includes(`plugin:${pluginShortName}"`)) {
              info.usedInFiles.push(`${configFile} (eslint plugin:${pluginShortName})`);
              break;
            }
          }
        }

        // Check for ESLint import resolver pattern: 'import/resolver': { NAME: ... }
        // e.g., eslint-import-resolver-typescript loaded via { typescript: true }
        if (info.usedInFiles.length === 0 && conv.prefix === "eslint-import-resolver-") {
          const resolverName = dependency.slice(conv.prefix.length);
          const eslintConfigFiles = sourceFiles.filter((f) => {
            const base = path.basename(f);
            return base.startsWith("eslint.config") || base === ".eslintrc.js" ||
              base === ".eslintrc.cjs" || base === ".eslintrc.json" || base === ".eslintrc.yml";
          });
          for (const configFile of eslintConfigFiles) {
            const content = await OptimizedFileReader.getInstance().readFile(configFile);
            if (
              content.includes(`'${resolverName}'`) ||
              content.includes(`"${resolverName}"`) ||
              content.includes(`${resolverName}:`)
            ) {
              info.usedInFiles.push(`${configFile} (eslint import resolver)`);
              break;
            }
          }
        }

        if (info.usedInFiles.length > 0) break;
      }
    }
  }

  // Peer dependency awareness: if another installed dep requires this as a peer,
  // it shouldn't be flagged as unused.
  if (info.usedInFiles.length === 0) {
    for (const otherDep of topLevelDependencies) {
      if (otherDep === dependency) continue;
      try {
        const otherPkgPath = path.join(context.projectRoot, "node_modules", otherDep, "package.json");
        const otherPkgContent = await fs.readFile(otherPkgPath, "utf8");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsing external JSON
        const otherPkg: any = JSON.parse(otherPkgContent);
        if (otherPkg.peerDependencies && dependency in otherPkg.peerDependencies) {
          info.usedInFiles.push(`${otherPkgPath} (required peer)`);
          break;
        }
      } catch {
        // skip
      }
    }
  }

  // Check subdependencies with optimized processing
  if (subdepsArray.length > 0) {
    for (const [index, subdep] of subdepsArray.entries()) {
      const subdepUsedFiles = await dependencyAnalyzer.processFilesInBatches(
        sourceFiles,
        subdep,
        context,
      );

      if (subdepUsedFiles.length > 0) {
        info.hasSubDependencyUsage = true;
        break; // Early exit if any subdependency is used
      }

      progressOptions?.onProgress?.(sourceFiles[0], index + 1, totalSubdeps);
    }
  }

  performanceMonitor.endTimer("fileProcessing");

  // Don't check package dependencies in node_modules
  // A dependency should only be considered "used" if it's actually imported in source code
  // The requiredByPackages logic was causing false positives

  // Cache the result with optimized key
  depInfoCache.set(cacheKey, info);
  performanceMonitor.endTimer("getDependencyInfo");
  return info;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tsconfig.json has arbitrary shape
export async function getTSConfig(projectRoot: string): Promise<any> {
  try {
    const tsConfigPath = path.join(projectRoot, "tsconfig.json");
    const content = await fs.readFile(tsConfigPath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function hasTSFiles(files: string[]): boolean {
  return files.some((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

// Add workspace detection
export async function getWorkspaceInfo(
  packageJsonPath: string,
): Promise<WorkspaceInfo | undefined> {
  try {
    const content = await fs.readFile(packageJsonPath);
    const package_ = JSON.parse(content.toString("utf8")) as PackageJson;

    if (!package_.workspaces) return undefined;

    const patterns = Array.isArray(package_.workspaces)
      ? package_.workspaces
      : package_.workspaces.packages || [];

    const packagePaths = await globby(patterns, {
      cwd: path.dirname(packageJsonPath),
      onlyDirectories: true,
      expandDirectories: false,
      ignore: ["node_modules"],
    });

    return {
      root: packageJsonPath,
      packages: packagePaths,
    };
  } catch {
    return undefined;
  }
}

export async function findClosestPackageJson(
  startDirectory: string,
): Promise<string> {
  const packageJsonPath = await findUp(FILE_PATTERNS.PACKAGE_JSON, {
    cwd: startDirectory,
  });
  if (!packageJsonPath) {
    console.error(chalk.red(MESSAGES.noPackageJson));
    process.exit(1);
  }

  // Check if this is part of a monorepo
  let currentDirectory = path.dirname(packageJsonPath);
  while (true) {
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    const potentialRootPackageJson = path.join(
      parentDirectory,
      FILE_PATTERNS.PACKAGE_JSON,
    );
    try {
      const rootPackageString = await fs.readFile(potentialRootPackageJson);
      const rootPackage = JSON.parse(rootPackageString.toString("utf8")) as {
        workspaces?: string[];
      };
      if (rootPackage.workspaces) {
        console.log(chalk.yellow(MESSAGES.monorepoDetected));
        return potentialRootPackageJson;
      }
    } catch {
      // No package.json found at this level
    }
    const workspaceInfo = await getWorkspaceInfo(potentialRootPackageJson);

    if (workspaceInfo) {
      const relativePath = path.relative(
        path.dirname(workspaceInfo.root),
        packageJsonPath,
      );
      const isWorkspacePackage = workspaceInfo.packages.some(
        (p: string) => relativePath.startsWith(p) || p.startsWith(relativePath),
      );

      if (isWorkspacePackage) {
        console.log(chalk.yellow("\nMonorepo workspace package detected."));
        console.log(chalk.yellow(`Root: ${workspaceInfo.root}`));
        return packageJsonPath; // Analyze the workspace package
      }
    }
    currentDirectory = parentDirectory;
  }

  return packageJsonPath;
}

/**
 * Validates package.json structure and content
 */
function validatePackageJson(packageJson: any): { valid: boolean; error?: string } {
  if (typeof packageJson !== 'object' || packageJson === null) {
    return { valid: false, error: 'package.json must be an object' };
  }

  // Validate dependency fields if they exist
  const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  for (const field of dependencyFields) {
    if (packageJson[field] !== undefined) {
      if (typeof packageJson[field] !== 'object' || Array.isArray(packageJson[field])) {
        return { valid: false, error: `${field} must be an object` };
      }

      // Log warnings for invalid dependency names but don't abort the entire scan.
      // Yarn workspace protocol links (e.g., "$repo-utils": "link:./scripts") use
      // non-standard names that fail PACKAGE_NAME_REGEX but don't invalidate the file.
      for (const depName of Object.keys(packageJson[field])) {
        if (typeof depName !== 'string' || !FILE_PATTERNS.PACKAGE_NAME_REGEX.test(depName)) {
          console.warn(chalk.yellow(`Skipping invalid dependency name in ${field}: ${depName}`));
        }
      }
    }
  }

  return { valid: true };
}

export async function getDependencies(
  packageJsonPath: string,
): Promise<string[]> {
  try {
    const packageJsonString = await fs.readFile(packageJsonPath, "utf8");
    if (!packageJsonString || packageJsonString.trim() === '') {
      return [];
    }

    let packageJson: any;
    try {
      packageJson = JSON.parse(packageJsonString);
    } catch {
      console.error(chalk.red(`Invalid JSON in package.json: ${packageJsonPath}`));
      return [];
    }

    // Validate package.json structure
    const validation = validatePackageJson(packageJson);
    if (!validation.valid) {
      console.error(chalk.red(`Invalid package.json: ${validation.error}`));
      return [];
    }

    // Filter helper: valid package name AND not an npm: alias (structural deps, not imported)
    const isValidDep = (dep: string, field: Record<string, string>) =>
      FILE_PATTERNS.PACKAGE_NAME_REGEX.test(dep) &&
      !(typeof field[dep] === "string" && field[dep].startsWith("npm:"));

    const dependencies = packageJson.dependencies && typeof packageJson.dependencies === 'object'
      ? Object.keys(packageJson.dependencies).filter(dep => isValidDep(dep, packageJson.dependencies))
      : [];
    const devDependencies = packageJson.devDependencies && typeof packageJson.devDependencies === 'object'
      ? Object.keys(packageJson.devDependencies).filter(dep => isValidDep(dep, packageJson.devDependencies))
      : [];
    const peerDependencies = packageJson.peerDependencies && typeof packageJson.peerDependencies === 'object'
      ? Object.keys(packageJson.peerDependencies).filter(dep => isValidDep(dep, packageJson.peerDependencies))
      : [];
    // optionalDependencies are excluded — they exist to trigger platform-specific
    // binary installation and are never directly imported in source code.

    const allDependencies = [
      ...dependencies,
      ...devDependencies,
      ...peerDependencies,
    ];

    // Remove duplicates
    const uniqueDependencies = [...new Set(allDependencies)];

    // Sort all dependencies using custom sort function
    uniqueDependencies.sort(customSort);

    return uniqueDependencies;
  } catch {
    console.error(chalk.red(`Error reading package.json: ${packageJsonPath}`));
    return [];
  }
}

export async function getPackageContext(
  packageJsonPath: string,
): Promise<DependencyContext> {
  const projectDirectory = path.dirname(packageJsonPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- config files have arbitrary shapes
  const configs: Record<string, any> = {};
  const dependencyGraph = new Map<string, Set<string>>(); // Re-added dependencyGraph

  // Populate dependencyGraph as needed
  // Example: Populate with existing dependencies
  const dependencies = await getDependencies(packageJsonPath);
  for (const dep of dependencies) {
    // Example: Initialize with empty sets or actual subdependencies
    dependencyGraph.set(dep, new Set<string>());
  }

  // Read all files in the project
  const allFiles = await getSourceFiles(projectDirectory);

  // Process config files
  for (const file of allFiles) {
    if (file && isConfigFile(file)) {
      const relativePath = path.relative(projectDirectory, file);
      try {
        configs[relativePath] = await parseConfigFile(file);
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Get package.json content
  const packageJsonString =
    (await fs.readFile(packageJsonPath, "utf8")) || "{}";
  const packageJson = JSON.parse(packageJsonString) as PackageJson & {
    eslintConfig?: { extends?: string | string[] };
    prettier?: unknown;
    stylelint?: { extends?: string | string[] };
  };

  return {
    scripts: packageJson.scripts,
    configs: {
      "package.json": packageJson,
      ...configs,
    },
    projectRoot: path.dirname(packageJsonPath),
    dependencyGraph, // Included dependencyGraph
  };
}

export async function getSourceFiles(
  projectDirectory: string,
  ignorePatterns: string[] = [],
): Promise<string[]> {
  const files = await globby(["**/*"], {
    cwd: projectDirectory,
    gitignore: true,
    dot: true,
    followSymbolicLinks: false,
    ignore: [
      FILE_PATTERNS.NODE_MODULES,
      "**/node_modules/**",
      "dist",
      "coverage",
      "build",
      ".git",
      "*.log",
      "*.lock",
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      ...ignorePatterns,
    ],
    absolute: true,
  });

  return files.filter((file) => !isBinaryFileSync(file));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- recursively scans arbitrary config structures
export function scanForDependency(config: any, dependency: string): boolean {
  if (!config) {
    return false;
  }

  if (Array.isArray(config)) {
    return config.some((item) => {
      if (typeof item === "string") {
        return item.includes(dependency);
      }
      return scanForDependency(item, dependency);
    });
  }

  if (typeof config !== "object") {
    return false;
  }

  for (const [, value] of Object.entries(config)) {
    if (typeof value === "string" && value.includes(dependency)) {
      return true;
    }
    if (typeof value === "object" && scanForDependency(value, dependency)) {
      return true;
    }
  }

  return false;
}

// Optimized parallel processing with enhanced memory management
export async function processFilesInParallel(
  files: string[],
  dependency: string,
  context: DependencyContext,
  onProgress?: (processed: number, total: number) => void,
): Promise<string[]> {
  performanceMonitor.startTimer("processFilesInParallel");

  const results: string[] = [];
  const totalErrors = 0;

  // Use optimized dependency analyzer for better performance
  const usedFiles = await dependencyAnalyzer.processFilesInBatches(
    files,
    dependency,
    context,
    onProgress,
  );

  // Process results with error handling
  for (const file of usedFiles) {
    if (file) {
      results.push(file);
    }
  }

  performanceMonitor.endTimer("processFilesInParallel");

  if (totalErrors > 0) {
    console.warn(
      chalk.yellow(`\nWarning: ${totalErrors} files had processing errors`),
    );
  }

  return results;
}

export function findSubDependencies(
  dependency: string,
  context: DependencyContext,
): string[] {
  // Retrieve sub-dependencies from the dependencyGraph
  return context.dependencyGraph?.get(dependency)
    ? [...context.dependencyGraph.get(dependency)!]
    : [];
}
