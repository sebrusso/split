import { StyleSheet, useColorScheme as useRNColorScheme } from "react-native";

// Light mode colors
export const lightColors = {
  // Base (Slate grays)
  text: "#0F172A", // slate-900
  textSecondary: "#475569", // slate-600
  textMuted: "#94A3B8", // slate-400

  background: "#F8FAFC", // slate-50
  card: "#FFFFFF",
  white: "#FFFFFF",

  // Accent (Blue - interactive elements)
  accent: "#3B82F6", // blue-500
  accentDark: "#1D4ED8", // blue-700
  accentLight: "#DBEAFE", // blue-100

  // Gradient endpoints
  gradientStart: "#3B82F6", // blue-500
  gradientEnd: "#06B6D4", // cyan-500

  // Semantic (Financial)
  positive: "#3B82F6", // blue - "you're owed"
  negative: "#64748B", // slate-500 - "you owe"
  settled: "#94A3B8", // slate-400

  // Legacy semantic (for compatibility)
  danger: "#EF4444",
  dangerLight: "#FEE2E2",
  success: "#3B82F6", // Now blue instead of green
  successLight: "#DBEAFE",
  warning: "#F59E0B",

  // Borders
  border: "#E2E8F0", // slate-200
  borderLight: "#F1F5F9", // slate-100

  // Legacy mappings for compatibility
  primary: "#3B82F6",
  primaryDark: "#1D4ED8",
  primaryLight: "#DBEAFE",
};

// Dark mode colors
export const darkColors = {
  // Base
  text: "#F8FAFC", // slate-50
  textSecondary: "#94A3B8", // slate-400
  textMuted: "#64748B", // slate-500

  background: "#0F172A", // slate-900
  card: "#1E293B", // slate-800
  white: "#FFFFFF",

  // Accent (same as light)
  accent: "#3B82F6",
  accentDark: "#60A5FA", // blue-400 (lighter for dark mode)
  accentLight: "#1E3A5F", // darker blue tint

  // Gradient endpoints (same)
  gradientStart: "#3B82F6",
  gradientEnd: "#06B6D4",

  // Semantic (Financial)
  positive: "#60A5FA", // blue-400 (brighter for dark)
  negative: "#94A3B8", // slate-400
  settled: "#64748B", // slate-500

  // Legacy semantic
  danger: "#F87171", // red-400
  dangerLight: "#450A0A", // dark red bg
  success: "#60A5FA",
  successLight: "#1E3A5F",
  warning: "#FBBF24", // amber-400

  // Borders
  border: "#334155", // slate-700
  borderLight: "#1E293B", // slate-800

  // Legacy mappings
  primary: "#3B82F6",
  primaryDark: "#60A5FA",
  primaryLight: "#1E3A5F",
};

// Default export for backward compatibility (light mode)
export const colors = lightColors;

// Gradient configuration for LinearGradient
export const gradients = {
  primary: {
    colors: ["#3B82F6", "#06B6D4"] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  primaryVertical: {
    colors: ["#3B82F6", "#06B6D4"] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
};

// Avatar colors - now blue/slate/cyan focused
export const avatarColors = [
  "#3B82F6", // blue-500
  "#0EA5E9", // sky-500
  "#06B6D4", // cyan-500
  "#6366F1", // indigo-500
  "#8B5CF6", // violet-500
  "#64748B", // slate-500
  "#475569", // slate-600
  "#0891B2", // cyan-600
];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
};

// Typography - using system fonts (SF Pro on iOS, Roboto on Android)
export const typography = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: "700",
    color: lightColors.text,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700",
    color: lightColors.text,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600",
    color: lightColors.text,
  },
  body: {
    fontSize: 16,
    fontWeight: "400",
    color: lightColors.text,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: "500",
    color: lightColors.text,
  },
  caption: {
    fontSize: 14,
    fontWeight: "400",
    color: lightColors.textSecondary,
  },
  small: {
    fontSize: 12,
    fontWeight: "500",
    color: lightColors.textMuted,
  },
  amount: {
    fontSize: 36,
    fontWeight: "700",
    color: lightColors.text,
    letterSpacing: -1,
  },
  amountMedium: {
    fontSize: 28,
    fontWeight: "700",
    color: lightColors.text,
    letterSpacing: -0.5,
  },
});

// Shadows - stronger for borderless cards
export const shadows = StyleSheet.create({
  sm: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
});

// Hook to get current color scheme
export function useAppColorScheme() {
  const colorScheme = useRNColorScheme();
  return colorScheme === "dark" ? "dark" : "light";
}

// Hook to get colors for current scheme
export function useThemeColors() {
  const scheme = useAppColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}
