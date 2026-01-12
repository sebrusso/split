/**
 * Split Evenly Screen
 *
 * Shows a summary view for splitting the receipt evenly among selected members.
 * No itemized list - just shows each member and their equal share.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../../../lib/theme';
import { Button, Card, Avatar } from '../../../../../components/ui';
import { useReceiptSummary } from '../../../../../lib/useReceipts';
import { formatReceiptAmount, roundCurrency } from '../../../../../lib/receipts';
import { supabase } from '../../../../../lib/supabase';
import { Member } from '../../../../../lib/types';

export default function SplitEvenlyScreen() {
  const { id, receiptId } = useLocalSearchParams<{ id: string; receiptId: string }>();

  const { receipt, items, members, summary, loading, error, refetch } = useReceiptSummary(receiptId);

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  // Filter to regular items only (not tax/tip/etc)
  const regularItems = items.filter(
    (item) =>
      !item.is_tax && !item.is_tip && !item.is_subtotal && !item.is_total && !item.is_discount
  );

  // Select all members by default
  useEffect(() => {
    if (members.length > 0 && selectedMemberIds.length === 0) {
      setSelectedMemberIds(members.map((m) => m.id));
    }
  }, [members]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        // Don't allow deselecting if only one member remains
        if (prev.length === 1) {
          Alert.alert('Error', 'At least one person must be selected');
          return prev;
        }
        return prev.filter((id) => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const handleSwitchToItemClaiming = async () => {
    Alert.alert(
      'Switch Mode',
      'This will clear the current split. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            // Clear all claims for this receipt
            await clearAllClaims();
            // Navigate to item claiming screen
            router.replace(`/group/${id}/receipt/${receiptId}`);
          },
        },
      ]
    );
  };

  const clearAllClaims = async () => {
    try {
      // Get all item IDs for this receipt
      const itemIds = items.map((i) => i.id);

      if (itemIds.length > 0) {
        await supabase
          .from('item_claims')
          .delete()
          .in('receipt_item_id', itemIds);
      }
    } catch (err) {
      console.error('Error clearing claims:', err);
    }
  };

  const handleConfirm = async () => {
    if (selectedMemberIds.length === 0) {
      Alert.alert('Error', 'Please select at least one person');
      return;
    }

    try {
      setConfirming(true);

      // Clear any existing claims first
      await clearAllClaims();

      // Calculate share fraction
      const shareFraction = 1 / selectedMemberIds.length;

      // Create claims for all regular items, split among selected members
      const claims = regularItems.flatMap((item) =>
        selectedMemberIds.map((memberId) => ({
          receipt_item_id: item.id,
          member_id: memberId,
          claim_type: 'split',
          share_fraction: shareFraction,
          split_count: selectedMemberIds.length,
          claimed_via: 'app',
        }))
      );

      if (claims.length > 0) {
        const { error: claimError } = await supabase
          .from('item_claims')
          .insert(claims);

        if (claimError) throw claimError;
      }

      // Navigate to settlement screen
      router.replace(`/group/${id}/receipt/${receiptId}/settle`);
    } catch (err: any) {
      console.error('Error confirming split:', err);
      Alert.alert('Error', err.message || 'Failed to confirm split');
    } finally {
      setConfirming(false);
    }
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

  const total = receipt.total_amount || summary?.total || 0;
  const perPersonAmount = selectedMemberIds.length > 0
    ? roundCurrency(total / selectedMemberIds.length)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Mode Switcher */}
        <TouchableOpacity
          style={styles.modeSwitcher}
          onPress={handleSwitchToItemClaiming}
        >
          <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
          <Text style={styles.modeSwitcherText}>Switch to Item Claiming</Text>
        </TouchableOpacity>

        {/* Receipt Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.merchantName}>
            {receipt.merchant_name || 'Receipt'}
          </Text>
          {receipt.receipt_date && (
            <Text style={styles.receiptDate}>{receipt.receipt_date}</Text>
          )}
          <View style={styles.divider} />
          <Text style={styles.splitLabel}>Splitting evenly</Text>
          <Text style={styles.totalAmount}>
            {formatReceiptAmount(total, receipt.currency)}
          </Text>
          <Text style={styles.itemCount}>
            {regularItems.length} items
          </Text>
        </Card>

        {/* Per Person Summary */}
        <Card style={styles.perPersonCard}>
          <Ionicons name="calculator" size={32} color={colors.primary} />
          <Text style={styles.perPersonAmount}>
            {formatReceiptAmount(perPersonAmount, receipt.currency)}
          </Text>
          <Text style={styles.perPersonLabel}>per person</Text>
        </Card>

        {/* Member Selection */}
        <Text style={styles.sectionTitle}>Who's splitting?</Text>
        <Text style={styles.sectionSubtitle}>
          Tap to include or exclude members
        </Text>

        <View style={styles.membersList}>
          {members.map((member) => {
            const isSelected = selectedMemberIds.includes(member.id);
            const memberShare = isSelected ? perPersonAmount : 0;

            return (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.memberCard,
                  isSelected && styles.memberCardSelected,
                ]}
                onPress={() => toggleMember(member.id)}
                activeOpacity={0.7}
              >
                <View style={styles.memberInfo}>
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                    )}
                  </View>
                  <Avatar
                    name={member.name}
                    size="md"
                    color={isSelected ? colors.primary : undefined}
                  />
                  <Text style={[
                    styles.memberName,
                    !isSelected && styles.memberNameDeselected,
                  ]}>
                    {member.name}
                  </Text>
                </View>
                <Text style={[
                  styles.memberAmount,
                  isSelected && styles.memberAmountSelected,
                ]}>
                  {isSelected
                    ? formatReceiptAmount(memberShare, receipt.currency)
                    : '-'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Summary Footer */}
        <Card style={styles.summaryFooter}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>People</Text>
            <Text style={styles.summaryValue}>{selectedMemberIds.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Each pays</Text>
            <Text style={styles.summaryValuePrimary}>
              {formatReceiptAmount(perPersonAmount, receipt.currency)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>
              {formatReceiptAmount(total, receipt.currency)}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.footer}>
        <Button
          title={confirming ? 'Confirming...' : 'Confirm Split'}
          onPress={handleConfirm}
          loading={confirming}
          disabled={selectedMemberIds.length === 0}
          style={styles.confirmButton}
        />
      </View>
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
    paddingBottom: 100,
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
  modeSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  modeSwitcherText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  summaryCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  merchantName: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  receiptDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  splitLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  totalAmount: {
    ...typography.h1,
    color: colors.primary,
    fontSize: 36,
  },
  itemCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  perPersonCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.xl,
  },
  perPersonAmount: {
    ...typography.h1,
    color: colors.primaryDark,
    marginTop: spacing.sm,
  },
  perPersonLabel: {
    ...typography.body,
    color: colors.primaryDark,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  membersList: {
    gap: spacing.sm,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  memberCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  memberName: {
    ...typography.bodyMedium,
  },
  memberNameDeselected: {
    color: colors.textSecondary,
  },
  memberAmount: {
    ...typography.body,
    color: colors.textSecondary,
  },
  memberAmountSelected: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
  summaryFooter: {
    marginTop: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
  },
  summaryValuePrimary: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  confirmButton: {
    width: '100%',
  },
});
