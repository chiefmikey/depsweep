const baseConfig = require('./test/jest.config.js');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/test/**/*.e2e.test.ts'],
  displayName: 'Unit Tests',
};