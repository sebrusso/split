module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'components/**/*.tsx',
    '!lib/supabase.ts',
  ],
  coverageDirectory: 'coverage',
  // Coverage thresholds for quality gates
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  // Setup file for fast-check and test configuration
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  verbose: true,
  // Transform for React Native/Expo components
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  // Transform Expo and React Native packages that use ESM
  transformIgnorePatterns: [
    'node_modules/(?!(expo-crypto|expo-file-system|expo-sharing|expo-modules-core|@expo|base64-js|react-native|@react-native)/)',
  ],
  // Mock React Native modules for component tests
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__tests__/__mocks__/react-native.ts',
    '^expo-secure-store$': '<rootDir>/__tests__/__mocks__/expo-secure-store.ts',
    '^expo-crypto$': '<rootDir>/__tests__/__mocks__/expo-crypto.ts',
    '^expo-file-system/next$': '<rootDir>/__tests__/__mocks__/expo-file-system.ts',
    '^expo-file-system$': '<rootDir>/__tests__/__mocks__/expo-file-system.ts',
    '^expo-sharing$': '<rootDir>/__tests__/__mocks__/expo-sharing.ts',
    '^(\\.\\./)+lib/clerk$': '<rootDir>/__tests__/__mocks__/clerk.ts',
  },
};
