/**
 * Split Method Picker Screen
 *
 * Allows users to choose how to split a receipt:
 * - Split Evenly: Divide total by number of members
 * - Claim Items: Go to item-by-item claiming
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../../../lib/theme';
import { Button, Card, Avatar } from '../../../../../components/ui';
import { useReceiptSummary, useItemClaims } from '../../../../../lib/useReceipts';
import { formatReceiptAmount } from '../../../../../lib/receipts';
import { useSupabase } from '../../../../../lib/supabase';
import { Member } from '../../../../../lib/types';

export default function SplitMethodScreen() {
  const { id, receiptId } = useLocalSearchParams<{ id: string; receiptId: string }>();

  const { receipt, items, members, summary, loading, error } = useReceiptSummary(receiptId);
  const { claimItem } = useItemClaims(receiptId);

  const [splitting, setSplitting] = useState(false);

  // Filter to regular items only
  const regularItems = items.filter(
    (item) =>
      !item.is_tax && !item.is_tip && !item.is_subtotal && !item.is_total && !item.is_discount
  );

  const handleSplitEvenly = () => {
    // Navigate to split evenly screen where user can select members and confirm
    router.replace(`/group/${id}/receipt/${receiptId}/split-evenly`);
  };

  const handleClaimItems = () => {
    router.replace(`/group/${id}/receipt/${receiptId}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.danger} />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error || 'Receipt not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const perPersonAmount = members.length > 0
    ? (receipt.total_amount || summary?.total || 0) / members.length
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Receipt Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.merchantName}>
            {receipt.merchant_name || 'Receipt'}
          </Text>
          <Text style={styles.totalAmount}>
            {formatReceiptAmount(receipt.total_amount || summary?.total || 0, receipt.currency)}
          </Text>
          <Text style={styles.itemCount}>
            {regularItems.length} items • {members.length} people
          </Text>
        </Card>

        <Text style={styles.heading}>How do you want to split?</Text>

        {/* Split Options */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleSplitEvenly}
          disabled={splitting}
          activeOpacity={0.7}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="calculator" size={32} color={colors.primary} />
          </View>
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>Split Evenly</Text>
            <Text style={styles.optionDescription}>
              Everyone pays the same amount
            </Text>
            <Text style={styles.optionAmount}>
              {formatReceiptAmount(perPersonAmount, receipt.currency)} each
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleClaimItems}
          disabled={splitting}
          activeOpacity={0.7}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="list" size={32} color={colors.primary} />
          </View>
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>Claim Items</Text>
            <Text style={styles.optionDescription}>
              Each person claims what they ordered
            </Text>
            <Text style={styles.optionAmount}>
              Pay for only what you had
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Members Preview */}
        <View style={styles.membersSection}>
          <Text style={styles.membersSectionTitle}>Splitting between:</Text>
          <View style={styles.membersList}>
            {members.map((member) => (
              <View key={member.id} style={styles.memberBadge}>
                <Avatar name={member.name} size="sm" />
                <Text style={styles.memberName}>{member.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  summaryCard: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  merchantName: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  totalAmount: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  itemCount: {
    ...typography.body,
    color: colors.textSecondary,
  },
  heading: {
    ...typography.h3,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  optionAmount: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  membersSection: {
    marginTop: spacing.xl,
  },
  membersSectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    ...shadows.sm,
  },
  memberName: {
    ...typography.body,
  },
});
