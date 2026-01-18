import React from "react";
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, borderRadius, avatarColors } from "../../lib/theme";
import { getInitials } from "../../lib/utils";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
  color?: string;
  /** Venmo username to show badge and enable profile link */
  venmoUsername?: string | null;
  /** Whether to show the Venmo badge overlay */
  showVenmoBadge?: boolean;
}

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function Avatar({ name, size = "md", style, color, venmoUsername, showVenmoBadge = false }: AvatarProps) {
  const backgroundColor = color || getColorForName(name);
  const initials = getInitials(name);

  const handleVenmoBadgePress = async () => {
    if (!venmoUsername) return;

    // Open Venmo profile using deep link
    const venmoProfileUrl = `venmo://users?username=${venmoUsername}`;
    const webFallbackUrl = `https://venmo.com/${venmoUsername}`;

    try {
      const canOpen = await Linking.canOpenURL(venmoProfileUrl);
      if (canOpen) {
        await Linking.openURL(venmoProfileUrl);
      } else {
        // Fallback to web
        await Linking.openURL(webFallbackUrl);
      }
    } catch (error) {
      // Try web fallback
      try {
        await Linking.openURL(webFallbackUrl);
      } catch {
        // Silently fail
      }
    }
  };

  const showBadge = showVenmoBadge && venmoUsername;
  const badgeSize = size === "sm" ? 12 : size === "md" ? 14 : 18;
  const badgeOffset = size === "sm" ? -2 : size === "md" ? -3 : -4;

  return (
    <View style={[styles.avatarContainer, style]}>
      <View style={[styles.avatar, styles[size], { backgroundColor }]}>
        <Text style={[styles.text, styles[`text_${size}`]]}>{initials}</Text>
      </View>
      {showBadge && (
        <TouchableOpacity
          style={[
            styles.venmoBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              right: badgeOffset,
              bottom: badgeOffset,
            },
          ]}
          onPress={handleVenmoBadgePress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="logo-venmo" size={badgeSize * 0.6} color={colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.full,
  },
  venmoBadge: {
    position: "absolute",
    backgroundColor: "#3D95CE", // Venmo blue
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.white,
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
    color: colors.white,
    fontWeight: "600",
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
