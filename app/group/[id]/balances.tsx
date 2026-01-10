import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../lib/supabase";
import { Group, Member, SettlementRecord } from "../../../lib/types";
import {
  formatCurrency,
  formatRelativeDate,
  calculateBalancesWithSettlements,
  simplifyDebts,
} from "../../../lib/utils";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../../lib/theme";
import { Card, Avatar, Button, SettlementMethodPicker } from "../../../components/ui";
import type { SettlementMethod } from "../../../components/ui/SettlementMethodPicker";
import { getSettlementMethodName, getSettlementMethodIcon } from "../../../components/ui/SettlementMethodPicker";
import { openPaymentApp, getPaymentAppName, getPaymentAppIcon, type PaymentApp } from "../../../lib/payment-links";
import { notifySettlementRecorded } from "../../../lib/notifications";

interface ExpenseWithSplits {
  id: string;
  paid_by: string;
  amount: number;
  splits: Array<{ member_id: string; amount: number }>;
}

export default function BalancesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [suggestedSettlements, setSuggestedSettlements] = useState<
    Array<{ from: string; to: string; amount: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settlingIndex, setSettlingIndex] = useState<number | null>(null);

  // Settlement modal state
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<{
    from: string;
    to: string;
    amount: number;
    index: number;
  } | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<SettlementMethod>("cash");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0]);
  const [showMethodPicker, setShowMethodPicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("group_id", id)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch expenses with splits
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select(
          `
          id,
          paid_by,
          amount,
          splits(member_id, amount)
        `,
        )
        .eq("group_id", id);

      if (expensesError) throw expensesError;

      // Fetch settlements
      const { data: settlementsData, error: settlementsError } = await supabase
        .from("settlements")
        .select(
          `
          *,
          from_member:members!from_member_id(id, name),
          to_member:members!to_member_id(id, name)
        `,
        )
        .eq("group_id", id)
        .order("settled_at", { ascending: false });

      if (settlementsError) throw settlementsError;
      setSettlementRecords(settlementsData || []);

      // Prepare data for calculations
      const expensesForCalc: ExpenseWithSplits[] = (expensesData || []).map(
        (exp) => ({
          id: exp.id,
          paid_by: exp.paid_by,
          amount: parseFloat(String(exp.amount)),
          splits: exp.splits.map((s: { member_id: string; amount: number }) => ({
            member_id: s.member_id,
            amount: parseFloat(String(s.amount)),
          })),
        }),
      );

      const settlementsForCalc = (settlementsData || []).map((s) => ({
        from_member_id: s.from_member_id,
        to_member_id: s.to_member_id,
        amount: parseFloat(String(s.amount)),
      }));

      // Calculate balances with settlements
      const calculatedBalances = calculateBalancesWithSettlements(
        expensesForCalc,
        settlementsForCalc,
        membersData || [],
      );
      setBalances(calculatedBalances);

      // Calculate suggested settlements from current balances
      const suggested = simplifyDebts(calculatedBalances, membersData || []);
      setSuggestedSettlements(suggested);
    } catch (error) {
      console.error("Error fetching balance data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getMemberById = (memberId: string): Member | undefined => {
    return members.find((m) => m.id === memberId);
  };

  const getBalanceColor = (balance: number): string => {
    if (balance > 0.01) return colors.success;
    if (balance < -0.01) return colors.danger;
    return colors.textSecondary;
  };

  const getBalanceLabel = (balance: number): string => {
    if (balance > 0.01) return "is owed";
    if (balance < -0.01) return "owes";
    return "settled up";
  };

  const handleSettle = (
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    index: number,
  ) => {
    // Open settlement modal
    setSelectedSettlement({ from: fromMemberId, to: toMemberId, amount, index });
    setSettlementMethod("cash");
    setSettlementNotes("");
    setSettlementDate(new Date().toISOString().split('T')[0]);
    setShowSettlementModal(true);
  };

  const handleConfirmSettlement = async () => {
    if (!selectedSettlement) return;

    setSettlingIndex(selectedSettlement.index);
    setShowSettlementModal(false);

    try {
      const { error } = await supabase.from("settlements").insert({
        group_id: id,
        from_member_id: selectedSettlement.from,
        to_member_id: selectedSettlement.to,
        amount: selectedSettlement.amount,
        settled_at: settlementDate + 'T12:00:00Z',
        method: settlementMethod,
        notes: settlementNotes.trim() || null,
      });

      if (error) throw error;

      // Send notification to the recipient
      const fromMember = getMemberById(selectedSettlement.from);
      const toMember = getMemberById(selectedSettlement.to);
      if (fromMember && toMember && toMember.clerk_user_id && group) {
        notifySettlementRecorded(
          {
            fromName: fromMember.name,
            toUserId: toMember.clerk_user_id,
            amount: selectedSettlement.amount,
          },
          group.name,
          id!
        );
      }

      // Refresh data
      fetchData();
    } catch (error) {
      console.error("Error creating settlement:", error);
      Alert.alert("Error", "Failed to record settlement. Please try again.");
    } finally {
      setSettlingIndex(null);
      setSelectedSettlement(null);
    }
  };

  const handleCancelSettlement = () => {
    setShowSettlementModal(false);
    setSelectedSettlement(null);
  };

  const handlePayWithApp = async (app: PaymentApp) => {
    if (!selectedSettlement) return;

    const fromMember = getMemberById(selectedSettlement.from);
    const toMember = getMemberById(selectedSettlement.to);

    const note = `${group?.name || 'Group'} - Payment from ${fromMember?.name} to ${toMember?.name}`;

    await openPaymentApp(app, {
      amount: selectedSettlement.amount,
      note,
    });
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    Alert.alert(
      "Delete Settlement",
      "Are you sure you want to remove this settlement record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("settlements")
                .delete()
                .eq("id", settlementId);

              if (error) throw error;

              // Refresh data
              fetchData();
            } catch (error) {
              console.error("Error deleting settlement:", error);
              Alert.alert("Error", "Failed to delete settlement. Please try again.");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const totalOwed = Array.from(balances.values())
    .filter((b) => b > 0)
    .reduce((sum, b) => sum + b, 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Balances",
          headerBackTitle: group?.name || "Back",
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Card */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Outstanding</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(totalOwed, group?.currency)}
            </Text>
            <Text style={styles.summarySubtext}>
              {suggestedSettlements.length === 0
                ? "All settled up!"
                : `${suggestedSettlements.length} payment${suggestedSettlements.length === 1 ? "" : "s"} needed`}
            </Text>
          </Card>

          {/* Member Balances */}
          <Text style={styles.sectionTitle}>Individual Balances</Text>
          {members.map((member) => {
            const balance = balances.get(member.id) || 0;
            return (
              <Card key={member.id} style={styles.balanceCard}>
                <View style={styles.balanceRow}>
                  <View style={styles.memberInfo}>
                    <Avatar name={member.name} size="md" />
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text
                        style={[
                          styles.balanceLabel,
                          { color: getBalanceColor(balance) },
                        ]}
                      >
                        {getBalanceLabel(balance)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.balanceAmount,
                      { color: getBalanceColor(balance) },
                    ]}
                  >
                    {balance === 0
                      ? "$0.00"
                      : formatCurrency(Math.abs(balance), group?.currency)}
                  </Text>
                </View>
              </Card>
            );
          })}

          {/* Suggested Settlements */}
          {suggestedSettlements.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Settle Up</Text>
              <Text style={styles.sectionSubtitle}>
                Tap to record a payment
              </Text>
              {suggestedSettlements.map((settlement, index) => {
                const fromMember = getMemberById(settlement.from);
                const toMember = getMemberById(settlement.to);
                const isSettling = settlingIndex === index;
                return (
                  <Card key={index} style={styles.settlementCard}>
                    <View style={styles.settlementContent}>
                      <View style={styles.settlementParties}>
                        <View style={styles.settlementMember}>
                          <Avatar name={fromMember?.name || "?"} size="sm" />
                          <Text style={styles.settlementName}>
                            {fromMember?.name || "Unknown"}
                          </Text>
                        </View>
                        <View style={styles.arrowContainer}>
                          <Text style={styles.arrow}>→</Text>
                        </View>
                        <View style={styles.settlementMember}>
                          <Avatar name={toMember?.name || "?"} size="sm" />
                          <Text style={styles.settlementName}>
                            {toMember?.name || "Unknown"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.settlementActions}>
                        <Text style={styles.settlementAmount}>
                          {formatCurrency(settlement.amount, group?.currency)}
                        </Text>
                        <TouchableOpacity
                          style={styles.settleButton}
                          onPress={() =>
                            handleSettle(
                              settlement.from,
                              settlement.to,
                              settlement.amount,
                              index,
                            )
                          }
                          disabled={isSettling}
                        >
                          <Text style={styles.settleButtonText}>
                            {isSettling ? "..." : "Settle"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </>
          )}

          {/* Settlement History */}
          {settlementRecords.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Settlement History</Text>
              {settlementRecords.map((record) => (
                <Card key={record.id} style={styles.historyCard}>
                  <TouchableOpacity
                    style={styles.historyContent}
                    onLongPress={() => handleDeleteSettlement(record.id)}
                  >
                    <View style={styles.historyInfo}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyText}>
                          <Text style={styles.historyName}>
                            {record.from_member?.name}
                          </Text>
                          {" paid "}
                          <Text style={styles.historyName}>
                            {record.to_member?.name}
                          </Text>
                        </Text>
                        {record.method && (
                          <Text style={styles.historyMethodIcon}>
                            {getSettlementMethodIcon(record.method as SettlementMethod)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.historyDate}>
                        {formatRelativeDate(record.settled_at)}
                        {record.method && ` • ${getSettlementMethodName(record.method as SettlementMethod)}`}
                      </Text>
                      {record.notes && (
                        <Text style={styles.historyNotes} numberOfLines={2}>
                          {record.notes}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.historyAmount}>
                      {formatCurrency(record.amount, group?.currency)}
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}
              <Text style={styles.historyHint}>
                Long press to delete a settlement
              </Text>
            </>
          )}

          {/* Empty State */}
          {members.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>No members yet</Text>
              <Text style={styles.emptySubtext}>
                Add members to start tracking balances
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Settlement Modal */}
      <Modal
        visible={showSettlementModal}
        animationType="slide"
        transparent
        onRequestClose={handleCancelSettlement}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCancelSettlement}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboardAvoid}
          >
            <Pressable
              style={styles.modalContainer}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Record Settlement</Text>

              {selectedSettlement && (
                <>
                  {/* Settlement Summary */}
                  <View style={styles.settlementSummary}>
                    <View style={styles.settlementParties}>
                      <View style={styles.settlementMember}>
                        <Avatar
                          name={getMemberById(selectedSettlement.from)?.name || "?"}
                          size="sm"
                        />
                        <Text style={styles.settlementName}>
                          {getMemberById(selectedSettlement.from)?.name}
                        </Text>
                      </View>
                      <View style={styles.arrowContainer}>
                        <Text style={styles.arrow}>→</Text>
                      </View>
                      <View style={styles.settlementMember}>
                        <Avatar
                          name={getMemberById(selectedSettlement.to)?.name || "?"}
                          size="sm"
                        />
                        <Text style={styles.settlementName}>
                          {getMemberById(selectedSettlement.to)?.name}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalAmount}>
                      {formatCurrency(selectedSettlement.amount, group?.currency)}
                    </Text>
                  </View>

                  {/* Quick Pay Buttons */}
                  <View style={styles.quickPaySection}>
                    <Text style={styles.quickPayLabel}>Quick Pay With:</Text>
                    <View style={styles.quickPayButtons}>
                      <TouchableOpacity
                        style={styles.quickPayButton}
                        onPress={() => handlePayWithApp('venmo')}
                      >
                        <Text style={styles.quickPayIcon}>
                          {getPaymentAppIcon('venmo')}
                        </Text>
                        <Text style={styles.quickPayText}>Venmo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickPayButton}
                        onPress={() => handlePayWithApp('paypal')}
                      >
                        <Text style={styles.quickPayIcon}>
                          {getPaymentAppIcon('paypal')}
                        </Text>
                        <Text style={styles.quickPayText}>PayPal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickPayButton}
                        onPress={() => handlePayWithApp('cashapp')}
                      >
                        <Text style={styles.quickPayIcon}>
                          {getPaymentAppIcon('cashapp')}
                        </Text>
                        <Text style={styles.quickPayText}>Cash App</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickPayButton}
                        onPress={() => handlePayWithApp('zelle')}
                      >
                        <Text style={styles.quickPayIcon}>
                          {getPaymentAppIcon('zelle')}
                        </Text>
                        <Text style={styles.quickPayText}>Zelle</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.quickPayHint}>
                      Opens the app with pre-filled amount
                    </Text>
                  </View>

                  {/* Payment Method */}
                  <Text style={styles.modalLabel}>Payment Method</Text>
                  <TouchableOpacity
                    style={styles.methodSelector}
                    onPress={() => setShowMethodPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.methodIcon}>
                      {getSettlementMethodIcon(settlementMethod)}
                    </Text>
                    <Text style={styles.methodText}>
                      {getSettlementMethodName(settlementMethod)}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>

                  {/* Date */}
                  <Text style={styles.modalLabel}>Date</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={settlementDate}
                    onChangeText={setSettlementDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                  />

                  {/* Notes */}
                  <Text style={styles.modalLabel}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={settlementNotes}
                    onChangeText={setSettlementNotes}
                    placeholder="e.g., Venmo transaction #123"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />

                  {/* Action Buttons */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancelSettlement}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={handleConfirmSettlement}
                    >
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Settlement Method Picker Modal */}
      <SettlementMethodPicker
        visible={showMethodPicker}
        selectedMethod={settlementMethod}
        onSelect={setSettlementMethod}
        onClose={() => setShowMethodPicker(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
    backgroundColor: colors.primaryLight,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  summaryAmount: {
    ...typography.amount,
    color: colors.primaryDark,
    marginVertical: spacing.xs,
  },
  summarySubtext: {
    ...typography.small,
    color: colors.primaryDark,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionSubtitle: {
    ...typography.small,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  balanceCard: {
    marginBottom: spacing.sm,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  memberText: {
    marginLeft: spacing.md,
  },
  memberName: {
    ...typography.bodyMedium,
  },
  balanceLabel: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  balanceAmount: {
    ...typography.amountMedium,
    fontSize: 20,
  },
  settlementCard: {
    marginBottom: spacing.sm,
  },
  settlementContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settlementParties: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settlementMember: {
    alignItems: "center",
    width: 60,
  },
  settlementName: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  arrowContainer: {
    paddingHorizontal: spacing.sm,
  },
  arrow: {
    fontSize: 20,
    color: colors.textMuted,
  },
  settlementActions: {
    alignItems: "flex-end",
  },
  settlementAmount: {
    ...typography.bodyMedium,
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
    marginBottom: spacing.xs,
  },
  settleButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  settleButtonText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  historyCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.borderLight,
  },
  historyContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyInfo: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  historyName: {
    fontFamily: "Inter_500Medium",
  },
  historyMethodIcon: {
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  historyDate: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  historyNotes: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: "italic",
  },
  historyAmount: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  historyHint: {
    ...typography.small,
    textAlign: "center",
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalKeyboardAvoid: {
    width: "100%",
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: "85%",
    paddingBottom: spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  settlementSummary: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  modalAmount: {
    ...typography.amount,
    color: colors.primaryDark,
    marginTop: spacing.md,
  },
  quickPaySection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  quickPayLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  quickPayButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  quickPayButton: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickPayIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  quickPayText: {
    ...typography.small,
    color: colors.text,
  },
  quickPayHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    fontSize: 11,
  },
  modalLabel: {
    ...typography.bodyMedium,
    marginLeft: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  methodSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  methodText: {
    ...typography.bodyMedium,
    flex: 1,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
  dateInput: {
    ...typography.body,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesInput: {
    ...typography.body,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontFamily: "Inter_600SemiBold",
  },
});
