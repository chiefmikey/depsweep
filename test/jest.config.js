module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
