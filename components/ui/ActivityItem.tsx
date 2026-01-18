/**
 * ActivityItem Component
 *
 * Displays a single activity feed item with icon, description,
 * timestamp, and optional group info.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { ActivityItem as ActivityItemType } from "../../lib/types";
import { formatRelativeDate, getInitials } from "../../lib/utils";
import { getActivityDescription, getActivityIcon } from "../../lib/activity";

interface ActivityItemProps {
  activity: ActivityItemType;
  showGroup?: boolean;
  onPress?: () => void;
}

export function ActivityItemComponent({
  activity,
  showGroup = true,
  onPress,
}: ActivityItemProps) {
  const description = getActivityDescription(activity);
  const icon = getActivityIcon(activity.action);

  const renderActorAvatar = () => {
    if (activity.actor?.avatarUrl) {
      return (
        <Image
          source={{ uri: activity.actor.avatarUrl }}
          style={styles.avatar}
        />
      );
    }

    const name = activity.actor?.displayName || "User";
    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Text style={styles.avatarText}>{getInitials(name)}</Text>
      </View>
    );
  };

  const renderIcon = () => {
    return (
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
    );
  };

  const getActionColor = () => {
    switch (activity.action) {
      case "expense_added":
        return colors.primary;
      case "expense_edited":
        return colors.warning;
      case "expense_deleted":
        return colors.danger;
      case "settlement_recorded":
        return colors.success;
      case "member_joined":
        return colors.primary;
      case "member_left":
        return colors.textSecondary;
      case "group_created":
        return colors.primary;
      default:
        return colors.textSecondary;
    }
  };

  const cardContent = (
    <>
      <View style={styles.leftSection}>
        {renderActorAvatar()}
        <View style={styles.iconBadge}>{renderIcon()}</View>
      </View>

      <View style={styles.contentSection}>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.timestamp}>
            {formatRelativeDate(activity.createdAt)}
          </Text>

          {showGroup && activity.group && (
            <>
              <Text style={styles.separator}>in</Text>
              <View style={styles.groupBadge}>
                <Text style={styles.groupEmoji}>
                  {activity.group.emoji || "👥"}
                </Text>
                <Text style={styles.groupName} numberOfLines={1}>
                  {activity.group.name}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View
        style={[styles.actionIndicator, { backgroundColor: getActionColor() }]}
      />
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return <View style={styles.card}>{cardContent}</View>;
}

// Compact version for preview in group detail
export function ActivityItemCompact({
  activity,
  onPress,
}: {
  activity: ActivityItemType;
  onPress?: () => void;
}) {
  const description = getActivityDescription(activity);
  const icon = getActivityIcon(activity.action);

  const content = (
    <View style={styles.compactCard}>
      <Text style={styles.compactIcon}>{icon}</Text>
      <Text style={styles.compactDescription} numberOfLines={1}>
        {description}
      </Text>
      <Text style={styles.compactTime}>
        {formatRelativeDate(activity.createdAt)}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const AVATAR_SIZE = 40;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
    overflow: "hidden",
  },
  leftSection: {
    position: "relative",
    marginRight: spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: colors.accentLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: colors.accentDark,
    fontSize: 14,
    fontWeight: "600",
  },
  iconBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    padding: 2,
  },
  iconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 12,
  },
  contentSection: {
    flex: 1,
  },
  description: {
    ...typography.body,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    flexWrap: "wrap",
  },
  timestamp: {
    ...typography.small,
    color: colors.textMuted,
  },
  separator: {
    ...typography.small,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  groupBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  groupEmoji: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  groupName: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.accentDark,
    maxWidth: 100,
  },
  actionIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
  },

  // Compact styles
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  compactIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  compactDescription: {
    ...typography.caption,
    flex: 1,
    marginRight: spacing.sm,
  },
  compactTime: {
    ...typography.small,
    color: colors.textMuted,
  },
});
