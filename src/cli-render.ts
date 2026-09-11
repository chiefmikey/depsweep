/* eslint-disable unicorn/filename-case -- kebab-case is the deliberate module naming convention for this CLI tool */
import path from 'node:path';

import chalk from 'chalk';
import CliTable from 'cli-table3';
import ora, { type Ora } from 'ora';

import { MESSAGES } from './constants.js';
import {
  calculateGlobalImpact,
  getPackageMetadata,
  resolveTransitiveSize,
} from './global-impact.js';
import {
  formatNumber,
  formatSize,
  getParentPackageDownloads,
} from './helpers.js';
import type { GlobalImpact, UnusedDepInfo } from './interfaces.js';

// ────────────────────────────────────────────────────
// Verbose dependency table
// ────────────────────────────────────────────────────

interface VerboseTableContext {
  depInfoMap: Map<
    string,
    { usedInFiles: string[]; requiredByPackages: Set<string> }
  >;
  projectDirectory: string;
  sortedDeps: string[];
  unusedDeps: string[];
}

export function renderVerboseTable(context: VerboseTableContext): void {
  const { depInfoMap, projectDirectory, sortedDeps, unusedDeps } = context;

  const table = new CliTable({
    colWidths: [25, 35, 20],
    head: ['Dependency', 'Direct Usage', 'Required By'],
    style: { border: ['grey'], head: ['cyan'] },
    wordWrap: true,
  });

  // Build the "required-by" label outside the loop so the function
  // reference is stable and no-loop-func cannot fire.
  const labelDep = (dep: string): string =>
    unusedDeps.includes(dep) ? `${dep} ${chalk.blue('(unused)')}` : dep;

  for (const dep of sortedDeps) {
    const info = depInfoMap.get(dep);
    if (info !== undefined) {
      const fileUsage =
        info.usedInFiles.length > 0
          ? info.usedInFiles
              .map((f) => path.relative(projectDirectory, f))
              .join('\n')
          : chalk.gray('-');
      const requiredBy =
        info.requiredByPackages.size > 0
          ? [...info.requiredByPackages].map(labelDep).join(', ')
          : chalk.gray('-');
      table.push([dep, fileUsage, requiredBy]);
    }
  }

  console.log(table.toString());
}

// ────────────────────────────────────────────────────
// Impact resolution
// ────────────────────────────────────────────────────

interface ImpactContext {
  unusedDeps: string[];
  packageJson: Record<string, unknown>;
  parentDownloads: number;
  quickCheck: boolean;
}

export async function resolveImpactForDeps(
  context: ImpactContext,
): Promise<UnusedDepInfo[]> {
  const { packageJson, parentDownloads, quickCheck, unusedDeps } = context;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- packageJson.dependencies is unknown from JSON.parse; shape is always a string-keyed record in valid package.json
  const depsRecord = (packageJson.dependencies ?? {}) as Record<
    string,
    unknown
  >;
  const depSet = new Set(Object.keys(depsRecord));

  const metadataResults = await Promise.all(
    unusedDeps.map((dep) => getPackageMetadata(dep)),
  );

  const results: UnusedDepInfo[] = [];

  for (const [index, dep] of unusedDeps.entries()) {
    const category: 'dependency' | 'devDependency' = depSet.has(dep)
      ? 'dependency'
      : 'devDependency';
    // eslint-disable-next-line security/detect-object-injection -- index is from .entries()
    const metadata = metadataResults[index];
    const unpackedSize = metadata?.unpackedSize ?? 0;

    let impact: GlobalImpact | null = null;
    if (
      category === 'dependency' &&
      parentDownloads > 0 &&
      unpackedSize > 0 &&
      metadata !== null &&
      metadata !== undefined
    ) {
      // eslint-disable-next-line no-await-in-loop -- sequential to respect npm registry rate limits
      const transitiveDepsSize = await resolveTransitiveSize(
        metadata.dependencies,
        quickCheck,
      );
      impact = calculateGlobalImpact({
        monthlyDownloads: parentDownloads,
        transitiveDepsSize,
        unpackedSize,
      });
    }

    results.push({ category, impact, name: dep, unpackedSize });
  }

  return results;
}

// ────────────────────────────────────────────────────
// Environmental impact report display
// ────────────────────────────────────────────────────

interface ImpactReportContext {
  unusedDepInfos: UnusedDepInfo[];
  verbose: boolean;
}

function renderImpactSources(firstImpact: GlobalImpact): void {
  console.log(chalk.dim('  Sources:'));
  console.log(chalk.dim(`    Downloads:   ${firstImpact.sources.downloads}`));
  console.log(chalk.dim(`    Pkg size:    ${firstImpact.sources.packageSize}`));
  console.log(
    chalk.dim(`    Energy:      ${firstImpact.sources.energyIntensity}`),
  );
  console.log(
    chalk.dim(`    Carbon:      ${firstImpact.sources.carbonIntensity}`),
  );
}

function renderImpactFormula(): void {
  console.log(chalk.dim('  Formula:'));
  console.log(
    chalk.dim(
      '    totalSizeGB     = (unpackedSize + transitiveDepsSize) / 1024^3',
    ),
  );
  console.log(
    chalk.dim(
      '    energyWaste     = monthlyDownloads * totalSizeGB * 0.06 kWh/GB [IEA/LBNL 2024]',
    ),
  );
  console.log(
    chalk.dim(
      '    carbonWaste     = energyWaste * regionalCarbonIntensity [EIA/Ember]',
    ),
  );
  console.log(
    chalk.dim(
      '    waterWaste      = energyWaste * 1.8 L/kWh [Uptime Institute]',
    ),
  );
  console.log(
    chalk.dim(
      '    treesEquivalent = carbonWaste * 0.045 trees/kg [USDA Forest Service]',
    ),
  );
  console.log(
    chalk.dim('    carMiles        = carbonWaste / 0.4 kg/mile [EPA]'),
  );
}

function renderSingleDepImpact(
  dep: UnusedDepInfo & { impact: GlobalImpact },
): void {
  const { impact, name, unpackedSize } = dep;
  console.log(
    chalk.bold(`  ${name}`) +
      chalk.dim(` (dependency) -- ${formatSize(unpackedSize)} unpacked`),
  );
  const installsString = formatNumber(impact.monthlyDownloads);
  const footprintBytes =
    impact.monthlyDownloads * impact.totalSizeGB * 1024 * 1024 * 1024;
  const footprintString = formatSize(footprintBytes);
  const energyString = `${impact.energyWasteKwh.toFixed(1)} kWh/month`;
  const carbonString = `${impact.carbonWasteKg.toFixed(1)} kg CO2e/month`;
  const waterString = `${impact.waterWasteLiters.toFixed(1)} L/month`;
  const milesString = `${impact.carMilesEquivalent.toFixed(0)} miles driven`;
  console.log(
    `    Monthly installs:    ${chalk.yellow(installsString)} ${chalk.dim('(npm)')}`,
  );
  console.log(
    `    Data footprint:      ${chalk.yellow(footprintString)}${chalk.dim('/month')}`,
  );
  console.log(`    Energy waste:        ${chalk.red(energyString)}`);
  console.log(`    Carbon waste:        ${chalk.red(carbonString)}`);
  console.log(`    Water waste:         ${chalk.red(waterString)}`);
  console.log(`    Equivalent to:       ${chalk.yellow(milesString)}`);
  console.log();
}

export function renderImpactReport(context: ImpactReportContext): void {
  const { unusedDepInfos, verbose } = context;

  const depsWithImpact = unusedDepInfos.filter(
    (d): d is UnusedDepInfo & { impact: GlobalImpact } => d.impact !== null,
  );
  const developmentDeps = unusedDepInfos.filter(
    (d) => d.category === 'devDependency',
  );

  if (depsWithImpact.length > 0) {
    console.log();
    console.log(chalk.green.bold('Global Environmental Impact'));
    console.log(
      chalk.dim(
        '  All data from npm APIs and published research. Zero assumptions.\n',
      ),
    );

    for (const dep of depsWithImpact) {
      renderSingleDepImpact(dep);
    }

    renderImpactSources(depsWithImpact[0].impact);

    if (verbose) {
      console.log();
      renderImpactFormula();
    }
  }

  if (developmentDeps.length > 0) {
    console.log();
    console.log(chalk.blue.bold('Unused Dev Dependencies (no global impact):'));
    for (const dep of developmentDeps) {
      const sizeLabel = chalk.dim(
        ` -- ${formatSize(dep.unpackedSize)} unpacked`,
      );
      console.log(`  ${dep.name}${sizeLabel}`);
    }
    console.log(chalk.dim('  devDependencies are not installed by consumers.'));
  }

  if (depsWithImpact.length === 0 && developmentDeps.length === 0) {
    console.log();
    console.log(
      chalk.yellow(
        'No impact data available (package may not be published to npm)',
      ),
    );
  }
}

// Handler for measuring impact
export async function handleMeasureImpact(options: {
  unusedDependencies: string[];
  packageJson: Record<string, unknown>;
  packageJsonPath: string;
  verbose: boolean;
}): Promise<void> {
  const { packageJson, packageJsonPath, unusedDependencies, verbose } = options;

  const measureSpinner: Ora = ora({
    spinner: 'dots',
    text: MESSAGES.measuringImpact,
  }).start();

  const parentInfo = await getParentPackageDownloads(packageJsonPath, verbose);
  const parentDownloads = parentInfo?.downloads ?? 0;

  const unusedDepInfos = await resolveImpactForDeps({
    packageJson,
    parentDownloads,
    quickCheck: false,
    unusedDeps: unusedDependencies,
  });

  const totalPackages = unusedDependencies.length;
  for (let index = 0; index < totalPackages; index++) {
    // eslint-disable-next-line security/detect-object-injection -- index is from numeric for-loop
    measureSpinner.text = `${MESSAGES.measuringImpact} [${index + 1}/${totalPackages}] ${unusedDependencies[index]}`;
  }

  measureSpinner.stop();
  console.log(
    `${MESSAGES.measuringImpact} [${totalPackages}/${totalPackages}] ${chalk.green('done')}`,
  );

  renderImpactReport({
    unusedDepInfos,
    verbose,
  });
}
