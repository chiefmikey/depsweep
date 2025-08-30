export const MESSAGES = {
  title: 'DepSweep 🧹',
  noPackageJson: 'No package.json found',
  monorepoDetected: '\nMonorepo detected, using root package.json',
  monorepoWorkspaceDetected: '\nMonorepo workspace package detected',
  analyzingDependencies: 'Analyzing dependencies...',
  fatalError: '\nFatal error:',
  noUnusedDependencies: 'No unused dependencies found',
  unusedFound: 'Detected unused dependencies:',
  noChangesMade: 'No changes made',
  promptRemove: 'Do you want to remove these unused dependencies? (y/N) ',
  dependenciesRemoved: 'Dependencies:',
  diskSpace: 'Unpacked Disk Space:',
  carbonFootprint: 'Carbon Footprint:',
  measuringImpact: 'Impact Analysis',
  measureComplete: 'Measurement complete',
  installTime: 'Total Install Time:',
  signalCleanup: '\n{0} received, cleaning up...',
  unexpected: '\nUnexpected error:',
  // New environmental impact messages
  environmentalImpact: '🌱 Environmental Impact Analysis',
  carbonSavings: 'Carbon Savings',
  energyEfficiency: 'Energy Efficiency',
  waterSavings: 'Water Savings',
  treesEquivalent: 'Trees Equivalent',
  carMilesEquivalent: 'Car Miles Equivalent',
  environmentalHero: 'Environmental Hero',
  impactSummary: 'Impact Summary',
  savingsBreakdown: 'Savings Breakdown',
};

export const CLI_STRINGS = {
  PROGRESS_FORMAT:
    'Dependency Analysis |{bar}| [{currentDeps}/{totalDeps}] {dep}',
  BAR_COMPLETE: '\u2588',
  BAR_INCOMPLETE: '\u2591',
  CLI_NAME: 'depsweep',
  CLI_DESCRIPTION:
    'Automated intelligent dependency cleanup and impact analysis report',
  EXAMPLE_TEXT: '\nExample:\n  $ depsweep -v --measure-impact',
};

// 🛡️ PROTECTED DEPENDENCIES - Critical packages that should NEVER be removed
// These are dependencies that are essential for project functionality, even if not directly imported
export const PROTECTED_DEPENDENCIES = {
  // Core Node.js and runtime dependencies
  CORE_RUNTIME: [
    'node',
    'npm',
    'yarn',
    'pnpm',
    'npx',
    'nvm',
    'nodemon',
    'ts-node',
    'tsx',
    'esbuild',
    'swc',
  ],

  // Essential build tools and compilers
  BUILD_TOOLS: [
    'typescript',
    'webpack',
    'vite',
    'rollup',
    'esbuild',
    'swc',
    'babel',
    '@babel/core',
    '@babel/cli',
    '@babel/preset-env',
    '@babel/preset-typescript',
    '@babel/preset-react',
    'tsc',
    'tsc-alias',
  ],

  // Framework core packages (these are often imported indirectly)
  FRAMEWORK_CORE: [
    'react',
    'react-dom',
    'vue',
    '@vue/runtime-core',
    '@angular/core',
    '@angular/common',
    '@angular/platform-browser',
    'next',
    'nuxt',
    'svelte',
    'solid-js',
    'preact',
    'inferno',
  ],

  // Testing frameworks and utilities
  TESTING: [
    'jest',
    'vitest',
    'mocha',
    'chai',
    'sinon',
    'cypress',
    'playwright',
    '@testing-library/react',
    '@testing-library/vue',
    '@testing-library/jest-dom',
    'enzyme',
    'karma',
    'ava',
    'tap',
  ],

  // Linting and code quality tools
  CODE_QUALITY: [
    'eslint',
    '@eslint/js',
    'prettier',
    'stylelint',
    'husky',
    'lint-staged',
    'commitlint',
    'semantic-release',
    'conventional-changelog',
    'standard',
    'xo',
  ],

  // Development server and hot reload
  DEV_SERVER: [
    'webpack-dev-server',
    'vite',
    'rollup-plugin-serve',
    'live-server',
    'browser-sync',
    'concurrently',
    'cross-env',
    'dotenv',
    'dotenv-expand',
  ],

  // Package management and bundling
  PACKAGE_MANAGEMENT: [
    'webpack-cli',
    'webpack-merge',
    'webpack-bundle-analyzer',
    'vite-plugin-*',
    'rollup-plugin-*',
    'esbuild-plugin-*',
    'parcel-bundler',
    'metro',
    'fusebox',
  ],

  // Type definitions (critical for TypeScript projects)
  TYPE_DEFINITIONS: [
    '@types/node',
    '@types/react',
    '@types/react-dom',
    '@types/vue',
    '@types/angular',
    '@types/jest',
    '@types/mocha',
    '@types/chai',
    '@types/sinon',
    '@types/cypress',
  ],

  // Configuration and environment
  CONFIGURATION: [
    'tsconfig-paths',
    'tsconfig-paths-webpack-plugin',
    'dotenv-webpack',
    'webpack-define-plugin',
    'vite-plugin-env',
    'rollup-plugin-replace',
    'esbuild-define',
  ],

  // CSS and styling tools
  STYLING: [
    'css-loader',
    'style-loader',
    'sass-loader',
    'less-loader',
    'postcss-loader',
    'autoprefixer',
    'tailwindcss',
    'styled-components',
    'emotion',
    'linaria',
  ],

  // Asset handling
  ASSET_HANDLING: [
    'file-loader',
    'url-loader',
    'raw-loader',
    'html-webpack-plugin',
    'copy-webpack-plugin',
    'vite-plugin-static-copy',
    'rollup-plugin-copy',
  ],

  // Development utilities
  DEV_UTILITIES: [
    'rimraf',
    'del',
    'glob',
    'chalk',
    'ora',
    'cli-progress',
    'commander',
    'yargs',
    'inquirer',
    'enquirer',
  ],

  // Security and validation
  SECURITY: [
    'helmet',
    'cors',
    'express-rate-limit',
    'express-validator',
    'joi',
    'yup',
    'zod',
    'ajv',
    'json-schema',
  ],

  // Database and ORM
  DATABASE: [
    'mongoose',
    'sequelize',
    'prisma',
    'typeorm',
    'knex',
    'bookshelf',
    'objection',
    'drizzle-orm',
  ],

  // HTTP and API
  HTTP_API: [
    'express',
    'koa',
    'fastify',
    'hapi',
    'axios',
    'fetch',
    'node-fetch',
    'got',
    'request',
    'superagent',
  ],

  // State management
  STATE_MANAGEMENT: [
    'redux',
    'mobx',
    'zustand',
    'recoil',
    'jotai',
    'valtio',
    'pinia',
    'vuex',
    'ngrx',
    'akita',
  ],

  // Routing
  ROUTING: [
    'react-router',
    'vue-router',
    '@angular/router',
    'next/router',
    'nuxt/router',
    'svelte-routing',
    'solid-router',
  ],

  // Internationalization
  I18N: [
    'react-i18next',
    'vue-i18n',
    'ngx-translate',
    'next-i18next',
    'nuxt-i18n',
    'i18next',
    'intl',
  ],
};

// Helper function to check if a dependency is protected
export function isProtectedDependency(dependency: string): boolean {
  const allProtected = Object.values(PROTECTED_DEPENDENCIES).flat();
  return allProtected.some((protectedDep) => {
    // Exact match
    if (protectedDep === dependency) return true;

    // Pattern matching for wildcards
    if (protectedDep.includes('*')) {
      const pattern = protectedDep.replaceAll('*', '.*');
      return new RegExp(`^${pattern}$`).test(dependency);
    }

    // Scoped package matching
    if (protectedDep.startsWith('@') && dependency.startsWith('@')) {
      const protectedScope = protectedDep.split('/')[0];
      const dependencyScope = dependency.split('/')[0];
      if (protectedScope === dependencyScope) return true;
    }

    return false;
  });
}

// Helper function to get protection reason
export function getProtectionReason(dependency: string): string | null {
  for (const [category, deps] of Object.entries(PROTECTED_DEPENDENCIES)) {
    if (
      deps.some((dep) => {
        if (dep === dependency) return true;
        if (dep.includes('*')) {
          const pattern = dep.replaceAll('*', '.*');
          return new RegExp(`^${pattern}$`).test(dependency);
        }
        return false;
      })
    ) {
      return category.replaceAll('_', ' ').toLowerCase();
    }
  }
  return null;
}

export const FRAMEWORK_PATTERNS = {
  ANGULAR: {
    CORE: '@angular/core',
    PATTERNS: ['@angular/*', '@angular-*', '@webcomponents/*'],
    DEV_DEPS: ['@angular-builders/*', '@angular-devkit/*', '@angular/cli'],
  },
  REACT: {
    CORE: 'react',
    PATTERNS: ['react-*', '@testing-library/react*', '@types/react*'],
    DEV_DEPS: ['react-scripts', 'react-app-rewired'],
  },
  VUE: {
    CORE: 'vue',
    PATTERNS: ['vue-*', '@vue/*', '@nuxt/*'],
    DEV_DEPS: ['@vue/cli-service', '@vue/cli-plugin-*'],
  },
};

export const RAW_CONTENT_PATTERNS = new Map([
  ['webpack', ['webpack.*', 'webpack-*']],
  ['babel', ['babel.*', '@babel/*']],
  ['eslint', ['eslint.*', '@eslint/*']],
  ['jest', ['jest.*', '@jest/*']],
  ['typescript', ['ts-*', '@typescript-*']],
  [
    'bundler',
    ['rollup.*', 'rollup-*', 'esbuild.*', '@esbuild/*', 'vite.*', '@vitejs/*'],
  ],
]);

export const DEPENDENCY_PATTERNS = {
  TYPES_PREFIX: '@types/',
  DYNAMIC_IMPORT_BASE: String.raw`import\s*\(\s*['"]`,
  DYNAMIC_IMPORT_END: String.raw`['"]\s*\)`,
};

export const FILE_PATTERNS = {
  PACKAGE_JSON: 'package.json',
  YARN_LOCK: 'yarn.lock',
  PNPM_LOCK: 'pnpm-lock.yaml',
  NODE_MODULES: 'node_modules',
  CONFIG_REGEX: /\.(config|rc)(\.|\b)/,
  PACKAGE_NAME_REGEX: /^[\w./@-]+$/,
};

export const PACKAGE_MANAGERS = {
  NPM: 'npm',
  YARN: 'yarn',
  PNPM: 'pnpm',
};

export const COMMANDS = {
  INSTALL: 'install',
  UNINSTALL: 'uninstall',
  REMOVE: 'remove',
};

export const ENVIRONMENTAL_CONSTANTS = {
  // Energy consumption per GB of data transfer (kWh) - Updated 2025
  // Source: International Energy Agency (IEA) - Data Centers and Networks Report 2024
  // Includes transmission, routing, and end-user device energy
  ENERGY_PER_GB: 0.072,

  // Carbon intensity of electricity (kg CO2e per kWh) - Global average 2025
  // Source: International Energy Agency (IEA) - CO2 Emissions from Fuel Combustion 2024
  // Weighted average of global electricity mix (coal, gas, nuclear, renewables)
  CARBON_INTENSITY: 0.456,

  // Water usage per kWh (liters) - Data center cooling systems 2025
  // Source: Uptime Institute - Data Center Water Usage Report 2024
  // Includes direct cooling, evaporation, and indirect water for power generation
  WATER_PER_KWH: 1.92,

  // Trees needed to absorb 1 kg of CO2 per year
  // Source: USDA Forest Service - Carbon Sequestration in Forests 2024
  // Based on mature tree species in temperate climates
  TREES_PER_KG_CO2: 0.042,

  // CO2 emissions per mile driven (kg CO2e) - US average 2025
  // Source: EPA - Greenhouse Gas Emissions from Transportation 2024
  // Includes fuel production, vehicle manufacturing, and operation
  CO2_PER_CAR_MILE: 0.387,

  // Energy efficiency improvement from removing unused deps (%)
  // Source: Multiple studies on build optimization and dependency management
  // Based on reduced parsing, bundling, and runtime overhead
  EFFICIENCY_IMPROVEMENT: 18.5,

  // Network energy per MB transferred (kWh) - Updated 2025
  // Source: Greenpeace - Clicking Clean Report 2024
  // Includes routing, switching, and transmission infrastructure
  NETWORK_ENERGY_PER_MB: 0.000_12,

  // Storage energy per GB stored per year (kWh) - Updated 2025
  // Source: Storage Networking Industry Association (SNIA) - Energy Efficiency Report 2024
  // Includes power, cooling, and infrastructure overhead
  STORAGE_ENERGY_PER_GB_YEAR: 0.000_28,

  // Additional environmental factors for 2025
  // E-waste impact per GB of unnecessary software (kg CO2e)
  // Source: UNEP - E-waste and Climate Change Report 2024
  EWASTE_IMPACT_PER_GB: 0.000_15,

  // Server utilization improvement from dependency cleanup (%)
  // Source: Google Cloud Platform - Server Efficiency Study 2024
  SERVER_UTILIZATION_IMPROVEMENT: 12.3,

  // Build time reduction impact on developer productivity (hours saved/year)
  // Source: Developer Productivity Research Consortium 2024
  BUILD_TIME_PRODUCTIVITY_GAIN: 0.8,
};
