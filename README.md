# DepSweep 🧹

> Automated dependency cleanup and impact analysis report

[![npm version](https://img.shields.io/npm/v/depsweep.svg)](https://www.npmjs.com/package/depsweep)
[![Downloads](https://img.shields.io/npm/dm/depsweep.svg)](https://www.npmjs.com/package/depsweep)
[![License](https://img.shields.io/npm/l/depsweep.svg)](https://github.com/chiefmikey/depsweep/blob/main/LICENSE)

## Features

Automatically detect and remove unused dependencies

- 🔍 **Smart Detection**: Analyzes your codebase to find unused dependencies.
- 🎯 **AST-Based Analysis**: Uses Abstract Syntax Tree parsing for precise
  detection.
- 🚀 **Modern JS/TS Support**: Supports the latest JavaScript and TypeScript
  features.
- 📦 **Package Manager Compatibility**: Works with npm, yarn, and pnpm.
- 🛡️ **Safe Mode**: Prevents accidental removal of specified dependencies.
- 🏗️ **Monorepo Support**: Seamlessly handles projects within monorepos.
- ⚡ **Efficient Processing**: Utilizes parallel processing for faster analysis.
- 🧩 **Config File Scanning**: Detects dependencies used in configuration files.
- 🔧 **Customizable Ignoring**: Allows specifying directory patterns to exclude
  from scanning.
- 🧠 **Memory Management**: Efficiently manages memory usage during analysis.
- 🏆 **Impact Reporting**: See the impact of removing unused dependencies.
  - 🌱 **Environmental Impact**: **NEW!** Calculate carbon savings, energy
    efficiency, and water conservation.
  - 🏅 **Environmental Hero Awards**: Get recognition for your sustainability
    efforts.

**Supports**:

- ✅ ES Modules and CommonJS
- ✅ TypeScript and JSX
- ✅ Dynamic Imports
- ✅ Configuration Files
- ✅ Workspace Dependencies
- ✅ Binary File Detection
- ✅ Monorepos

## 🌱 Environmental Impact Features

**Why This Matters Now**: With the explosive growth of AI development and
cryptocurrency mining consuming massive amounts of energy worldwide, every
developer has a responsibility to reduce waste. DepSweep helps you make a
tangible difference in your daily development workflow.

DepSweep goes beyond simple dependency cleanup by providing **comprehensive
environmental impact analysis**:

### Carbon Footprint Calculation

- **CO2 Savings**: Calculate how much carbon dioxide you're preventing from
  entering the atmosphere
- **Tree Equivalents**: See how many trees would need to be planted to offset
  your savings
- **Car Miles**: Understand your impact in relatable terms (equivalent miles not
  driven)

### Energy & Resource Conservation

- **Data Center Energy**: Reduce energy consumption in data centers worldwide
- **Water Savings**: Conserve water used for data center cooling systems
- **Network Efficiency**: Minimize unnecessary data transfers across the
  internet
- **Storage Optimization**: Reduce long-term storage energy requirements

### Environmental Recognition

- **Hero Awards**: Earn badges for significant environmental impact
- **Progress Tracking**: See your cumulative environmental contributions
- **Team Motivation**: Inspire your colleagues with concrete environmental
  benefits
- **Sustainability Reporting**: Generate reports for corporate sustainability
  initiatives

### Real-World Impact Examples

- Removing 10 unused packages can save **0.5 kg CO2e** monthly
- That's equivalent to **planting 0.025 trees annually**
- Or **driving 1.2 fewer miles** per month
- **Conserving 0.9 liters of water** monthly

### Example Environmental Impact Report

When you run `depsweep --measure-impact`, you'll see detailed environmental
metrics:

```
🌱 Environmental Impact Analysis

┌─────────────────────────┬────────────────────┬─────────────────────────────────────┐
│ Metric                  │ Value              │ Impact                              │
├─────────────────────────┼────────────────────┼─────────────────────────────────────┤
│ 🌱 Carbon Savings       │ 0.125 kg CO2e      │ Equivalent to 0.006 trees planted  │
│ ⚡ Energy Savings       │ 0.263 kWh          │ Reduced data center consumption     │
│ 💧 Water Savings        │ 0.473 L            │ Reduced data center cooling needs   │
│ 🚗 Car Miles Equivalent │ 0.310 miles       │ CO2 savings equivalent to driving   │
│ 🚀 Efficiency Gain      │ 15%                │ Improved build and runtime perf.    │
└─────────────────────────┴────────────────────┴─────────────────────────────────────┘

💡 Environmental Impact Recommendations:
  🌍 You're saving 0.125 kg CO2e - equivalent to 0.006 trees planted annually!
  ⚡ Energy savings of 0.263 kWh - enough to power a laptop for 2.6 hours!
  💧 Water savings of 0.5L - equivalent to 0.2 water bottles!
  🎯 Removing 5 unused dependencies significantly reduces your project's environmental footprint!
  🚗 Your CO2 savings equal driving 0.3 fewer miles - every bit helps!
  🌟 You're making a real difference! Share your environmental impact with your team to inspire others.

🏆 Environmental Hero Award! 🏆
You're making a significant positive impact on the environment!
```

## Usage

### Single Run

```bash
# Using npx
npx depsweep

# Using yarn
yarn dlx depsweep

# Using pnpm
pnpm dlx depsweep
```

### Install

```bash
# Using npm
npm install -g depsweep

# Using yarn
yarn global add depsweep

# Using pnpm
pnpm add -g depsweep
```

### Options

```txt
  -v, --verbose          Display detailed usage information
  -a, --aggressive       Allow removal of protected dependencies
  -s, --safe <deps>      Dependencies that will not be removed
  -i, --ignore <paths>   Patterns to ignore during scanning
  -m, --measure-impact   Measure unused dependency impact
  -d, --dry-run              Run without making changes
  -n, --no-progress          Disable the progress bar
  --version              Display installed version
  -h, --help             Display help information
```

### Examples

```bash
# Run with verbose output
depsweep --verbose

# Specify dependencies to protect
depsweep --safe react react-dom

# Ignore specific directories or files
depsweep -i "test/**" "scripts/**"

# Preview changes without removing dependencies
depsweep --dry-run
```

## Protected Dependencies

A [list of protected dependencies](src/index.ts#L33) are ignored by default to
prevent accidental removal. Use the `-a, --aggressive` flag to override this
protection. Combine with the `-s, --safe` flag to enable removal for only some
protected dependencies.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an
issue.

## License

MIT © [chief mikey](https://github.com/chiefmikey)
