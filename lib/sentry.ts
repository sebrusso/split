/**
 * Sentry Error Monitoring Configuration
 *
 * Provides production error tracking, performance monitoring,
 * and crash reporting for the split it. app.
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

  console.log(`[Sentry] Initializing... DSN present: ${!!dsn}, isDev: ${isDev}`);

  if (!dsn) {
    if (isProduction) {
      console.warn(
        "Sentry DSN not configured. Set EXPO_PUBLIC_SENTRY_DSN in your environment."
      );
    }
    return;
  }

  console.log(`[Sentry] Environment: ${isDev ? "development" : "production"}`);
  console.log(`[Sentry] Traces sample rate: ${isProduction ? 0.2 : 1.0}`);

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

  console.log("[Sentry] Initialized successfully!");

  // Send a test event to verify connection
  Sentry.addBreadcrumb({
    category: "app",
    message: "Sentry initialized",
    level: "info",
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
import React, { Component, createElement } from "react";

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
class FallbackErrorBoundary extends Component<
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
        // Use createElement instead of JSX since this is a .ts file
        return createElement(Fallback as React.ComponentType<{ error: Error; resetError: () => void }>, {
          error: this.state.error,
          resetError: this.resetError,
        });
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
export function withSentryScreen<T>(component: T): T {
  return Sentry.wrap ? (Sentry.wrap(component as any) as T) : component;
}

/**
 * Feature-specific Error Boundary
 *
 * Wraps critical features (receipt scanning, payments) with dedicated
 * error boundaries that capture feature context for better debugging.
 */
interface FeatureErrorFallbackProps {
  feature: string;
  error: Error;
  resetError: () => void;
}

/**
 * Default fallback UI for feature error boundaries
 */
function FeatureErrorFallbackComponent({
  feature,
  resetError,
}: FeatureErrorFallbackProps): React.ReactElement {
  return createElement(
    "View",
    {
      style: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: "#F9FAFB",
      },
    },
    createElement(
      "Text",
      {
        style: {
          fontSize: 18,
          fontWeight: "600",
          color: "#1F2937",
          marginBottom: 8,
          textAlign: "center",
        },
      },
      `${feature} Error`
    ),
    createElement(
      "Text",
      {
        style: {
          fontSize: 14,
          color: "#6B7280",
          marginBottom: 16,
          textAlign: "center",
        },
      },
      "Something went wrong. Please try again."
    ),
    createElement(
      "Text",
      {
        style: {
          fontSize: 16,
          color: "#10B981",
          fontWeight: "500",
        },
        onPress: resetError,
      },
      "Try Again"
    )
  );
}

interface FeatureErrorBoundaryProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ComponentType<FeatureErrorFallbackProps>;
}

/**
 * State for the FeatureErrorBoundary class component
 */
interface FeatureErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Feature-specific error boundary class component.
 * Captures errors with feature context for better debugging in Sentry.
 */
class FeatureErrorBoundaryClass extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Capture to Sentry with feature context
    Sentry.withScope((scope) => {
      scope.setTag("feature", this.props.feature);
      scope.setContext("feature", { name: this.props.feature });
      scope.setExtra("componentStack", errorInfo.componentStack);
      Sentry.captureException(error);
    });
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback: CustomFallback, feature } = this.props;
      const FallbackComponent = CustomFallback || FeatureErrorFallbackComponent;

      return createElement(FallbackComponent, {
        feature,
        error: this.state.error,
        resetError: this.resetError,
      });
    }

    return this.props.children;
  }
}

/**
 * Wrap critical features with this error boundary for granular error tracking.
 *
 * Usage:
 * ```tsx
 * <FeatureErrorBoundary feature="Receipt Scanning">
 *   <ScanReceiptScreen />
 * </FeatureErrorBoundary>
 * ```
 */
export function FeatureErrorBoundary(
  props: FeatureErrorBoundaryProps
): React.ReactElement {
  return createElement(FeatureErrorBoundaryClass, props);
}

/**
 * Last captured event ID for associating user feedback
 */
let lastEventId: string | null = null;

/**
 * Capture an exception and store the event ID for feedback association
 */
export function captureExceptionWithFeedback(
  error: Error,
  context?: Record<string, unknown>
): string {
  const eventId = Sentry.captureException(error, {
    extra: context,
  });
  lastEventId = eventId;
  return eventId;
}

/**
 * Submit bug report feedback to Sentry
 * Uses Sentry's captureFeedback API which is available in @sentry/react-native v7+
 *
 * @param feedback Object containing user feedback
 * @param feedback.name User's name
 * @param feedback.email User's email
 * @param feedback.comments Bug description from user
 */
export function submitBugReport(feedback: {
  name?: string;
  email?: string;
  comments: string;
}): void {
  // Use captureFeedback (available in v7+) for submitting user feedback
  Sentry.captureFeedback({
    name: feedback.name || "Anonymous",
    email: feedback.email || "",
    message: feedback.comments,
    associatedEventId: lastEventId || undefined,
  });

  // Add breadcrumb for tracking
  addBreadcrumb("feedback", "Bug report submitted", {
    hasEventId: !!lastEventId,
  });

  // Clear the last event ID after submitting feedback
  lastEventId = null;
}

/**
 * Get the last captured event ID
 * Useful for custom feedback UIs
 */
export function getLastEventId(): string | null {
  return lastEventId;
}

// Re-export Sentry for advanced usage
export { Sentry };
