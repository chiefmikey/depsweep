const baseConfig = require('./test/jest.config.js');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/test/**/*.e2e.test.ts'],
  displayName: 'E2E Tests',
  testTimeout: 60000, // Longer timeout for e2e tests
};