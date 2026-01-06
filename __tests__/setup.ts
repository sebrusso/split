/**
 * Jest Test Setup
 *
 * This file runs before each test file and sets up the test environment.
 * It configures global mocks and test utilities.
 */

// Extend Jest matchers if needed
// import '@testing-library/jest-dom';

// Suppress console.log in tests unless explicitly testing console output
// Uncomment to enable:
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   // Keep warn and error for debugging
//   warn: console.warn,
//   error: console.error,
// };

// Mock Date.now() for consistent timestamps in tests
// Useful when testing date-dependent functions
const MOCK_DATE = new Date('2024-01-15T12:00:00Z');

beforeEach(() => {
  // Reset any date mocks
  jest.useFakeTimers();
  jest.setSystemTime(MOCK_DATE);
});

afterEach(() => {
  jest.useRealTimers();
});

// Global test utilities
global.testUtils = {
  /**
   * Wait for all pending promises to resolve
   */
  flushPromises: () => new Promise((resolve) => setTimeout(resolve, 0)),

  /**
   * Create a mock function that resolves after a delay
   */
  delayedResolve: <T>(value: T, ms: number = 100) =>
    jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(value), ms))
    ),

  /**
   * Create a mock function that rejects after a delay
   */
  delayedReject: (error: Error, ms: number = 100) =>
    jest.fn().mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(error), ms))
    ),
};

// Type declarations for global test utilities
declare global {
  var testUtils: {
    flushPromises: () => Promise<void>;
    delayedResolve: <T>(value: T, ms?: number) => jest.Mock;
    delayedReject: (error: Error, ms?: number) => jest.Mock;
  };
}

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
});

export {};
