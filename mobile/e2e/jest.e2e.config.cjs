/**
 * E2E test configuration for device/emulator tests.
 *
 * This config extends jest-expo to run end-to-end scenarios against
 * emulators via @testing-library/react-native with mocked API responses.
 *
 * Usage:
 *   npm run test:e2e          – run all e2e tests
 *   npm run test:e2e:watch    – run in watch mode
 *   npm run test:e2e:ci       – CI mode (single run, JUnit output)
 */

const path = require('path');

module.exports = {
  preset: 'jest-expo',
  rootDir: path.resolve(__dirname, '..'),
  roots: ['<rootDir>/e2e'],
  testMatch: ['**/*.e2e.test.{js,jsx,ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  setupFilesAfterSetup: [],
  testEnvironment: 'node',
  verbose: true,
  maxWorkers: 2,
  // CI options
  ...(process.env.CI === 'true'
    ? {
        reporters: ['default', 'jest-junit'],
        collectCoverage: false,
        ci: true,
      }
    : {}),
};
