/**
 * FriendCard Component
 *
 * Displays a friend or friend request with avatar, name, email,
 * and action buttons for accepting/rejecting/removing.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { Friendship, UserProfile, FriendshipStatus } from "../../lib/types";
import { getInitials } from "../../lib/utils";

interface FriendCardProps {
  friendship?: Friendship;
  user?: UserProfile;
  status?: FriendshipStatus | "none" | "outgoing";
  onAccept?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
  onPress?: () => void;
  onAddFriend?: () => void;
  loading?: boolean;
}

export function FriendCard({
  friendship,
  user,
  status,
  onAccept,
  onReject,
  onRemove,
  onPress,
  onAddFriend,
  loading = false,
}: FriendCardProps) {
  // Determine which profile to display
  const displayUser =
    user ||
    friendship?.friend ||
    friendship?.requester ||
    friendship?.addressee;

  const displayStatus = status || friendship?.status || "none";

  if (!displayUser) {
    return null;
  }

  const renderAvatar = () => {
    if (displayUser.avatarUrl) {
      return (
        <Image
          source={{ uri: displayUser.avatarUrl }}
          style={styles.avatar}
        />
      );
    }

    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Text style={styles.avatarText}>
          {getInitials(displayUser.displayName)}
        </Text>
      </View>
    );
  };

  const renderStatusBadge = () => {
    if (displayStatus === "pending") {
      return (
        <View style={[styles.badge, styles.badgePending]}>
          <Text style={styles.badgeText}>Pending</Text>
        </View>
      );
    }

    if (displayStatus === "outgoing") {
      return (
        <View style={[styles.badge, styles.badgeOutgoing]}>
          <Text style={styles.badgeText}>Sent</Text>
        </View>
      );
    }

    return null;
  };

  const renderActions = () => {
    if (loading) {
      return (
        <View style={styles.actionsContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      );
    }

    // Incoming pending request
    if (displayStatus === "pending" && (onAccept || onReject)) {
      return (
        <View style={styles.actionsContainer}>
          {onAccept && (
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={onAccept}
              activeOpacity={0.7}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          )}
          {onReject && (
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={onReject}
              activeOpacity={0.7}
            >
              <Text style={styles.rejectButtonText}>Decline</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Outgoing pending request - show cancel option
    if (displayStatus === "outgoing" && onReject) {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={onReject}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Accepted friend - show remove option
    if (displayStatus === "accepted" && onRemove) {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={onRemove}
            activeOpacity={0.7}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Not friends - show add friend option
    if (displayStatus === "none" && onAddFriend) {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.addButton]}
            onPress={onAddFriend}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>Add Friend</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  const cardContent = (
    <>
      {renderAvatar()}
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayUser.displayName}
          </Text>
          {renderStatusBadge()}
        </View>
        <Text style={styles.email} numberOfLines={1}>
          {displayUser.email}
        </Text>
      </View>
      {renderActions()}
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

const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  infoContainer: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    ...typography.bodyMedium,
    flex: 1,
    marginRight: spacing.sm,
  },
  email: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  badgePending: {
    backgroundColor: colors.accentLight,
  },
  badgeOutgoing: {
    backgroundColor: colors.borderLight,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.accentDark,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: 70,
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: colors.accent,
  },
  acceptButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  rejectButton: {
    backgroundColor: colors.borderLight,
  },
  rejectButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  cancelButton: {
    backgroundColor: colors.borderLight,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  removeButton: {
    backgroundColor: colors.dangerLight,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "500",
  },
  addButton: {
    backgroundColor: colors.accentLight,
  },
  addButtonText: {
    color: colors.accentDark,
    fontSize: 13,
    fontWeight: "600",
  },
});
