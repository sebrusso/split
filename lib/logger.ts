/**
 * Production-safe logging utility
 * Only logs in development mode, silently no-ops in production
 */

// __DEV__ is a React Native global that's true in dev builds
declare const __DEV__: boolean;

export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (__DEV__) {
      console.log('[INFO]', ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (__DEV__) {
      console.error('[ERROR]', ...args);
    }
    // In production, you could send to a monitoring service here
  },
};

export default logger;
