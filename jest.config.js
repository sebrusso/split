module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage collection configuration
  collectCoverageFrom: [
    'lib/**/*.ts',
    'components/**/*.tsx',
    // Exclude files that don't need coverage
    '!lib/supabase.ts',        // Supabase client initialization
    '!lib/types.ts',           // Type definitions only
    '!lib/theme.ts',           // Constants/design tokens
    '!**/index.ts',            // Barrel exports
  ],
  coverageDirectory: 'coverage',

  // Coverage thresholds - enforces minimum coverage
  // Note: Set slightly below current coverage to prevent regressions while allowing small fluctuations
  // Global thresholds set conservatively as some files have lower coverage
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 25,
      lines: 40,
      statements: 40,
    },
    // Higher thresholds for critical utility files that have good coverage
    'lib/utils.ts': {
      branches: 35,
      functions: 75,
      lines: 65,
      statements: 65,
    },
    'lib/splits.ts': {
      branches: 78,
      functions: 95,
      lines: 90,
      statements: 90,
    },
    'lib/categories.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // Verbose output
  verbose: true,

  // Transform for React Native/Expo components
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
  },

  // Mock React Native modules for component tests
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__tests__/__mocks__/react-native.ts',
    '^expo-secure-store$': '<rootDir>/__tests__/__mocks__/expo-secure-store.ts',
  },

  // Setup files that run before each test file
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],

  // Test timeout (useful for async tests)
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Ignore integration tests by default (run with --testPathPattern)
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.test\\.',
  ],
};
