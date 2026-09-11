/* eslint-disable max-lines -- comprehensive AST-based dependency detection requires all helpers in one module */
import { execSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import type {
  CallExpression,
  ImportDeclaration,
  TSExternalModuleReference,
  TSImportType,
} from '@babel/types';
import chalk from 'chalk';
import { isBinaryFileSync } from 'isbinaryfile';
// eslint-disable-next-line import-x/no-extraneous-dependencies -- @types/micromatch is available
import micromatch from 'micromatch';
import fetch, { type Response } from 'node-fetch';
import shellEscape from 'shell-escape';

import {
  DEPENDENCY_PATTERNS,
  FILE_PATTERNS,
  PACKAGE_MANAGERS,
  RAW_CONTENT_PATTERNS,
} from './constants.js';
import type { DependencyContext } from './interfaces.js';

// eslint-disable max-lines, eqeqeq -- This file contains interdependent functions for dependency detection and analysis; refactoring should extract patterns to dedicated files. eqeqeq used for null checks throughout

// Custom sort function for scoped dependencies (defined here to avoid circular imports)
export function customSort(a: string, b: string): number {
  const aNormalized = a.replace(/^@/u, '');
  const bNormalized = b.replace(/^@/u, '');
  return aNormalized.localeCompare(bNormalized, 'en', { sensitivity: 'base' });
}

export function isConfigFile(filePath: string): boolean {
  // Guard: null/undefined/empty-string all mean "no path to check"
  if (filePath === undefined || filePath === null || filePath === '') {
    return false;
  }
  const filename = path.basename(filePath).toLowerCase();
  return (
    filename.includes('config') ||
    filename.startsWith('.') ||
    filename === FILE_PATTERNS.PACKAGE_JSON ||
    FILE_PATTERNS.CONFIG_REGEX.test(filename)
  );
}

// Type definitions and patterns for dependency matching
interface DependencyPattern {
  type: 'combined' | 'exact' | 'prefix' | 'regex' | 'suffix';
  match: RegExp | string;
  variations?: string[];
}

const COMMON_PATTERNS: DependencyPattern[] = [
  // Direct matches
  { match: '', type: 'exact' }, // Base name
  { match: '@', type: 'prefix' }, // Scoped packages

  // Common package organization patterns
  { match: '@types/', type: 'prefix' },
  { match: '@storybook/', type: 'prefix' },
  { match: '@testing-library/', type: 'prefix' },

  // Config patterns
  {
    match: 'config',
    type: 'suffix',
    variations: ['rc', 'settings', 'configuration', 'setup', 'options'],
  },

  // Plugin patterns
  {
    match: 'plugin',
    type: 'suffix',
    variations: ['plugins', 'extension', 'extensions', 'addon', 'addons'],
  },

  // Preset patterns
  {
    match: 'preset',
    type: 'suffix',
    variations: ['presets', 'recommended', 'standard', 'defaults'],
  },

  // Tool patterns
  {
    match: '',
    type: 'combined',
    variations: ['cli', 'core', 'utils', 'tools', 'helper', 'helpers'],
  },

  // Framework integration patterns
  {
    match: /[/-](react|vue|svelte|angular|node)$/iu,
    type: 'regex',
  },

  // Common package naming patterns
  {
    match: /[/-](loader|parser|transformer|formatter|linter|compiler)s?$/iu,
    type: 'regex',
  },
];

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- switch statement over pattern types is explicit and necessary
export function generatePatternMatcher(dependency: string): RegExp[] {
  const patterns: RegExp[] = [];
  const escapedDep = dependency.replaceAll(
    /[$()*+.?[\\\]^{|}]/gu,
    String.raw`\$&`,
  );

  /* eslint-disable security/detect-non-literal-regexp -- escapedDep comes from our own controlled package name analysis */
  for (const pattern of COMMON_PATTERNS) {
    switch (pattern.type) {
      case 'exact': {
        patterns.push(new RegExp(`^${escapedDep}$`, 'u'));
        break;
      }
      case 'prefix': {
        patterns.push(new RegExp(`^${pattern.match}${escapedDep}(/.*)?$`, 'u'));
        break;
      }
      case 'suffix': {
        const suffixes = [pattern.match, ...(pattern.variations ?? [])];
        for (const suffix of suffixes) {
          patterns.push(
            new RegExp(`^${escapedDep}[-./]${suffix}$`, 'u'),
            new RegExp(`^${escapedDep}[-./]${suffix}s$`, 'u'),
          );
        }
        break;
      }
      case 'combined': {
        const parts = [pattern.match, ...(pattern.variations ?? [])];
        for (const part of parts) {
          patterns.push(
            new RegExp(`^${escapedDep}[-./]${part}$`, 'u'),
            new RegExp(`^${part}[-./]${escapedDep}$`, 'u'),
          );
        }
        break;
      }
      case 'regex': {
        if (pattern.match instanceof RegExp) {
          patterns.push(
            new RegExp(
              `^${escapedDep}${pattern.match.source}`,
              pattern.match.flags.includes('u')
                ? pattern.match.flags
                : `${pattern.match.flags}u`,
            ),
          );
        }
        break;
      }
      default: {
        break;
      }
    }
  }
  /* eslint-enable security/detect-non-literal-regexp */

  return patterns;
}

export async function parseConfigFile(filePath: string): Promise<unknown> {
  const extension = path.extname(filePath).toLowerCase();
  const content = await readFile(filePath, 'utf8');

  try {
    switch (extension) {
      case '.json': {
        return JSON.parse(content);
      }
      case '.yaml':
      case '.yml': {
        const yaml = await import('yaml').catch(() => null);
        return yaml === null ? content : yaml.parse(content);
      }
      case '.js':
      case '.cjs':
      case '.mjs': {
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

// CJS/ESM interop: @babel/traverse may expose its default export as .default.
// The no-unsafe-* family is disabled here because traverse's types don't advertise
// .default and the cast-to-any is the only portable way to detect the ESM wrapper.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-type-assertion */
const traverseFunction = ((traverse as any).default || traverse) as (
  ast: unknown,
  options: unknown,
) => void;
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-type-assertion */

export function matchesDependency(
  importSource: string,
  dependency: string,
): boolean {
  const depWithoutScope = dependency.startsWith('@')
    ? dependency.split('/')[1]
    : dependency;
  const sourceWithoutScope = importSource.startsWith('@')
    ? importSource.split('/')[1]
    : importSource;

  return (
    importSource === dependency ||
    importSource.startsWith(`${dependency}/`) ||
    sourceWithoutScope === depWithoutScope ||
    sourceWithoutScope.startsWith(`${depWithoutScope}/`) ||
    (dependency.startsWith('@types/') &&
      (importSource === dependency.replace(/^@types\//u, '') ||
        importSource.startsWith(`${dependency.replace(/^@types\//u, '')}/`)))
  );
}

export function scanForDependency(
  object: unknown,
  dependency: string,
): boolean {
  if (typeof object === 'string') {
    const matchers = generatePatternMatcher(dependency);
    return matchers.some((pattern) => pattern.test(object));
  }

  if (Array.isArray(object)) {
    return object.some((item) => scanForDependency(item, dependency));
  }

  if (object !== null && typeof object === 'object') {
    return Object.values(object).some((value) =>
      scanForDependency(value, dependency),
    );
  }

  return false;
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity, max-lines-per-function -- multiple detection strategies required; decomposition would break the 9-layer pipeline flow
export async function isDependencyUsedInFile(
  dependency: string,
  filePath: string,
  context: DependencyContext,
): Promise<boolean> {
  // Don't consider dependencies as "used" just because they're in package.json
  // Only check actual source code files for dependency usage
  if (path.basename(filePath) === FILE_PATTERNS.PACKAGE_JSON) {
    return false;
  }

  const configKey = path.relative(path.dirname(filePath), filePath);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, security/detect-object-injection -- configKey is path.relative output from our own controlled filePath; not user input
  const config = context.configs?.[configKey];
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- config may be falsy or falsey
  if (config) {
    if (typeof config === 'string') {
      if (config.includes(dependency)) {
        return true;
      }
    } else if (scanForDependency(config, dependency)) {
      return true;
    }
  }

  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- scripts may be null or undefined
  if (context.scripts) {
    for (const script of Object.values(context.scripts)) {
      const scriptParts = script.split(' ');
      if (scriptParts.includes(dependency)) {
        return true;
      }
    }
  }

  try {
    if (isBinaryFileSync(filePath)) {
      return false;
    }

    const content = await readFile(filePath, 'utf8');

    // eslint-disable-next-line security/detect-non-literal-regexp -- dependency is from our own package analysis, safe
    const dynamicImportRegex = new RegExp(
      `${DEPENDENCY_PATTERNS.DYNAMIC_IMPORT_BASE}${dependency.replaceAll(
        /[/@-]/gu,
        '[/@-]',
      )}${DEPENDENCY_PATTERNS.DYNAMIC_IMPORT_END}`,
      'iu',
    );
    if (dynamicImportRegex.test(content)) {
      return true;
    }

    try {
      const ast = parse(content, {
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'dynamicImport',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'importMeta',
        ],
        sourceType: 'unambiguous',
      });

      let isUsed = false;
      traverseFunction(ast, {
        CallExpression(importPath: NodePath<CallExpression>) {
          if (
            importPath.node.callee.type === 'Identifier' &&
            importPath.node.callee.name === 'require' &&
            importPath.node.arguments[0]?.type === 'StringLiteral' &&
            matchesDependency(importPath.node.arguments[0].value, dependency)
          ) {
            isUsed = true;
            importPath.stop();
          }
        },
        ImportDeclaration(importPath: NodePath<ImportDeclaration>) {
          const importSource = importPath.node.source.value;
          if (matchesDependency(importSource, dependency)) {
            isUsed = true;
            importPath.stop();
          }
        },
        TSExternalModuleReference(
          importPath: NodePath<TSExternalModuleReference>,
        ) {
          const importSource = importPath.node.expression.value;
          if (matchesDependency(importSource, dependency)) {
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
      });

      if (isUsed) {
        return true;
      }

      /* eslint-disable max-depth -- RAW_CONTENT_PATTERNS detection is a deliberate nested-scan pipeline */
      for (const [base, patterns] of RAW_CONTENT_PATTERNS.entries()) {
        if (
          dependency.startsWith(base) &&
          patterns.some((pattern: string) =>
            micromatch.isMatch(dependency, pattern),
          )
        ) {
          // eslint-disable-next-line security/detect-non-literal-regexp -- dependency is from our own package analysis, safe
          const searchPattern = new RegExp(
            String.raw`\b${dependency.replaceAll(/[/@-]/gu, '[/@-]')}\b`,
            'iu',
          );
          if (searchPattern.test(content)) {
            return true;
          }
        }
      }
      /* eslint-enable max-depth */
    } catch {
      // Ignore parse errors
    }

    /* eslint-disable max-depth -- RAW_CONTENT_PATTERNS detection nested scan */
    for (const [base, patterns] of RAW_CONTENT_PATTERNS.entries()) {
      if (
        dependency.startsWith(base) &&
        patterns.some((pattern: string) =>
          micromatch.isMatch(dependency, pattern),
        )
      ) {
        // eslint-disable-next-line security/detect-non-literal-regexp -- dependency is from our own package analysis, safe
        const searchPattern = new RegExp(
          String.raw`\b${dependency.replaceAll(/[/@-]/gu, '[/@-]')}\b`,
          'iu',
        );
        if (searchPattern.test(content)) {
          return true;
        }
      }
    }
    /* eslint-enable max-depth */
  } catch {
    // Ignore file read errors
  }

  return false;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- multi-path type package detection; decomposition would fragment the intentional fallback chain
export async function isTypePackageUsed(
  dependency: string,
  installedPackages: string[],
  _unusedDependencies: string[],
  context: DependencyContext,
  sourceFiles: string[],
): Promise<{ isUsed: boolean; supportedPackage?: string }> {
  if (!dependency.startsWith(DEPENDENCY_PATTERNS.TYPES_PREFIX)) {
    return { isUsed: false };
  }

  const correspondingPackage = dependency
    .replace(/^@types\//u, '')
    .replaceAll('__', '/');

  const normalizedPackage = correspondingPackage.includes('/')
    ? `@${correspondingPackage}`
    : correspondingPackage;

  const supportedPackage = installedPackages.find(
    (package_) => package_ === normalizedPackage,
  );

  if (supportedPackage !== undefined) {
    for (const file of sourceFiles) {
      // eslint-disable-next-line no-await-in-loop -- sequential scan required: stop at first positive match; parallel would prevent early exit
      if (await isDependencyUsedInFile(supportedPackage, file, context)) {
        return { isUsed: true, supportedPackage };
      }
    }
  }

  for (const package_ of installedPackages) {
    try {
      // eslint-disable-next-line unicorn/prefer-module -- require.resolve is the only API available for package resolution
      const packageJsonPath = require.resolve(`${package_}/package.json`, {
        paths: [process.cwd()],
      });
      // eslint-disable-next-line no-await-in-loop -- sequential peer-dep file reads; parallel would require all results before any early-exit can fire
      const packageJsonBuffer = await readFile(packageJsonPath);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse from local node_modules package.json, narrow to expected shape
      const packageJson = JSON.parse(packageJsonBuffer.toString('utf8')) as {
        peerDependencies?: Record<string, string>;
      };
      // eslint-disable-next-line security/detect-object-injection -- key is a validated npm package name from our own dependency list
      if (packageJson.peerDependencies?.[dependency] !== undefined) {
        return { isUsed: true, supportedPackage: package_ };
      }
    } catch {
      // Ignore errors
    }
  }

  return { isUsed: false };
}

export function formatSize(bytes: number): string {
  if (bytes >= 1e12) {
    return `${(bytes / 1e12).toFixed(2)} ${chalk.blue('TB')}`;
  } else if (bytes >= 1e9) {
    return `${(bytes / 1e9).toFixed(2)} ${chalk.blue('GB')}`;
  } else if (bytes >= 1e6) {
    return `${(bytes / 1e6).toFixed(2)} ${chalk.blue('MB')}`;
  } else if (bytes >= 1e3) {
    return `${(bytes / 1e3).toFixed(2)} ${chalk.blue('KB')}`;
  }
  return `${bytes} ${chalk.blue('Bytes')}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function safeExecSync(
  command: string[],
  options: { cwd: string; stdio?: 'ignore' | 'inherit'; timeout?: number },
): void {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error('Invalid command array');
  }

  const [packageManager, ...arguments_] = command;

  if (!Object.values(PACKAGE_MANAGERS).includes(packageManager)) {
    throw new Error(`Invalid package manager: ${packageManager}`);
  }

  // Validate all arguments
  if (
    !arguments_.every(
      (argument) => typeof argument === 'string' && argument.length > 0,
    )
  ) {
    throw new Error('Invalid command arguments');
  }

  try {
    execSync(shellEscape(command), {
      cwd: options.cwd,
      encoding: 'utf8',
      stdio: options.stdio ?? 'inherit',
      timeout: options.timeout ?? 300_000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Command execution failed: ${message}`, { cause: error });
  }
}

export async function detectPackageManager(
  projectDirectory: string,
): Promise<string> {
  if (
    await access(path.join(projectDirectory, FILE_PATTERNS.YARN_LOCK))
      .then(() => true)
      .catch(() => false)
  ) {
    return PACKAGE_MANAGERS.YARN;
  } else if (
    await access(path.join(projectDirectory, FILE_PATTERNS.PNPM_LOCK))
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
  processing: false,
  queue: [] as (() => void)[],
};

async function rateLimitedFetch(
  url: string,
  timeout = 10_000,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const now = Date.now();
    const timeSinceLastCall = now - npmApiRateLimiter.lastCallTime;
    const waitTime = Math.max(
      0,
      npmApiRateLimiter.minInterval - timeSinceLastCall,
    );

    const executeFetch = async (): Promise<void> => {
      npmApiRateLimiter.lastCallTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'depsweep/1.0.0',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        resolve(response);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    if (waitTime === 0 && !npmApiRateLimiter.processing) {
      npmApiRateLimiter.processing = true;
      // eslint-disable-next-line no-void, promise/prefer-await-to-then -- fire-and-forget rate-limiter; cannot use await here (non-async callback context)
      void executeFetch().finally(() => {
        npmApiRateLimiter.processing = false;
        if (npmApiRateLimiter.queue.length > 0) {
          const next = npmApiRateLimiter.queue.shift();

          if (next !== undefined && next !== null) {
            next();
          }
        }
      });
    } else {
      npmApiRateLimiter.queue.push(() => {
        npmApiRateLimiter.processing = true;
        // eslint-disable-next-line no-void, promise/prefer-await-to-then -- fire-and-forget rate-limiter queue callback; non-async context
        void executeFetch().finally(() => {
          npmApiRateLimiter.processing = false;
          if (npmApiRateLimiter.queue.length > 0) {
            const next = npmApiRateLimiter.queue.shift();

            if (next !== undefined && next !== null) {
              next();
            }
          }
        });
      });
      setTimeout(() => {
        if (
          npmApiRateLimiter.queue.length > 0 &&
          !npmApiRateLimiter.processing
        ) {
          const next = npmApiRateLimiter.queue.shift();

          if (next !== undefined && next !== null) {
            next();
          }
        }
      }, waitTime);
    }
  });
}

// eslint-disable-next-line complexity -- retry/validation/rate-limit paths required for robust npm API access
export async function getDownloadStatsFromNpm(
  packageName: string,
): Promise<number | null> {
  // Validate package name to prevent injection

  if (
    packageName === null ||
    packageName === undefined ||
    packageName === '' ||
    typeof packageName !== 'string' ||
    !/^[\w./@-]+$/u.test(packageName)
  ) {
    return null;
  }

  try {
    const encodedPackageName = encodeURIComponent(packageName);
    const response = await rateLimitedFetch(
      `https://api.npmjs.org/downloads/point/last-month/${encodedPackageName}`,
      10_000, // 10 second timeout
    );

    if (!response.ok) {
      // Handle rate limiting (429) and other errors gracefully
      if (response.status === 429) {
        // Rate limited - wait longer before retry
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 2000);
        });
        return null;
      }
      return null;
    }

    const data = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse result needs narrowing to expected shape
    const downloadData = data as { downloads: number };

    // Validate response data
    if (
      typeof downloadData.downloads === 'number' &&
      downloadData.downloads >= 0
    ) {
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

// eslint-disable-next-line complexity -- package.json validation + npm API fallback paths inherently branchy
export async function getParentPackageDownloads(
  packageJsonPath: string,
  verbose = false,
): Promise<{
  name: string;
  downloads: number;
  repository?: { url: string };
  homepage?: string;
} | null> {
  try {
    const packageJsonString = (await readFile(packageJsonPath, 'utf8')) ?? '{}';

    // Validate JSON structure

    let packageJson: unknown;
    try {
      packageJson = JSON.parse(packageJsonString);
    } catch {
      if (verbose) {
        // eslint-disable-next-line no-console -- verbose user feedback path
        console.error(chalk.red('Invalid package.json format'));
      }
      return null;
    }

    // Validate package.json structure

    if (
      packageJson === null ||
      packageJson === undefined ||
      typeof packageJson !== 'object'
    ) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowed by type checks above
    const { homepage, name, repository } = packageJson as Record<
      string,
      unknown
    >;

    // Validate name field

    if (
      name === null ||
      name === undefined ||
      name === '' ||
      typeof name !== 'string' ||
      !/^[\w./@-]+$/u.test(name)
    ) {
      return null;
    }

    const downloads = await getDownloadStatsFromNpm(name);

    // downloads is null on error, 0+ is a valid value
    if (downloads === null || downloads === undefined) {
      if (verbose) {
        // eslint-disable-next-line no-console -- verbose user feedback path
        console.log(
          chalk.yellow(`\nUnable to find download stats for '${name}'`),
        );
      }
      return null;
    }

    return {
      downloads: downloads ?? 0,
      homepage: typeof homepage === 'string' ? homepage : undefined,
      name,

      repository:
        typeof repository === 'object' &&
        repository !== null &&
        'url' in repository &&
        typeof (repository as Record<string, unknown>).url === 'string'
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowed above
            (repository as { url: string })
          : undefined,
    };
  } catch {
    // Silently handle errors - don't expose internal details
    return null;
  }
}
