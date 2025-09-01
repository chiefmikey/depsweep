const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "test/tsconfig.test.json",
        useESM: false,
      },
    ],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/index.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./src/helpers.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./src/constants.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./src/interfaces.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./src/index.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./src/utils.ts": {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testTimeout: 30000,
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverage: true,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};

export default config;
