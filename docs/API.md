# DepSweep API Documentation

## Overview

DepSweep provides a comprehensive API for dependency analysis and environmental impact calculation. This document covers all available functions, interfaces, and configuration options.

## Core Functions

### `calculateEnvironmentalImpact(diskSpace, installTime, monthlyDownloads)`

Calculates the environmental impact of removing unused dependencies.

**Parameters:**
- `diskSpace` (number): Disk space in bytes
- `installTime` (number): Install time in seconds
- `monthlyDownloads` (number): Monthly download count

**Returns:**
```typescript
interface EnvironmentalImpact {
  carbonSavings: number;        // kg CO2e
  energySavings: number;        // kWh
  waterSavings: number;         // liters
  treeEquivalents: number;      // trees per year
  carMilesEquivalent: number;   // miles
  efficiencyGain: number;       // percentage
}
```

**Example:**
```typescript
import { calculateEnvironmentalImpact } from 'depsweep';

const impact = calculateEnvironmentalImpact(
  1024 * 1024 * 1024,  // 1GB
  3600,                // 1 hour
  1000                 // 1000 downloads/month
);

console.log(`Carbon savings: ${impact.carbonSavings} kg CO2e`);
```

### `isDependencyUsedInFile(dependency, filePath, context)`

Checks if a dependency is used in a specific file.

**Parameters:**
- `dependency` (string): Dependency name
- `filePath` (string): File path to check
- `context` (DependencyContext): Analysis context

**Returns:**
- `Promise<boolean>`: True if dependency is used

**Example:**
```typescript
import { isDependencyUsedInFile } from 'depsweep';

const isUsed = await isDependencyUsedInFile(
  'lodash',
  '/path/to/file.js',
  { projectDirectory: '/path/to/project' }
);
```

### `getDependencies(projectDirectory)`

Retrieves all dependencies from a project.

**Parameters:**
- `projectDirectory` (string): Project root directory

**Returns:**
- `Promise<DependencyInfo[]>`: Array of dependency information

**Example:**
```typescript
import { getDependencies } from 'depsweep';

const dependencies = await getDependencies('/path/to/project');
dependencies.forEach(dep => {
  console.log(`${dep.name}: ${dep.version}`);
});
```

## Configuration Interfaces

### `DependencyContext`

Context for dependency analysis.

```typescript
interface DependencyContext {
  projectDirectory: string;
  ignorePatterns?: string[];
  safeDependencies?: string[];
  aggressive?: boolean;
}
```

### `DependencyInfo`

Information about a dependency.

```typescript
interface DependencyInfo {
  name: string;
  version: string;
  isUsed: boolean;
  isProtected: boolean;
  isSafe: boolean;
  usageCount: number;
  usedInFiles: string[];
  requiredByPackages: string[];
  diskSpace: number;
  installTime: number;
  monthlyDownloads?: number;
}
```

### `EnvironmentalImpact`

Environmental impact calculation result.

```typescript
interface EnvironmentalImpact {
  carbonSavings: number;        // kg CO2e
  energySavings: number;        // kWh
  waterSavings: number;         // liters
  treeEquivalents: number;      // trees per year
  carMilesEquivalent: number;   // miles
  efficiencyGain: number;       // percentage
  networkSavings: number;       // MB
  storageSavings: number;       // GB
  buildTimeReduction: number;   // seconds
  developerProductivityGain: number; // hours
}
```

## Utility Functions

### `formatSize(bytes)`

Formats bytes into human-readable size.

**Parameters:**
- `bytes` (number): Size in bytes

**Returns:**
- `string`: Formatted size (e.g., "1.5 MB")

### `formatTime(seconds)`

Formats seconds into human-readable time.

**Parameters:**
- `seconds` (number): Time in seconds

**Returns:**
- `string`: Formatted time (e.g., "2.5 minutes")

### `formatNumber(number)`

Formats numbers with locale-specific formatting.

**Parameters:**
- `number` (number): Number to format

**Returns:**
- `string`: Formatted number (e.g., "1,234.56")

## Constants

### `ENVIRONMENTAL_CONSTANTS`

Environmental calculation constants.

```typescript
const ENVIRONMENTAL_CONSTANTS = {
  CARBON_INTENSITY: 0.5,           // kg CO2e per kWh
  WATER_PER_KWH: 2.5,              // liters per kWh
  TREE_CARBON_CAPACITY: 22,        // kg CO2e per tree per year
  CAR_MILES_PER_KG_CO2: 0.4,       // miles per kg CO2
  NETWORK_ENERGY_PER_MB: 0.001,    // kWh per MB
  STORAGE_ENERGY_PER_GB: 0.002,    // kWh per GB
  // ... more constants
};
```

### `PROTECTED_DEPENDENCIES`

Categories of protected dependencies.

```typescript
const PROTECTED_DEPENDENCIES = {
  RUNTIME: ['express', 'react', 'vue', 'angular'],
  BUILD_TOOLS: ['webpack', 'typescript', 'babel'],
  TESTING: ['jest', 'mocha', 'cypress'],
  CODE_QUALITY: ['eslint', 'prettier', 'husky'],
  // ... more categories
};
```

## CLI Options

### Command Line Interface

```bash
depsweep [options]
```

**Options:**
- `-v, --verbose`: Display detailed usage information
- `-a, --aggressive`: Allow removal of protected dependencies
- `-s, --safe <deps>`: Dependencies that will not be removed
- `-i, --ignore <paths>`: Patterns to ignore during scanning
- `-m, --measure-impact`: Measure unused dependency impact
- `-d, --dry-run`: Run without making changes
- `-n, --no-progress`: Disable the progress bar
- `--version`: Display installed version
- `-h, --help`: Display help for command

## Error Handling

### `DependencyAnalysisError`

Custom error for dependency analysis failures.

```typescript
class DependencyAnalysisError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DependencyAnalysisError';
  }
}
```

### Common Error Codes

- `NO_PACKAGE_JSON`: No package.json found
- `INVALID_PACKAGE_JSON`: Malformed package.json
- `FILE_READ_ERROR`: Cannot read file
- `PARSE_ERROR`: Cannot parse file content
- `NETWORK_ERROR`: Network request failed

## Performance Monitoring

### `PerformanceMonitor`

Tracks operation timing and statistics.

```typescript
class PerformanceMonitor {
  start(operation: string): void;
  end(operation: string): void;
  getStats(): PerformanceStats;
  logSummary(): void;
}
```

### `MemoryOptimizer`

Optimizes memory usage for large projects.

```typescript
class MemoryOptimizer {
  checkMemoryUsage(): MemoryStats;
  optimize(): void;
  getStats(): MemoryStats;
}
```

## Examples

### Basic Usage

```typescript
import {
  calculateEnvironmentalImpact,
  getDependencies,
  isDependencyUsedInFile
} from 'depsweep';

async function analyzeProject(projectPath: string) {
  // Get all dependencies
  const dependencies = await getDependencies(projectPath);

  // Find unused dependencies
  const unusedDeps = dependencies.filter(dep => !dep.isUsed);

  // Calculate environmental impact
  const totalImpact = unusedDeps.reduce((total, dep) => {
    const impact = calculateEnvironmentalImpact(
      dep.diskSpace,
      dep.installTime,
      dep.monthlyDownloads || 0
    );
    return {
      carbonSavings: total.carbonSavings + impact.carbonSavings,
      energySavings: total.energySavings + impact.energySavings,
      waterSavings: total.waterSavings + impact.waterSavings,
      // ... other metrics
    };
  }, { carbonSavings: 0, energySavings: 0, waterSavings: 0 });

  return { unusedDeps, totalImpact };
}
```

### Advanced Configuration

```typescript
import { analyzeProject } from 'depsweep';

const context = {
  projectDirectory: '/path/to/project',
  ignorePatterns: ['tests/**', 'docs/**'],
  safeDependencies: ['lodash', 'moment'],
  aggressive: false
};

const results = await analyzeProject(context);
```

## TypeScript Support

DepSweep is written in TypeScript and provides full type definitions. All interfaces and types are exported from the main module.

```typescript
import type {
  DependencyInfo,
  EnvironmentalImpact,
  DependencyContext
} from 'depsweep';
```

## Browser Support

DepSweep is designed for Node.js environments and requires Node.js >=18.0.0. It uses Node.js-specific APIs and is not compatible with browser environments.

## License

MIT License - see [LICENSE](../LICENSE) for details.
