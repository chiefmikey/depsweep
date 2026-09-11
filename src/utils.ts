/* eslint-disable max-lines, unicorn/prevent-abbreviations -- utils.ts is the central dependency-analysis hub; all exported functions are tightly interdependent and tested as a unit via imports from utils.js; splitting creates circular dependencies through getTSConfig/scanForDependency re-exports; filename is a deliberate project convention (tests import from utils.js) */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';
import { findUp } from 'find-up';
import { globby } from 'globby';
import { isBinaryFileSync } from 'isbinaryfile';

import { FILE_PATTERNS, MESSAGES } from './constants.js';
import {
  customSort,
  isConfigFile,
  isDependencyUsedInFile,
  parseConfigFile,
} from './helpers.js';
import type {
  DependencyContext,
  DependencyInfo,
  PackageJson,
  ProgressOptions,
  WorkspaceInfo,
} from './interfaces.js';
import {
  MemoryOptimizer,
  OptimizedCache,
  OptimizedDependencyAnalyzer,
  OptimizedFileReader,
  PerformanceMonitor,
  StringOptimizer,
} from './performance-optimizations.js';

// ---------------------------------------------------------------------------
// Module-level interfaces
// ---------------------------------------------------------------------------

interface TsConfigCompilerOptions {
  types?: string[];
  typeRoots?: string[];
}

export interface TsConfig {
  compilerOptions?: TsConfigCompilerOptions;
}

interface NpmPackageManifest {
  bin?: Record<string, string> | string;
  peerDependencies?: Record<string, unknown>;
}

interface PluginConvention {
  prefix: string;
  parent: string;
  configPattern?: RegExp;
}

// ---------------------------------------------------------------------------
// Module-level constants (extracted from function bodies to reduce per-function
// line counts and avoid repeated string literals)
// ---------------------------------------------------------------------------

const CONFIG_FIELDS = [
  'eslintConfig',
  'prettier',
  'stylelint',
  'babel',
  'jest',
  'browserslist',
  'commitlint',
  'lint-staged',
  'husky',
  'mocha',
  'ava',
  'nyc',
  'c8',
  'gitHooks',
] as const;

const STANDARD_PKG_FIELDS = new Set([
  'name',
  'version',
  'description',
  'main',
  'module',
  'browser',
  'exports',
  'imports',
  'bin',
  'man',
  'files',
  'directories',
  'scripts',
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'optionalDependencies',
  'bundledDependencies',
  'bundleDependencies',
  'engines',
  'os',
  'cpu',
  'private',
  'publishConfig',
  'workspaces',
  'repository',
  'bugs',
  'homepage',
  'license',
  'author',
  'contributors',
  'funding',
  'keywords',
  'type',
  'types',
  'typings',
  'sideEffects',
  'unpkg',
  'jsdelivr',
]);

const PLUGIN_CONVENTIONS: readonly PluginConvention[] = [
  { configPattern: /karma\.conf/u, parent: 'karma', prefix: 'karma-' },
  { configPattern: /[Gg]runtfile/u, parent: 'grunt', prefix: 'grunt-' },
  { configPattern: /gulpfile/u, parent: 'gulp', prefix: 'gulp-' },
  { parent: 'eslint', prefix: 'eslint-formatter-' },
  { parent: 'eslint', prefix: 'eslint-plugin-' },
  { parent: 'eslint', prefix: 'eslint-config-' },
  { parent: 'eslint', prefix: 'eslint-import-resolver-' },
];

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

// ---------------------------------------------------------------------------
// Module-level cache + singleton instances
// ---------------------------------------------------------------------------

const depInfoCache = new OptimizedCache<DependencyInfo>(2000, 300_000);
const performanceMonitor = PerformanceMonitor.getInstance();
const memoryOptimizer = MemoryOptimizer.getInstance();
const fileReader = OptimizedFileReader.getInstance();
const dependencyAnalyzer = OptimizedDependencyAnalyzer.getInstance();

// ---------------------------------------------------------------------------
// Type guard helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Pure utility helpers (must come first — used by functions below)
// ---------------------------------------------------------------------------

function normalizeTypesPackage(typesPackage: string): string {
  const basePackage = typesPackage.replace('@types/', '');
  if (basePackage.includes('__')) {
    return `@${basePackage.replace('__', '/')}`;
  }
  return basePackage.includes('/') ? `@${basePackage}` : basePackage;
}

export async function getTSConfig(
  projectRoot: string,
): Promise<TsConfig | null> {
  try {
    const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
    const content = await readFile(tsConfigPath, 'utf8');
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? (parsed as TsConfig) : null;
  } catch {
    return null;
  }
}

function hasTSFiles(files: string[]): boolean {
  return files.some((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
}

export function scanForDependency(
  config: unknown,
  dependency: string,
): boolean {
  if (config === null || config === undefined) {
    return false;
  }

  if (Array.isArray(config)) {
    return config.some((item) => {
      if (typeof item === 'string') {
        return item.includes(dependency);
      }
      return scanForDependency(item, dependency);
    });
  }

  if (typeof config !== 'object') {
    return false;
  }

  for (const [, value] of Object.entries(config)) {
    if (typeof value === 'string' && value.includes(dependency)) {
      return true;
    }
    if (typeof value === 'object' && scanForDependency(value, dependency)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

function getFrameworkInfo(context: DependencyContext): {
  name: string;
  corePackage: string;
  devDependencies: string[];
} | null {
  const rawPkgConfig: unknown = context.configs?.[FILE_PATTERNS.PACKAGE_JSON];
  if (!isRecord(rawPkgConfig)) {
    return null;
  }
  const packageJson = rawPkgConfig as PackageJson;

  const deps = packageJson.dependencies ?? {};
  const developmentDeps = packageJson.devDependencies ?? {};
  const allDeps = { ...deps, ...developmentDeps };

  const frameworks = [
    {
      corePackage: '@angular/core',
      devDependencies: [
        '@angular-builders/',
        '@angular-devkit/',
        '@angular/cli',
        '@webcomponents/custom-elements',
      ],
      name: 'angular',
    },
    {
      corePackage: 'react',
      devDependencies: [
        'react-scripts',
        '@testing-library/react',
        'react-app-rewired',
      ],
      name: 'react',
    },
  ];

  for (const framework of frameworks) {
    if (allDeps[framework.corePackage] !== undefined) {
      return framework;
    }
  }

  return null;
}

function isFrameworkDevelopmentDependency(
  dependency: string,
  frameworkInfo: ReturnType<typeof getFrameworkInfo>,
): boolean {
  if (frameworkInfo === null) {
    return false;
  }
  return frameworkInfo.devDependencies.some(
    (prefix) => dependency.startsWith(prefix) || dependency === prefix,
  );
}

// ---------------------------------------------------------------------------
// getDependencyInfo phase helpers
// ---------------------------------------------------------------------------

function createEmptyDependencyInfo(): DependencyInfo {
  return {
    hasSubDependencyUsage: false,
    requiredByPackages: new Set(),
    usedInFiles: [],
  };
}

function isTypesInTsConfig(basePackage: string, tsConfig: TsConfig): boolean {
  const { typeRoots = [], types = [] } = tsConfig.compilerOptions ?? {};
  return (
    types.includes(basePackage) ||
    typeRoots.some((root) => root.includes(basePackage))
  );
}

async function scanFilesForAtTypes(
  dependency: string,
  basePackage: string,
  sourceFiles: string[],
  context: DependencyContext,
  progressOptions?: ProgressOptions,
): Promise<string[]> {
  const usedFiles: string[] = [];
  let subdepIndex = 0;
  for (const file of sourceFiles) {
    subdepIndex++;
    if (
      (file.endsWith('.ts') || file.endsWith('.tsx')) &&
      // eslint-disable-next-line no-await-in-loop -- sequential: each file scanned for @types usage; short-circuits before the base-package check
      ((await isDependencyUsedInFile(dependency, file, context)) ||
        // eslint-disable-next-line no-await-in-loop -- sequential: only reached when the dependency check above was false
        (await isDependencyUsedInFile(basePackage, file, context)))
    ) {
      usedFiles.push(file);
    }
    progressOptions?.onProgress?.(file, subdepIndex);
    // eslint-disable-next-line no-await-in-loop -- intentional yield for memory pressure relief
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
  return usedFiles;
}

async function handleAtTypesDetection(
  dependency: string,
  context: DependencyContext,
  sourceFiles: string[],
  topLevelDependencies: Set<string>,
  progressOptions?: ProgressOptions,
): Promise<DependencyInfo> {
  const info = createEmptyDependencyInfo();
  const basePackage = normalizeTypesPackage(dependency);
  // getTSConfig is called unconditionally, before any early return, so its
  // read is always consumed in call order (matters for test mock queues).
  const tsConfig = await getTSConfig(context.projectRoot);

  if (basePackage === 'node' && hasTSFiles(sourceFiles)) {
    info.requiredByPackages.add('typescript');
    return info;
  }

  if (topLevelDependencies.has(basePackage)) {
    info.requiredByPackages.add(basePackage);
  }

  info.usedInFiles = await scanFilesForAtTypes(
    dependency,
    basePackage,
    sourceFiles,
    context,
    progressOptions,
  );

  if (
    tsConfig !== null &&
    hasTSFiles(sourceFiles) &&
    isTypesInTsConfig(basePackage, tsConfig)
  ) {
    info.requiredByPackages.add('typescript');
  }

  return info;
}

function checkPackageJsonConfigFields(
  dependency: string,
  packageJsonConfig: Record<string, unknown>,
  projectRoot: string,
): string[] {
  let foundInConfig = false;

  for (const field of CONFIG_FIELDS) {
    // eslint-disable-next-line security/detect-object-injection -- field is from CONFIG_FIELDS, a compile-time const string literal array
    if (packageJsonConfig[field] !== undefined) {
      // eslint-disable-next-line security/detect-object-injection -- field is from CONFIG_FIELDS, a compile-time const string literal array
      const fieldValue = packageJsonConfig[field];
      const matched =
        typeof fieldValue === 'string'
          ? fieldValue.includes(dependency)
          : scanForDependency(fieldValue, dependency);
      if (matched) {
        foundInConfig = true;
        break;
      }
    }
  }

  if (
    !foundInConfig &&
    // eslint-disable-next-line security/detect-object-injection -- key is a validated npm package name from our own dependency list
    packageJsonConfig[dependency] !== undefined &&
    !STANDARD_PKG_FIELDS.has(dependency)
  ) {
    foundInConfig = true;
  }

  if (foundInConfig) {
    return [
      `${path.join(projectRoot, FILE_PATTERNS.PACKAGE_JSON)} (config fields)`,
    ];
  }
  return [];
}

function checkScriptsForDependency(
  dependency: string,
  scripts: Record<string, string>,
  projectRoot: string,
): string[] {
  const scriptValues = Object.values(scripts);
  const foundInScripts = scriptValues.some(
    (script) => typeof script === 'string' && script.includes(dependency),
  );
  if (foundInScripts) {
    return [`${path.join(projectRoot, FILE_PATTERNS.PACKAGE_JSON)} (scripts)`];
  }
  return [];
}

async function findBinInSourceFiles(
  binNames: string[],
  sourceFiles: string[],
  context: DependencyContext,
): Promise<string | undefined> {
  for (const bin of binNames) {
    // eslint-disable-next-line no-await-in-loop -- sequential: checking each binary name
    const binUsedFiles = await dependencyAnalyzer.processFilesInBatches(
      sourceFiles,
      bin,
      context,
    );
    if (binUsedFiles.length > 0) {
      return binUsedFiles[0];
    }
  }
  return undefined;
}

function extractBinNames(
  dependency: string,
  depPackage: NpmPackageManifest,
): string[] {
  if (typeof depPackage.bin === 'string') {
    const baseName = dependency.startsWith('@')
      ? dependency.split('/')[1]
      : dependency;
    return baseName !== undefined && baseName !== '' ? [baseName] : [];
  }
  if (depPackage.bin !== undefined && typeof depPackage.bin === 'object') {
    return Object.keys(depPackage.bin);
  }
  return [];
}

async function checkBinaryCliUsage(
  dependency: string,
  scripts: Record<string, string>,
  projectRoot: string,
  sourceFiles: string[],
  context: DependencyContext,
): Promise<string[]> {
  try {
    const depPackagePath = path.join(
      projectRoot,
      'node_modules',
      dependency,
      FILE_PATTERNS.PACKAGE_JSON,
    );
    const depPackageContent = await readFile(depPackagePath, 'utf8');
    const rawDepPkg: unknown = JSON.parse(depPackageContent);
    if (!isRecord(rawDepPkg)) {
      return [];
    }
    const depPackage = rawDepPkg as NpmPackageManifest;
    const binNames = extractBinNames(dependency, depPackage);

    if (binNames.length === 0) {
      return [];
    }

    const scriptValues = Object.values(scripts);
    const foundBin = binNames.some((bin) =>
      scriptValues.some(
        (script) => typeof script === 'string' && script.includes(bin),
      ),
    );
    if (foundBin) {
      return [
        `${path.join(projectRoot, FILE_PATTERNS.PACKAGE_JSON)} (scripts:bin)`,
      ];
    }

    const firstBinFile = await findBinInSourceFiles(
      binNames,
      sourceFiles,
      context,
    );
    if (firstBinFile !== undefined) {
      return [`${firstBinFile} (bin)`];
    }
  } catch {
    // node_modules not available or dep not installed, skip
  }
  return [];
}

async function checkVitestCoverageProvider(
  providerName: string,
  sourceFiles: string[],
): Promise<string[]> {
  const vitestConfigFiles = sourceFiles.filter((f) => {
    const base = path.basename(f);
    return base.startsWith('vitest.config') || base.startsWith('vite.config');
  });
  // eslint-disable-next-line security/detect-non-literal-regexp -- pattern from controlled provider name (package name slice)
  const providerRegex = new RegExp(
    `provider\\s*:\\s*['"\`]${providerName}['"\`]`,
    'u',
  );
  /* eslint-disable no-await-in-loop -- sequential scan of small config file set; early-exit on first match */
  for (const configFile of vitestConfigFiles) {
    const content =
      await OptimizedFileReader.getInstance().readFile(configFile);
    if (providerRegex.test(content)) {
      return [`${configFile} (vitest coverage provider)`];
    }
  }
  /* eslint-enable no-await-in-loop */
  return [];
}

async function checkJestEnvironmentProvider(
  dependency: string,
  context: DependencyContext,
  sourceFiles: string[],
): Promise<string[]> {
  const environmentName = dependency.slice('jest-environment-'.length);
  // eslint-disable-next-line security/detect-non-literal-regexp -- pattern from controlled env name (package name slice)
  const environmentRegex = new RegExp(
    `testEnvironment\\s*:\\s*['"\`]${environmentName}['"\`]`,
    'u',
  );

  const rawPkgConfig: unknown = context.configs?.[FILE_PATTERNS.PACKAGE_JSON];
  const jestConfig: unknown = isRecord(rawPkgConfig)
    ? rawPkgConfig.jest
    : undefined;
  const testEnvValue: unknown = isRecord(jestConfig)
    ? jestConfig.testEnvironment
    : undefined;
  const packageTestEnvironment =
    typeof testEnvValue === 'string' ? testEnvValue : '';

  if (packageTestEnvironment.toLowerCase() === environmentName.toLowerCase()) {
    return [
      `${path.join(context.projectRoot, FILE_PATTERNS.PACKAGE_JSON)} (jest testEnvironment)`,
    ];
  }

  const jestConfigFiles = sourceFiles.filter((f) => {
    const base = path.basename(f);
    return base.startsWith('jest.config') || base.startsWith('.jest');
  });

  for (const configFile of jestConfigFiles) {
    const content =
      // eslint-disable-next-line no-await-in-loop -- sequential scan; stops at first match
      await OptimizedFileReader.getInstance().readFile(configFile);
    if (environmentRegex.test(content)) {
      return [`${configFile} (jest testEnvironment)`];
    }
  }

  return [];
}

async function findInConfigFiles(
  shortName: string,
  configFiles: string[],
  parentTool: string,
): Promise<string | undefined> {
  for (const configFile of configFiles) {
    const content =
      // eslint-disable-next-line no-await-in-loop -- sequential scan; stops at first match
      await OptimizedFileReader.getInstance().readFile(configFile);
    if (content.toLowerCase().includes(shortName.toLowerCase())) {
      return `${configFile} (${parentTool} plugin)`;
    }
  }
  return undefined;
}

async function findEslintPluginInConfigs(
  pluginShortName: string,
  sourceFiles: string[],
): Promise<string | undefined> {
  const eslintConfigFiles = sourceFiles.filter((f) => {
    const base = path.basename(f);
    return (
      base.startsWith('eslint.config') ||
      base === '.eslintrc.js' ||
      base === '.eslintrc.cjs' ||
      base === '.eslintrc.json' ||
      base === '.eslintrc.yml'
    );
  });
  for (const configFile of eslintConfigFiles) {
    const content =
      // eslint-disable-next-line no-await-in-loop -- sequential scan; stops at first match
      await OptimizedFileReader.getInstance().readFile(configFile);
    if (
      content.includes(`plugin:${pluginShortName}/`) ||
      content.includes(`plugin:${pluginShortName}'`) ||
      content.includes(`plugin:${pluginShortName}"`)
    ) {
      return `${configFile} (eslint plugin:${pluginShortName})`;
    }
  }
  return undefined;
}

async function findEslintImportResolverInConfigs(
  resolverName: string,
  sourceFiles: string[],
): Promise<string | undefined> {
  const eslintConfigFiles = sourceFiles.filter((f) => {
    const base = path.basename(f);
    return (
      base.startsWith('eslint.config') ||
      base === '.eslintrc.js' ||
      base === '.eslintrc.cjs' ||
      base === '.eslintrc.json' ||
      base === '.eslintrc.yml'
    );
  });
  for (const configFile of eslintConfigFiles) {
    const content =
      // eslint-disable-next-line no-await-in-loop -- sequential scan; stops at first match
      await OptimizedFileReader.getInstance().readFile(configFile);
    if (
      content.includes(`'${resolverName}'`) ||
      content.includes(`"${resolverName}"`) ||
      content.includes(`${resolverName}:`)
    ) {
      return `${configFile} (eslint import resolver)`;
    }
  }
  return undefined;
}

async function checkSinglePluginConvention(
  conv: PluginConvention,
  dependency: string,
  topLevelDependencies: Set<string>,
  sourceFiles: string[],
  context: DependencyContext,
): Promise<string | undefined> {
  if (
    !dependency.startsWith(conv.prefix) ||
    !topLevelDependencies.has(conv.parent)
  ) {
    return undefined;
  }
  const { configPattern, parent, prefix } = conv;
  const shortName = dependency.slice(prefix.length);

  if (configPattern !== undefined) {
    const configFiles = sourceFiles.filter((f) =>
      configPattern.test(path.basename(f)),
    );
    const found = await findInConfigFiles(shortName, configFiles, parent);
    if (found !== undefined) {
      return found;
    }
  }

  if (context.scripts !== undefined) {
    const scriptValues = Object.values(context.scripts);
    const foundInScripts = scriptValues.some(
      (s) =>
        typeof s === 'string' &&
        s.toLowerCase().includes(shortName.toLowerCase()),
    );
    if (foundInScripts) {
      return `${path.join(context.projectRoot, FILE_PATTERNS.PACKAGE_JSON)} (${parent} plugin:scripts)`;
    }
  }

  const shortUsedFiles = await dependencyAnalyzer.processFilesInBatches(
    sourceFiles,
    shortName,
    context,
  );
  if (shortUsedFiles.length > 0) {
    return `${shortUsedFiles[0]} (${parent} plugin:source)`;
  }

  if (prefix === 'eslint-plugin-') {
    return findEslintPluginInConfigs(shortName, sourceFiles);
  }

  if (prefix === 'eslint-import-resolver-') {
    return findEslintImportResolverInConfigs(shortName, sourceFiles);
  }

  return undefined;
}

async function checkFrameworkPluginConventions(
  dependency: string,
  topLevelDependencies: Set<string>,
  sourceFiles: string[],
  context: DependencyContext,
): Promise<string[]> {
  for (const conv of PLUGIN_CONVENTIONS) {
    // eslint-disable-next-line no-await-in-loop -- sequential: early-exit on first match
    const result = await checkSinglePluginConvention(
      conv,
      dependency,
      topLevelDependencies,
      sourceFiles,
      context,
    );
    if (result !== undefined) {
      return [result];
    }
  }
  return [];
}

async function findPeerDependencyPath(
  dependency: string,
  otherDep: string,
  projectRoot: string,
): Promise<string | undefined> {
  try {
    const otherPackagePath = path.join(
      projectRoot,
      'node_modules',
      otherDep,
      FILE_PATTERNS.PACKAGE_JSON,
    );
    const otherPackageContent = await readFile(otherPackagePath, 'utf8');
    const rawOther: unknown = JSON.parse(otherPackageContent);
    if (!isRecord(rawOther)) {
      return undefined;
    }
    const manifest = rawOther as NpmPackageManifest;
    if (
      manifest.peerDependencies !== undefined &&
      dependency in manifest.peerDependencies
    ) {
      return `${otherPackagePath} (required peer)`;
    }
  } catch {
    // package.json not found or not parseable; skip
  }
  return undefined;
}

async function checkPeerDependencyRequirement(
  dependency: string,
  topLevelDependencies: Set<string>,
  projectRoot: string,
): Promise<string[]> {
  const otherDeps = [...topLevelDependencies].filter((d) => d !== dependency);
  for (const otherDep of otherDeps) {
    // eslint-disable-next-line no-await-in-loop -- sequential peer dep check; early exit on first match
    const peerDepPath = await findPeerDependencyPath(
      dependency,
      otherDep,
      projectRoot,
    );
    if (peerDepPath !== undefined) {
      return [peerDepPath];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Detection pipeline wrappers (reduce getDependencyInfo complexity)
// ---------------------------------------------------------------------------

function getConfigFieldsUsage(
  dependency: string,
  context: DependencyContext,
): string[] {
  const rawPkgConfig: unknown = context.configs?.[FILE_PATTERNS.PACKAGE_JSON];
  if (!isRecord(rawPkgConfig)) {
    return [];
  }
  return checkPackageJsonConfigFields(
    dependency,
    rawPkgConfig,
    context.projectRoot,
  );
}

function getScriptUsage(
  dependency: string,
  context: DependencyContext,
): string[] {
  if (context.scripts === undefined) {
    return [];
  }
  return checkScriptsForDependency(
    dependency,
    context.scripts,
    context.projectRoot,
  );
}

async function checkVitestUsage(
  dependency: string,
  sourceFiles: string[],
): Promise<string[]> {
  if (!dependency.startsWith('@vitest/coverage-')) {
    return [];
  }
  return checkVitestCoverageProvider(
    dependency.slice('@vitest/coverage-'.length),
    sourceFiles,
  );
}

async function checkJestUsage(
  dependency: string,
  context: DependencyContext,
  sourceFiles: string[],
): Promise<string[]> {
  if (!dependency.startsWith('jest-environment-')) {
    return [];
  }
  return checkJestEnvironmentProvider(dependency, context, sourceFiles);
}

async function detectDependencyUsage(
  dependency: string,
  context: DependencyContext,
  sourceFiles: string[],
  topLevelDependencies: Set<string>,
  progressOptions?: ProgressOptions,
): Promise<string[]> {
  const mainFiles = await dependencyAnalyzer.processFilesInBatches(
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
  if (mainFiles.length > 0) {
    return mainFiles;
  }

  const configFiles = getConfigFieldsUsage(dependency, context);
  if (configFiles.length > 0) {
    return configFiles;
  }

  const scriptFiles = getScriptUsage(dependency, context);
  if (scriptFiles.length > 0) {
    return scriptFiles;
  }

  const scripts = context.scripts ?? {};
  const binFiles = await checkBinaryCliUsage(
    dependency,
    scripts,
    context.projectRoot,
    sourceFiles,
    context,
  );
  if (binFiles.length > 0) {
    return binFiles;
  }

  const vitestFiles = await checkVitestUsage(dependency, sourceFiles);
  if (vitestFiles.length > 0) {
    return vitestFiles;
  }

  const jestFiles = await checkJestUsage(dependency, context, sourceFiles);
  if (jestFiles.length > 0) {
    return jestFiles;
  }

  const pluginFiles = await checkFrameworkPluginConventions(
    dependency,
    topLevelDependencies,
    sourceFiles,
    context,
  );
  if (pluginFiles.length > 0) {
    return pluginFiles;
  }

  return checkPeerDependencyRequirement(
    dependency,
    topLevelDependencies,
    context.projectRoot,
  );
}

async function checkSubdepsUsage(
  dependency: string,
  context: DependencyContext,
  sourceFiles: string[],
  info: DependencyInfo,
  totalSubdeps: number,
  progressOptions?: ProgressOptions,
): Promise<void> {
  const subdeps = context.dependencyGraph?.get(dependency) ?? new Set<string>();
  const subdepsArray = [...subdeps];
  if (subdepsArray.length === 0) {
    return;
  }
  for (const [index, subdep] of subdepsArray.entries()) {
    // eslint-disable-next-line no-await-in-loop -- sequential subdep check with early exit
    const subdepUsedFiles = await dependencyAnalyzer.processFilesInBatches(
      sourceFiles,
      subdep,
      context,
    );
    if (subdepUsedFiles.length > 0) {
      info.hasSubDependencyUsage = true;
      break;
    }
    progressOptions?.onProgress?.(sourceFiles[0], index + 1, totalSubdeps);
  }
}

// ---------------------------------------------------------------------------
// Main dependency analysis entry point
// ---------------------------------------------------------------------------

export async function getDependencyInfo(
  dependency: string,
  context: DependencyContext,
  sourceFiles: string[],
  topLevelDependencies: Set<string>,
  progressOptions?: ProgressOptions,
): Promise<DependencyInfo> {
  performanceMonitor.startTimer('getDependencyInfo');

  const memoryStats = memoryOptimizer.checkMemoryUsage();
  if (memoryStats.shouldGC) {
    depInfoCache.clear();
    fileReader.clearCache();
    dependencyAnalyzer.clearCaches();
  }

  const cacheKey = StringOptimizer.intern(
    `${context.projectRoot}:${dependency}`,
  );
  const cached = depInfoCache.get(cacheKey);
  if (cached !== undefined) {
    performanceMonitor.endTimer('getDependencyInfo');
    return cached;
  }

  const frameworkInfo = getFrameworkInfo(context);
  if (
    frameworkInfo !== null &&
    isFrameworkDevelopmentDependency(dependency, frameworkInfo)
  ) {
    const info = createEmptyDependencyInfo();
    info.requiredByPackages.add(frameworkInfo.corePackage);
    performanceMonitor.endTimer('getDependencyInfo');
    return info;
  }

  if (dependency.startsWith('@types/')) {
    // Intentionally not cached: @types detection result depends on tsconfig
    // and source-file state that can shift between calls in the same run.
    const typesInfo = await handleAtTypesDetection(
      dependency,
      context,
      sourceFiles,
      topLevelDependencies,
      progressOptions,
    );
    performanceMonitor.endTimer('getDependencyInfo');
    return typesInfo;
  }

  performanceMonitor.startTimer('fileProcessing');

  const subdeps = context.dependencyGraph?.get(dependency) ?? new Set<string>();
  const totalSubdeps = subdeps.size;

  const usedInFiles = await detectDependencyUsage(
    dependency,
    context,
    sourceFiles,
    topLevelDependencies,
    progressOptions,
  );
  const info: DependencyInfo = {
    hasSubDependencyUsage: false,
    requiredByPackages: new Set(),
    usedInFiles,
  };

  await checkSubdepsUsage(
    dependency,
    context,
    sourceFiles,
    info,
    totalSubdeps,
    progressOptions,
  );

  performanceMonitor.endTimer('fileProcessing');
  depInfoCache.set(cacheKey, info);
  performanceMonitor.endTimer('getDependencyInfo');
  return info;
}

// ---------------------------------------------------------------------------
// Workspace / monorepo helpers
// ---------------------------------------------------------------------------

async function getWorkspacesFromPackageJson(
  packageJsonPath: string,
): Promise<string[] | undefined> {
  try {
    const content = await readFile(packageJsonPath, 'utf8');
    const rawPkg: unknown = JSON.parse(content);
    if (!isRecord(rawPkg)) {
      return undefined;
    }
    const pkg = rawPkg as { workspaces?: string[] };
    return pkg.workspaces;
  } catch {
    return undefined;
  }
}

export async function getWorkspaceInfo(
  packageJsonPath: string,
): Promise<WorkspaceInfo | undefined> {
  try {
    const content = await readFile(packageJsonPath);
    const rawPkg: unknown = JSON.parse(content.toString('utf8'));
    if (!isRecord(rawPkg)) {
      return undefined;
    }
    const package_ = rawPkg as PackageJson;

    if (package_.workspaces === undefined) {
      return undefined;
    }

    const patterns = Array.isArray(package_.workspaces)
      ? package_.workspaces
      : package_.workspaces.packages;

    const packagePaths = await globby(patterns, {
      cwd: path.dirname(packageJsonPath),
      expandDirectories: false,
      ignore: ['node_modules'],
      onlyDirectories: true,
    });

    return {
      packages: packagePaths,
      root: packageJsonPath,
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
  if (packageJsonPath === undefined) {
    // eslint-disable-next-line no-console -- fatal CLI error; process.exit follows
    console.error(chalk.red(MESSAGES.noPackageJson));
    // eslint-disable-next-line unicorn/no-process-exit -- intentional CLI exit on missing package.json
    process.exit(1);
  }

  let currentDirectory = path.dirname(packageJsonPath);
  let parentDirectory = path.dirname(currentDirectory);

  while (parentDirectory !== currentDirectory) {
    const potentialRootPackageJson = path.join(
      parentDirectory,
      FILE_PATTERNS.PACKAGE_JSON,
    );
    // eslint-disable-next-line no-await-in-loop -- sequential directory traversal up the tree
    const workspaces = await getWorkspacesFromPackageJson(
      potentialRootPackageJson,
    );
    if (workspaces !== undefined) {
      // eslint-disable-next-line no-console -- informational CLI output for monorepo detection
      console.log(chalk.yellow(MESSAGES.monorepoDetected));
      return potentialRootPackageJson;
    }

    // eslint-disable-next-line no-await-in-loop -- sequential directory traversal up the tree
    const workspaceInfo = await getWorkspaceInfo(potentialRootPackageJson);
    if (workspaceInfo !== undefined) {
      const relativePath = path.relative(
        path.dirname(workspaceInfo.root),
        packageJsonPath,
      );
      const isWorkspacePackage = workspaceInfo.packages.some(
        (p: string) => relativePath.startsWith(p) || p.startsWith(relativePath),
      );

      if (isWorkspacePackage) {
        // eslint-disable-next-line no-console -- informational CLI output for monorepo detection
        console.log(chalk.yellow('\nMonorepo workspace package detected.'));
        // eslint-disable-next-line no-console -- informational CLI output for monorepo detection
        console.log(chalk.yellow(`Root: ${workspaceInfo.root}`));
        return packageJsonPath;
      }
    }
    currentDirectory = parentDirectory;
    parentDirectory = path.dirname(currentDirectory);
  }

  return packageJsonPath;
}

// ---------------------------------------------------------------------------
// package.json validation helpers
// ---------------------------------------------------------------------------

function warnInvalidDepNames(
  field: string,
  fieldValue: Record<string, unknown>,
): void {
  for (const depName of Object.keys(fieldValue)) {
    if (
      typeof depName !== 'string' ||
      !FILE_PATTERNS.PACKAGE_NAME_REGEX.test(depName)
    ) {
      // eslint-disable-next-line no-console -- real warning surfacing invalid package.json content
      console.warn(
        chalk.yellow(
          `Skipping invalid dependency name in ${field}: ${depName}`,
        ),
      );
    }
  }
}

function validateDependencyFields(
  packageObject: Record<string, unknown>,
): string | undefined {
  for (const field of DEPENDENCY_FIELDS) {
    // eslint-disable-next-line security/detect-object-injection -- field is from DEPENDENCY_FIELDS, a compile-time const string literal array
    const fieldValue = packageObject[field];
    if (fieldValue === undefined) {
      continue; // eslint-disable-line no-continue -- skip absent fields
    }
    if (!isRecord(fieldValue)) {
      return `${field} must be an object`;
    }
    warnInvalidDepNames(field, fieldValue);
  }
  return undefined;
}

function validatePackageJson(packageJson: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!isRecord(packageJson)) {
    return { error: 'package.json must be an object', valid: false };
  }
  const fieldError = validateDependencyFields(packageJson);
  if (fieldError !== undefined) {
    return { error: fieldError, valid: false };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// getDependencies
// ---------------------------------------------------------------------------

export async function getDependencies(
  packageJsonPath: string,
): Promise<string[]> {
  try {
    const packageJsonString = await readFile(packageJsonPath, 'utf8');
    if (packageJsonString.trim() === '') {
      return [];
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(packageJsonString);
    } catch {
      // eslint-disable-next-line no-console -- real error surfacing malformed package.json to user
      console.error(
        chalk.red(`Invalid JSON in package.json: ${packageJsonPath}`),
      );
      return [];
    }

    const validation = validatePackageJson(parsedJson);
    if (!validation.valid) {
      // eslint-disable-next-line no-console -- real error surfacing invalid package.json to user
      console.error(chalk.red(`Invalid package.json: ${validation.error}`));
      return [];
    }

    // parsedJson has been validated as an object with correct dep field shapes
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated above by validatePackageJson; assigning from unknown to a compatible interface
    const packageJson = parsedJson as PackageJson;

    const isValidDep = (dep: string, field: Record<string, string>): boolean =>
      FILE_PATTERNS.PACKAGE_NAME_REGEX.test(dep) &&
      // eslint-disable-next-line security/detect-object-injection -- dep is a key from Object.keys(field)
      !(typeof field[dep] === 'string' && field[dep].startsWith('npm:'));

    const {
      dependencies: depsMap,
      devDependencies: developmentDepsMap,
      peerDependencies: peerDepsMap,
    } = packageJson;

    const dependencies =
      depsMap === undefined
        ? []
        : Object.keys(depsMap).filter((dep) => isValidDep(dep, depsMap));
    const devDependencies =
      developmentDepsMap === undefined
        ? []
        : Object.keys(developmentDepsMap).filter((dep) =>
            isValidDep(dep, developmentDepsMap),
          );
    const peerDependencies =
      peerDepsMap === undefined
        ? []
        : Object.keys(peerDepsMap).filter((dep) =>
            isValidDep(dep, peerDepsMap),
          );

    const allDependencies = [
      ...dependencies,
      ...devDependencies,
      ...peerDependencies,
    ];
    const uniqueDependencies = [...new Set(allDependencies)];
    uniqueDependencies.sort(customSort);
    return uniqueDependencies;
  } catch {
    // eslint-disable-next-line no-console -- real error surfacing package.json read failure
    console.error(chalk.red(`Error reading package.json: ${packageJsonPath}`));
    return [];
  }
}

// ---------------------------------------------------------------------------
// getSourceFiles (placed before getPackageContext to satisfy no-use-before-define)
// ---------------------------------------------------------------------------

export async function getSourceFiles(
  projectDirectory: string,
  ignorePatterns: string[] = [],
): Promise<string[]> {
  const files = await globby(['**/*'], {
    absolute: true,
    cwd: projectDirectory,
    dot: true,
    followSymbolicLinks: false,
    gitignore: true,
    ignore: [
      FILE_PATTERNS.NODE_MODULES,
      '**/node_modules/**',
      'dist',
      'coverage',
      'build',
      '.git',
      '*.log',
      '*.lock',
      FILE_PATTERNS.PACKAGE_JSON,
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      ...ignorePatterns,
    ],
  });

  if (!Array.isArray(files)) {
    return [];
  }

  return files.filter((file) => !isBinaryFileSync(file));
}

// ---------------------------------------------------------------------------
// getPackageContext
// ---------------------------------------------------------------------------

export async function getPackageContext(
  packageJsonPath: string,
): Promise<DependencyContext> {
  const projectDirectory = path.dirname(packageJsonPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- config files have arbitrary shapes
  const configs: Record<string, any> = {};
  const dependencyGraph = new Map<string, Set<string>>();

  const dependencies = await getDependencies(packageJsonPath);
  for (const dep of dependencies) {
    dependencyGraph.set(dep, new Set<string>());
  }

  const allFiles = await getSourceFiles(projectDirectory);

  for (const file of allFiles) {
    if (isConfigFile(file)) {
      const relativePath = path.relative(projectDirectory, file);
      try {
        // eslint-disable-next-line security/detect-object-injection, no-await-in-loop -- relativePath is a path.relative result from the user's own project tree; sequential parse into shared configs map
        configs[relativePath] = await parseConfigFile(file);
      } catch {
        // Ignore parse errors
      }
    }
  }

  const rawPackageJsonString = await readFile(packageJsonPath, 'utf8');
  const packageJsonString =
    rawPackageJsonString === '' ? '{}' : rawPackageJsonString;
  const rawParsed: unknown = JSON.parse(packageJsonString);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns any cast via unknown; structure already validated by getDependencies above
  const packageJson = rawParsed as PackageJson & {
    eslintConfig?: { extends?: string[] | string };
    prettier?: unknown;
    stylelint?: { extends?: string[] | string };
  };

  return {
    configs: {
      [FILE_PATTERNS.PACKAGE_JSON]: packageJson,
      ...configs,
    },
    dependencyGraph,
    projectRoot: path.dirname(packageJsonPath),
    scripts: packageJson.scripts,
  };
}

// ---------------------------------------------------------------------------
// Parallel file processing
// ---------------------------------------------------------------------------

export async function processFilesInParallel(
  files: string[],
  dependency: string,
  context: DependencyContext,
  onProgress?: (processed: number, total: number) => void,
): Promise<string[]> {
  performanceMonitor.startTimer('processFilesInParallel');

  const results: string[] = [];
  const totalErrors = 0;

  const usedFiles = await dependencyAnalyzer.processFilesInBatches(
    files,
    dependency,
    context,
    onProgress,
  );

  for (const file of usedFiles) {
    if (file.length > 0) {
      results.push(file);
    }
  }

  performanceMonitor.endTimer('processFilesInParallel');

  if (totalErrors > 0) {
    // eslint-disable-next-line no-console -- real warning surfacing file processing failures to user
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
  const subdeps = context.dependencyGraph?.get(dependency);
  return subdeps === undefined ? [] : [...subdeps];
}
