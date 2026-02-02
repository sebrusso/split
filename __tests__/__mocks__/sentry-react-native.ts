/**
 * Mock for @sentry/react-native
 *
 * Provides no-op implementations for testing
 */

export const init = jest.fn();
export const captureException = jest.fn();
export const captureMessage = jest.fn();
export const setUser = jest.fn();
export const setTag = jest.fn();
export const setTags = jest.fn();
export const setContext = jest.fn();
export const setExtra = jest.fn();
export const setExtras = jest.fn();
export const addBreadcrumb = jest.fn();
export const startSpan = jest.fn((options: any, callback: any) => callback());
export const startInactiveSpan = jest.fn();
export const withScope = jest.fn((callback: any) => callback({ setTag: jest.fn() }));
export const getCurrentScope = jest.fn(() => ({
  setTag: jest.fn(),
  setUser: jest.fn(),
}));

export const Severity = {
  Debug: "debug",
  Info: "info",
  Warning: "warning",
  Error: "error",
  Fatal: "fatal",
};

export const reactNativeTracingIntegration = jest.fn(() => ({}));

export default {
  init,
  captureException,
  captureMessage,
  setUser,
  setTag,
  setTags,
  setContext,
  setExtra,
  setExtras,
  addBreadcrumb,
  startSpan,
  startInactiveSpan,
  withScope,
  getCurrentScope,
  Severity,
  reactNativeTracingIntegration,
};
