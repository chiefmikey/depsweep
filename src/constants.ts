export const MESSAGES = {
  title: "DepSweep 🧹",
  noPackageJson: "No package.json found",
  monorepoDetected: "\nMonorepo detected, using root package.json",
  monorepoWorkspaceDetected: "\nMonorepo workspace package detected",
  analyzingDependencies: "Analyzing dependencies...",
  fatalError: "\nFatal error:",
  noUnusedDependencies: "No unused dependencies found",
  unusedFound: "Detected unused dependencies:",
  noChangesMade: "No changes made",
  promptRemove: "Do you want to remove these unused dependencies? (y/N) ",
  dependenciesRemoved: "Dependencies:",
  diskSpace: "Unpacked Disk Space:",
  carbonFootprint: "Carbon Footprint:",
  measuringImpact: "Impact Analysis",
  measureComplete: "Measurement complete",
  installTime: "Total Install Time:",
  signalCleanup: "\n{0} received, cleaning up...",
  unexpected: "\nUnexpected error:",
  // New environmental impact messages
  environmentalImpact: "Environmental Impact Analysis",
  carbonSavings: "Carbon Savings",
  energyEfficiency: "Energy Efficiency",
  waterSavings: "Water Savings",
  treesEquivalent: "Trees Equivalent",
  carMilesEquivalent: "Car Miles Equivalent",
  environmentalHero: "Environmental Hero",
  impactSummary: "Impact Summary",
  savingsBreakdown: "Savings Breakdown",
};

export const CLI_STRINGS = {
  PROGRESS_FORMAT:
    "Dependency Analysis |{bar}| [{currentDeps}/{totalDeps}] {dep}",
  BAR_COMPLETE: "\u2588",
  BAR_INCOMPLETE: "\u2591",
  CLI_NAME: "depsweep",
  CLI_DESCRIPTION:
    "Automated intelligent dependency cleanup and impact analysis report",
  EXAMPLE_TEXT: "\nExample:\n  $ depsweep -v --measure-impact",
};

// 🛡️ PROTECTED DEPENDENCIES - Critical packages that should NEVER be removed
// These are dependencies that are essential for project functionality, even if not directly imported
export const PROTECTED_DEPENDENCIES = {
  // Core Node.js and runtime dependencies
  CORE_RUNTIME: [
    "node",
    "npm",
    "yarn",
    "pnpm",
    "npx",
    "nvm",
    "nodemon",
    "ts-node",
    "tsx",
    "esbuild",
    "swc",
  ],

  // Essential build tools and compilers
  BUILD_TOOLS: [
    "typescript",
    "webpack",
    "vite",
    "rollup",
    "esbuild",
    "swc",
    "babel",
    "@babel/core",
    "@babel/cli",
    "@babel/preset-env",
    "@babel/preset-typescript",
    "@babel/preset-react",
    "tsc",
    "tsc-alias",
  ],

  // Framework core packages (these are often imported indirectly)
  FRAMEWORK_CORE: [
    "react",
    "react-dom",
    "vue",
    "@vue/runtime-core",
    "@angular/core",
    "@angular/common",
    "@angular/platform-browser",
    "next",
    "nuxt",
    "svelte",
    "solid-js",
    "preact",
    "inferno",
  ],

  // Testing frameworks and utilities
  TESTING: [
    "jest",
    "vitest",
    "mocha",
    "chai",
    "sinon",
    "cypress",
    "playwright",
    "@testing-library/react",
    "@testing-library/vue",
    "@testing-library/jest-dom",
    "enzyme",
    "karma",
    "ava",
    "tap",
  ],

  // Linting and code quality tools
  CODE_QUALITY: [
    "eslint",
    "@eslint/js",
    "prettier",
    "stylelint",
    "husky",
    "yorkie",
    "lint-staged",
    "commitlint",
    "semantic-release",
    "conventional-changelog",
    "standard",
    "xo",
  ],

  // Development server and hot reload
  DEV_SERVER: [
    "webpack-dev-server",
    "vite",
    "rollup-plugin-serve",
    "live-server",
    "browser-sync",
    "concurrently",
    "cross-env",
    "dotenv",
    "dotenv-expand",
  ],

  // Package management and bundling
  PACKAGE_MANAGEMENT: [
    "webpack-cli",
    "webpack-merge",
    "webpack-bundle-analyzer",
    "vite-plugin-*",
    "rollup-plugin-*",
    "esbuild-plugin-*",
    "parcel-bundler",
    "metro",
    "fusebox",
  ],

  // Type definitions (critical for TypeScript projects)
  TYPE_DEFINITIONS: [
    "@types/node",
    "@types/react",
    "@types/react-dom",
    "@types/vue",
    "@types/angular",
    "@types/jest",
    "@types/mocha",
    "@types/chai",
    "@types/sinon",
    "@types/cypress",
  ],

  // Configuration and environment
  CONFIGURATION: [
    "tsconfig-paths",
    "tsconfig-paths-webpack-plugin",
    "dotenv-webpack",
    "webpack-define-plugin",
    "vite-plugin-env",
    "rollup-plugin-replace",
    "esbuild-define",
  ],

  // CSS and styling tools
  STYLING: [
    "css-loader",
    "style-loader",
    "sass-loader",
    "less-loader",
    "postcss-loader",
    "autoprefixer",
    "tailwindcss",
    "styled-components",
    "emotion",
    "linaria",
  ],

  // Asset handling
  ASSET_HANDLING: [
    "file-loader",
    "url-loader",
    "raw-loader",
    "html-webpack-plugin",
    "copy-webpack-plugin",
    "vite-plugin-static-copy",
    "rollup-plugin-copy",
  ],

  // Development utilities
  DEV_UTILITIES: [
    "rimraf",
    "del",
    "chalk",
    "ora",
    "cli-progress",
    "commander",
    "yargs",
    "inquirer",
    "enquirer",
  ],

  // Security and validation
  SECURITY: [
    "helmet",
    "cors",
    "express-rate-limit",
    "express-validator",
    "joi",
    "yup",
    "zod",
    "ajv",
    "json-schema",
  ],

  // Database and ORM
  DATABASE: [
    "mongoose",
    "sequelize",
    "prisma",
    "typeorm",
    "knex",
    "bookshelf",
    "objection",
    "drizzle-orm",
  ],

  // HTTP and API
  HTTP_API: [
    "express",
    "koa",
    "fastify",
    "hapi",
    "axios",
    "fetch",
    "node-fetch",
    "got",
    "request",
    "superagent",
  ],

  // State management
  STATE_MANAGEMENT: [
    "redux",
    "mobx",
    "zustand",
    "recoil",
    "jotai",
    "valtio",
    "pinia",
    "vuex",
    "ngrx",
    "akita",
  ],

  // Routing
  ROUTING: [
    "react-router",
    "vue-router",
    "@angular/router",
    "next/router",
    "nuxt/router",
    "svelte-routing",
    "solid-router",
  ],

  // Internationalization
  I18N: [
    "react-i18next",
    "vue-i18n",
    "ngx-translate",
    "next-i18next",
    "nuxt-i18n",
    "i18next",
    "intl",
  ],
};

// Helper function to check if a dependency is protected
export function isProtectedDependency(dependency: string): boolean {
  const allProtected = Object.values(PROTECTED_DEPENDENCIES).flat();
  return allProtected.some((protectedDep) => {
    // Exact match
    if (protectedDep === dependency) return true;

    // Pattern matching for wildcards
    if (protectedDep.includes("*")) {
      const pattern = protectedDep.replaceAll("*", ".*");
      return new RegExp(`^${pattern}$`).test(dependency);
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
        if (dep.includes("*")) {
          const pattern = dep.replaceAll("*", ".*");
          return new RegExp(`^${pattern}$`).test(dependency);
        }
        return false;
      })
    ) {
      return category.replaceAll("_", " ").toLowerCase();
    }
  }
  return null;
}

export const FRAMEWORK_PATTERNS = {
  ANGULAR: {
    CORE: "@angular/core",
    PATTERNS: ["@angular/*", "@angular-*", "@webcomponents/*"],
    DEV_DEPS: ["@angular-builders/*", "@angular-devkit/*", "@angular/cli"],
  },
  REACT: {
    CORE: "react",
    PATTERNS: ["react-*", "@testing-library/react*", "@types/react*"],
    DEV_DEPS: ["react-scripts", "react-app-rewired"],
  },
  VUE: {
    CORE: "vue",
    PATTERNS: ["vue-*", "@vue/*", "@nuxt/*"],
    DEV_DEPS: ["@vue/cli-service", "@vue/cli-plugin-*"],
  },
};

export const RAW_CONTENT_PATTERNS = new Map([
  ["webpack", ["webpack.*", "webpack-*"]],
  ["babel", ["babel.*", "@babel/*"]],
  ["eslint", ["eslint.*", "@eslint/*"]],
  ["jest", ["jest.*", "@jest/*"]],
  ["typescript", ["ts-*", "@typescript-*"]],
  [
    "bundler",
    ["rollup.*", "rollup-*", "esbuild.*", "@esbuild/*", "vite.*", "@vitejs/*"],
  ],
]);

export const DEPENDENCY_PATTERNS = {
  TYPES_PREFIX: "@types/",
  DYNAMIC_IMPORT_BASE: String.raw`import\s*\(\s*['"]`,
  DYNAMIC_IMPORT_END: String.raw`['"]\s*\)`,
};

export const FILE_PATTERNS = {
  PACKAGE_JSON: "package.json",
  YARN_LOCK: "yarn.lock",
  PNPM_LOCK: "pnpm-lock.yaml",
  NODE_MODULES: "node_modules",
  CONFIG_REGEX: /\.(config|rc)(\.|\b)/,
  PACKAGE_NAME_REGEX: /^[\w./@-]+$/,
};

export const PACKAGE_MANAGERS = {
  NPM: "npm",
  YARN: "yarn",
  PNPM: "pnpm",
};

export const COMMANDS = {
  INSTALL: "install",
  UNINSTALL: "uninstall",
  REMOVE: "remove",
};

export const ENVIRONMENTAL_CONSTANTS = {
  // Energy consumption per GB of data transfer (kWh)
  // Sources: IEA Data Centers Report 2024, LBNL US Data Center Energy Report 2024
  // Data center ops ~0.055 kWh/GB + network ~0.059 kWh/GB; 0.06 is midpoint of 0.055-0.066 range
  ENERGY_PER_GB: 0.06,

  // Carbon intensity of electricity (kg CO2e per kWh) - Global average
  // Source: IEA Electricity 2025 report — 2024 global avg was 445 g CO2/kWh
  // https://www.iea.org/reports/electricity-2025/emissions
  CARBON_INTENSITY: 0.445,

  // Water usage per kWh (liters) - Data center cooling + upstream power generation
  // Source: Uptime Institute, industry avg WUE ~1.8 L/kWh (hyperscalers are 0.2-0.3)
  // https://dgtlinfra.com/data-center-water-usage/
  WATER_PER_KWH: 1.8,

  // Trees needed to absorb 1 kg of CO2 per year
  // Source: USDA Forest Service — mature tree absorbs ~22 kg CO2/year → 1/22 ≈ 0.045
  // https://www.fs.usda.gov/about-agency/features/trees-are-climate-change-carbon-storage-heroes
  TREES_PER_KG_CO2: 0.045,

  // CO2 emissions per mile driven (kg CO2e) - US average
  // Source: EPA — typical passenger vehicle emits ~400 g CO2/mile (8,887 g CO2/gal ÷ 22.2 mpg)
  // https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle
  CO2_PER_CAR_MILE: 0.4,

  // Energy efficiency improvement from removing unused deps (%)
  // Note: not currently used in per-package calculations (cannot be meaningfully
  // computed without knowing total project context). Retained for reference.
  EFFICIENCY_IMPROVEMENT: 18.5,

  // Network energy per MB transferred (kWh)
  // Estimate: routing, switching, and transmission infrastructure
  // Note: ENERGY_PER_GB above already includes network costs per IEA/LBNL data,
  // so this constant is retained for reference but not used in totals to avoid double-counting
  NETWORK_ENERGY_PER_MB: 0.000_12,

  // Storage energy per GB stored per year (kWh)
  // Estimate: ~0.3W per TB idle SSD → 0.0003W/GB × 8760h = 2.63 Wh = 0.0026 kWh/GB/year
  STORAGE_ENERGY_PER_GB_YEAR: 0.0026,

  // E-waste impact per GB of unnecessary software (kg CO2e)
  // Estimate: marginal contribution to hardware wear from unnecessary storage
  EWASTE_IMPACT_PER_GB: 0.000_15,

  // Server utilization improvement from dependency cleanup (%)
  // Estimate: marginal improvement from reduced disk/memory footprint
  SERVER_UTILIZATION_IMPROVEMENT: 12.3,

  // Build time reduction impact on developer productivity (hours saved/year)
  // Estimate: developer wait time saved per hour of build time eliminated
  BUILD_TIME_PRODUCTIVITY_GAIN: 0.8,

  // === ADDITIONAL ENVIRONMENTAL FACTORS ===
  // CPU energy per GB processed (kWh)
  // Estimate: ~10W CPU for ~0.05s per GB of package extraction → 0.00015 kWh/GB
  CPU_ENERGY_PER_GB: 0.00015,

  // Memory energy per GB stored (kWh)
  // Estimate: ~1W/GB DRAM active for ~0.3s during install → 0.00008 kWh/GB
  MEMORY_ENERGY_PER_GB: 0.00008,

  // Network latency energy per MB (kWh)
  // Note: included in ENERGY_PER_GB, retained for reference only
  LATENCY_ENERGY_PER_MB: 0.000_08,

  // Build system energy per hour (kWh)
  // Estimate: 2-vCPU cloud CI runner ~15W (share of server power including PUE)
  BUILD_SYSTEM_ENERGY_PER_HOUR: 0.015,

  // CI/CD energy per build (kWh)
  // Estimate: average energy for a full CI build cycle
  CI_CD_ENERGY_PER_BUILD: 0.12,

  // Package registry energy per download (kWh)
  // Estimate: registry serving + CDN delivery per request
  // Note: not used in calculations (removing your dep doesn't reduce global registry load)
  REGISTRY_ENERGY_PER_DOWNLOAD: 0.000_05,

  // === CARBON OFFSET COSTS ===
  // Social Cost of Carbon (USD per kg CO2e)
  // Source: EPA 2024 — Social Cost of Carbon ~$190/tonne = $0.19/kg
  // VCM market avg is ~$6/tonne but SCC better reflects true externality cost
  // https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references
  CARBON_OFFSET_COST_PER_KG: 0.19,

  // === WATER TREATMENT COSTS ===
  // Cost per liter of water treatment (USD)
  // Estimate based on US municipal water treatment costs (~$2.50/m³)
  WATER_TREATMENT_COST_PER_LITER: 0.0025,

  // === RENEWABLE ENERGY FACTORS ===
  // Renewable energy percentage in global grid
  // Source: IRENA Renewable Capacity Statistics 2024 — ~30-32% of global generation
  RENEWABLE_ENERGY_PERCENTAGE: 0.32,

  // === LIFECYCLE ASSESSMENT ===
  // Software lifecycle energy multiplier
  // Note: not currently used in calculations (source unverifiable). Retained for
  // potential future use if a defensible lifecycle model is established.
  LIFECYCLE_ENERGY_MULTIPLIER: 2.1,

  // === REGIONAL VARIATIONS ===
  // North America carbon intensity (kg CO2e per kWh)
  // Source: EIA 2023 — US avg 0.81 lbs CO2/kWh = 0.37 kg/kWh
  // https://www.eia.gov/tools/faqs/faq.php?id=74&t=11
  CARBON_INTENSITY_NA: 0.37,

  // Europe carbon intensity (kg CO2e per kWh)
  // Source: Ember European Electricity Review 2025 — EU avg 213 g CO2/kWh in 2024
  // https://ember-energy.org/latest-insights/european-electricity-review-2025/
  CARBON_INTENSITY_EU: 0.213,

  // Asia Pacific carbon intensity (kg CO2e per kWh)
  // Estimate: generation-weighted avg of China (~565), India (~713), Japan (~450),
  // Australia (~500), South Korea (~415) from Ember 2024 country-level data
  CARBON_INTENSITY_AP: 0.555,

  // === TIME-BASED FACTORS ===
  // Peak energy multiplier (during high demand)
  // Estimate: typical peak-to-average grid ratio ~1.45 (not used in current calculations)
  PEAK_ENERGY_MULTIPLIER: 1.45,

  // Off-peak energy multiplier (during low demand)
  // Estimate: typical off-peak ratio ~0.78 (not used in current calculations)
  OFF_PEAK_ENERGY_MULTIPLIER: 0.78,
};
