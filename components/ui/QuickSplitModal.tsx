/**
 * Quick Split Modal Component
 *
 * P0: Allows users to quickly split an item between multiple people
 * without navigating to a separate screen. Shows a number picker
 * for selecting how many people to split between.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { ReceiptItem, Member } from '../../lib/types';
import { formatReceiptAmount } from '../../lib/receipts';
import { Avatar } from './Avatar';

interface QuickSplitModalProps {
  visible: boolean;
  onClose: () => void;
  item: ReceiptItem | null;
  members: Member[];
  currentMemberId: string | null;
  currency?: string;
  onSplit: (memberIds: string[]) => Promise<{ success: boolean; error?: string }>;
  onClaimForSelf?: () => Promise<{ success: boolean; error?: string }>;
}

export function QuickSplitModal({
  visible,
  onClose,
  item,
  members,
  currentMemberId,
  currency = 'USD',
  onSplit,
  onClaimForSelf,
}: QuickSplitModalProps) {
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      // Pre-select current member
      if (currentMemberId) {
        setSelectedMembers(new Set([currentMemberId]));
      } else {
        setSelectedMembers(new Set());
      }
      setError(null);
    }
  }, [visible, currentMemberId]);

  const toggleMember = useCallback((memberId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  const handleSplit = async () => {
    if (!item) return;

    const memberIds = Array.from(selectedMembers);

    if (memberIds.length === 0) {
      setError('Select at least one person');
      return;
    }

    if (memberIds.length === 1 && onClaimForSelf && memberIds[0] === currentMemberId) {
      // Just claiming for self, use the simpler claim function
      setLoading(true);
      setError(null);
      const result = await onClaimForSelf();
      setLoading(false);

      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Failed to claim item');
      }
      return;
    }

    setLoading(true);
    setError(null);

    const result = await onSplit(memberIds);

    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Failed to split item');
    }
  };

  if (!item) return null;

  const splitAmount = selectedMembers.size > 0
    ? item.total_price / selectedMembers.size
    : item.total_price;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Split Item</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Item Info */}
          <View style={styles.itemInfo}>
            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.itemPrice}>
              {formatReceiptAmount(item.total_price, currency)}
            </Text>
            {item.is_likely_shared && (
              <View style={styles.sharedBadge}>
                <Ionicons name="people" size={14} color={colors.primary} />
                <Text style={styles.sharedBadgeText}>Shared Item</Text>
              </View>
            )}
          </View>

          {/* Split Preview */}
          {selectedMembers.size > 0 && (
            <View style={styles.splitPreview}>
              <Text style={styles.splitPreviewLabel}>
                Split {selectedMembers.size} way{selectedMembers.size !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.splitPreviewAmount}>
                {formatReceiptAmount(splitAmount, currency)} each
              </Text>
            </View>
          )}

          {/* Member Selection */}
          <Text style={styles.sectionLabel}>Select who to split with:</Text>
          <View style={styles.memberGrid}>
            {members.map((member) => {
              const isSelected = selectedMembers.has(member.id);
              const isCurrentUser = member.id === currentMemberId;

              return (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberButton,
                    isSelected && styles.memberButtonSelected,
                  ]}
                  onPress={() => toggleMember(member.id)}
                >
                  <Avatar
                    name={member.name}
                    size="md"
                    color={isSelected ? colors.primary : undefined}
                  />
                  <Text
                    style={[
                      styles.memberName,
                      isSelected && styles.memberNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {member.name}
                    {isCurrentUser && ' (You)'}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                // Select all members
                setSelectedMembers(new Set(members.map((m) => m.id)));
              }}
            >
              <Ionicons name="people" size={16} color={colors.primary} />
              <Text style={styles.quickActionText}>Everyone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => {
                // Select just current user
                if (currentMemberId) {
                  setSelectedMembers(new Set([currentMemberId]));
                }
              }}
            >
              <Ionicons name="person" size={16} color={colors.primary} />
              <Text style={styles.quickActionText}>Just Me</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => setSelectedMembers(new Set())}
            >
              <Ionicons name="close-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.quickActionText, { color: colors.textSecondary }]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              selectedMembers.size === 0 && styles.actionButtonDisabled,
            ]}
            onPress={handleSplit}
            disabled={loading || selectedMembers.size === 0}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.actionButtonText}>
                {selectedMembers.size === 1
                  ? 'Claim Item'
                  : `Split ${selectedMembers.size} Ways`}
              </Text>
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 20, // Extra padding for safe area
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  itemInfo: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  itemDescription: {
    ...typography.bodyMedium,
    marginBottom: spacing.xs,
  },
  itemPrice: {
    ...typography.h3,
    color: colors.primary,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  sharedBadgeText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  splitPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  splitPreviewLabel: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  splitPreviewAmount: {
    ...typography.h3,
    color: colors.primary,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  memberButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.borderLight,
    minWidth: 80,
    position: 'relative',
  },
  memberButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  memberName: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 70,
  },
  memberNameSelected: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  checkmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.card,
    borderRadius: 10,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  quickActionText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
  },
  actionButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionButtonDisabled: {
    backgroundColor: colors.borderLight,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
