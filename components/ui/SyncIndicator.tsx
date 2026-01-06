import { View, Text, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { useSyncStatus } from "../../lib/useOffline";
import { colors, spacing, typography, borderRadius } from "../../lib/theme";

export function SyncIndicator() {
  const { status, pendingCount, isOnline } = useSyncStatus();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === "syncing") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  // Don't show if online and idle with no pending
  if (isOnline && status === "idle" && pendingCount === 0) {
    return null;
  }

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: "📴",
        text: "Offline",
        color: colors.textSecondary,
        bgColor: colors.borderLight,
      };
    }

    switch (status) {
      case "syncing":
        return {
          icon: "🔄",
          text: "Syncing...",
          color: colors.primary,
          bgColor: colors.primaryLight,
        };
      case "error":
        return {
          icon: "⚠️",
          text: `${pendingCount} pending`,
          color: "#EF4444",
          bgColor: "#FEE2E2",
        };
      default:
        if (pendingCount > 0) {
          return {
            icon: "📤",
            text: `${pendingCount} pending`,
            color: colors.textSecondary,
            bgColor: colors.borderLight,
          };
        }
        return null;
    }
  };

  const info = getStatusInfo();
  if (!info) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: info.bgColor, opacity: pulseAnim },
      ]}
    >
      <Text style={styles.icon}>{info.icon}</Text>
      <Text style={[styles.text, { color: info.color }]}>{info.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  text: {
    ...typography.small,
    fontFamily: "Inter_500Medium",
  },
});
