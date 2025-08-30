// Test setup file for DepSweep
import "@jest/globals";

// Mock chalk before any imports
jest.mock("chalk", () => {
  const createColorMock = (prefix: string) => {
    const colorFn = jest.fn((text: string) => `${prefix}:${text}`) as any;
    colorFn.bold = jest.fn((text: string) => `${prefix}_BOLD:${text}`);
    return colorFn;
  };

  return {
    __esModule: true,
    default: {
      green: createColorMock("GREEN"),
      blue: createColorMock("BLUE"),
      yellow: createColorMock("YELLOW"),
      red: createColorMock("RED"),
      cyan: createColorMock("CYAN"),
      magenta: createColorMock("MAGENTA"),
      white: createColorMock("WHITE"),
      gray: jest.fn((text: string) => `GRAY:${text}`),
      dim: jest.fn((text: string) => `DIM:${text}`),
      reset: jest.fn((text: string) => `RESET:${text}`),
      bold: jest.fn((text: string) => `BOLD:${text}`),
    },
  };
});

// Global test configuration
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = "test";

  // Suppress console output during tests unless explicitly needed
  if (process.env.VERBOSE_TESTS !== "true") {
    // Mock console methods before any tests run
    global.console = {
      ...global.console,
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
  }
});

afterAll(() => {
  // Clean up
  jest.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  // Create mock environmental impact data
  createMockEnvironmentalImpact: (overrides = {}) => ({
    carbonSavings: 1.5,
    energySavings: 2.3,
    waterSavings: 15.7,
    treesEquivalent: 0.075,
    carMilesEquivalent: 3.75,
    efficiencyGain: 0.15,
    networkSavings: 0.5,
    storageSavings: 0.3,
    ...overrides,
  }),

  // Create mock package.json for testing
  createMockPackageJson: (dependencies = {}, devDependencies = {}) => ({
    name: "test-project",
    version: "1.0.0",
    dependencies,
    devDependencies,
  }),

  // Wait for async operations
  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Mock file system operations
  mockFileSystem: {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    rmSync: jest.fn(),
  },

  resetConsoleMocks: () => {
    jest.clearAllMocks();
  },

  expectConsoleLog: (expected: string) => {
    const calls = (global.console.log as jest.Mock).mock.calls;
    const found = calls.some((call: any[]) =>
      call.some((arg: any) => String(arg).includes(expected))
    );
    if (!found) {
      throw new Error(
        `Expected console.log to contain "${expected}". Got: ${JSON.stringify(calls)}`
      );
    }
  },

  expectConsoleError: (expected: string) => {
    const calls = (global.console.error as jest.Mock).mock.calls;
    const found = calls.some((call: any[]) =>
      call.some((arg: any) => String(arg).includes(expected))
    );
    if (!found) {
      throw new Error(
        `Expected console.error to contain "${expected}". Got: ${JSON.stringify(calls)}`
      );
    }
  },

  expectConsoleWarn: (expected: string) => {
    const calls = (global.console.warn as jest.Mock).mock.calls;
    const found = calls.some((call: any[]) =>
      call.some((arg: any) => String(arg).includes(expected))
    );
    if (!found) {
      throw new Error(
        `Expected console.warn to contain "${expected}". Got: ${JSON.stringify(calls)}`
      );
    }
  },

  expectConsoleInfo: (expected: string) => {
    const calls = (global.console.info as jest.Mock).mock.calls;
    const found = calls.some((call: any[]) =>
      call.some((arg: any) => String(arg).includes(expected))
    );
    if (!found) {
      throw new Error(
        `Expected console.info to contain "${expected}". Got: ${JSON.stringify(calls)}`
      );
    }
  },
};

// Extend Jest matchers for environmental impact testing
expect.extend({
  toBeValidEnvironmentalImpact(received) {
    const pass =
      received &&
      typeof received.carbonSavings === "number" &&
      typeof received.energySavings === "number" &&
      typeof received.waterSavings === "number" &&
      typeof received.treesEquivalent === "number" &&
      typeof received.carMilesEquivalent === "number" &&
      typeof received.efficiencyGain === "number" &&
      typeof received.networkSavings === "number" &&
      typeof received.storageSavings === "number" &&
      received.carbonSavings >= 0 &&
      received.energySavings >= 0 &&
      received.waterSavings >= 0 &&
      received.treesEquivalent >= 0 &&
      received.carMilesEquivalent >= 0 &&
      received.efficiencyGain >= 0 &&
      received.networkSavings >= 0 &&
      received.storageSavings >= 0;

    if (pass) {
      return {
        message: () =>
          `Expected ${received} not to be a valid environmental impact`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected ${received} to be a valid environmental impact`,
        pass: false,
      };
    }
  },

  toBeWithinRange(received, min, max) {
    const pass = received >= min && received <= max;
    if (pass) {
      return {
        message: () =>
          `Expected ${received} to be within range [${min}, ${max}]`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `Expected ${received} to be within range [${min}, ${max}], but got ${received}`,
        pass: false,
      };
    }
  },
});

// Type declarations for global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidEnvironmentalImpact(): R;
      toBeWithinRange(min: number, max: number): R;
    }
  }

  var testUtils: {
    createMockEnvironmentalImpact: (overrides?: any) => any;
    createMockPackageJson: (dependencies?: any, devDependencies?: any) => any;
    wait: (ms: number) => Promise<void>;
    mockFileSystem: {
      existsSync: jest.Mock;
      readFileSync: jest.Mock;
      writeFileSync: jest.Mock;
      mkdirSync: jest.Mock;
      rmSync: jest.Mock;
    };
    resetConsoleMocks: () => void;
    expectConsoleLog: (expected: string) => void;
    expectConsoleError: (expected: string) => void;
    expectConsoleWarn: (expected: string) => void;
    expectConsoleInfo: (expected: string) => void;
  };
}

export {};
