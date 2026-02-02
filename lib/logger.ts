/**
 * Production-safe logging utility
 * Logs to console in development, sends errors to Sentry in production
 */

import * as Sentry from "@sentry/react-native";

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
    // In production, send warnings as breadcrumbs for context
    if (!__DEV__) {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      Sentry.addBreadcrumb({
        category: 'logger',
        message,
        level: 'warning',
      });
    }
  },
  error: (...args: unknown[]) => {
    if (__DEV__) {
      console.error('[ERROR]', ...args);
    }
    // In production, send errors to Sentry
    if (!__DEV__) {
      const firstArg = args[0];
      if (firstArg instanceof Error) {
        Sentry.captureException(firstArg, {
          extra: { additionalArgs: args.slice(1) },
        });
      } else {
        const message = args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        Sentry.captureMessage(message, 'error');
      }
    }
  },
};

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export default logger;
