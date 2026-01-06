/**
 * React Native Mock for Jest Component Tests
 *
 * This file provides mock implementations of React Native components
 * for unit testing without requiring a native runtime.
 */

import React from "react";

// Mock component factory
const createMockComponent = (name: string) => {
  const Component = ({
    children,
    testID,
    ...props
  }: {
    children?: React.ReactNode;
    testID?: string;
    [key: string]: unknown;
  }) => {
    return React.createElement(
      name,
      { ...props, "data-testid": testID },
      children,
    );
  };
  Component.displayName = name;
  return Component;
};

// Mock View
export const View = createMockComponent("View");

// Mock Text
export const Text = createMockComponent("Text");

// Mock TouchableOpacity with onPress support
export const TouchableOpacity = ({
  children,
  onPress,
  disabled,
  testID,
  style,
  activeOpacity,
  ...props
}: {
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  style?: unknown;
  activeOpacity?: number;
  [key: string]: unknown;
}) => {
  return React.createElement(
    "TouchableOpacity",
    {
      ...props,
      "data-testid": testID,
      onClick: disabled ? undefined : onPress,
      "aria-disabled": disabled,
      style,
    },
    children,
  );
};

// Mock TextInput with value/onChange support
export const TextInput = ({
  value,
  onChangeText,
  onFocus,
  onBlur,
  placeholder,
  placeholderTextColor,
  testID,
  style,
  ...props
}: {
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  testID?: string;
  style?: unknown;
  [key: string]: unknown;
}) => {
  return React.createElement("input", {
    ...props,
    "data-testid": testID,
    value,
    onChange: (e: { target: { value: string } }) =>
      onChangeText?.(e.target.value),
    onFocus,
    onBlur,
    placeholder,
    style,
  });
};

// Mock ActivityIndicator
export const ActivityIndicator = ({
  size,
  color,
  testID,
}: {
  size?: "small" | "large";
  color?: string;
  testID?: string;
}) => {
  return React.createElement("ActivityIndicator", {
    "data-testid": testID || "activity-indicator",
    size,
    color,
  });
};

// Mock StyleSheet
export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
};

// Mock Platform
export const Platform = {
  OS: "ios" as const,
  select: <T>(options: { ios?: T; android?: T; default?: T }): T | undefined =>
    options.ios ?? options.default,
};

// Mock Dimensions
export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};

// Mock Keyboard
export const Keyboard = {
  dismiss: jest.fn(),
  addListener: () => ({ remove: () => {} }),
};

// Mock SafeAreaView
export const SafeAreaView = createMockComponent("SafeAreaView");

// Mock ScrollView
export const ScrollView = createMockComponent("ScrollView");

// Mock FlatList
export const FlatList = createMockComponent("FlatList");

// Mock KeyboardAvoidingView
export const KeyboardAvoidingView = createMockComponent("KeyboardAvoidingView");

// Mock RefreshControl
export const RefreshControl = createMockComponent("RefreshControl");

// Mock Alert
export const Alert = {
  alert: jest.fn(),
};

// Mock Animated
export const Animated = {
  View: createMockComponent("Animated.View"),
  Text: createMockComponent("Animated.Text"),
  Value: class {
    _value: number;
    constructor(value: number) {
      this._value = value;
    }
    setValue(value: number) {
      this._value = value;
    }
    interpolate() {
      return this;
    }
  },
  timing: () => ({ start: (cb?: () => void) => cb?.() }),
  spring: () => ({ start: (cb?: () => void) => cb?.() }),
  parallel: () => ({ start: (cb?: () => void) => cb?.() }),
  sequence: () => ({ start: (cb?: () => void) => cb?.() }),
};

// Export ViewStyle and TextStyle types as empty objects for type compatibility
export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
