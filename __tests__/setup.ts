/**
 * Jest setup file for test configuration
 * Configures fast-check and increases timeout for property-based tests
 */

// Load environment variables from .env files
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import * as fc from "fast-check";

// Configure fast-check defaults for property-based testing
fc.configureGlobal({
  numRuns: 100, // Number of test iterations
  verbose: false, // Don't log each iteration
  endOnFailure: true, // Stop on first failure for faster feedback
});

// Increase Jest timeout for property tests which may need more time
jest.setTimeout(30000);

// Define __DEV__ global for React Native compatibility
// @ts-ignore
global.__DEV__ = true;

// Global test utilities
export {};
