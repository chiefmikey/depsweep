#!/usr/bin/env node
/* eslint-disable unicorn/prefer-json-parse-buffer */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';

import chalk from 'chalk';
import cliProgress from 'cli-progress';
import CliTable from 'cli-table3';
import { Command } from 'commander';
import { isBinaryFileSync } from 'isbinaryfile';
import ora, { type Ora } from 'ora';

import {
  CLI_STRINGS,
  FILE_PATTERNS,
  MESSAGES,
  PACKAGE_MANAGERS,
} from './constants.js';
import {
  isTypePackageUsed,
  safeExecSync,
  detectPackageManager,
  measurePackageInstallation,
  getParentPackageDownloads,
  getYearlyDownloads,
  calculateImpactStats,
  displayImpactTable,
  formatSize,
  formatTime,
  formatNumber,
} from './helpers.js';
import {
  getSourceFiles,
  findClosestPackageJson,
  getDependencies,
  getPackageContext,
  processFilesInParallel,
  getDependencyInfo,
} from './utils.js';

// Variables for active resources
let activeSpinner: Ora | null = null;
let activeProgressBar: cliProgress.SingleBar | null = null;
let activeReadline: readline.Interface | null = null;

function cleanup(): void {
  if (activeSpinner) {
    activeSpinner.stop();
  }
  if (activeProgressBar) {
    activeProgressBar.stop();
  }
  if (activeReadline) {
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

function logNewlines(count = 1): void {
  for (let index = 0; index < count; index++) {
    console.log();
  }
}

// Custom sort function to handle scoped dependencies
export function customSort(a: string, b: string): number {
  const aNormalized = a.replace(/^@/, '');
  const bNormalized = b.replace(/^@/, '');
  return aNormalized.localeCompare(bNormalized, 'en', { sensitivity: 'base' });
}

// Main execution
async function main(): Promise<void> {
  try {
    // Add signal handlers at the start of main
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Set up CLI first to handle help/version without requiring package.json
    const program = new Command();

    // Configure program output and prevent exit
    program.configureOutput({
      writeOut: (string_) => process.stdout.write(string_),
      writeErr: (string_) => process.stdout.write(string_),
    });
    program.exitOverride();

    // Configure the CLI program
    program.name(CLI_STRINGS.CLI_NAME);
    program.usage('[options]');
    program.description(CLI_STRINGS.CLI_DESCRIPTION);

    program.option('-v, --verbose', 'display detailed usage information');
    program.option('-a, --aggressive', 'allow removal of protected dependencies');
    program.option('-s, --safe <deps>', 'dependencies that will not be removed');
    program.option('-i, --ignore <paths>', 'patterns to ignore during scanning');
    program.option('-m, --measure-impact', 'measure unused dependency impact');
    program.option('-d, --dry-run', 'run without making changes');
    program.option('-n, --no-progress', 'disable the progress bar');
    program.version('0.0.0', '--version', 'display installed version'); // Temporary version
    
    // Handle help and version first, before requiring package.json
    if (process.argv.includes('--help')) {
      const helpText = program.helpInformation();
      process.stdout.write(`${helpText}\n`);
      process.stdout.write(`\nExample:\n  $ depsweep -v --measure-impact\n`);
      return;
    }

    if (process.argv.includes('--version')) {
      // Try to get version from package.json, but fall back to a default
      try {
        const packageJsonPath = await findClosestPackageJson(process.cwd());
        const packageJsonString = (await fs.readFile(packageJsonPath, 'utf8')) || '{}';
        const packageJson = JSON.parse(packageJsonString);
        process.stdout.write(`${packageJson.version}\n`);
      } catch {
        // If we can't find package.json, use the built-in version
        process.stdout.write('0.6.3\n'); // This should match the version in the main package.json
      }
      return;
    }

    // Now find package.json for normal operation
    const packageJsonPath = await findClosestPackageJson(process.cwd());
    const projectDirectory = path.dirname(packageJsonPath);
    const context = await getPackageContext(packageJsonPath);

    const packageJsonString =
      (await fs.readFile(packageJsonPath, 'utf8')) || '{}';
    const packageJson = JSON.parse(packageJsonString);

    // Update version with actual package.json version
    program.version(packageJson.version, '--version', 'display installed version');
    
    // Parse arguments now that everything is set up
    program.parse(process.argv);
    
    // Add help text if the method exists
    if (typeof program.addHelpText === 'function') {
      program.addHelpText('after', CLI_STRINGS.EXAMPLE_TEXT);
    }

    program.exitOverride(() => {
      // Don't throw or exit - just let the help display
    });

    const options = program.opts();

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

    // Filter out any file you don't want to count (e.g., binaries):
    const allFiles = await getSourceFiles(
      projectDirectory,
      options.ignore || [],
    );
    const filteredFiles = [];
    for (const file of allFiles) {
      // ...check if file is binary or some skip condition...
      if (!isBinaryFileSync(file)) {
        filteredFiles.push(file);
      }
    }

    // sourceFiles now refers to filteredFiles
    const sourceFiles = filteredFiles;
    const topLevelDeps = new Set(dependencies);

    const safeUnused: string[] = [];

    // Update totalAnalysisSteps to include subdependencies and files
    const totalAnalysisSteps = dependencies.length * sourceFiles.length;
    let analysisStepsProcessed = 0;

    let progressBar: cliProgress.SingleBar | null = null;
    if (options.progress) {
      progressBar = new cliProgress.SingleBar({
        format: CLI_STRINGS.PROGRESS_FORMAT,
        barCompleteChar: CLI_STRINGS.BAR_COMPLETE,
        barIncompleteChar: CLI_STRINGS.BAR_INCOMPLETE,
        hideCursor: true,
        clearOnComplete: false,
        forceRedraw: true,
        linewrap: false,
      });
      activeProgressBar = progressBar;
      progressBar.start(100, 0, {
        currentDeps: 0,
        totalDeps: dependencies.length,
        dep: '',
      });
    }

    // Declare subdepIndex and subdepCount at an appropriate scope
    let subdepIndex = 0;
    let subdepCount = 0;

    let totalDepsProcessed = 0;
    const currentDepFiles = new Set<string>(); // Add this to track unique files per dep

    // Add this before the loop
    const subdepsProcessed = new Set<string>();

    // Adjust progress tracking
    const progressCallback = (
      filePath: string,
      sIndex?: number,
      sCount?: number,
    ) => {
      analysisStepsProcessed++;
      if (progressBar) {
        progressBar.update(
          (analysisStepsProcessed / totalAnalysisSteps) * 100,
          {
            currentDeps: totalDepsProcessed,
            totalDeps: dependencies.length,
            dep: currentDependency,
          },
        );
      }
    };

    // Create a map to store all dependency info
    const depInfoMap = new Map<
      string,
      Awaited<ReturnType<typeof getDependencyInfo>>
    >();

    // Create a variable to store the current dependency name
    let currentDependency = '';

    // Analyze all dependencies
    for (const [index, dep] of dependencies.entries()) {
      currentDependency = dep; // Update the current dependency name
      subdepsProcessed.clear();
      totalDepsProcessed++;
      currentDepFiles.clear(); // Reset the file tracker for each dependency
      subdepIndex = 0;
      subdepCount = 0;
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

      await new Promise((res) => setImmediate(res));
    }

    if (progressBar) {
      progressBar.update(100, {
        currentDeps: dependencies.length,
        totalDeps: dependencies.length,
        dep: chalk.green('✓'),
      });
      progressBar.stop();
    }

    logNewlines();

    // Determine unused dependencies based on complete analysis
    let unusedDependencies = dependencies.filter((dep) => {
      const info = depInfoMap.get(dep)!;
      return (
        info.usedInFiles.length === 0 && info.requiredByPackages.size === 0
      );
    });

    // Finalize the unused dependencies to account for those
    // used only by other unused dependencies
    unusedDependencies = finalizeUnusedDependencies(
      unusedDependencies,
      depInfoMap,
      dependencies,
    );

    // Filter out safe dependencies if --safe option is provided
    if (options.safe) {
      const safeDeps = Array.isArray(options.safe) ? options.safe : [options.safe];
      unusedDependencies = unusedDependencies.filter(dep => !safeDeps.includes(dep));
    }

    // Sort unused dependencies alphabetically
    unusedDependencies.sort(customSort);

    // Sort safeUnused dependencies alphabetically
    safeUnused.sort(customSort);

    // Show results and handle package removal
    if (unusedDependencies.length === 0 && safeUnused.length === 0) {
      console.log(chalk.green(MESSAGES.noUnusedDependencies));
    } else if (unusedDependencies.length === 0 && safeUnused.length > 0) {
      console.log(chalk.bold(MESSAGES.unusedFound));
      for (const dep of safeUnused) {
        const isSafeListed = options.safe?.includes(dep);
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
        const isSafeListed = options.safe?.includes(dep);
        console.log(
          chalk.blue(`- ${dep} [${isSafeListed ? 'safe' : 'protected'}]`),
        );
      }
      logNewlines();

      // Display verbose output if requested
      if (options.verbose) {
        const table = new CliTable({
          head: ['Dependency', 'Direct Usage', 'Required By'],
          wordWrap: true,
          colWidths: [25, 35, 20],
          style: { head: ['cyan'], border: ['grey'] },
        });

        const sortedDependencies = [...dependencies].sort(customSort);
        for (const dep of sortedDependencies) {
          const info = depInfoMap.get(dep)!;
          const fileUsage =
            info.usedInFiles.length > 0
              ? info.usedInFiles
                  .map((f) => path.relative(projectDirectory, f))
                  .join('\n')
              : chalk.gray('-');

          const requiredBy =
            info.requiredByPackages.size > 0
              ? [...info.requiredByPackages]
                  .map((requestDep) =>
                    unusedDependencies.includes(requestDep)
                      ? `${requestDep} ${chalk.blue('(unused)')}`
                      : requestDep,
                  )
                  .join(', ')
              : chalk.gray('-');

          table.push([dep, fileUsage, requiredBy]);
        }

        console.log(table.toString());
        logNewlines();
      }

      // Measure impact if requested
      if (options.measureImpact) {
        let totalInstallTime = 0;
        let totalDiskSpace = 0;
        const installResults: {
          dep: string;
          time: number;
          space: number;
          errors?: string[];
        }[] = [];

        const measureSpinner = ora({
          text: MESSAGES.measuringImpact,
          spinner: 'dots',
        }).start();
        activeSpinner = measureSpinner;

        const totalPackages = unusedDependencies.length;
        for (let index = 0; index < totalPackages; index++) {
          const dep = unusedDependencies[index];
          try {
            const metrics = await measurePackageInstallation(dep);
            totalInstallTime += metrics.installTime;
            totalDiskSpace += metrics.diskSpace;

            installResults.push({
              dep,
              time: metrics.installTime,
              space: metrics.diskSpace,
              errors: metrics.errors,
            });

            const progress = `[${index + 1}/${totalPackages}] ${dep}`;
            measureSpinner.text = `${MESSAGES.measuringImpact} ${progress}`;
          } catch (error) {
            console.error(`Error measuring ${dep}:`, error);
          }
        }

        measureSpinner.stop();
        console.log(
          `${MESSAGES.measuringImpact} [${totalPackages}/${totalPackages}] ${chalk.green('✔')}`,
        );

        const parentInfo = await getParentPackageDownloads(packageJsonPath);

        logNewlines();
        console.log(
          `${chalk.bold('Unused Dependency Impact Report:')} ${chalk.yellow(parentInfo?.name)} ${chalk.blue(`(${parentInfo?.homepage || parentInfo?.repository?.url || ''})`)}`,
        );

        // Create a table for detailed results
        const impactData: Record<
          string,
          { installTime: string; diskSpace: string }
        > = {};
        for (const result of installResults) {
          impactData[result.dep] = {
            installTime: `${result.time.toFixed(2)}s`,
            diskSpace: formatSize(result.space),
          };
        }

        displayImpactTable(impactData, totalInstallTime, totalDiskSpace);

        if (parentInfo) {
          const yearlyData = await getYearlyDownloads(parentInfo.name);
          const stats = calculateImpactStats(
            totalDiskSpace,
            totalInstallTime,
            parentInfo.downloads,
            yearlyData,
          );

          const impactTable = new CliTable({
            head: ['Period', 'Downloads', 'Data Transfer', 'Install Time'],
            colWidths: [18, 20, 20, 20],
            wordWrap: true,
            style: { head: ['cyan'], border: ['grey'] },
          });

          if (stats.day) {
            impactTable.push([
              'Day',
              `~${formatNumber(stats.day.downloads)}`,
              formatSize(stats.day.diskSpace),
              formatTime(stats.day.installTime),
            ]);
          }

          if (stats.monthly) {
            // Ensure monthly stats are only added when not a full year
            impactTable.push([
              'Month',
              formatNumber(stats.monthly.downloads),
              formatSize(stats.monthly.diskSpace),
              formatTime(stats.monthly.installTime),
            ]);
          }

          if (
            yearlyData?.monthsFetched === 12 &&
            stats.yearly &&
            stats.yearly.downloads > 0
          ) {
            impactTable.push([
              'Last 12 months',
              formatNumber(stats.yearly.downloads),
              formatSize(stats.yearly.diskSpace),
              formatTime(stats.yearly.installTime),
            ]);
          } else if (
            yearlyData?.monthsFetched &&
            yearlyData.monthsFetched > 1 &&
            stats[`last_${yearlyData.monthsFetched}_months`] &&
            (stats[`last_${yearlyData.monthsFetched}_months`]?.downloads ?? 0) >
              0
          ) {
            const label = `Last ${yearlyData.monthsFetched} months`;
            const periodStats =
              stats[`last_${yearlyData.monthsFetched}_months`];
            impactTable.push([
              label,
              formatNumber(periodStats?.downloads ?? 0),
              formatSize(periodStats?.diskSpace ?? 0),
              formatTime(periodStats?.installTime ?? 0),
            ]);
          }

          console.log(impactTable.toString());

          logNewlines();
          console.log(
            `${chalk.yellow(
              'Note:',
            )} These results depend on your system's capabilities.\nTry a multi-architecture analysis at ${chalk.bold('https://github.com/chiefmikey/depsweep/analysis')}`,
          );
        } else {
          logNewlines();
          console.log(
            chalk.yellow('Insufficient download data to calculate impact'),
          );
        }
      }

      if (!options.measureImpact) {
        console.log(
          chalk.blue(
            'Run with the -m, --measure-impact flag to output a detailed impact analysis report',
          ),
        );
      }

      if (options.dryRun) {
        logNewlines(2); // Use 2 newlines here
        console.log(chalk.blue(MESSAGES.noChangesMade));
        return;
      }

      logNewlines(2); // Use 2 newlines here

      // Prompt to remove dependencies
      const rl = readline.createInterface({ input, output });
      activeReadline = rl;

      // Detect package manager once
      const packageManager = await detectPackageManager(projectDirectory);

      const answer = await rl.question(chalk.blue(MESSAGES.promptRemove));
      if (answer.toLowerCase() === 'y') {
        // Build uninstall command
        let uninstallCommand = '';
        switch (packageManager) {
          case PACKAGE_MANAGERS.NPM: {
            uninstallCommand = `npm uninstall ${unusedDependencies.join(' ')}`;
            break;
          }
          case PACKAGE_MANAGERS.YARN: {
            uninstallCommand = `yarn remove ${unusedDependencies.join(' ')}`;
            break;
          }
          case PACKAGE_MANAGERS.PNPM: {
            uninstallCommand = `pnpm remove ${unusedDependencies.join(' ')}`;
            break;
          }
          default: {
            break;
          }
        }

        // Validate before using in execSync
        unusedDependencies = unusedDependencies.filter((dep) =>
          isValidPackageName(dep),
        );

        if (unusedDependencies.length > 0) {
          try {
            safeExecSync(uninstallCommand.split(' '), {
              stdio: 'inherit',
              cwd: projectDirectory,
              timeout: 300_000,
            });
          } catch (error) {
            console.error(chalk.red('Failed to uninstall packages:'), error);
            process.exit(1);
          }
        }
      } else {
        console.log(chalk.blue(MESSAGES.noChangesMade));
      }
      rl.close();
      activeReadline = null;
    }
  } catch (error) {
    cleanup();
    console.error(chalk.red(MESSAGES.fatalError), error);
    process.exit(1);
  }
}

// Replace the top-level await with an async init function
async function init(): Promise<void> {
  try {
    // Handle exit signals at the top level
    const exitHandler = (signal: string): void => {
      console.log(MESSAGES.signalCleanup.replace('{0}', signal));
      cleanup();
      // Exit without error since this is an intentional exit
      process.exit(0);
    };

    // Handle both SIGINT (Ctrl+C) and SIGTERM
    process.on('SIGINT', () => {
      exitHandler('SIGINT');
    });
    process.on('SIGTERM', () => {
      exitHandler('SIGTERM');
    });

    await main();
  } catch (error) {
    cleanup();
    console.error(chalk.red(MESSAGES.unexpected), error);
    process.exit(1);
  }
}

init().catch((error) => {
  console.error(chalk.red(MESSAGES.fatalError), error);
  process.exit(1);
});

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
      if (!unusedSet.has(dep)) {
        const info = depInfoMap.get(dep);
        if (info) {
          // If every package requiring this dep is also unused, mark it unused
          const allRequirersUnused = [...info.requiredByPackages].every(
            (package_) => unusedSet.has(package_),
          );
          if (allRequirersUnused && info.usedInFiles.length === 0) {
            unusedSet.add(dep);
            changed = true;
          }
        }
      }
    }
  }
  return [...unusedSet];
}
