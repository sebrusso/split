import React from "react";
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp } from "react-native";
import { colors, borderRadius, spacing, shadows } from "../../lib/theme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}

export function Card({ children, style, onPress, padded = true }: CardProps) {
  // Borderless card with stronger shadow
  const cardStyle = [styles.card, shadows.md, padded && styles.padded, style];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    // No border - relies on shadow for depth
  },
  padded: {
    padding: spacing.lg,
  },
});
