# DepSweep User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Advanced Configuration](#advanced-configuration)
4. [Environmental Impact](#environmental-impact)
5. [Safety Features](#safety-features)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

## Getting Started

### Installation

```bash
# Global installation
npm install -g depsweep

# Verify installation
depsweep --version
```

### First Run

```bash
# Navigate to your project
cd /path/to/your/project

# Run basic analysis
depsweep --measure-impact --dry-run
```

## Basic Usage

### Standard Analysis

```bash
# Analyze dependencies and measure environmental impact
depsweep --measure-impact --dry-run
```

### Verbose Output

```bash
# Get detailed information about the analysis
depsweep --measure-impact --dry-run --verbose
```

### Help and Version

```bash
# Get help
depsweep --help

# Check version
depsweep --version
```

## Advanced Configuration

### Ignore Patterns

Exclude specific directories or files from analysis:

```bash
# Ignore test and documentation directories
depsweep --ignore "tests/**,docs/**" --measure-impact --dry-run

# Ignore specific file types
depsweep --ignore "*.test.js,*.spec.js" --measure-impact --dry-run

# Multiple ignore patterns
depsweep --ignore "tests/**,docs/**,*.test.js" --measure-impact --dry-run
```

### Safe Dependencies

Protect specific packages from removal:

```bash
# Protect specific packages
depsweep --safe "lodash,moment,axios" --measure-impact --dry-run

# Protect with ignore patterns
depsweep --safe "lodash" --ignore "tests/**" --measure-impact --dry-run
```

### Aggressive Mode

Remove protected dependencies (use with caution):

```bash
# Aggressive cleanup
depsweep --measure-impact --aggressive --dry-run

# Aggressive with safe dependencies
depsweep --measure-impact --aggressive --safe "express" --dry-run
```

### No Progress Bar

Cleaner output for scripts and CI:

```bash
# Disable progress bar
depsweep --measure-impact --dry-run --no-progress
```

## Environmental Impact

### Understanding the Metrics

DepSweep calculates several environmental impact metrics:

- **Carbon Savings**: CO2 equivalent reduction in kg
- **Energy Savings**: Reduced data center energy consumption in kWh
- **Water Savings**: Reduced cooling water usage in liters
- **Tree Equivalents**: Trees that would need to be planted to offset carbon
- **Car Miles**: Equivalent miles driven to produce the same CO2
- **Efficiency Gain**: Performance improvement percentage

### Example Output

```
Environmental Impact Analysis

Total Environmental Impact
┌─────────────────────────┬────────────────────┬───────────────────────────────────┐
│ Metric                  │ Value              │ Impact                            │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Carbon Savings          │ 0.492 kg CO2e      │ Equivalent to 0.02 trees/year     │
│                         │                    │ trees planted                     │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Energy Savings          │ 1.273 kWh          │ Reduced data center energy        │
│                         │                    │ consumption                       │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Water Savings           │ 2.4 L              │ Reduced data center cooling needs │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Car Miles Equivalent    │ 1.3 miles          │ CO2 savings equivalent to driving │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Efficiency Gain         │ 18.5%              │ Improved build and runtime        │
│                         │                    │ performance                       │
└─────────────────────────┴────────────────────┴───────────────────────────────────┘
```

### Per-Package Analysis

Each unused dependency gets its own environmental impact breakdown:

```
Per-Package Environmental Impact:

lodash:

Package: lodash
┌─────────────────────────┬────────────────────┬───────────────────────────────────┐
│ Metric                  │ Value              │ Impact                            │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Carbon Savings          │ 0.098 kg CO2e      │ Equivalent to 0.00 trees/year     │
│                         │                    │ trees planted                     │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Energy Savings          │ 0.253 kWh          │ Reduced data center energy        │
│                         │                    │ consumption                       │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Water Savings           │ 0.5 L              │ Reduced data center cooling needs │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Car Miles Equivalent    │ 0.3 miles          │ CO2 savings equivalent to driving │
├─────────────────────────┼────────────────────┼───────────────────────────────────┤
│ Efficiency Gain         │ 18.5%              │ Improved build and runtime        │
│                         │                    │ performance                       │
└─────────────────────────┴────────────────────┴───────────────────────────────────┘
```

## Safety Features

### Protected Dependencies

DepSweep automatically protects critical dependencies:

- **Runtime Dependencies**: express, react, vue, angular
- **Build Tools**: webpack, typescript, babel
- **Testing Frameworks**: jest, mocha, cypress
- **Code Quality**: eslint, prettier, husky

### Safe Dependencies

Protect specific packages from removal:

```bash
# Protect specific packages
depsweep --safe "lodash,moment,axios" --measure-impact --dry-run
```

### Dry Run Mode

Always test before making changes:

```bash
# Safe - no changes made
depsweep --measure-impact --dry-run

# Actually removes dependencies (use with caution)
depsweep --measure-impact
```

## Troubleshooting

### Common Issues

#### "No package.json found"
- Ensure you're running depsweep from a project directory
- Check that package.json exists in the current directory

#### "Permission denied"
- Ensure you have read/write permissions for the project directory
- On Unix systems, you may need to use `sudo` for global installation

#### "Command not found"
- Ensure depsweep is installed globally: `npm install -g depsweep`
- Check your PATH environment variable
- Try using `npx depsweep` instead

#### "Out of memory"
- For very large projects, try using ignore patterns to reduce scope
- Close other applications to free up memory
- Consider analyzing subdirectories separately

### Debug Mode

Enable verbose output for debugging:

```bash
# Verbose output
depsweep --measure-impact --dry-run --verbose

# Check specific files
depsweep --ignore "src/**" --measure-impact --dry-run --verbose
```

### Performance Issues

For large projects, optimize performance:

```bash
# Ignore large directories
depsweep --ignore "node_modules/**,dist/**,coverage/**" --measure-impact --dry-run

# Disable progress bar for scripts
depsweep --measure-impact --dry-run --no-progress
```

## Best Practices

### 1. Always Use Dry Run First

```bash
# Test before making changes
depsweep --measure-impact --dry-run

# Review the output carefully
# Then run without --dry-run if satisfied
depsweep --measure-impact
```

### 2. Use Safe Dependencies

Protect important packages:

```bash
# Protect critical dependencies
depsweep --safe "express,react,lodash" --measure-impact --dry-run
```

### 3. Ignore Test and Build Directories

```bash
# Ignore common non-source directories
depsweep --ignore "tests/**,dist/**,coverage/**,docs/**" --measure-impact --dry-run
```

### 4. Regular Analysis

Run depsweep regularly to keep your project clean:

```bash
# Add to package.json scripts
{
  "scripts": {
    "depsweep": "depsweep --measure-impact --dry-run",
    "depsweep:clean": "depsweep --measure-impact"
  }
}
```

### 5. CI/CD Integration

Integrate with your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run DepSweep
  run: |
    npm install -g depsweep
    depsweep --measure-impact --dry-run --no-progress
```

## FAQ

### Q: Is it safe to remove unused dependencies?

A: Generally yes, but always use `--dry-run` first to review what will be removed. Some dependencies might be used in ways that aren't easily detected (e.g., dynamic imports, configuration files).

### Q: What if I accidentally remove a needed dependency?

A: You can always reinstall it with `npm install <package-name>`. DepSweep's protected dependencies help prevent this, but always test your application after cleanup.

### Q: How accurate is the environmental impact calculation?

A: The calculations are based on industry-standard metrics for data center energy consumption and carbon intensity. They provide a good estimate of the environmental impact.

### Q: Can I use DepSweep with monorepos?

A: Yes! DepSweep automatically detects and analyzes monorepos with workspaces (Lerna, Yarn, pnpm).

### Q: Does DepSweep work with all package managers?

A: DepSweep works with npm, Yarn, and pnpm. It automatically detects the package manager used in your project.

### Q: How can I contribute to DepSweep?

A: Check out our [Contributing Guide](../CONTRIBUTING.md) and [GitHub repository](https://github.com/yourusername/depsweep).

### Q: Where can I get help?

A:
- Check the [GitHub Issues](https://github.com/yourusername/depsweep/issues)
- Join our [Discussions](https://github.com/yourusername/depsweep/discussions)
- Read the [API Documentation](API.md)

---

**DepSweep - Optimizing dependencies, reducing waste, building sustainably**
