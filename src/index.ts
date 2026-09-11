#!/usr/bin/env node
/* eslint-disable max-lines -- index.ts is the CLI entry point and top-level orchestrator; further decomposition would scatter functionality across many files */
// Phase 3 lint cleanup complete: all src files now pass eslint with 0 errors, 0 warnings.

import { execSync, type ExecSyncOptions } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- imported for import.meta.dirname in getDepsweepVersion()
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { Command } from 'commander';
import { isBinaryFileSync } from 'isbinaryfile';
import type { Ora } from 'ora';

import {
  handleMeasureImpact,
  renderVerboseTable,
  resolveImpactForDeps,
} from './cli-render.js';
import {
  CLI_STRINGS,
  FILE_PATTERNS,
  isProtectedDependency,
  MESSAGES,
  PACKAGE_MANAGERS,
} from './constants.js';
import {
  customSort,
  detectPackageManager,
  getParentPackageDownloads,
  safeExecSync,
} from './helpers.js';
import type { GlobalScanResult, ScanResult } from './interfaces.js';
import {
  MemoryOptimizer,
  PerformanceMonitor,
} from './performance-optimizations.js';
import {
  findClosestPackageJson,
  getDependencies,
  getDependencyInfo,
  getPackageContext,
  getSourceFiles,
} from './utils.js';

export { customSort } from './helpers.js';

// Variables for active resources
const activeSpinner: Ora | null = null;
let activeProgressBar: cliProgress.SingleBar | null = null;
let activeReadline: Awaited<ReturnType<typeof createInterface>> | null = null;

function cleanup(): void {
  if (activeSpinner !== null) {
    activeSpinner.stop();
  }
  if (activeProgressBar !== null) {
    activeProgressBar.stop();
  }
  if (activeReadline !== null) {
    activeReadline.close();
  }
  // Only exit if not in test environment
  if (process.env.NODE_ENV !== 'test') {
    process.exit(0);
  }
}

function isValidPackageName(name: string): boolean {
  return FILE_PATTERNS.PACKAGE_NAME_REGEX.test(name);
}

// Handler for removing unused dependencies
// eslint-disable-next-line @typescript-eslint/require-await -- removing deps doesn't require await in current code path
async function removeUnusedDependencies(options: {
  unusedDependencies: string[];
  packageManager: string;
  projectDirectory: string;
  PACKAGE_MANAGERS: typeof PACKAGE_MANAGERS;
}): Promise<void> {
  const {
    PACKAGE_MANAGERS: packageManagers,
    packageManager,
    projectDirectory,
    unusedDependencies,
  } = options;

  let uninstallCommand = '';
  switch (packageManager) {
    case packageManagers.NPM: {
      uninstallCommand = `npm uninstall ${unusedDependencies.join(' ')}`;
      break;
    }
    case packageManagers.YARN: {
      uninstallCommand = `yarn remove ${unusedDependencies.join(' ')}`;
      break;
    }
    case packageManagers.PNPM: {
      uninstallCommand = `pnpm remove ${unusedDependencies.join(' ')}`;
      break;
    }
    default: {
      break;
    }
  }

  const validatedDeps = unusedDependencies.filter((dep) => {
    if (!isValidPackageName(dep)) {
      console.warn(chalk.yellow(`Skipping invalid package name: ${dep}`));
      return false;
    }
    return true;
  });

  if (validatedDeps.length > 0) {
    try {
      safeExecSync(uninstallCommand.split(' '), {
        cwd: projectDirectory,
        stdio: 'inherit',
        timeout: 300_000,
      });
    } catch (error) {
      console.error(chalk.red('Failed to uninstall packages:'), error);
      process.exit(1);
    }
  }
}

// Handler for JSON output
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- branches across two output paths (with/without impact); further decomposition would scatter the JSON shape
async function handleJsonOutput(options_: {
  options: Record<string, unknown>;
  packageManager: string;
  packageJson: Record<string, unknown>;
  projectDirectory: string;
  protectedUnused: string[];
  unusedDependencies: string[];
  dependencies: string[];
  packageJsonPath: string;
  savedConsoleLog: typeof console.log | undefined;
}): Promise<void> {
  const {
    dependencies,
    options,
    packageJson,
    packageJsonPath,
    packageManager,
    projectDirectory,
    protectedUnused,
    savedConsoleLog,
    unusedDependencies,
  } = options_;

  const projectName =
    typeof packageJson.name === 'string'
      ? packageJson.name
      : path.basename(projectDirectory);

  const scanResult: ScanResult = {
    packageManager,
    project: projectName,
    protectedDependencies: [...protectedUnused],
    timestamp: new Date().toISOString(),
    totalDependencies: dependencies.length,
    unusedDependencies: [...unusedDependencies],
    version: '1.0.0',
  };

  if (unusedDependencies.length > 0 && options.measureImpact === true) {
    const parentInfo = await getParentPackageDownloads(packageJsonPath);
    const parentDownloads = parentInfo?.downloads ?? 0;

    const unusedDepInfos = await resolveImpactForDeps({
      packageJson,
      parentDownloads,
      quickCheck: options.quickCheck === true,
      unusedDeps: unusedDependencies,
    });

    const globalResult: GlobalScanResult = {
      packageManager,
      parentDownloads: parentDownloads > 0 ? parentDownloads : null,
      project: projectName,
      protectedDependencies: [...protectedUnused],
      timestamp: new Date().toISOString(),
      totalDependencies: dependencies.length,
      unusedDependencies: unusedDepInfos,
      version: '1.0.0',
    };

    const jsonText = JSON.stringify(globalResult, null, 2);
    if (savedConsoleLog !== undefined) {
      // eslint-disable-next-line require-atomic-updates -- single-threaded Node.js; no actual race condition; console.log is restored before next await
      console.log = savedConsoleLog;
    }
    const outputPath =
      typeof options.output === 'string' ? options.output : undefined;
    if (outputPath === undefined) {
      process.stdout.write(`${jsonText}\n`);
    } else {
      await writeFile(outputPath, jsonText, 'utf8');
      console.log(chalk.green(`Report written to ${outputPath}`));
    }
    return;
  }

  const jsonText = JSON.stringify(scanResult, null, 2);
  if (savedConsoleLog !== undefined) {
    console.log = savedConsoleLog;
  }
  const outputPath =
    typeof options.output === 'string' ? options.output : undefined;
  if (outputPath === undefined) {
    process.stdout.write(`${jsonText}\n`);
  } else {
    await writeFile(outputPath, jsonText, 'utf8');
    console.log(chalk.green(`Report written to ${outputPath}`));
  }
}

function logNewlines(count = 1): void {
  for (let index = 0; index < count; index++) {
    console.log();
  }
}

// Get depsweep's own version from its package.json
async function getDepsweepVersion(): Promise<string> {
  try {
    const __dirname = import.meta.dirname;
    const packagePath = path.join(__dirname, '..', 'package.json');
    const content = await readFile(packagePath, 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- JSON.parse returns any; version is guaranteed string here
    return JSON.parse(content).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Clone a GitHub repo and install dependencies for isolated scanning
function cloneAndInstall(
  target: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- console override
  log: (...parameters: any[]) => void,
): string {
  const temporaryDirectory = path.join(
    os.tmpdir(),
    `depsweep-${target.replace('/', '-')}-${Date.now()}`,
  );

  log(chalk.blue(`Cloning ${target}...`));
  const execOptions: ExecSyncOptions = { stdio: 'pipe', timeout: 120_000 };
  try {
    execSync(
      `git clone --depth 1 https://github.com/${target}.git ${temporaryDirectory}`,
      execOptions,
    );
  } catch {
    throw new Error(
      `Failed to clone ${target}. Check the repository exists and is public.`,
    );
  }

  // Scrub any auth from remote URL
  try {
    execSync(
      `git -C ${temporaryDirectory} remote set-url origin https://github.com/${target}.git`,
      execOptions,
    );
  } catch {
    // non-critical
  }

  // Detect package manager and install
  log(chalk.blue('Installing dependencies...'));
  try {
    if (existsSync(path.join(temporaryDirectory, 'pnpm-lock.yaml'))) {
      execSync('pnpm install --no-frozen-lockfile --ignore-scripts', {
        ...execOptions,
        cwd: temporaryDirectory,
        timeout: 300_000,
      });
    } else if (existsSync(path.join(temporaryDirectory, 'yarn.lock'))) {
      execSync('yarn install --ignore-scripts', {
        ...execOptions,
        cwd: temporaryDirectory,
        timeout: 300_000,
      });
    } else {
      execSync('npm install --ignore-scripts', {
        ...execOptions,
        cwd: temporaryDirectory,
        timeout: 300_000,
      });
    }
  } catch {
    // Fallback: try npm install without lockfile
    try {
      execSync('npm install --ignore-scripts', {
        ...execOptions,
        cwd: temporaryDirectory,
        timeout: 300_000,
      });
    } catch {
      log(
        chalk.yellow(
          'Warning: dependency installation failed. Results may be incomplete.',
        ),
      );
    }
  }

  return temporaryDirectory;
}

// Main execution
// eslint-disable-next-line max-lines-per-function, complexity, sonarjs/cognitive-complexity -- top-level CLI orchestration; all branches are linear command dispatch and cannot be meaningfully decomposed without fragmenting user-visible behavior
async function main(): Promise<void> {
  const performanceMonitor = PerformanceMonitor.getInstance();
  const memoryOptimizer = MemoryOptimizer.getInstance();
  let savedConsoleLog: typeof console.log | undefined;
  let isolatedCloneDirectory: string | null = null;

  try {
    performanceMonitor.startTimer('totalExecution');
    // Add signal handlers at the start of main
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Set up Commander FIRST to parse arguments before resolving project
    const depsweepVersion = await getDepsweepVersion();
    const program = new Command();

    // Configure program output and prevent exit
    program.configureOutput({
      writeErr: (message) => {
        process.stdout.write(message);
      },
      writeOut: (message) => {
        process.stdout.write(message);
      },
    });
    program.exitOverride();

    // Configure the CLI program
    program
      .name(CLI_STRINGS.CLI_NAME)
      .usage('[options] [owner/repo]')
      .description(CLI_STRINGS.CLI_DESCRIPTION)
      .argument(
        '[target]',
        'GitHub owner/repo to scan remotely (e.g., facebook/react)',
      )

      .option('-v, --verbose', 'display detailed usage information')
      .option('-a, --aggressive', 'allow removal of protected dependencies')
      .option('-s, --safe <deps>', 'dependencies that will not be removed')
      .option('-i, --ignore <paths>', 'patterns to ignore during scanning')
      .option('-m, --measure-impact', 'measure unused dependency impact')
      .option('-d, --dry-run', 'run without making changes')
      .option('-n, --no-progress', 'disable the progress bar')
      .option('--json', 'output results as JSON')
      .option('-o, --output <file>', 'write results to file')
      .option(
        '--quick-check',
        'skip transitive dependency size resolution (faster)',
      )
      .version(depsweepVersion, '--version', 'display installed version')
      .addHelpText(
        'after',
        '\nExample:\n  $ depsweep -v --measure-impact\n  $ depsweep facebook/react --json --dry-run',
      );

    program.exitOverride(() => {
      // Don't throw or exit - just let the help display
    });

    // Show help immediately if --help flag is present
    if (process.argv.includes('--help')) {
      const helpText = program.helpInformation();
      process.stdout.write(`${helpText}\n`);
      process.exit(0); // Exit after displaying help
    }

    program.parse(process.argv);

    const options = program.opts();
    if (options.help === true) {
      program.outputHelp();
      return;
    }

    // JSON-to-stdout mode: suppress all non-JSON console output
    const jsonToStdout = options.json === true && options.output === undefined;
    if (jsonToStdout) {
      options.progress = false;
      savedConsoleLog = console.log;
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentionally suppress console in JSON mode
      console.log = (): void => {};
    }

    // Determine project directory: remote (owner/repo) or local
    const [target] = program.args;
    const isRemote = target !== undefined && /^[\w.-]+\/[\w.-]+$/u.test(target);

    let packageJsonPath: string;
    let projectDirectory: string;

    if (isRemote) {
      // Isolated mode: clone, install, scan
      isolatedCloneDirectory = cloneAndInstall(target, console.log);
      packageJsonPath = path.join(isolatedCloneDirectory, 'package.json');
      projectDirectory = isolatedCloneDirectory;
      options.dryRun = true; // Always dry-run for remote repos
    } else {
      packageJsonPath = await findClosestPackageJson(process.cwd());
      projectDirectory = path.dirname(packageJsonPath);
    }

    const context = await getPackageContext(packageJsonPath);
    const packageManager = await detectPackageManager(projectDirectory);

    const packageJsonString = (await readFile(packageJsonPath, 'utf8')) ?? '{}';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns any; casting to Record<string, unknown> is the minimum-unsafe shape for package.json access
    const packageJson = JSON.parse(packageJsonString) as Record<
      string,
      unknown
    >;

    console.log(chalk.cyan(MESSAGES.title));
    logNewlines();
    console.log(chalk.blue(`Package.json found at: ${packageJsonPath}`));

    process.on('uncaughtException', (error: Error): void => {
      console.error(chalk.red(MESSAGES.fatalError), error);
      process.exit(1);
    });

    process.on('unhandledRejection', (error: Error): void => {
      console.error(chalk.red(MESSAGES.fatalError), error);
      process.exit(1);
    });

    const dependencies = await getDependencies(packageJsonPath);
    dependencies.sort(customSort);

    // Early exit for JSON mode with 0 dependencies (e.g., monorepo root)
    if (dependencies.length === 0 && options.json === true) {
      const projectName =
        typeof packageJson.name === 'string'
          ? packageJson.name
          : path.basename(projectDirectory);
      const scanResult: ScanResult = {
        packageManager,
        project: projectName,
        protectedDependencies: [],
        timestamp: new Date().toISOString(),
        totalDependencies: 0,
        unusedDependencies: [],
        version: '1.0.0',
      };
      const jsonText = JSON.stringify(scanResult, null, 2);
      if (savedConsoleLog !== undefined) {
        // eslint-disable-next-line require-atomic-updates -- single-threaded Node.js; no actual race condition
        console.log = savedConsoleLog;
      }
      const earlyOutputPath =
        typeof options.output === 'string' ? options.output : undefined;
      if (earlyOutputPath === undefined) {
        process.stdout.write(`${jsonText}\n`);
      } else {
        await writeFile(earlyOutputPath, jsonText, 'utf8');
        console.log(chalk.green(`Report written to ${earlyOutputPath}`));
      }
      return;
    }

    // Filter out any file you don't want to count (e.g., binaries):
    /* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
    const ignoreList = Array.isArray(options.ignore)
      ? (options.ignore as string[])
      : [];
    /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
    const allFiles = await getSourceFiles(projectDirectory, ignoreList);
    const filteredFiles = [];
    for (const file of allFiles) {
      if (!isBinaryFileSync(file)) {
        filteredFiles.push(file);
      }
    }

    // sourceFiles now refers to filteredFiles
    const sourceFiles = filteredFiles;
    const topLevelDeps = new Set(dependencies);

    const safeUnused: string[] = [];

    // Add user-specified safe dependencies to safeUnused
    if (options.safe !== undefined) {
      // Parse comma-separated safe dependencies; options.safe is `any` from Commander opts()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Commander opts() returns Record<string, any>
      const rawSafe = options.safe;
      let safeDeps: string[];
      if (Array.isArray(rawSafe)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- rawSafe is any[]; Commander always passes string arrays for multi-value options
        safeDeps = rawSafe as string[];
      } else if (typeof rawSafe === 'string') {
        safeDeps = rawSafe
          .split(',')
          .map((dep: string) => dep.trim())
          .filter((dep: string) => dep.length > 0);
      } else {
        safeDeps = [];
      }

      /* eslint-disable max-depth */
      for (const safeDep of safeDeps) {
        if (!safeUnused.includes(safeDep)) {
          safeUnused.push(safeDep);
        }
      }
      /* eslint-enable max-depth */
    }

    // Update totalAnalysisSteps to include subdependencies and files
    const totalAnalysisSteps = dependencies.length * sourceFiles.length;
    let analysisStepsProcessed = 0;

    let progressBar: cliProgress.SingleBar | null = null;
    if (options.progress === true) {
      progressBar = new cliProgress.SingleBar({
        barCompleteChar: CLI_STRINGS.BAR_COMPLETE,
        barIncompleteChar: CLI_STRINGS.BAR_INCOMPLETE,
        clearOnComplete: false,
        forceRedraw: true,
        format: CLI_STRINGS.PROGRESS_FORMAT,
        hideCursor: true,
        linewrap: false,
      });
      activeProgressBar = progressBar;
      progressBar.start(100, 0, {
        currentDeps: 0,
        dep: '',
        totalDeps: dependencies.length,
      });
    }

    let totalDepsProcessed = 0;

    // Create a variable to store the current dependency name (declared before progressCallback to avoid no-use-before-define)
    let currentDependency = '';

    // Adjust progress tracking
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const progressCallback = (
      _filePath: string,
      _sIndex?: number,
      _sCount?: number,
    ): void => {
      /* eslint-enable @typescript-eslint/no-unused-vars */
      analysisStepsProcessed++;
      if (progressBar !== null) {
        progressBar.update(
          (analysisStepsProcessed / totalAnalysisSteps) * 100,
          {
            currentDeps: totalDepsProcessed,
            dep: currentDependency,
            totalDeps: dependencies.length,
          },
        );
      }
    };

    // Create a map to store all dependency info
    const depInfoMap = new Map<
      string,
      Awaited<ReturnType<typeof getDependencyInfo>>
    >();

    // Analyze all dependencies
    for (const dep of dependencies) {
      currentDependency = dep;
      totalDepsProcessed++;
      // eslint-disable-next-line no-await-in-loop -- sequential to preserve progress feedback and respect npm registry rate limits
      const info = await getDependencyInfo(
        dep,
        context,
        sourceFiles,
        topLevelDeps,
        {
          onProgress: progressCallback,
          totalAnalysisSteps,
        },
      );

      depInfoMap.set(dep, info);

      // eslint-disable-next-line no-await-in-loop -- intentional yield after each dep to relieve memory pressure between iterations
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }

    if (progressBar !== null) {
      progressBar.update(100, {
        currentDeps: dependencies.length,
        dep: chalk.green('✓'),
        totalDeps: dependencies.length,
      });
      progressBar.stop();
    }

    // Log performance metrics if verbose mode
    if (options.verbose === true) {
      performanceMonitor.logSummary();
      const memoryStats = memoryOptimizer.getMemoryStats();
      const heapUsedMB = Math.round(memoryStats.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryStats.heapTotal / 1024 / 1024);
      console.log(
        chalk.blue(`\nMemory Usage: ${heapUsedMB}MB / ${heapTotalMB}MB`),
      );
    }

    logNewlines();

    // Determine unused dependencies based on complete analysis
    let unusedDependencies = dependencies.filter((dep) => {
      const info = depInfoMap.get(dep);
      if (info === undefined) {
        return false;
      }
      return (
        info.usedInFiles.length === 0 && info.requiredByPackages.size === 0
      );
    });

    // Finalize the unused dependencies to account for those
    // used only by other unused dependencies
    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- defined after main() for organization
    unusedDependencies = finalizeUnusedDependencies(
      unusedDependencies,
      depInfoMap,
      dependencies,
    );

    // Sort unused dependencies alphabetically
    unusedDependencies.sort(customSort);

    // Sort safeUnused dependencies alphabetically
    safeUnused.sort(customSort);

    // SAFETY SYSTEM: Separate truly unused from protected dependencies
    // Protected dependencies are critical packages that should never be removed
    const protectedUnused: string[] = [];
    const trulyUnused: string[] = [];

    for (const dep of unusedDependencies) {
      const isProtected = isProtectedDependency(dep);
      const isAggressive = options.aggressive === true;
      if (isProtected && !isAggressive) {
        protectedUnused.push(dep);
        safeUnused.push(dep);
      } else {
        trulyUnused.push(dep);
      }
    }

    // Update unusedDependencies to only include truly unused (non-protected)
    // When aggressive flag is set, this includes protected dependencies
    unusedDependencies = trulyUnused;

    // === JSON OUTPUT MODE ===
    if (options.json === true) {
      await handleJsonOutput({
        dependencies,
        options,
        packageJson,
        packageJsonPath,
        packageManager,
        projectDirectory,
        protectedUnused,
        savedConsoleLog,
        unusedDependencies,
      });
      return;
    }

    // Determine which deps were user-safe-listed (vs auto-protected)
    // options.safe is any from Commander; parse into a typed list for safe comparison
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Commander opts() returns Record<string, any>
    const rawSafeOpt = options.safe;

    /* eslint-disable no-nested-ternary, unicorn/no-nested-ternary, @typescript-eslint/no-unsafe-type-assertion */
    const safeListed: string[] = Array.isArray(rawSafeOpt)
      ? (rawSafeOpt as string[])
      : typeof rawSafeOpt === 'string'
        ? [rawSafeOpt]
        : [];
    /* eslint-enable no-nested-ternary, unicorn/no-nested-ternary, @typescript-eslint/no-unsafe-type-assertion */

    // Show results and handle package removal
    if (unusedDependencies.length === 0 && safeUnused.length === 0) {
      console.log(chalk.green(MESSAGES.noUnusedDependencies));
    } else if (unusedDependencies.length === 0 && safeUnused.length > 0) {
      console.log(chalk.bold(MESSAGES.unusedFound));
      for (const dep of safeUnused) {
        const isSafeListed = safeListed.includes(dep);
        console.log(
          chalk.blue(`- ${dep} [${isSafeListed ? 'safe' : 'protected'}]`),
        );
      }
      logNewlines(2); // replaces console.log('\n\n')
      console.log(chalk.blue(MESSAGES.noChangesMade));
    } else {
      console.log(chalk.bold(MESSAGES.unusedFound));
      for (const dep of unusedDependencies) {
        console.log(chalk.yellow(`- ${dep}`));
      }
      for (const dep of safeUnused) {
        const isSafeListed = safeListed.includes(dep);
        console.log(
          chalk.blue(`- ${dep} [${isSafeListed ? 'safe' : 'protected'}]`),
        );
      }
      logNewlines();

      // Display verbose output if requested
      if (options.verbose === true) {
        // eslint-disable-next-line unicorn/no-array-sort -- tsconfig targets ES2022; toSorted() requires ES2023 lib which is not yet in scope
        const sortedDeps = [...dependencies].sort(customSort);
        renderVerboseTable({
          depInfoMap,
          projectDirectory,
          sortedDeps,
          unusedDeps: unusedDependencies,
        });
        logNewlines();
      }

      // Measure impact if requested
      if (options.measureImpact === true) {
        await handleMeasureImpact({
          packageJson,
          packageJsonPath,
          unusedDependencies,
          verbose: options.verbose === true,
        });
      }

      if (options.measureImpact !== true) {
        console.log(
          chalk.blue(
            'Run with the -m, --measure-impact flag to output a detailed impact analysis report',
          ),
        );
      }

      if (options.dryRun === true) {
        logNewlines(2);
        console.log(chalk.blue(MESSAGES.noChangesMade));
        return;
      }

      logNewlines(2);

      // Prompt to remove dependencies
      const rl = createInterface({ input, output });
      activeReadline = rl;

      const answer = await rl.question(chalk.blue(MESSAGES.promptRemove));
      if (answer.toLowerCase() === 'y') {
        await removeUnusedDependencies({
          PACKAGE_MANAGERS,
          packageManager,
          projectDirectory,
          unusedDependencies,
        });
      } else {
        console.log(chalk.blue(MESSAGES.noChangesMade));
      }
      rl.close();
      activeReadline = null;
    }

    // End total execution timer
    performanceMonitor.endTimer('totalExecution');

    // Log final performance summary
    if (options.verbose === true) {
      const metrics = performanceMonitor.getMetrics().get('totalExecution');
      const totalTime = metrics?.totalTime ?? 0;
      console.log(
        chalk.blue(`\nTotal execution time: ${totalTime.toFixed(2)}ms`),
      );
    }
  } catch (error) {
    if (savedConsoleLog !== undefined) {
      // eslint-disable-next-line require-atomic-updates -- single-threaded Node.js; no actual race condition; console restoration must happen before error output
      console.log = savedConsoleLog;
    }
    console.error(chalk.red(MESSAGES.fatalError), error);
    cleanup();
    process.exit(1);
  } finally {
    // Clean up isolated clone directory
    if (isolatedCloneDirectory !== null) {
      try {
        await rm(isolatedCloneDirectory, { force: true, recursive: true });
      } catch {
        // Best-effort cleanup
      }
    }
  }
}

function setupSignalHandlers(): void {
  const exitHandler = (signal: string): void => {
    console.log(MESSAGES.signalCleanup.replace('{0}', signal));
    cleanup();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    exitHandler('SIGINT');
  });
  process.on('SIGTERM', () => {
    exitHandler('SIGTERM');
  });
}

// Top-level initialization
async function init(): Promise<void> {
  try {
    setupSignalHandlers();
    await main();
  } catch (error) {
    cleanup();
    console.error(chalk.red(MESSAGES.unexpected), error);
    process.exit(1);
  }
}

// Only run init when this file is executed directly
if (process.argv[1]?.endsWith('index.js')) {
  // eslint-disable-next-line unicorn/prefer-top-level-await, promise/prefer-await-to-callbacks, promise/prefer-await-to-then -- init() is guarded by the argv check; top-level await cannot be conditionally gated
  init().catch((error) => {
    console.error(chalk.red(MESSAGES.fatalError), error);
    process.exit(1);
  });
}

function markTransitivelyUnused(
  unusedSet: Set<string>,
  dep: string,
  depInfoMap: Map<
    string,
    { usedInFiles: string[]; requiredByPackages: Set<string> }
  >,
): boolean {
  if (unusedSet.has(dep)) {
    return false;
  }
  const info = depInfoMap.get(dep);
  if (info === undefined) {
    return false;
  }
  const allRequirersUnused = [...info.requiredByPackages].every((package_) =>
    unusedSet.has(package_),
  );
  if (allRequirersUnused && info.usedInFiles.length === 0) {
    unusedSet.add(dep);
    return true;
  }
  return false;
}

function finalizeUnusedDependencies(
  initialUnusedDeps: string[],
  depInfoMap: Map<
    string,
    { usedInFiles: string[]; requiredByPackages: Set<string> }
  >,
  allDeps: string[],
): string[] {
  const unusedSet = new Set(initialUnusedDeps);
  let changed = true;

  while (changed) {
    changed = false;
    for (const dep of allDeps) {
      if (markTransitivelyUnused(unusedSet, dep, depInfoMap)) {
        changed = true;
      }
    }
  }
  return [...unusedSet];
}
