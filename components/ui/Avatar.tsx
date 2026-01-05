import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, borderRadius } from "../../lib/theme";
import { getInitials } from "../../lib/utils";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
  color?: string;
}

const AVATAR_COLORS = [
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({ name, size = "md", style, color }: AvatarProps) {
  const backgroundColor = color || getColorForName(name);
  const initials = getInitials(name);

  return (
    <View style={[styles.avatar, styles[size], { backgroundColor }, style]}>
      <Text style={[styles.text, styles[`text_${size}`]]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
  },
  sm: {
    width: 32,
    height: 32,
  },
  md: {
    width: 40,
    height: 40,
  },
  lg: {
    width: 56,
    height: 56,
  },
  text: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },
  text_sm: {
    fontSize: 12,
  },
  text_md: {
    fontSize: 14,
  },
  text_lg: {
    fontSize: 20,
  },
});
