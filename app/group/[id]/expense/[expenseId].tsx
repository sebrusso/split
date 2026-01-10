import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../../lib/supabase";
import { Expense, Member, Split, SplitMethod } from "../../../../lib/types";
import { colors, spacing, typography, borderRadius } from "../../../../lib/theme";
import {
  Button,
  Input,
  Avatar,
  Card,
  CategoryPicker,
  CategoryButton,
  SplitMethodPicker,
  AmountInput,
  ReceiptViewer,
  ReceiptThumbnail,
  AddReceiptButton,
} from "../../../../components/ui";
import { getCategoryDisplay, getDefaultCategory } from "../../../../lib/categories";
import {
  calculateSplits,
  validateSplitData,
  getSplitMethodLabel,
} from "../../../../lib/splits";
import { uploadReceipt, deleteReceipt, validateReceiptImage } from "../../../../lib/storage";
import { formatCurrency, formatRelativeDate } from "../../../../lib/utils";

export default function ExpenseDetailScreen() {
  const { id: groupId, expenseId } = useLocalSearchParams<{
    id: string;
    expenseId: string;
  }>();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  // Form state
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [category, setCategory] = useState("other");
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [localReceiptUri, setLocalReceiptUri] = useState<string | null>(null);

  // Split state
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [shares, setShares] = useState<Record<string, number>>({});

  // Modal state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);

  const [error, setError] = useState("");

  // Check if expense is deleted (soft deleted)
  const isDeleted = expense?.deleted_at !== null && expense?.deleted_at !== undefined;

  useEffect(() => {
    fetchData();
  }, [groupId, expenseId]);

  const fetchData = async () => {
    try {
      // Fetch expense with splits
      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .select(
          `
          *,
          payer:members!paid_by(id, name),
          splits(id, member_id, amount, member:members(id, name))
        `
        )
        .eq("id", expenseId)
        .single();

      if (expenseError) throw expenseError;

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;

      setExpense(expenseData);
      setMembers(membersData || []);

      // Initialize form state from expense data
      setAmount(expenseData.amount.toString());
      setDescription(expenseData.description);
      setPaidBy(expenseData.paid_by);
      setCategory(expenseData.category || "other");
      setNotes(expenseData.notes || "");
      setReceiptUrl(expenseData.receipt_url || null);
      setSplitMethod(expenseData.split_type || "equal");

      // Initialize split data
      if (expenseData.splits) {
        const memberIds = expenseData.splits.map((s: Split) => s.member_id);
        setSelectedMemberIds(memberIds);

        // Set exact amounts from current splits
        const amounts: Record<string, number> = {};
        expenseData.splits.forEach((s: Split) => {
          amounts[s.member_id] = s.amount;
        });
        setExactAmounts(amounts);

        // Initialize percentages and shares based on current splits
        const totalAmount = expenseData.amount;
        const percs: Record<string, number> = {};
        const shrs: Record<string, number> = {};
        expenseData.splits.forEach((s: Split) => {
          percs[s.member_id] = Math.round((s.amount / totalAmount) * 100);
          shrs[s.member_id] = 1;
        });
        setPercentages(percs);
        setShares(shrs);
      }
    } catch (err) {
      console.error("Error fetching expense:", err);
      setError("Failed to load expense details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [groupId, expenseId]);

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to add receipts."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const validation = await validateReceiptImage(uri);

      if (!validation.isValid) {
        Alert.alert("Invalid Image", validation.error || "Please select a valid image.");
        return;
      }

      setLocalReceiptUri(uri);
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to take receipt photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setLocalReceiptUri(uri);
    }
  };

  const showReceiptOptions = () => {
    Alert.alert("Add Receipt", "Choose an option", [
      { text: "Take Photo", onPress: handleTakePhoto },
      { text: "Choose from Library", onPress: handlePickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    const amountNum = parseFloat(amount);

    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!description.trim()) {
      setError("Please enter a description");
      return;
    }

    if (!paidBy) {
      setError("Please select who paid");
      return;
    }

    // Validate split data
    const splitValidation = validateSplitData(splitMethod, amountNum, {
      memberIds: selectedMemberIds,
      amounts: exactAmounts,
      percents: percentages,
      shares: shares,
    });

    if (!splitValidation.isValid) {
      setError(splitValidation.error || "Invalid split configuration");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Upload new receipt if changed
      let finalReceiptUrl = receiptUrl;
      if (localReceiptUri) {
        // Delete old receipt if exists
        if (receiptUrl) {
          await deleteReceipt(receiptUrl);
        }
        const uploadResult = await uploadReceipt(localReceiptUri, groupId!, expenseId!);
        if (uploadResult.data) {
          finalReceiptUrl = uploadResult.data;
        }
      }

      // Update expense
      const { error: updateError } = await supabase
        .from("expenses")
        .update({
          description: description.trim(),
          amount: amountNum,
          paid_by: paidBy,
          category,
          notes: notes.trim() || null,
          receipt_url: finalReceiptUrl,
          split_type: splitMethod,
        })
        .eq("id", expenseId);

      if (updateError) throw updateError;

      // Delete old splits and create new ones
      const { error: deleteError } = await supabase
        .from("splits")
        .delete()
        .eq("expense_id", expenseId);

      if (deleteError) throw deleteError;

      // Calculate new splits
      const newSplits = calculateSplits(splitMethod, amountNum, {
        memberIds: selectedMemberIds,
        amounts: exactAmounts,
        percents: percentages,
        shares: shares,
      });

      const splitsToInsert = newSplits.map((split) => ({
        expense_id: expenseId,
        member_id: split.member_id,
        amount: split.amount,
      }));

      const { error: splitsError } = await supabase.from("splits").insert(splitsToInsert);

      if (splitsError) throw splitsError;

      setIsEditing(false);
      setLocalReceiptUri(null);
      setReceiptUrl(finalReceiptUrl);
      fetchData();
    } catch (err) {
      console.error("Error updating expense:", err);
      setError("Failed to update expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Expense",
      "This expense will be moved to trash and can be restored within 30 days.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Soft delete - set deleted_at timestamp
              const { error } = await supabase
                .from("expenses")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", expenseId);

              if (error) throw error;

              Alert.alert("Expense Deleted", "You can restore this expense from the trash within 30 days.");
              router.back();
            } catch (err) {
              console.error("Error deleting expense:", err);
              Alert.alert("Error", "Failed to delete expense. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handlePermanentDelete = () => {
    Alert.alert(
      "Permanently Delete",
      "Are you sure? This action cannot be undone and will permanently delete the expense.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete receipt if exists
              if (receiptUrl) {
                await deleteReceipt(receiptUrl);
              }

              // Hard delete expense (cascades to splits)
              const { error } = await supabase
                .from("expenses")
                .delete()
                .eq("id", expenseId);

              if (error) throw error;

              router.back();
            } catch (err) {
              console.error("Error permanently deleting expense:", err);
              Alert.alert("Error", "Failed to delete expense. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    try {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: null })
        .eq("id", expenseId);

      if (error) throw error;

      Alert.alert("Expense Restored", "The expense has been restored.");
      router.back();
    } catch (err) {
      console.error("Error restoring expense:", err);
      Alert.alert("Error", "Failed to restore expense. Please try again.");
    }
  };

  const handleRemoveReceipt = () => {
    Alert.alert("Remove Receipt", "Are you sure you want to remove this receipt?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (receiptUrl) {
            await deleteReceipt(receiptUrl);
            setReceiptUrl(null);
          }
          setLocalReceiptUri(null);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Expense not found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const categoryDisplay = getCategoryDisplay(category);
  const displayReceiptUrl = localReceiptUri || receiptUrl;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Deleted Banner */}
          {isDeleted && (
            <View style={styles.deletedBanner}>
              <Text style={styles.deletedBannerText}>
                🗑️ This expense is in trash and will be permanently deleted after 30 days
              </Text>
            </View>
          )}

          {/* Amount */}
          {isEditing ? (
            <View style={styles.amountContainer}>
              <AmountInput
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>
          ) : (
            <View style={styles.amountContainer}>
              <Text style={styles.amountDisplay}>
                {formatCurrency(expense.amount)}
              </Text>
              <Text style={styles.dateDisplay}>
                {formatRelativeDate(expense.created_at)}
              </Text>
            </View>
          )}

          {/* Description */}
          {isEditing ? (
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., Dinner, Uber, Groceries"
              containerStyle={styles.inputContainer}
            />
          ) : (
            <Card style={styles.infoCard}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.value}>{expense.description}</Text>
            </Card>
          )}

          {/* Category */}
          <Text style={styles.sectionTitle}>Category</Text>
          {isEditing ? (
            <CategoryButton
              categoryId={category}
              onPress={() => setShowCategoryPicker(true)}
            />
          ) : (
            <Card style={styles.infoCard}>
              <View style={styles.categoryRow}>
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: categoryDisplay.color + "20" },
                  ]}
                >
                  <Text style={styles.categoryIconText}>{categoryDisplay.icon}</Text>
                </View>
                <Text style={styles.value}>{categoryDisplay.name}</Text>
              </View>
            </Card>
          )}

          {/* Paid By */}
          <Text style={styles.sectionTitle}>Paid by</Text>
          {isEditing ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.membersScroll}
            >
              {members.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberButton,
                    paidBy === member.id && styles.memberButtonSelected,
                  ]}
                  onPress={() => setPaidBy(member.id)}
                >
                  <Avatar
                    name={member.name}
                    size="md"
                    color={paidBy === member.id ? colors.primary : undefined}
                  />
                  <Text
                    style={[
                      styles.memberButtonText,
                      paidBy === member.id && styles.memberButtonTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {member.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Card style={styles.infoCard}>
              <View style={styles.paidByRow}>
                <Avatar name={expense.payer?.name || ""} size="sm" />
                <Text style={styles.paidByName}>{expense.payer?.name}</Text>
              </View>
            </Card>
          )}

          {/* Split */}
          <Text style={styles.sectionTitle}>Split</Text>
          {isEditing ? (
            <SplitMethodPicker
              selectedMethod={splitMethod}
              onSelect={setSplitMethod}
              amount={parseFloat(amount) || 0}
              members={members}
              selectedMemberIds={selectedMemberIds}
              exactAmounts={exactAmounts}
              percentages={percentages}
              shares={shares}
              onToggleMember={handleToggleMember}
              onExactAmountChange={(id, amt) =>
                setExactAmounts((prev) => ({ ...prev, [id]: amt }))
              }
              onPercentageChange={(id, pct) =>
                setPercentages((prev) => ({ ...prev, [id]: pct }))
              }
              onSharesChange={(id, shrs) =>
                setShares((prev) => ({ ...prev, [id]: shrs }))
              }
            />
          ) : (
            <Card style={styles.infoCard}>
              <Text style={styles.splitMethodLabel}>
                {getSplitMethodLabel(expense.split_type || "equal")}
              </Text>
              <View style={styles.splitsContainer}>
                {expense.splits?.map((split: Split) => (
                  <View key={split.id} style={styles.splitRow}>
                    <Avatar name={split.member?.name || ""} size="sm" />
                    <Text style={styles.splitName}>{split.member?.name}</Text>
                    <Text style={styles.splitAmount}>
                      {formatCurrency(split.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Notes */}
          {isEditing ? (
            <Input
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional notes..."
              multiline
              numberOfLines={3}
              containerStyle={styles.inputContainer}
            />
          ) : notes ? (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Card style={styles.infoCard}>
                <Text style={styles.notesText}>{notes}</Text>
              </Card>
            </>
          ) : null}

          {/* Receipt */}
          <Text style={styles.sectionTitle}>Receipt</Text>
          {isEditing ? (
            <View>
              {displayReceiptUrl ? (
                <View style={styles.receiptPreview}>
                  <ReceiptThumbnail
                    imageUrl={displayReceiptUrl}
                    onPress={() => setShowReceiptViewer(true)}
                    onRemove={handleRemoveReceipt}
                    size="lg"
                  />
                  <TouchableOpacity
                    style={styles.changeReceiptButton}
                    onPress={showReceiptOptions}
                  >
                    <Text style={styles.changeReceiptText}>Change Receipt</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <AddReceiptButton onPress={showReceiptOptions} />
              )}
            </View>
          ) : displayReceiptUrl ? (
            <TouchableOpacity
              style={styles.receiptCard}
              onPress={() => setShowReceiptViewer(true)}
            >
              <ReceiptThumbnail imageUrl={displayReceiptUrl} size="md" />
              <Text style={styles.viewReceiptText}>Tap to view receipt</Text>
            </TouchableOpacity>
          ) : (
            <Card style={styles.infoCard}>
              <Text style={styles.noReceiptText}>No receipt attached</Text>
            </Card>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {isDeleted ? (
            <View style={styles.viewButtons}>
              <Button
                title="Delete Forever"
                variant="danger"
                onPress={handlePermanentDelete}
                fullWidth={false}
                style={styles.deleteButton}
              />
              <Button
                title="Restore"
                onPress={handleRestore}
                fullWidth={false}
                style={styles.editButton}
              />
            </View>
          ) : isEditing ? (
            <View style={styles.editButtons}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => {
                  setIsEditing(false);
                  // Reset form state
                  setAmount(expense.amount.toString());
                  setDescription(expense.description);
                  setPaidBy(expense.paid_by);
                  setCategory(expense.category || "other");
                  setNotes(expense.notes || "");
                  setLocalReceiptUri(null);
                }}
                fullWidth={false}
                style={styles.cancelButton}
              />
              <Button
                title="Save Changes"
                onPress={handleSave}
                loading={saving}
                fullWidth={false}
                style={styles.saveButton}
              />
            </View>
          ) : (
            <View style={styles.viewButtons}>
              <Button
                title="Delete"
                variant="danger"
                onPress={handleDelete}
                fullWidth={false}
                style={styles.deleteButton}
              />
              <Button
                title="Edit Expense"
                onPress={() => setIsEditing(true)}
                fullWidth={false}
                style={styles.editButton}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
      <CategoryPicker
        visible={showCategoryPicker}
        selectedCategory={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
      />

      {displayReceiptUrl && (
        <ReceiptViewer
          visible={showReceiptViewer}
          imageUrl={displayReceiptUrl}
          onClose={() => setShowReceiptViewer(false)}
          onDelete={isEditing ? handleRemoveReceipt : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  amountContainer: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  amountDisplay: {
    ...typography.amount,
    color: colors.primary,
  },
  dateDisplay: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  infoCard: {
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.body,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  categoryIconText: {
    fontSize: 20,
  },
  membersScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  memberButton: {
    alignItems: "center",
    marginRight: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: "transparent",
    width: 72,
  },
  memberButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  memberButtonText: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  memberButtonTextSelected: {
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  paidByRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  paidByName: {
    ...typography.body,
    marginLeft: spacing.md,
  },
  splitMethodLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  splitsContainer: {
    marginTop: spacing.xs,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  splitName: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.sm,
  },
  splitAmount: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  notesText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  receiptPreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  changeReceiptButton: {
    marginLeft: spacing.lg,
  },
  changeReceiptText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  receiptCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewReceiptText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.md,
  },
  noReceiptText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelButton: {
    flex: 1,
    marginRight: spacing.sm,
  },
  saveButton: {
    flex: 2,
    marginLeft: spacing.sm,
  },
  viewButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deleteButton: {
    flex: 1,
    marginRight: spacing.sm,
  },
  editButton: {
    flex: 2,
    marginLeft: spacing.sm,
  },
  deletedBanner: {
    backgroundColor: colors.danger + "15",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger + "30",
  },
  deletedBannerText: {
    ...typography.small,
    color: colors.danger,
    textAlign: "center",
  },
});
