/**
 * Receipt Settlement Screen
 *
 * A simplified summary showing what YOU owe or are owed.
 * Clear separation between your share and the group's total.
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
  const [settling, setSettling] = useState(false);
  const [uploaderVenmo, setUploaderVenmo] = useState<string | null>(null);

  // Fetch current user's member record
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
  const isCurrentUserPayer = currentMember?.id === uploaderId;

  // Get current user's total
  const myTotal = summary?.memberTotals.find((t) => t.memberId === currentMember?.id);

  // Get payer's name
  const payerTotal = summary?.memberTotals.find((t) => t.memberId === uploaderId);
  const payerName = payerTotal?.memberName || 'Someone';

  // Calculate what's owed to the payer (everyone except the payer)
  const totalOwedToPayer = summary?.memberTotals
    .filter((t) => t.memberId !== uploaderId)
    .reduce((sum, t) => sum + t.grandTotal, 0) || 0;

  const handlePayVenmo = async () => {
    if (!myTotal || !uploaderVenmo) {
      Alert.alert(
        'Venmo Not Set Up',
        "The person who paid hasn't added their Venmo username yet.",
        [{ text: 'OK' }]
      );
      return;
    }

    const note = `${receipt?.merchant_name || 'Receipt'} - ${myTotal.claimedItems.map((i) => i.description).join(', ')}`;
    const url = generateVenmoLink(uploaderVenmo, myTotal.grandTotal, note);

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(
          `https://venmo.com/${uploaderVenmo}?txn=pay&amount=${myTotal.grandTotal}&note=${encodeURIComponent(note)}`
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to open Venmo');
    }
  };

  const handleFinish = async () => {
    if (!receiptId || !receipt || !summary || !uploaderId) return;

    try {
      setSettling(true);

      const receiptMarker = `[receipt:${receiptId}]`;
      const { data: existingExpenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('group_id', id)
        .ilike('notes', `%${receiptMarker}%`)
        .is('deleted_at', null)
        .limit(1);

      if (!existingExpenses || existingExpenses.length === 0) {
        const expenseDescription = receipt.merchant_name || 'Receipt';
        const expenseAmount = summary.total;
        const notesText = `From receipt scan${receipt.merchant_address ? ` at ${receipt.merchant_address}` : ''} ${receiptMarker}`;

        const { data: expense, error: expenseError } = await supabase
          .from('expenses')
          .insert({
            group_id: id,
            description: expenseDescription,
            amount: expenseAmount,
            paid_by: uploaderId,
            category: 'food',
            expense_date: receipt.receipt_date || new Date().toISOString().split('T')[0],
            notes: notesText,
            receipt_url: receipt.image_url,
            split_type: 'exact',
            currency: receipt.currency,
          })
          .select()
          .single();

        if (expenseError) throw expenseError;

        const splits = summary.memberTotals.map((memberTotal) => ({
          expense_id: expense.id,
          member_id: memberTotal.memberId,
          amount: memberTotal.grandTotal,
        }));

        if (splits.length > 0) {
          const { error: splitsError } = await supabase.from('splits').insert(splits);
          if (splitsError) throw splitsError;
        }
      }

      await supabase
        .from('receipts')
        .update({ status: 'settled' })
        .eq('id', receiptId);

      router.replace(`/group/${id}`);
    } catch (err: any) {
      console.error('Error finalizing receipt:', err);
      Alert.alert('Error', err.message || 'Failed to save receipt');
    } finally {
      setSettling(false);
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Main Summary Card - What You're Paying */}
        <Card style={styles.mainCard}>
          <View style={styles.mainCardHeader}>
            <Text style={styles.mainCardLabel}>
              {isCurrentUserPayer ? 'You paid' : 'Your share'}
            </Text>
            <Text style={styles.mainCardAmount}>
              {formatReceiptAmount(myTotal?.grandTotal || 0, receipt.currency)}
            </Text>
          </View>

          {/* Your items breakdown */}
          {myTotal && myTotal.claimedItems.length > 0 && (
            <View style={styles.itemsBreakdown}>
              {myTotal.claimedItems.map((item, index) => (
                <View key={index} style={styles.breakdownRow}>
                  <Text style={styles.breakdownItemName} numberOfLines={1}>
                    {item.shareFraction < 1
                      ? `${item.description} (${Math.round(item.shareFraction * 100)}%)`
                      : item.description}
                  </Text>
                  <Text style={styles.breakdownItemAmount}>
                    {formatReceiptAmount(item.amount, receipt.currency)}
                  </Text>
                </View>
              ))}
              {(myTotal.taxShare > 0 || myTotal.tipShare > 0) && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownItemName}>Tax & Tip</Text>
                  <Text style={styles.breakdownItemAmount}>
                    {formatReceiptAmount(myTotal.taxShare + myTotal.tipShare, receipt.currency)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Pay button if you owe money */}
          {!isCurrentUserPayer && myTotal && myTotal.grandTotal > 0 && (
            <View style={styles.paySection}>
              <Text style={styles.payToLabel}>
                Pay {payerName}
              </Text>
              <TouchableOpacity
                style={[styles.venmoButton, !uploaderVenmo && styles.venmoButtonDisabled]}
                onPress={handlePayVenmo}
              >
                <Text style={[styles.venmoButtonText, !uploaderVenmo && styles.venmoButtonTextDisabled]}>
                  {uploaderVenmo ? 'Pay with Venmo' : 'Venmo not set up'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Group Total Card */}
        <Card style={styles.groupCard}>
          <Text style={styles.groupCardTitle}>Group Total</Text>

          <View style={styles.groupTotalRow}>
            <Text style={styles.groupTotalLabel}>Bill Total</Text>
            <Text style={styles.groupTotalAmount}>
              {formatReceiptAmount(summary.total, receipt.currency)}
            </Text>
          </View>

          {isCurrentUserPayer && totalOwedToPayer > 0 && (
            <View style={styles.owedToYouSection}>
              <View style={styles.owedToYouHeader}>
                <Ionicons name="arrow-down-circle" size={20} color={colors.success} />
                <Text style={styles.owedToYouLabel}>Owed to you</Text>
              </View>
              <Text style={styles.owedToYouAmount}>
                {formatReceiptAmount(totalOwedToPayer, receipt.currency)}
              </Text>
            </View>
          )}

          {/* Simple member breakdown */}
          <View style={styles.membersList}>
            {summary.memberTotals.map((memberTotal) => (
              <View key={memberTotal.memberId} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Avatar name={memberTotal.memberName} size="sm" />
                  <Text style={styles.memberName}>
                    {memberTotal.memberName}
                    {memberTotal.memberId === currentMember?.id && ' (You)'}
                    {memberTotal.memberId === uploaderId && ' - Paid'}
                  </Text>
                </View>
                <Text style={styles.memberAmount}>
                  {formatReceiptAmount(memberTotal.grandTotal, receipt.currency)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Done"
          onPress={handleFinish}
          loading={settling}
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
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  // Main card - Your share
  mainCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  mainCardHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  mainCardLabel: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  mainCardAmount: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  itemsBreakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.primary,
    paddingTop: spacing.md,
    opacity: 0.9,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  breakdownItemName: {
    ...typography.small,
    color: colors.text,
    flex: 1,
    marginRight: spacing.md,
  },
  breakdownItemAmount: {
    ...typography.small,
    color: colors.text,
  },
  paySection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.primary,
    alignItems: 'center',
  },
  payToLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  venmoButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  venmoButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  venmoButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  venmoButtonTextDisabled: {
    color: colors.borderLight,
  },
  // Group total card
  groupCard: {
    marginBottom: spacing.lg,
  },
  groupCardTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  groupTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  groupTotalLabel: {
    ...typography.bodyMedium,
  },
  groupTotalAmount: {
    ...typography.h3,
    color: colors.text,
  },
  owedToYouSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.successLight,
    marginHorizontal: -spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  owedToYouHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  owedToYouLabel: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  owedToYouAmount: {
    ...typography.h3,
    color: colors.success,
  },
  membersList: {
    marginTop: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  memberName: {
    ...typography.body,
    flex: 1,
  },
  memberAmount: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
