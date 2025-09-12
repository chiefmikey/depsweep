# DepSweep User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Advanced Features](#advanced-features)
4. [Environmental Impact Analysis](#environmental-impact-analysis)
5. [Configuration](#configuration)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm, yarn, or pnpm package manager
- Git (for version control)

### Installation

Choose your preferred installation method:

#### Global Installation (Recommended)
```bash
npm install -g depsweep
```

#### Project Installation
```bash
npm install --save-dev depsweep
```

#### One-time Usage
```bash
npx depsweep
```

### First Run

Navigate to your project directory and run:

```bash
depsweep --dry-run
```

This will analyze your project and show you what dependencies could be removed without actually making any changes.

## Basic Usage

### Analyzing Dependencies

```bash
# Basic analysis
depsweep

# Preview changes without modifying files
depsweep --dry-run

# Generate environmental impact report
depsweep --measure-impact

# Verbose output for detailed information
depsweep --verbose
```

### Understanding the Output

DepSweep provides clear, actionable output:

```
DepSweep 🧹

Package.json found at: /path/to/your/project/package.json
Dependency Analysis |████████████████████████████████████████| [24/24] ✓

Found 3 unused dependencies:
- lodash (used in 0 files)
- moment (used in 0 files)
- axios (used in 0 files)

🌍 Environmental Impact Analysis
• Carbon Footprint: 0.023 kg CO₂e saved
• Energy Consumption: 0.051 kWh saved
• Water Usage: 0.098 L saved
• Equivalent to: 0.001 trees planted
• Car Miles: 0.059 miles not driven

Would you like to remove these dependencies? (y/N)
```

### Safe Mode

DepSweep runs in safe mode by default, which:
- Protects critical dependencies from removal
- Requires confirmation before making changes
- Provides detailed analysis before removal
- Validates package names and versions

## Advanced Features

### Protected Dependencies

DepSweep automatically protects critical packages:

- **Runtime Dependencies**: Core libraries and frameworks
- **Build Tools**: Compilers, bundlers, and transpilers
- **Testing Frameworks**: Jest, Mocha, Cypress, etc.
- **Code Quality Tools**: ESLint, Prettier, TypeScript
- **Database Drivers**: MongoDB, PostgreSQL, MySQL

### Custom Protection

Protect specific dependencies from removal:

```bash
# Protect specific dependencies
depsweep --safe "react,typescript,eslint"

# Protect with wildcards
depsweep --safe "@types/*,eslint-*"
```

### Ignoring Files and Directories

Exclude specific paths from analysis:

```bash
# Ignore test files and documentation
depsweep --ignore "test/**" "docs/**" "*.spec.js"

# Ignore build outputs
depsweep --ignore "dist/**" "build/**" "coverage/**"
```

### Aggressive Mode

Remove protected dependencies (use with caution):

```bash
depsweep --aggressive
```

**Warning**: Aggressive mode can remove critical dependencies. Always test thoroughly after use.

## Environmental Impact Analysis

### Understanding the Metrics

DepSweep provides scientifically validated environmental impact calculations:

- **Carbon Footprint**: CO₂ emissions saved (kg CO₂e)
- **Energy Consumption**: Energy saved (kWh)
- **Water Usage**: Water saved (liters)
- **Trees Equivalent**: Trees needed to absorb CO₂
- **Car Miles**: Equivalent car miles not driven

### Sample Impact Report

```
🌍 Environmental Impact Analysis

📦 Package: example-package (1.2.3)
📈 Monthly Downloads: 50,000

💡 Potential Savings:
• Carbon Footprint: 2.3 kg CO₂e saved
• Energy Consumption: 5.1 kWh saved
• Water Usage: 9.8 L saved
• Equivalent to: 0.1 trees planted
• Car Miles: 5.9 miles not driven

⚡ Efficiency Gains: 18.5% improvement
```

### Scientific Validation

All calculations are based on peer-reviewed research:
- International Energy Agency (IEA) 2024 data
- EPA transportation emissions data
- USDA Forest Service carbon sequestration studies
- Uptime Institute water usage research

## Configuration

### Configuration Files

Create a `.depsweeprc` file in your project root:

```json
{
  "ignore": ["test/**", "docs/**", "*.spec.js"],
  "safe": ["react", "typescript", "eslint"],
  "measure-impact": true,
  "verbose": false,
  "aggressive": false
}
```

### Package.json Configuration

Add DepSweep configuration to your `package.json`:

```json
{
  "depsweep": {
    "ignore": ["test/**", "docs/**"],
    "safe": ["react", "typescript"],
    "measure-impact": true
  }
}
```

### Environment Variables

Set environment variables for consistent behavior:

```bash
export DEPSWEEP_SAFE_DEPENDENCIES="react,typescript,eslint"
export DEPSWEEP_IGNORE_PATTERNS="test/**,docs/**"
export DEPSWEEP_MEASURE_IMPACT=true
export DEPSWEEP_VERBOSE=false
```

## Best Practices

### Before Running DepSweep

1. **Commit your changes** to version control
2. **Run tests** to ensure everything is working
3. **Backup your project** (optional but recommended)
4. **Review your dependencies** to understand what you're using

### Safe Removal Process

1. **Start with dry-run**: `depsweep --dry-run`
2. **Review the analysis** carefully
3. **Test the changes** in a development environment
4. **Run your test suite** after removal
5. **Deploy to staging** before production

### CI/CD Integration

Add DepSweep to your CI/CD pipeline:

```yaml
# GitHub Actions
- name: Dependency Analysis
  run: depsweep --dry-run --measure-impact
```

### Regular Maintenance

- **Run DepSweep monthly** to catch unused dependencies
- **Review environmental impact** reports
- **Update protected dependencies** as needed
- **Monitor for new unused dependencies**

## Troubleshooting

### Common Issues

#### "No package.json found"
- Ensure you're running DepSweep from the project root
- Check that package.json exists and is valid

#### "Permission denied"
- Ensure you have read/write permissions for the project
- Try running with appropriate user permissions

#### "Out of memory"
- Reduce project size by using `--ignore` patterns
- Increase Node.js memory limit: `node --max-old-space-size=4096`

#### "Analysis timeout"
- Large projects may take longer to analyze
- Consider using `--ignore` to exclude unnecessary files

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Enable all debug logging
DEBUG=depsweep:* depsweep --verbose

# Enable specific debug categories
DEBUG=depsweep:analysis depsweep --verbose
DEBUG=depsweep:environmental depsweep --measure-impact
```

### Performance Issues

If DepSweep is running slowly:

1. **Use ignore patterns** to exclude unnecessary files
2. **Enable no-progress** for CI/CD: `--no-progress`
3. **Increase memory limit** if needed
4. **Consider project size** and complexity

## FAQ

### Q: Is DepSweep safe to use in production?

A: Yes, DepSweep is designed for production use. It includes:
- Built-in protection for critical dependencies
- Safe mode by default
- Comprehensive testing and validation
- Enterprise-grade security features

### Q: Can DepSweep remove dependencies I'm actually using?

A: DepSweep uses sophisticated AST analysis to detect usage, but false positives can occur. Always:
- Review the analysis carefully
- Test after removal
- Use safe mode to protect critical dependencies

### Q: How accurate are the environmental impact calculations?

A: All calculations are based on peer-reviewed scientific research from organizations like the IEA, EPA, and USDA. The methodology is transparent and documented.

### Q: Can I customize which dependencies are protected?

A: Yes, use the `--safe` option or configuration files to specify which dependencies should be protected from removal.

### Q: Does DepSweep work with monorepos?

A: Yes, DepSweep has full support for monorepos and workspaces with npm, yarn, and pnpm.

### Q: How often should I run DepSweep?

A: We recommend running DepSweep monthly or as part of your regular maintenance routine. You can also integrate it into your CI/CD pipeline.

### Q: Can I use DepSweep in CI/CD?

A: Yes, DepSweep is designed for CI/CD integration. Use `--dry-run` mode to analyze without making changes.

### Q: What if DepSweep removes a dependency I need?

A: If this happens:
1. Reinstall the dependency: `npm install <package-name>`
2. Add it to your protected dependencies
3. Report the issue if it's a false positive

## Getting Help

- **GitHub Issues**: [Create an issue](https://github.com/chiefmikey/depsweep/issues)
- **Documentation**: [View docs](https://github.com/chiefmikey/depsweep#readme)
- **Discussions**: [GitHub Discussions](https://github.com/chiefmikey/depsweep/discussions)

---

*This guide is regularly updated. Check back for the latest information.*



