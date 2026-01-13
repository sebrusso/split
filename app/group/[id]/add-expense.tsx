import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../lib/supabase";
import { Member, Group, SplitMethod } from "../../../lib/types";
import { colors, spacing, typography, borderRadius } from "../../../lib/theme";
import {
  Button,
  Input,
  Avatar,
  Card,
  CategoryPicker,
  CategoryButton,
  SplitMethodPicker,
  AmountInput,
  ReceiptThumbnail,
  AddReceiptButton,
  CurrencyPicker,
  CurrencyPill,
  ConversionPreview,
} from "../../../components/ui";
import { getDefaultCategory } from "../../../lib/categories";
import {
  calculateSplits,
  validateSplitData,
  getSplitMethodLabel,
} from "../../../lib/splits";
import { uploadReceipt, validateReceiptImage } from "../../../lib/storage";
import { notifyExpenseAdded } from "../../../lib/notifications";
import { useAuth } from "../../../lib/auth-context";
import { getExchangeRate } from "../../../lib/exchange-rates";
import { useAnalytics, AnalyticsEvents } from "../../../lib/analytics-provider";

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { trackEvent } = useAnalytics();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Category state
  const [category, setCategory] = useState(getDefaultCategory().id);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Currency state
  const [expenseCurrency, setExpenseCurrency] = useState<string | null>(null); // null = use group currency
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);

  // Notes state
  const [notes, setNotes] = useState("");

  // Receipt state
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  // Split method state
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [shares, setShares] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const { data: groupData } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      setGroup(groupData);

      const { data: membersData } = await supabase
        .from("members")
        .select("*")
        .eq("group_id", id)
        .order("created_at", { ascending: true });

      if (membersData && membersData.length > 0) {
        setMembers(membersData);
        setPaidBy(membersData[0].id);
        setSelectedMemberIds(membersData.map((m) => m.id));

        // Initialize shares to 1 for each member
        const initialShares: Record<string, number> = {};
        membersData.forEach((m) => {
          initialShares[m.id] = 1;
        });
        setShares(initialShares);

        // Initialize equal percentages
        const equalPercent = Math.floor(100 / membersData.length);
        const initialPercentages: Record<string, number> = {};
        membersData.forEach((m, i) => {
          initialPercentages[m.id] =
            i === membersData.length - 1
              ? 100 - equalPercent * (membersData.length - 1)
              : equalPercent;
        });
        setPercentages(initialPercentages);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  // Fetch exchange rate when currency changes
  const fetchExchangeRate = useCallback(async (fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) {
      setExchangeRate(1);
      return;
    }

    setExchangeRateLoading(true);
    try {
      const rate = await getExchangeRate(fromCurrency, toCurrency);
      setExchangeRate(rate);
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      setExchangeRate(1); // Fallback to 1:1
    } finally {
      setExchangeRateLoading(false);
    }
  }, []);

  // Handle currency selection
  const handleCurrencySelect = (currency: string) => {
    const groupCurrency = group?.currency || "USD";
    if (currency === groupCurrency) {
      // Reset to group currency
      setExpenseCurrency(null);
      setExchangeRate(1);
    } else {
      setExpenseCurrency(currency);
      fetchExchangeRate(currency, groupCurrency);
    }
  };

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

      setReceiptUri(uri);
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
      setReceiptUri(uri);
    }
  };

  const showReceiptOptions = () => {
    Alert.alert("Add Receipt", "Choose an option", [
      { text: "Take Photo", onPress: handleTakePhoto },
      { text: "Choose from Library", onPress: handlePickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleRemoveReceipt = () => {
    setReceiptUri(null);
  };

  const handleSubmit = async () => {
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

    setLoading(true);
    setError("");

    try {
      // Prepare currency data
      const groupCurrency = group?.currency || "USD";
      const actualCurrency = expenseCurrency || groupCurrency;
      const needsConversion = actualCurrency !== groupCurrency;

      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          group_id: id,
          description: description.trim(),
          amount: amountNum,
          paid_by: paidBy,
          category,
          notes: notes.trim() || null,
          split_type: splitMethod,
          // Multi-currency fields
          currency: needsConversion ? actualCurrency : null,
          exchange_rate: needsConversion ? exchangeRate : null,
          exchange_rate_time: needsConversion ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Upload receipt if present
      let receiptUrl: string | null = null;
      if (receiptUri) {
        const uploadResult = await uploadReceipt(receiptUri, id!, expense.id);
        if (uploadResult.data) {
          receiptUrl = uploadResult.data;
          // Update expense with receipt URL
          await supabase
            .from("expenses")
            .update({ receipt_url: receiptUrl })
            .eq("id", expense.id);
        }
      }

      // Calculate splits based on method
      const calculatedSplits = calculateSplits(splitMethod, amountNum, {
        memberIds: selectedMemberIds,
        amounts: exactAmounts,
        percents: percentages,
        shares: shares,
      });

      const splits = calculatedSplits.map((split) => ({
        expense_id: expense.id,
        member_id: split.member_id,
        amount: split.amount,
      }));

      const { error: splitsError } = await supabase.from("splits").insert(splits);

      if (splitsError) throw splitsError;

      // Send push notification to other group members
      const payer = members.find((m) => m.id === paidBy);
      if (group && payer) {
        notifyExpenseAdded(
          id!,
          {
            description: description.trim(),
            amount: amountNum,
            payerName: payer.name,
          },
          group.name,
          userId || undefined
        );
      }

      trackEvent(AnalyticsEvents.EXPENSE_ADDED, {
        groupId: id,
        amount: amountNum,
        category,
        splitMethod,
        hasReceipt: !!receiptUri,
      });
      router.back();
    } catch (err) {
      console.error("Error creating expense:", err);
      setError("Failed to add expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate preview based on split method
  const getPreviewText = () => {
    const amountNum = parseFloat(amount) || 0;
    if (amountNum === 0) return null;

    switch (splitMethod) {
      case "equal": {
        if (selectedMemberIds.length === 0) return null;
        const perPerson = amountNum / selectedMemberIds.length;
        return `$${perPerson.toFixed(2)} each (${selectedMemberIds.length} people)`;
      }
      case "exact": {
        const total = Object.values(exactAmounts).reduce((sum, val) => sum + (val || 0), 0);
        const remaining = amountNum - total;
        if (Math.abs(remaining) < 0.01) return "Amounts add up correctly";
        return `$${Math.abs(remaining).toFixed(2)} ${remaining > 0 ? "remaining" : "over"}`;
      }
      case "percent": {
        const total = Object.values(percentages).reduce((sum, val) => sum + (val || 0), 0);
        if (Math.abs(total - 100) < 0.01) return "Percentages add up to 100%";
        return `${Math.abs(100 - total).toFixed(1)}% ${total < 100 ? "remaining" : "over"}`;
      }
      case "shares": {
        const totalShares = Object.values(shares).reduce((sum, val) => sum + (val || 0), 0);
        if (totalShares === 0) return "Assign at least 1 share";
        return `${totalShares} total shares`;
      }
      default:
        return null;
    }
  };

  const previewText = getPreviewText();
  const isValidSplit =
    splitMethod === "equal"
      ? selectedMemberIds.length > 0
      : splitMethod === "exact"
        ? Math.abs(
            Object.values(exactAmounts).reduce((sum, val) => sum + (val || 0), 0) -
              (parseFloat(amount) || 0)
          ) < 0.01
        : splitMethod === "percent"
          ? Math.abs(
              Object.values(percentages).reduce((sum, val) => sum + (val || 0), 0) - 100
            ) < 0.01
          : Object.values(shares).reduce((sum, val) => sum + (val || 0), 0) > 0;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Scan Receipt Option */}
          <TouchableOpacity
            style={styles.scanReceiptButton}
            onPress={() => router.push(`/group/${id}/scan-receipt`)}
          >
            <View style={styles.scanReceiptContent}>
              <Ionicons name="scan" size={24} color={colors.primary} />
              <View style={styles.scanReceiptText}>
                <Text style={styles.scanReceiptTitle}>Scan a Receipt</Text>
                <Text style={styles.scanReceiptSubtitle}>
                  Auto-extract items and split with your group
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or enter manually</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Amount Input with Currency Picker */}
          <View style={styles.amountContainer}>
            <View style={styles.amountRow}>
              <AmountInput
                value={amount}
                onChangeText={setAmount}
                currency={expenseCurrency || group?.currency || "USD"}
                autoFocus
              />
              <CurrencyPill
                currencyCode={expenseCurrency || group?.currency || "USD"}
                onPress={() => setShowCurrencyPicker(true)}
                size="md"
              />
            </View>

            {/* Conversion Preview */}
            {expenseCurrency && expenseCurrency !== (group?.currency || "USD") && parseFloat(amount) > 0 && (
              <ConversionPreview
                fromAmount={parseFloat(amount)}
                fromCurrency={expenseCurrency}
                toCurrency={group?.currency || "USD"}
                exchangeRate={exchangeRate}
                loading={exchangeRateLoading}
              />
            )}
          </View>

          {/* Description */}
          <Input
            label="What's it for?"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g., Dinner, Uber, Groceries"
            containerStyle={styles.inputContainer}
          />

          {/* Category */}
          <Text style={styles.sectionTitle}>Category</Text>
          <CategoryButton
            categoryId={category}
            onPress={() => setShowCategoryPicker(true)}
          />

          {/* Paid By */}
          <Text style={styles.sectionTitle}>Paid by</Text>
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

          {/* Split Method */}
          <Text style={styles.sectionTitle}>Split between</Text>
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
            onExactAmountChange={(memberId, amt) =>
              setExactAmounts((prev) => ({ ...prev, [memberId]: amt }))
            }
            onPercentageChange={(memberId, pct) =>
              setPercentages((prev) => ({ ...prev, [memberId]: pct }))
            }
            onSharesChange={(memberId, shrs) =>
              setShares((prev) => ({ ...prev, [memberId]: shrs }))
            }
          />

          {/* Split Preview */}
          {amount && previewText && (
            <Card
              style={[styles.previewCard, !isValidSplit && styles.previewCardError]}
            >
              <Text style={styles.previewTitle}>
                {getSplitMethodLabel(splitMethod)}
              </Text>
              <Text
                style={[
                  styles.previewAmount,
                  !isValidSplit && styles.previewAmountError,
                ]}
              >
                {previewText}
              </Text>
            </Card>
          )}

          {/* Notes (optional) */}
          <Input
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any additional notes..."
            multiline
            numberOfLines={2}
            containerStyle={styles.inputContainer}
          />

          {/* Receipt */}
          <Text style={styles.sectionTitle}>Receipt (optional)</Text>
          {receiptUri ? (
            <View style={styles.receiptPreview}>
              <ReceiptThumbnail
                imageUrl={receiptUri}
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

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Add Expense"
            onPress={handleSubmit}
            loading={loading}
            disabled={!amount || !description.trim() || !isValidSplit}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Category Picker Modal */}
      <CategoryPicker
        visible={showCategoryPicker}
        selectedCategory={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
      />

      {/* Currency Picker Modal */}
      <CurrencyPicker
        visible={showCurrencyPicker}
        selectedCurrency={expenseCurrency || group?.currency || "USD"}
        onSelect={handleCurrencySelect}
        onClose={() => setShowCurrencyPicker(false)}
        title="Expense Currency"
      />
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
  scanReceiptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    marginBottom: spacing.lg,
  },
  scanReceiptContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  scanReceiptText: {
    flex: 1,
  },
  scanReceiptTitle: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  scanReceiptSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    ...typography.small,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
  },
  amountContainer: {
    marginVertical: spacing.xl,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  membersScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
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
  previewCard: {
    backgroundColor: colors.primaryLight,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  previewCardError: {
    backgroundColor: colors.dangerLight,
  },
  previewTitle: {
    ...typography.small,
    color: colors.primary,
  },
  previewAmount: {
    ...typography.h3,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  previewAmountError: {
    color: colors.danger,
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
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
    marginVertical: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
