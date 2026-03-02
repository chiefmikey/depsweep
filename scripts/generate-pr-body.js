#!/usr/bin/env node

/**
 * generate-pr-body.js
 *
 * Reads a DepSweep ScanResult JSON (from stdin or a file path argument)
 * and outputs a PR body in Markdown suitable for submitting as a pull request.
 *
 * Usage:
 *   node scripts/generate-pr-body.js results.json
 *   cat results.json | node scripts/generate-pr-body.js
 */

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(1)} ${units[i]}`;
}

function formatSeconds(seconds) {
  if (seconds == null || isNaN(seconds)) return "—";
  return `${Number(seconds).toFixed(2)}s`;
}

function formatMetric(value, unit) {
  if (value == null || isNaN(value)) return "—";
  return `${Number(value).toFixed(3)} ${unit}`;
}

function plural(n, singular, pluralForm) {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

function detectTestCommand(packageManager) {
  switch (packageManager) {
    case "yarn":
      return "yarn test";
    case "pnpm":
      return "pnpm test";
    default:
      return "npm test";
  }
}

function detectInstallCommand(packageManager) {
  switch (packageManager) {
    case "yarn":
      return "yarn add";
    case "pnpm":
      return "pnpm add";
    default:
      return "npm install";
  }
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function generatePrBody(result) {
  const unused = result.unusedDependencies ?? [];
  const impact = result.impact ?? {};
  const perPackage = impact.perPackage ?? {};
  const env = impact.environmentalImpact ?? {};
  const version = result.version ?? "unknown";
  const packageManager = result.packageManager ?? "npm";
  const count = unused.length;

  const lines = [];

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(
    `## Remove unused ${plural(count, "dependency", "dependencies")}`,
    "",
    `This PR removes **${count} unused ${plural(count, "dependency", "dependencies")}** detected by [DepSweep](https://github.com/chiefmikey/depsweep), an automated dependency cleanup tool with environmental impact reporting.`,
    "",
  );

  // ── Package table ───────────────────────────────────────────────────────
  if (count > 0) {
    lines.push("### What's being removed", "");
    lines.push("| Package | Disk Space | Install Time |");
    lines.push("|---------|-----------|-------------|");

    for (const dep of unused) {
      const pkg = perPackage[dep] ?? {};
      const disk = pkg.diskSpace != null ? formatBytes(pkg.diskSpace) : "—";
      const time =
        pkg.installTime != null ? formatSeconds(pkg.installTime) : "—";
      lines.push(`| \`${dep}\` | ${disk} | ${time} |`);
    }

    // Totals row
    const totalDisk =
      impact.totalDiskSpace != null
        ? formatBytes(impact.totalDiskSpace)
        : "—";
    const totalTime =
      impact.totalInstallTime != null
        ? formatSeconds(impact.totalInstallTime)
        : "—";
    lines.push(`| **Total** | **${totalDisk}** | **${totalTime}** |`);

    lines.push(
      "",
      "These dependencies were scanned against all source files, configuration files, and build scripts in the project. None of them are imported, required, or referenced anywhere in the codebase.",
      "",
    );
  }

  // ── Environmental impact ────────────────────────────────────────────────
  const hasEnv =
    env.carbonSavings != null ||
    env.energySavings != null ||
    env.waterSavings != null;

  if (hasEnv) {
    lines.push("### Environmental Impact", "");
    lines.push(
      "By removing these unused dependencies, every install of this package saves:",
      "",
    );
    lines.push("| Metric | Savings |");
    lines.push("|--------|---------|");

    if (env.carbonSavings != null) {
      lines.push(
        `| Carbon | ${formatMetric(env.carbonSavings, "kg CO2e")} |`,
      );
    }
    if (env.energySavings != null) {
      lines.push(`| Energy | ${formatMetric(env.energySavings, "kWh")} |`);
    }
    if (env.waterSavings != null) {
      lines.push(`| Water | ${formatMetric(env.waterSavings, "L")} |`);
    }

    lines.push(
      "",
      "With your project's download volume, this adds up over time.",
      "",
    );
  }

  // ── Verification ────────────────────────────────────────────────────────
  const testCmd = detectTestCommand(packageManager);
  const installCmd = detectInstallCommand(packageManager);

  lines.push("### How to verify", "");
  lines.push(
    "After merging, run your test suite to confirm everything still works:",
    "",
  );
  lines.push("```");
  lines.push(testCmd);
  lines.push("```");
  lines.push("");
  lines.push(
    "If any dependency was incorrectly flagged, you can re-add it with:",
    "",
  );
  lines.push("```");
  lines.push(`${installCmd} <package-name>`);
  lines.push("```");

  // ── Footer ──────────────────────────────────────────────────────────────
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    `> Generated by [DepSweep](https://github.com/chiefmikey/depsweep) v${version} — Reducing software's environmental footprint, one dependency at a time.`,
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function readInput() {
  const filePath = process.argv[2];

  if (filePath) {
    return readFileSync(filePath, "utf-8");
  }

  // Read from stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  let raw;
  try {
    raw = await readInput();
  } catch (err) {
    console.error(`Error reading input: ${err.message}`);
    process.exit(1);
  }

  if (!raw || !raw.trim()) {
    console.error(
      "No input provided. Pass a JSON file path as an argument or pipe JSON to stdin.",
    );
    process.exit(1);
  }

  let result;
  try {
    result = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON: ${err.message}`);
    process.exit(1);
  }

  const markdown = generatePrBody(result);
  process.stdout.write(markdown + "\n");
}

main();
