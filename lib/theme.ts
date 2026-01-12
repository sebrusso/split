import { StyleSheet } from "react-native";

export const colors = {
  primary: "#10B981",
  primaryDark: "#059669",
  primaryLight: "#D1FAE5",

  background: "#FAFAFA",
  card: "#FFFFFF",
  white: "#FFFFFF", // Use for text on dark backgrounds (buttons, avatars, badges)

  text: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",

  border: "#E5E7EB",
  borderLight: "#F3F4F6",

  danger: "#EF4444",
  dangerLight: "#FEE2E2",

  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
};

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

export const typography = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
  },
  body: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: colors.text,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: colors.text,
  },
  caption: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
  },
  small: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: colors.textMuted,
  },
  amount: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    letterSpacing: -1,
  },
  amountMedium: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    letterSpacing: -0.5,
  },
});

export const shadows = StyleSheet.create({
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
});
