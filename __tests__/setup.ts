/**
 * Jest setup file for test configuration
 * Configures fast-check and increases timeout for property-based tests
 */

import * as fc from "fast-check";

// Configure fast-check defaults for property-based testing
fc.configureGlobal({
  numRuns: 100, // Number of test iterations
  verbose: false, // Don't log each iteration
  endOnFailure: true, // Stop on first failure for faster feedback
});

// Increase Jest timeout for property tests which may need more time
jest.setTimeout(30000);

// Global test utilities
export {};
