#!/usr/bin/env node

/**
 * generate-report.js
 *
 * Reads a DepSweep ScanResult JSON (from stdin or a file path argument)
 * and outputs a formatted markdown report to stdout.
 *
 * Usage:
 *   cat scan-result.json | node scripts/generate-report.js
 *   node scripts/generate-report.js scan-result.json
 */

import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(1)} ${units[idx]}`;
}

function formatTime(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '0.00s';
  return `${Number(seconds).toFixed(2)}s`;
}

function formatDate(iso) {
  if (!iso) return 'unknown';
  try {
    const d = new Date(iso);
    return d.toISOString().split('T')[0];
  } catch {
    return 'unknown';
  }
}

function num(v, decimals) {
  if (v == null || Number.isNaN(v)) return '0';
  if (decimals != null) return Number(v).toFixed(decimals);
  return Number(v).toFixed(2);
}

function dollar(v) {
  if (v == null || Number.isNaN(v)) return '$0.00';
  return `$${Number(v).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Report sections
// ---------------------------------------------------------------------------

function buildHeader(data) {
  const lines = [];
  lines.push('# 🧹 DepSweep Scan Report');
  lines.push('');
  lines.push(`**Project:** \`${data.project || 'unknown'}\`  `);
  lines.push(`**Scanned:** ${formatDate(data.timestamp)}  `);
  if (data.packageManager) {
    lines.push(`**Package Manager:** ${data.packageManager}  `);
  }
  if (data.totalDependencies != null) {
    lines.push(`**Total Dependencies:** ${data.totalDependencies}  `);
  }
  return lines.join('\n');
}

function buildCleanReport(data) {
  const lines = [];
  lines.push(buildHeader(data));
  lines.push('');
  lines.push('## ✅ No unused dependencies found!');
  lines.push('');
  const total = data.totalDependencies != null ? data.totalDependencies : '?';
  lines.push(
    `Your project is clean. All ${total} dependencies are being used.`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(buildFooter(data));
  return lines.join('\n');
}

function buildUnusedTable(data) {
  const unused = data.unusedDependencies || [];
  const perPkg = data.impact?.perPackage || {};

  const lines = [];
  lines.push(`## 📦 Unused Dependencies (${unused.length} found)`);
  lines.push('');
  lines.push('| Package | Disk Space | Install Time |');
  lines.push('|---------|-----------|-------------|');

  let totalDisk = 0;
  let totalTime = 0;

  for (const dep of unused) {
    const info = perPkg[dep] || {};
    const disk = info.diskSpace ?? 0;
    const time = info.installTime ?? 0;
    totalDisk += disk;
    totalTime += time;
    lines.push(`| ${dep} | ${formatBytes(disk)} | ${formatTime(time)} |`);
  }

  lines.push(
    `| **Total** | **${formatBytes(totalDisk)}** | **${formatTime(totalTime)}** |`,
  );

  return lines.join('\n');
}

function buildProtectedSection(data) {
  const protected_ = data.protectedDependencies || [];
  if (protected_.length === 0) return '';

  const lines = [];
  lines.push(`### 🛡️ Protected Dependencies (${protected_.length} found)`);
  lines.push('These are kept because they are critical build/runtime tools:');
  for (const dep of protected_) {
    lines.push(`- \`${dep}\``);
  }
  return lines.join('\n');
}

function buildEnvironmentalImpact(data) {
  const env = data.impact?.environmentalImpact;
  if (!env) return '';

  const lines = [];
  lines.push('## 🌱 Environmental Impact');
  lines.push('');
  lines.push('Removing these unused dependencies would save:');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');

  if (env.carbonSavings != null) {
    lines.push(`| 🌱 Carbon Savings | ${num(env.carbonSavings)} kg CO2e |`);
  }
  if (env.energySavings != null) {
    lines.push(`| ⚡ Energy Savings | ${num(env.energySavings, 3)} kWh |`);
  }
  if (env.waterSavings != null) {
    lines.push(`| 💧 Water Savings | ${num(env.waterSavings, 2)} L |`);
  }
  if (env.treesEquivalent != null) {
    lines.push(
      `| 🌳 Trees Equivalent | ${num(env.treesEquivalent)} trees planted |`,
    );
  }
  if (env.carMilesEquivalent != null) {
    lines.push(
      `| 🚗 Car Miles Equivalent | ${num(env.carMilesEquivalent)} miles not driven |`,
    );
  }
  if (env.efficiencyGain != null) {
    lines.push(`| 🚀 Efficiency Gain | ${num(env.efficiencyGain, 1)}% |`);
  }
  if (env.buildTimeReduction != null) {
    lines.push(
      `| ⏱️ Build Time Reduction | ${formatTime(env.buildTimeReduction)} per build |`,
    );
  }
  if (env.developerProductivityGain != null) {
    lines.push(
      `| 👩‍💻 Developer Productivity | ${num(env.developerProductivityGain, 2)} hours saved/year |`,
    );
  }

  return lines.join('\n');
}

function buildFinancialImpact(data) {
  const env = data.impact?.environmentalImpact;
  if (!env) return '';

  const hasFinancial =
    env.carbonOffsetValue != null ||
    env.waterTreatmentValue != null ||
    env.totalFinancialValue != null;
  if (!hasFinancial) return '';

  const lines = [];
  lines.push('### 💰 Financial Impact');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');

  if (env.carbonOffsetValue != null) {
    lines.push(`| Carbon Offset Value | ${dollar(env.carbonOffsetValue)} |`);
  }
  if (env.waterTreatmentValue != null) {
    lines.push(
      `| Water Treatment Value | ${dollar(env.waterTreatmentValue)} |`,
    );
  }
  if (env.totalFinancialValue != null) {
    lines.push(
      `| **Total Savings** | **${dollar(env.totalFinancialValue)}** |`,
    );
  }

  return lines.join('\n');
}

function buildPerPackageBreakdown(data) {
  const unused = data.unusedDependencies || [];
  const perPkg = data.impact?.perPackage || {};

  if (unused.length === 0) return '';

  const lines = [];
  lines.push('## 📊 Per-Package Breakdown');
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Click to expand per-package details</summary>');
  lines.push('');

  for (const dep of unused) {
    const info = perPkg[dep];
    if (!info) continue;

    lines.push(`### ${dep}`);
    if (info.diskSpace != null) {
      lines.push(`- Disk Space: ${formatBytes(info.diskSpace)}`);
    }
    if (info.installTime != null) {
      lines.push(`- Install Time: ${formatTime(info.installTime)}`);
    }

    const envImpact = info.environmentalImpact;
    if (envImpact) {
      if (envImpact.carbonSavings != null) {
        lines.push(`- Carbon Savings: ${num(envImpact.carbonSavings)} kg CO2e`);
      }
      if (envImpact.energySavings != null) {
        lines.push(`- Energy Savings: ${num(envImpact.energySavings)} kWh`);
      }
      if (envImpact.waterSavings != null) {
        lines.push(`- Water Savings: ${num(envImpact.waterSavings)} L`);
      }
      if (envImpact.efficiencyGain != null) {
        lines.push(
          `- Efficiency Gain: ${num(envImpact.efficiencyGain, 1)}%`,
        );
      }
    }
    lines.push('');
  }

  lines.push('</details>');

  return lines.join('\n');
}

function buildFooter(data) {
  const version = data.version || 'latest';
  return `> Generated by [DepSweep](https://github.com/chiefmikey/depsweep) v${version} — Automated dependency cleanup with environmental impact reporting`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function generateReport(data) {
  if (!data || typeof data !== 'object') {
    return '# 🧹 DepSweep Scan Report\n\n> No scan data provided.\n';
  }

  const unused = data.unusedDependencies || [];

  if (unused.length === 0) {
    return buildCleanReport(data);
  }

  const sections = [
    buildHeader(data),
    '---',
    buildUnusedTable(data),
    buildProtectedSection(data),
    '---',
    buildEnvironmentalImpact(data),
    buildFinancialImpact(data),
    '---',
    buildPerPackageBreakdown(data),
    '---',
    buildFooter(data),
  ];

  // Filter out empty sections and join with double newlines
  return sections
    .filter((s) => s.length > 0)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

async function readInput() {
  const filePath = process.argv[2];

  if (filePath) {
    try {
      return readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`Error reading file "${filePath}": ${err.message}`);
      process.exit(1);
    }
  }

  // Read from stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  const raw = await readInput();

  if (!raw || raw.trim().length === 0) {
    console.log('# 🧹 DepSweep Scan Report\n\n> No scan data provided.\n');
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Error parsing JSON: ${err.message}`);
    process.exit(1);
  }

  console.log(generateReport(data));
}

main();
