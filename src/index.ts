#!/usr/bin/env node

import { execSync, type ExecSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import cliProgress from "cli-progress";
import CliTable from "cli-table3";
import { Command } from "commander";
import { isBinaryFileSync } from "isbinaryfile";
import ora, { type Ora } from "ora";

import {
  CLI_STRINGS,
  FILE_PATTERNS,
  MESSAGES,
  PACKAGE_MANAGERS,
  isProtectedDependency,
} from "./constants.js";
import {
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
  calculateEnvironmentalImpact,
  calculateCumulativeEnvironmentalImpact,
  displayEnvironmentalImpactTable,
  generateEnvironmentalRecommendations,
  displayEnvironmentalHeroMessage,
  customSort,
} from "./helpers.js";
export { customSort } from "./helpers.js";
import type {
  EnvironmentalImpact,
  ImpactMetrics,
  ScanResult,
} from "./interfaces.js";
import {
  getSourceFiles,
  findClosestPackageJson,
  getDependencies,
  getPackageContext,
  getDependencyInfo,
} from "./utils.js";
import {
  PerformanceMonitor,
  MemoryOptimizer,
} from "./performance-optimizations.js";

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
  if (process.env.NODE_ENV !== "test") {
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

// Get depsweep's own version from its package.json
async function getDepsweepVersion(): Promise<string> {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.join(__dirname, "..", "package.json");
    const content = await fs.readFile(pkgPath, "utf8");
    return JSON.parse(content).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// Clone a GitHub repo and install dependencies for isolated scanning
async function cloneAndInstall(
  target: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- console override
  log: (...args: any[]) => void,
): Promise<string> {
  const tmpDir = path.join(
    os.tmpdir(),
    `depsweep-${target.replace("/", "-")}-${Date.now()}`,
  );

  log(chalk.blue(`Cloning ${target}...`));
  const execOpts: ExecSyncOptions = { stdio: "pipe", timeout: 120_000 };
  try {
    execSync(
      `git clone --depth 1 https://github.com/${target}.git ${tmpDir}`,
      execOpts,
    );
  } catch {
    throw new Error(`Failed to clone ${target}. Check the repository exists and is public.`);
  }

  // Scrub any auth from remote URL
  try {
    execSync(
      `git -C ${tmpDir} remote set-url origin https://github.com/${target}.git`,
      execOpts,
    );
  } catch {
    // non-critical
  }

  // Detect package manager and install
  log(chalk.blue("Installing dependencies..."));
  try {
    if (existsSync(path.join(tmpDir, "pnpm-lock.yaml"))) {
      execSync("pnpm install --no-frozen-lockfile --ignore-scripts", {
        ...execOpts,
        cwd: tmpDir,
        timeout: 300_000,
      });
    } else if (existsSync(path.join(tmpDir, "yarn.lock"))) {
      execSync("yarn install --ignore-scripts", {
        ...execOpts,
        cwd: tmpDir,
        timeout: 300_000,
      });
    } else {
      execSync("npm install --ignore-scripts", {
        ...execOpts,
        cwd: tmpDir,
        timeout: 300_000,
      });
    }
  } catch {
    // Fallback: try npm install without lockfile
    try {
      execSync("npm install --ignore-scripts", {
        ...execOpts,
        cwd: tmpDir,
        timeout: 300_000,
      });
    } catch {
      log(chalk.yellow("Warning: dependency installation failed. Results may be incomplete."));
    }
  }

  return tmpDir;
}

// Main execution
async function main(): Promise<void> {
  const performanceMonitor = PerformanceMonitor.getInstance();
  const memoryOptimizer = MemoryOptimizer.getInstance();
  let savedConsoleLog: typeof console.log | undefined;
  let isolatedCloneDir: string | null = null;

  try {
    performanceMonitor.startTimer("totalExecution");
    // Add signal handlers at the start of main
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Set up Commander FIRST to parse arguments before resolving project
    const depsweepVersion = await getDepsweepVersion();
    const program = new Command();

    // Configure program output and prevent exit
    program.configureOutput({
      writeOut: (string_) => process.stdout.write(string_),
      writeErr: (string_) => process.stdout.write(string_),
    });
    program.exitOverride();

    // Configure the CLI program
    program
      .name(CLI_STRINGS.CLI_NAME)
      .usage("[options] [owner/repo]")
      .description(CLI_STRINGS.CLI_DESCRIPTION)
      .argument("[target]", "GitHub owner/repo to scan remotely (e.g., facebook/react)")

      .option("-v, --verbose", "display detailed usage information")
      .option("-a, --aggressive", "allow removal of protected dependencies")
      .option("-s, --safe <deps>", "dependencies that will not be removed")
      .option("-i, --ignore <paths>", "patterns to ignore during scanning")
      .option("-m, --measure-impact", "measure unused dependency impact")
      .option("-d, --dry-run", "run without making changes")
      .option("-n, --no-progress", "disable the progress bar")
      .option("--json", "output results as JSON")
      .option("-o, --output <file>", "write results to file")
      .version(depsweepVersion, "--version", "display installed version")
      .addHelpText("after", "\nExample:\n  $ depsweep -v --measure-impact\n  $ depsweep facebook/react --json --dry-run");

    program.exitOverride(() => {
      // Don't throw or exit - just let the help display
    });

    // Show help immediately if --help flag is present
    if (process.argv.includes("--help")) {
      const helpText = program.helpInformation();
      process.stdout.write(`${helpText}\n`);
      process.exit(0); // Exit after displaying help
    }

    program.parse(process.argv);

    const options = program.opts();
    if (options.help) {
      program.outputHelp();
      return;
    }

    // JSON-to-stdout mode: suppress all non-JSON console output
    const jsonToStdout = options.json && !options.output;
    if (jsonToStdout) {
      options.progress = false;
      savedConsoleLog = console.log;
      console.log = () => {};
    }

    // Determine project directory: remote (owner/repo) or local
    const target = program.args[0];
    const isRemote = target && /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(target);

    let packageJsonPath: string;
    let projectDirectory: string;

    if (isRemote) {
      // Isolated mode: clone, install, scan
      isolatedCloneDir = await cloneAndInstall(target, console.log);
      packageJsonPath = path.join(isolatedCloneDir, "package.json");
      projectDirectory = isolatedCloneDir;
      options.dryRun = true; // Always dry-run for remote repos
    } else {
      packageJsonPath = await findClosestPackageJson(process.cwd());
      projectDirectory = path.dirname(packageJsonPath);
    }

    const context = await getPackageContext(packageJsonPath);
    const packageManager = await detectPackageManager(projectDirectory);

    const packageJsonString =
      (await fs.readFile(packageJsonPath, "utf8")) || "{}";
    const packageJson = JSON.parse(packageJsonString);

    console.log(chalk.cyan(MESSAGES.title));
    logNewlines();
    console.log(chalk.blue(`Package.json found at: ${packageJsonPath}`));

    process.on("uncaughtException", (error: Error): void => {
      console.error(chalk.red(MESSAGES.fatalError), error);
      process.exit(1);
    });

    process.on("unhandledRejection", (error: Error): void => {
      console.error(chalk.red(MESSAGES.fatalError), error);
      process.exit(1);
    });

    const dependencies = await getDependencies(packageJsonPath);
    dependencies.sort(customSort);

    // Early exit for JSON mode with 0 dependencies (e.g., monorepo root)
    if (dependencies.length === 0 && options.json) {
      const scanResult: ScanResult = {
        project: packageJson.name || path.basename(projectDirectory),
        packageManager,
        totalDependencies: 0,
        unusedDependencies: [],
        protectedDependencies: [],
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };
      const json = JSON.stringify(scanResult, null, 2);
      if (savedConsoleLog) {
        console.log = savedConsoleLog;
      }
      if (options.output) {
        await fs.writeFile(options.output, json, "utf8");
        console.log(chalk.green(`Report written to ${options.output}`));
      } else {
        process.stdout.write(json + "\n");
      }
      return;
    }

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

    // Add user-specified safe dependencies to safeUnused
    if (options.safe) {
      // Parse comma-separated safe dependencies
      const safeDeps =
        typeof options.safe === "string"
          ? options.safe
              .split(",")
              .map((dep) => dep.trim())
              .filter((dep) => dep.length > 0)
          : Array.isArray(options.safe)
            ? options.safe
            : [];

      for (const safeDep of safeDeps) {
        if (!safeUnused.includes(safeDep)) {
          safeUnused.push(safeDep);
        }
      }
    }

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
        dep: "",
      });
    }

    let totalDepsProcessed = 0;
    const currentDepFiles = new Set<string>(); // Add this to track unique files per dep

    // Add this before the loop
    const subdepsProcessed = new Set<string>();

    // Adjust progress tracking
    const progressCallback = (
      _filePath: string,
      _sIndex?: number,
      _sCount?: number,
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
    let currentDependency = "";

    // Analyze all dependencies
    for (const dep of dependencies) {
      currentDependency = dep; // Update the current dependency name
      subdepsProcessed.clear();
      totalDepsProcessed++;
      currentDepFiles.clear(); // Reset the file tracker for each dependency
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
        dep: chalk.green("✓"),
      });
      progressBar.stop();
    }

    // Log performance metrics if verbose mode
    if (options.verbose) {
      performanceMonitor.logSummary();
      const memoryStats = memoryOptimizer.getMemoryStats();
      console.log(
        chalk.blue(
          `\nMemory Usage: ${Math.round(
            memoryStats.heapUsed / 1024 / 1024,
          )}MB / ${Math.round(memoryStats.heapTotal / 1024 / 1024)}MB`,
        ),
      );
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

    // Sort unused dependencies alphabetically
    unusedDependencies.sort(customSort);

    // Sort safeUnused dependencies alphabetically
    safeUnused.sort(customSort);

    // 🛡️ SAFETY SYSTEM: Separate truly unused from protected dependencies
    // Protected dependencies are critical packages that should never be removed
    const protectedUnused: string[] = [];
    const trulyUnused: string[] = [];

    for (const dep of unusedDependencies) {
      if (isProtectedDependency(dep) && !options.aggressive) {
        // If aggressive flag is set, treat protected dependencies as removable
        protectedUnused.push(dep);
        safeUnused.push(dep); // Add to safeUnused for display
      } else {
        // Either not protected, or aggressive flag allows removal
        trulyUnused.push(dep);
      }
    }

    // Update unusedDependencies to only include truly unused (non-protected)
    // When aggressive flag is set, this includes protected dependencies
    unusedDependencies = trulyUnused;

    // === JSON OUTPUT MODE ===
    if (options.json) {
      const scanResult: ScanResult = {
        project: packageJson.name || path.basename(projectDirectory),
        packageManager,
        totalDependencies: dependencies.length,
        unusedDependencies: [...unusedDependencies],
        protectedDependencies: [...protectedUnused],
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };

      if (unusedDependencies.length > 0 && options.measureImpact) {
        let totalInstallTime = 0;
        let totalDiskSpace = 0;
        const perPackage: Record<string, ImpactMetrics> = {};
        const environmentalImpacts: EnvironmentalImpact[] = [];
        const parentInfo = await getParentPackageDownloads(packageJsonPath);

        for (const dep of unusedDependencies) {
          try {
            const metrics = await measurePackageInstallation(dep);
            totalInstallTime += metrics.installTime;
            totalDiskSpace += metrics.diskSpace;
            const envImpact = calculateEnvironmentalImpact(
              metrics.diskSpace,
              metrics.installTime,
              parentInfo?.downloads || null,
            );
            perPackage[dep] = {
              installTime: metrics.installTime,
              diskSpace: metrics.diskSpace,
              errors: metrics.errors,
              environmentalImpact: envImpact,
            };
            environmentalImpacts.push(envImpact);
          } catch (error) {
            perPackage[dep] = {
              installTime: 0,
              diskSpace: 0,
              errors: [String(error)],
            };
          }
        }

        scanResult.impact = {
          totalInstallTime,
          totalDiskSpace,
          perPackage,
          environmentalImpact:
            calculateCumulativeEnvironmentalImpact(environmentalImpacts),
        };
      }

      const json = JSON.stringify(scanResult, null, 2);
      if (savedConsoleLog) {
        console.log = savedConsoleLog;
      }
      if (options.output) {
        await fs.writeFile(options.output, json, "utf8");
        console.log(chalk.green(`Report written to ${options.output}`));
      } else {
        process.stdout.write(json + "\n");
      }
      return;
    }

    // Show results and handle package removal
    if (unusedDependencies.length === 0 && safeUnused.length === 0) {
      console.log(chalk.green(MESSAGES.noUnusedDependencies));
    } else if (unusedDependencies.length === 0 && safeUnused.length > 0) {
      console.log(chalk.bold(MESSAGES.unusedFound));
      for (const dep of safeUnused) {
        const isSafeListed = options.safe?.includes(dep);
        console.log(
          chalk.blue(`- ${dep} [${isSafeListed ? "safe" : "protected"}]`),
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
          chalk.blue(`- ${dep} [${isSafeListed ? "safe" : "protected"}]`),
        );
      }
      logNewlines();

      // Display verbose output if requested
      if (options.verbose) {
        const table = new CliTable({
          head: ["Dependency", "Direct Usage", "Required By"],
          wordWrap: true,
          colWidths: [25, 35, 20],
          style: { head: ["cyan"], border: ["grey"] },
        });

        const sortedDependencies = [...dependencies].sort(customSort);
        for (const dep of sortedDependencies) {
          const info = depInfoMap.get(dep)!;
          const fileUsage =
            info.usedInFiles.length > 0
              ? info.usedInFiles
                  .map((f) => path.relative(projectDirectory, f))
                  .join("\n")
              : chalk.gray("-");

          const requiredBy =
            info.requiredByPackages.size > 0
              ? [...info.requiredByPackages]
                  .map((requestDep) =>
                    unusedDependencies.includes(requestDep)
                      ? `${requestDep} ${chalk.blue("(unused)")}`
                      : requestDep,
                  )
                  .join(", ")
              : chalk.gray("-");

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
          spinner: "dots",
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
          `${
            MESSAGES.measuringImpact
          } [${totalPackages}/${totalPackages}] ${chalk.green("✔")}`,
        );

        const parentInfo = await getParentPackageDownloads(packageJsonPath, options.verbose);

        logNewlines();
        console.log(
          `${chalk.bold("Unused Dependency Impact Report:")} ${chalk.yellow(
            parentInfo?.name,
          )} ${chalk.blue(
            `(${parentInfo?.homepage || parentInfo?.repository?.url || ""})`,
          )}`,
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

        // Calculate environmental impact for each package
        const environmentalImpacts: EnvironmentalImpact[] = [];
        for (const result of installResults) {
          const environmentImpact = calculateEnvironmentalImpact(
            result.space,
            result.time,
            parentInfo?.downloads || null,
          );
          environmentalImpacts.push(environmentImpact);
        }

        // Calculate cumulative environmental impact
        const totalEnvironmentalImpact =
          calculateCumulativeEnvironmentalImpact(environmentalImpacts);

        // Display environmental impact report
        logNewlines();
        console.log(chalk.green.bold(MESSAGES.environmentalImpact));
        displayEnvironmentalImpactTable(
          totalEnvironmentalImpact,
          "Total Environmental Impact"
        );

        // Display per-package environmental impact
        if (unusedDependencies.length > 1) {
          logNewlines();
          console.log(chalk.blue.bold("Per-Package Environmental Impact:"));
          for (const [index, dep] of unusedDependencies.entries()) {
            const impact = environmentalImpacts[index];
            console.log(chalk.blue(`\n${dep}:`));
            displayEnvironmentalImpactTable(impact, `Package: ${dep}`);
          }
        }

        if (parentInfo) {
          const yearlyData = await getYearlyDownloads(parentInfo.name);
          const stats = calculateImpactStats(
            totalDiskSpace,
            totalInstallTime,
            parentInfo.downloads,
            yearlyData,
          );

          const impactTable = new CliTable({
            head: ["Period", "Downloads", "Data Transfer", "Install Time"],
            colWidths: [18, 20, 20, 20],
            wordWrap: true,
            style: { head: ["cyan"], border: ["grey"] },
          });

          if (stats.day) {
            impactTable.push([
              "Day",
              `~${formatNumber(stats.day.downloads)}`,
              formatSize(stats.day.diskSpace),
              formatTime(stats.day.installTime),
            ]);
          }

          if (stats.monthly) {
            // Ensure monthly stats are only added when not a full year
            impactTable.push([
              "Month",
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
              "Last 12 months",
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

          // Add environmental impact recommendations and hero message
          if (totalEnvironmentalImpact) {
            logNewlines();
            console.log(
              chalk.green.bold("Environmental Impact Recommendations:")
            );
            const recommendations = generateEnvironmentalRecommendations(
              totalEnvironmentalImpact,
              unusedDependencies.length,
            );
            for (const rec of recommendations)
              console.log(chalk.green(`  ${rec}`));

            logNewlines();
            displayEnvironmentalHeroMessage(totalEnvironmentalImpact);
          }

          logNewlines();
          console.log(
            `${chalk.yellow(
              "Note:",
            )} These results depend on your system's capabilities.\nTry a multi-architecture analysis at ${chalk.bold(
              "https://github.com/chiefmikey/depsweep/analysis",
            )}`,
          );
        } else {
          logNewlines();
          console.log(
            chalk.yellow("Insufficient download data to calculate impact"),
          );
        }
      }

      if (!options.measureImpact) {
        console.log(
          chalk.blue(
            "Run with the -m, --measure-impact flag to output a detailed impact analysis report",
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

      const answer = await rl.question(chalk.blue(MESSAGES.promptRemove));
      if (answer.toLowerCase() === "y") {
        // Build uninstall command
        let uninstallCommand = "";
        switch (packageManager) {
          case PACKAGE_MANAGERS.NPM: {
            uninstallCommand = `npm uninstall ${unusedDependencies.join(" ")}`;
            break;
          }
          case PACKAGE_MANAGERS.YARN: {
            uninstallCommand = `yarn remove ${unusedDependencies.join(" ")}`;
            break;
          }
          case PACKAGE_MANAGERS.PNPM: {
            uninstallCommand = `pnpm remove ${unusedDependencies.join(" ")}`;
            break;
          }
          default: {
            break;
          }
        }

        // Validate before using in execSync - filter out invalid package names
        unusedDependencies = unusedDependencies.filter((dep) => {
          if (!isValidPackageName(dep)) {
            console.warn(chalk.yellow(`Skipping invalid package name: ${dep}`));
            return false;
          }
          return true;
        });

        if (unusedDependencies.length > 0) {
          try {
            safeExecSync(uninstallCommand.split(" "), {
              stdio: "inherit",
              cwd: projectDirectory,
              timeout: 300_000,
            });
          } catch (error) {
            console.error(chalk.red("Failed to uninstall packages:"), error);
            process.exit(1);
          }
        }
      } else {
        console.log(chalk.blue(MESSAGES.noChangesMade));
      }
      rl.close();
      activeReadline = null;
    }

    // End total execution timer
    performanceMonitor.endTimer("totalExecution");

    // Log final performance summary
    if (options.verbose) {
      const totalTime =
        performanceMonitor.getMetrics().get("totalExecution")?.totalTime || 0;
      console.log(
        chalk.blue(`\nTotal execution time: ${totalTime.toFixed(2)}ms`),
      );
    }
  } catch (error) {
    if (savedConsoleLog) {
      console.log = savedConsoleLog;
    }
    console.error(chalk.red(MESSAGES.fatalError), error);
    cleanup();
    process.exit(1);
  } finally {
    // Clean up isolated clone directory
    if (isolatedCloneDir) {
      try {
        await fs.rm(isolatedCloneDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup
      }
    }
  }
}

// Replace the top-level await with an async init function
async function init(): Promise<void> {
  try {
    // Handle exit signals at the top level
    const exitHandler = (signal: string): void => {
      console.log(MESSAGES.signalCleanup.replace("{0}", signal));
      cleanup();
      // Exit without error since this is an intentional exit
      process.exit(0);
    };

    // Handle both SIGINT (Ctrl+C) and SIGTERM
    process.on("SIGINT", () => {
      exitHandler("SIGINT");
    });
    process.on("SIGTERM", () => {
      exitHandler("SIGTERM");
    });

    await main();
  } catch (error) {
    cleanup();
    console.error(chalk.red(MESSAGES.unexpected), error);
    process.exit(1);
  }
}

// Only run init when this file is executed directly (not imported)
if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  init().catch((error) => {
    console.error(chalk.red(MESSAGES.fatalError), error);
    process.exit(1);
  });
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
