# DepSweep API Reference

## Overview

DepSweep provides both a command-line interface and a programmatic API for dependency analysis and optimization.

## Command Line Interface

### Basic Usage

```bash
depsweep [options]
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--verbose` | `-v` | Display detailed analysis information | `false` |
| `--aggressive` | `-a` | Allow removal of protected dependencies | `false` |
| `--safe <deps>` | `-s` | Comma-separated list of dependencies to protect | `[]` |
| `--ignore <paths>` | `-i` | File patterns to ignore during analysis | `[]` |
| `--measure-impact` | `-m` | Generate environmental impact report | `false` |
| `--dry-run` | `-d` | Preview changes without modifying files | `false` |
| `--no-progress` | `-n` | Disable progress indicators | `false` |
| `--version` | | Display version information | |
| `--help` | `-h` | Display help information | |

### Examples

```bash
# Basic analysis
depsweep

# Preview changes with environmental impact
depsweep --dry-run --measure-impact

# Safe mode with custom protected dependencies
depsweep --safe "react,typescript,eslint"

# Ignore specific paths
depsweep --ignore "test/**" "docs/**" "*.spec.js"

# Verbose output for debugging
depsweep --verbose --dry-run
```

## Programmatic API

### Installation

```bash
npm install depsweep
```

### Basic Usage

```typescript
import { analyzeDependencies, removeDependencies } from 'depsweep';

// Analyze dependencies
const analysis = await analyzeDependencies({
  projectPath: './src',
  measureImpact: true,
  safeMode: true
});

// Remove unused dependencies
const result = await removeDependencies({
  dependencies: analysis.unusedDependencies,
  dryRun: true
});
```

### API Reference

#### `analyzeDependencies(options)`

Analyzes project dependencies and returns detailed analysis results.

**Parameters:**
- `options.projectPath` (string): Path to the project directory
- `options.measureImpact` (boolean): Whether to calculate environmental impact
- `options.safeMode` (boolean): Whether to enable safe mode
- `options.ignorePatterns` (string[]): File patterns to ignore
- `options.protectedDependencies` (string[]): Dependencies to protect

**Returns:** `Promise<AnalysisResult>`

```typescript
interface AnalysisResult {
  unusedDependencies: string[];
  usedDependencies: string[];
  protectedDependencies: string[];
  environmentalImpact?: EnvironmentalImpact;
  analysisTime: number;
  memoryUsage: number;
}
```

#### `removeDependencies(options)`

Removes specified dependencies from the project.

**Parameters:**
- `options.dependencies` (string[]): Dependencies to remove
- `options.dryRun` (boolean): Whether to preview changes only
- `options.packageManager` (string): Package manager to use ('npm', 'yarn', 'pnpm')

**Returns:** `Promise<RemovalResult>`

```typescript
interface RemovalResult {
  removedDependencies: string[];
  failedRemovals: string[];
  commands: string[];
  success: boolean;
}
```

#### `calculateEnvironmentalImpact(metrics)`

Calculates environmental impact for given metrics.

**Parameters:**
- `metrics.diskSpace` (number): Disk space in bytes
- `metrics.installTime` (number): Install time in seconds
- `metrics.monthlyDownloads` (number): Monthly download count

**Returns:** `EnvironmentalImpact`

```typescript
interface EnvironmentalImpact {
  carbonSavings: number; // kg CO2e
  energySavings: number; // kWh
  waterSavings: number; // liters
  treesEquivalent: number;
  carMilesEquivalent: number;
  efficiencyGain: number; // percentage
  networkSavings: number; // kWh
  storageSavings: number; // kWh
}
```

### Advanced Usage

#### Custom Configuration

```typescript
import { DepSweep } from 'depsweep';

const depsweep = new DepSweep({
  projectPath: './src',
  config: {
    ignorePatterns: ['test/**', 'docs/**'],
    protectedDependencies: ['react', 'typescript'],
    measureImpact: true,
    verbose: true
  }
});

const results = await depsweep.analyze();
```

#### Event Handling

```typescript
import { DepSweep } from 'depsweep';

const depsweep = new DepSweep({
  projectPath: './src'
});

depsweep.on('progress', (progress) => {
  console.log(`Progress: ${progress.percentage}%`);
});

depsweep.on('dependency-analyzed', (dependency) => {
  console.log(`Analyzed: ${dependency.name}`);
});

depsweep.on('complete', (results) => {
  console.log('Analysis complete:', results);
});

await depsweep.analyze();
```

#### Error Handling

```typescript
import { DepSweep, DepSweepError } from 'depsweep';

try {
  const depsweep = new DepSweep({ projectPath: './src' });
  const results = await depsweep.analyze();
} catch (error) {
  if (error instanceof DepSweepError) {
    console.error('DepSweep error:', error.message);
    console.error('Code:', error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Configuration Files

### `.depsweeprc`

```json
{
  "ignore": ["test/**", "docs/**", "*.spec.js"],
  "safe": ["react", "typescript", "eslint"],
  "measure-impact": true,
  "verbose": false,
  "aggressive": false
}
```

### `package.json` Configuration

```json
{
  "depsweep": {
    "ignore": ["test/**", "docs/**"],
    "safe": ["react", "typescript"],
    "measure-impact": true
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEPSWEEP_SAFE_DEPENDENCIES` | Comma-separated protected dependencies | `[]` |
| `DEPSWEEP_IGNORE_PATTERNS` | Comma-separated ignore patterns | `[]` |
| `DEPSWEEP_MEASURE_IMPACT` | Enable environmental impact analysis | `false` |
| `DEPSWEEP_VERBOSE` | Enable verbose output | `false` |
| `DEPSWEEP_DRY_RUN` | Enable dry run mode | `false` |

## Error Codes

| Code | Description |
|------|-------------|
| `EINVALID_PROJECT` | Invalid project path |
| `ENO_PACKAGE_JSON` | No package.json found |
| `EINVALID_DEPENDENCY` | Invalid dependency name |
| `EPROTECTED_DEPENDENCY` | Attempted to remove protected dependency |
| `EANALYSIS_FAILED` | Dependency analysis failed |
| `EREMOVAL_FAILED` | Dependency removal failed |

## Performance Considerations

### Memory Usage
- Typical memory usage: 50-200MB
- Large projects may require 500MB+
- Memory usage scales with project size

### Analysis Time
- Small projects (< 50 deps): 2-5 seconds
- Medium projects (50-200 deps): 5-15 seconds
- Large projects (200+ deps): 15-60 seconds

### Optimization Tips
1. Use `--ignore` to exclude unnecessary files
2. Enable `--no-progress` for CI/CD environments
3. Use `--dry-run` for analysis without changes
4. Consider project size when setting timeouts

## Troubleshooting

### Common Issues

**"No package.json found"**
- Ensure you're running DepSweep from the project root
- Check that package.json exists and is valid

**"Permission denied"**
- Ensure you have read/write permissions for the project
- Try running with appropriate user permissions

**"Out of memory"**
- Reduce project size by using `--ignore` patterns
- Increase Node.js memory limit: `node --max-old-space-size=4096`

**"Analysis timeout"**
- Large projects may take longer to analyze
- Consider using `--ignore` to exclude unnecessary files

### Debug Mode

```bash
# Enable debug logging
DEBUG=depsweep:* depsweep --verbose

# Enable specific debug categories
DEBUG=depsweep:analysis depsweep --verbose
DEBUG=depsweep:environmental depsweep --measure-impact
```

## Support

For API-related questions or issues:
- **GitHub Issues**: [Create an issue](https://github.com/chiefmikey/depsweep/issues)
- **Documentation**: [View docs](https://github.com/chiefmikey/depsweep#readme)
- **Discussions**: [GitHub Discussions](https://github.com/chiefmikey/depsweep/discussions)



