/**
 * Receipt Settlement Screen
 *
 * Shows final amounts for each member and provides payment options.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../../../lib/theme';
import { Button, Card, Avatar } from '../../../../../components/ui';
import { useReceiptSummary } from '../../../../../lib/useReceipts';
import {
  formatReceiptAmount,
  generateVenmoLink,
  generatePayPalLink,
  generateCashAppLink,
} from '../../../../../lib/receipts';
import { useAuth } from '../../../../../lib/auth-context';
import { supabase } from '../../../../../lib/supabase';
import { Member, ReceiptMemberCalculation } from '../../../../../lib/types';
import { getVenmoUsernameForMember } from '../../../../../lib/user-profile';

export default function ReceiptSettleScreen() {
  const { id, receiptId } = useLocalSearchParams<{ id: string; receiptId: string }>();
  const { userId } = useAuth();

  const { receipt, summary, loading, error } = useReceiptSummary(receiptId);

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [settledMembers, setSettledMembers] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState(false);
  const [uploaderVenmo, setUploaderVenmo] = useState<string | null>(null);

  // Fetch current user's member record and uploader's payment info
  useFocusEffect(
    useCallback(() => {
      const fetchMember = async () => {
        if (!id || !userId) return;

        try {
          const { data: member, error } = await supabase
            .from('members')
            .select('*')
            .eq('group_id', id)
            .eq('clerk_user_id', userId)
            .single();

          if (error) {
            console.error('Error fetching member:', error);
            return;
          }

          setCurrentMember(member);
        } catch (err) {
          console.error('Error fetching member:', err);
        }
      };

      fetchMember();
    }, [id, userId])
  );

  // Fetch uploader's Venmo username when receipt loads
  useFocusEffect(
    useCallback(() => {
      const fetchUploaderPaymentInfo = async () => {
        if (!receipt?.uploaded_by) return;

        try {
          const venmoUsername = await getVenmoUsernameForMember(receipt.uploaded_by);
          setUploaderVenmo(venmoUsername);
        } catch (err) {
          console.error('Error fetching uploader payment info:', err);
        }
      };

      fetchUploaderPaymentInfo();
    }, [receipt?.uploaded_by])
  );

  // Find the uploader (person who paid)
  const uploaderId = receipt?.uploaded_by;
  const uploaderTotal = summary?.memberTotals.find((t) => t.memberId === uploaderId);

  // Others who owe money
  const othersOwing = summary?.memberTotals.filter((t) => t.memberId !== uploaderId) || [];

  const handlePayVenmo = async (memberTotal: ReceiptMemberCalculation) => {
    if (!uploaderVenmo) {
      Alert.alert(
        'Venmo Not Set Up',
        'The person who paid hasn\'t added their Venmo username yet. Ask them to set it up in their profile.',
        [{ text: 'OK' }]
      );
      return;
    }

    const note = `${receipt?.merchant_name || 'Receipt'} - ${memberTotal.claimedItems.map((i) => i.description).join(', ')}`;
    const url = generateVenmoLink(uploaderVenmo, memberTotal.grandTotal, note);

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to web
        await Linking.openURL(
          `https://venmo.com/${uploaderVenmo}?txn=pay&amount=${memberTotal.grandTotal}&note=${encodeURIComponent(note)}`
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to open Venmo');
    }
  };

  const handlePayPayPal = async (memberTotal: ReceiptMemberCalculation) => {
    // PayPal username not yet implemented - show placeholder message
    Alert.alert(
      'PayPal Not Set Up',
      'PayPal payment integration is coming soon. For now, please use Venmo or settle manually.',
      [{ text: 'OK' }]
    );
  };

  const handlePayCashApp = async (memberTotal: ReceiptMemberCalculation) => {
    // CashApp tag not yet implemented - show placeholder message
    Alert.alert(
      'Cash App Not Set Up',
      'Cash App payment integration is coming soon. For now, please use Venmo or settle manually.',
      [{ text: 'OK' }]
    );
  };

  const handleMarkSettled = async (memberTotal: ReceiptMemberCalculation) => {
    if (!receipt || !uploaderId) return;

    try {
      setSettling(true);

      // Create settlement record
      const { error: settlementError } = await supabase.from('settlements').insert({
        group_id: id,
        from_member_id: memberTotal.memberId,
        to_member_id: uploaderId,
        amount: memberTotal.grandTotal,
        method: 'other',
        notes: `Receipt: ${receipt.merchant_name || 'Unknown'}`,
      });

      if (settlementError) throw settlementError;

      // Update receipt_member_totals
      await supabase
        .from('receipt_member_totals')
        .update({
          is_settled: true,
          settled_at: new Date().toISOString(),
        })
        .eq('receipt_id', receiptId)
        .eq('member_id', memberTotal.memberId);

      setSettledMembers((prev) => new Set(prev).add(memberTotal.memberId));

      Alert.alert('Success', `${memberTotal.memberName}'s portion has been marked as settled`);
    } catch (err: any) {
      console.error('Error marking settled:', err);
      Alert.alert('Error', err.message || 'Failed to mark as settled');
    } finally {
      setSettling(false);
    }
  };

  const handleFinish = async () => {
    if (!receiptId) return;

    try {
      // Update receipt status to settled
      const { error } = await supabase
        .from('receipts')
        .update({ status: 'settled' })
        .eq('id', receiptId);

      if (error) {
        console.error('Error settling receipt:', error);
        Alert.alert('Error', 'Failed to mark receipt as settled. Please try again.');
        return;
      }

      Alert.alert('Receipt Settled', 'All payments have been recorded.', [
        {
          text: 'Done',
          onPress: () => router.replace(`/group/${id}`),
        },
      ]);
    } catch (err) {
      console.error('Error settling receipt:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
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

  if (error || !receipt || !summary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error || 'Unable to load receipt'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  // Check if current user is the payer
  const isCurrentUserPayer = currentMember?.id === uploaderId;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Text style={styles.headerTitle}>Settlement Summary</Text>
          <Text style={styles.headerSubtitle}>
            {receipt.merchant_name || 'Receipt'}
          </Text>
          <Text style={styles.headerTotal}>
            Total: {formatReceiptAmount(summary.total, receipt.currency)}
          </Text>
        </Card>

        {/* Payer Info */}
        {uploaderTotal && (
          <Card style={styles.payerCard}>
            <View style={styles.payerHeader}>
              <Avatar
                name={uploaderTotal.memberName}
                size="md"
                color={colors.primary}
              />
              <View style={styles.payerInfo}>
                <Text style={styles.payerName}>
                  {uploaderTotal.memberName}
                  {isCurrentUserPayer && ' (You)'}
                </Text>
                <Text style={styles.payerLabel}>Paid the bill</Text>
              </View>
            </View>

            <View style={styles.payerItems}>
              <Text style={styles.payerItemsLabel}>Their share:</Text>
              {uploaderTotal.claimedItems.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.itemAmount}>
                    {formatReceiptAmount(item.amount, receipt.currency)}
                  </Text>
                </View>
              ))}
              {(uploaderTotal.taxShare > 0 || uploaderTotal.tipShare > 0) && (
                <View style={styles.itemRow}>
                  <Text style={styles.itemName}>Tax + Tip</Text>
                  <Text style={styles.itemAmount}>
                    {formatReceiptAmount(
                      uploaderTotal.taxShare + uploaderTotal.tipShare,
                      receipt.currency
                    )}
                  </Text>
                </View>
              )}
              <View style={[styles.itemRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Their total</Text>
                <Text style={styles.totalAmount}>
                  {formatReceiptAmount(uploaderTotal.grandTotal, receipt.currency)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Others Owing */}
        {othersOwing.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {isCurrentUserPayer ? 'Money Coming to You' : 'Who Owes What'}
            </Text>

            {othersOwing.map((memberTotal) => {
              const isSettled = settledMembers.has(memberTotal.memberId);
              const isMe = memberTotal.memberId === currentMember?.id;

              return (
                <Card
                  key={memberTotal.memberId}
                  style={[styles.owingCard, isSettled && styles.owingCardSettled]}
                >
                  <View style={styles.owingHeader}>
                    <Avatar name={memberTotal.memberName} size="sm" />
                    <View style={styles.owingInfo}>
                      <Text style={styles.owingName}>
                        {memberTotal.memberName}
                        {isMe && ' (You)'}
                      </Text>
                      <Text style={styles.owingAmount}>
                        Owes{' '}
                        {formatReceiptAmount(memberTotal.grandTotal, receipt.currency)}
                      </Text>
                    </View>
                    {isSettled && (
                      <View style={styles.settledBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.success}
                        />
                        <Text style={styles.settledText}>Settled</Text>
                      </View>
                    )}
                  </View>

                  {/* Item breakdown */}
                  <View style={styles.owingItems}>
                    {memberTotal.claimedItems.map((item, index) => (
                      <Text key={index} style={styles.owingItem} numberOfLines={1}>
                        {item.description} -{' '}
                        {formatReceiptAmount(item.amount, receipt.currency)}
                      </Text>
                    ))}
                    {(memberTotal.taxShare > 0 || memberTotal.tipShare > 0) && (
                      <Text style={styles.owingItem}>
                        Tax + Tip:{' '}
                        {formatReceiptAmount(
                          memberTotal.taxShare + memberTotal.tipShare,
                          receipt.currency
                        )}
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  {!isSettled && (
                    <View style={styles.owingActions}>
                      {isMe ? (
                        // Current user needs to pay
                        <>
                          <TouchableOpacity
                            style={[styles.payButton, !uploaderVenmo && styles.payButtonDisabled]}
                            onPress={() => handlePayVenmo(memberTotal)}
                          >
                            <Text style={[styles.payButtonText, !uploaderVenmo && styles.payButtonTextDisabled]}>
                              Venmo{uploaderVenmo ? '' : ' (Not Set)'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.payButton, styles.payButtonDisabled]}
                            onPress={() => handlePayPayPal(memberTotal)}
                          >
                            <Text style={[styles.payButtonText, styles.payButtonTextDisabled]}>PayPal</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.payButton, styles.payButtonDisabled]}
                            onPress={() => handlePayCashApp(memberTotal)}
                          >
                            <Text style={[styles.payButtonText, styles.payButtonTextDisabled]}>Cash App</Text>
                          </TouchableOpacity>
                        </>
                      ) : isCurrentUserPayer ? (
                        // Payer can mark as settled
                        <Button
                          title="Mark as Settled"
                          variant="secondary"
                          onPress={() => handleMarkSettled(memberTotal)}
                          loading={settling}
                          style={styles.settleButton}
                        />
                      ) : (
                        <TouchableOpacity
                          style={styles.remindButton}
                          onPress={() => Alert.alert('Reminder', 'Reminder feature coming soon!')}
                        >
                          <Ionicons name="notifications" size={16} color={colors.primary} />
                          <Text style={styles.remindButtonText}>Send Reminder</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </Card>
              );
            })}
          </>
        )}

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Total Breakdown</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatReceiptAmount(summary.subtotal, receipt.currency)}
            </Text>
          </View>
          {summary.tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>
                {formatReceiptAmount(summary.tax, receipt.currency)}
              </Text>
            </View>
          )}
          {summary.tip > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tip</Text>
              <Text style={styles.summaryValue}>
                {formatReceiptAmount(summary.tip, receipt.currency)}
              </Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Grand Total</Text>
            <Text style={styles.summaryTotalValue}>
              {formatReceiptAmount(summary.total, receipt.currency)}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button title="Done" onPress={handleFinish} />
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
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  headerCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h2,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  headerTotal: {
    ...typography.h3,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  payerCard: {
    marginBottom: spacing.lg,
  },
  payerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  payerInfo: {
    marginLeft: spacing.md,
  },
  payerName: {
    ...typography.bodyMedium,
  },
  payerLabel: {
    ...typography.caption,
    color: colors.primary,
  },
  payerItems: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  payerItemsLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  itemName: {
    ...typography.caption,
    flex: 1,
    marginRight: spacing.md,
  },
  itemAmount: {
    ...typography.caption,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  totalLabel: {
    ...typography.bodyMedium,
  },
  totalAmount: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  owingCard: {
    marginBottom: spacing.md,
  },
  owingCardSettled: {
    opacity: 0.7,
  },
  owingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  owingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  owingName: {
    ...typography.bodyMedium,
  },
  owingAmount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  settledText: {
    ...typography.small,
    color: colors.success,
  },
  owingItems: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  owingItem: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  owingActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  payButton: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  payButtonDisabled: {
    backgroundColor: colors.borderLight,
  },
  payButtonText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  payButtonTextDisabled: {
    color: colors.textSecondary,
  },
  settleButton: {
    flex: 1,
  },
  remindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  remindButtonText: {
    ...typography.small,
    color: colors.primary,
  },
  summaryCard: {
    marginTop: spacing.lg,
  },
  summaryTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  summaryTotalLabel: {
    ...typography.h3,
  },
  summaryTotalValue: {
    ...typography.h3,
    color: colors.primary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
