/**
 * Sentry Error Monitoring Configuration
 *
 * Provides production error tracking, performance monitoring,
 * and crash reporting for the SplitFree app.
 */

import * as Sentry from "@sentry/react-native";

// Environment detection
const isDev = __DEV__;
const isProduction = !isDev;

/**
 * Initialize Sentry with appropriate configuration
 * Call this at app startup (in _layout.tsx or App.tsx)
 */
export function initSentry(): void {
  // Only initialize in production or if explicitly enabled
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    if (isProduction) {
      console.warn(
        "Sentry DSN not configured. Set EXPO_PUBLIC_SENTRY_DSN in your environment."
      );
    }
    return;
  }

  Sentry.init({
    dsn,
    debug: isDev,
    environment: isDev ? "development" : "production",

    // Performance Monitoring
    tracesSampleRate: isProduction ? 0.2 : 1.0, // 20% in prod, 100% in dev
    profilesSampleRate: isProduction ? 0.1 : 0, // Only profile in production

    // Session Tracking
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,

    // Release Health
    enableNative: true,
    enableNativeCrashHandling: true,

    // Data scrubbing
    beforeSend(event) {
      // Remove sensitive data
      if (event.user) {
        delete event.user.ip_address;
      }

      // Filter out development errors in production
      if (isProduction && event.tags?.environment === "development") {
        return null;
      }

      return event;
    },

    // Integrations
    integrations: [
      Sentry.reactNativeTracingIntegration(),
    ],
  });
}

/**
 * Set user context for error tracking
 * Call after successful authentication
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  username?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Clear user context
 * Call on logout
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for user actions
 * Helps trace the path to an error
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = "info"
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set additional context tags
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Set extra context data
 */
export function setExtra(key: string, value: unknown): void {
  Sentry.setExtra(key, value);
}

/**
 * Capture an exception manually
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info"
): string {
  return Sentry.captureMessage(message, level);
}

/**
 * Start a performance transaction
 * Returns a function to finish the transaction
 */
export function startTransaction(
  name: string,
  operation: string
): () => void {
  const transaction = Sentry.startInactiveSpan({
    name,
    op: operation,
  });

  return () => {
    transaction?.end();
  };
}

/**
 * Wrap a component with Sentry error boundary
 * Provides a fallback for Expo Go where native Sentry isn't available
 */
import React from "react";

interface FallbackErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }> | ((props: { error: Error; resetError: () => void }) => React.ReactNode);
}

interface FallbackErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Fallback error boundary for when Sentry isn't available (e.g., Expo Go)
 */
class FallbackErrorBoundary extends React.Component<
  FallbackErrorBoundaryProps,
  FallbackErrorBoundaryState
> {
  constructor(props: FallbackErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): FallbackErrorBoundaryState {
    return { hasError: true, error };
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback: Fallback } = this.props;
      if (Fallback) {
        if (typeof Fallback === 'function') {
          return <Fallback error={this.state.error} resetError={this.resetError} />;
        }
        return <Fallback error={this.state.error} resetError={this.resetError} />;
      }
      return null;
    }

    return this.props.children;
  }
}

// Use Sentry's ErrorBoundary if available, otherwise use fallback
export const SentryErrorBoundary = Sentry.ErrorBoundary || FallbackErrorBoundary;

/**
 * HOC to wrap screens with Sentry navigation tracking
 * Returns identity function if Sentry.wrap isn't available
 */
export const withSentryScreen = Sentry.wrap || (<T,>(component: T) => component);

// Re-export Sentry for advanced usage
export { Sentry };
