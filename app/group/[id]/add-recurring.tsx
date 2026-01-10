import { useEffect, useState } from "react";
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
import { useLocalSearchParams, router, Stack } from "expo-router";
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
} from "../../../components/ui";
import { getDefaultCategory } from "../../../lib/categories";
import { calculateSplits, validateSplitData } from "../../../lib/splits";
import { useAuth } from "../../../lib/auth-context";

type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

const FREQUENCIES: { value: Frequency; label: string; description: string }[] = [
  { value: "daily", label: "Daily", description: "Every day" },
  { value: "weekly", label: "Weekly", description: "Every week" },
  { value: "biweekly", label: "Biweekly", description: "Every 2 weeks" },
  { value: "monthly", label: "Monthly", description: "Once a month" },
  { value: "yearly", label: "Yearly", description: "Once a year" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export default function AddRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [category, setCategory] = useState(getDefaultCategory().id);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [notes, setNotes] = useState("");

  // Recurrence state
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  // Split state
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

        const initialShares: Record<string, number> = {};
        membersData.forEach((m) => {
          initialShares[m.id] = 1;
        });
        setShares(initialShares);

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

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const calculateNextDueDate = (): string => {
    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start >= today) {
      return startDate;
    }

    // If start date is in the past, calculate next occurrence
    let next = new Date(start);
    while (next < today) {
      switch (frequency) {
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "biweekly":
          next.setDate(next.getDate() + 14);
          break;
        case "monthly":
          next.setMonth(next.getMonth() + 1);
          break;
        case "yearly":
          next.setFullYear(next.getFullYear() + 1);
          break;
      }
    }
    return next.toISOString().split("T")[0];
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
      setError("Please select who pays");
      return;
    }

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
      const nextDueDate = calculateNextDueDate();

      // Create recurring expense
      const { data: recurring, error: recurringError } = await supabase
        .from("recurring_expenses")
        .insert({
          group_id: id,
          description: description.trim(),
          amount: amountNum,
          paid_by: paidBy,
          category,
          split_type: splitMethod,
          notes: notes.trim() || null,
          frequency,
          day_of_week: frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : null,
          day_of_month: frequency === "monthly" ? dayOfMonth : null,
          start_date: startDate,
          next_due_date: nextDueDate,
          created_by: userId,
        })
        .select()
        .single();

      if (recurringError) throw recurringError;

      // Create splits configuration
      const calculatedSplits = calculateSplits(splitMethod, amountNum, {
        memberIds: selectedMemberIds,
        amounts: exactAmounts,
        percents: percentages,
        shares: shares,
      });

      const splitsToInsert = calculatedSplits.map((split) => ({
        recurring_expense_id: recurring.id,
        member_id: split.member_id,
        amount: splitMethod === "exact" ? exactAmounts[split.member_id] : null,
        percentage: splitMethod === "percent" ? percentages[split.member_id] : null,
        shares: splitMethod === "shares" ? shares[split.member_id] : 1,
      }));

      const { error: splitsError } = await supabase
        .from("recurring_expense_splits")
        .insert(splitsToInsert);

      if (splitsError) throw splitsError;

      Alert.alert(
        "Recurring Expense Created",
        `"${description}" will be added automatically ${FREQUENCIES.find((f) => f.value === frequency)?.description.toLowerCase()}.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      console.error("Error creating recurring expense:", err);
      setError("Failed to create recurring expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
    <>
      <Stack.Screen options={{ title: "Add Recurring Expense" }} />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount */}
            <View style={styles.amountContainer}>
              <AmountInput
                value={amount}
                onChangeText={setAmount}
                currency={group?.currency || "USD"}
                autoFocus
              />
            </View>

            {/* Description */}
            <Input
              label="What's it for?"
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., Rent, Netflix, Utilities"
              containerStyle={styles.inputContainer}
            />

            {/* Category */}
            <Text style={styles.sectionTitle}>Category</Text>
            <CategoryButton
              categoryId={category}
              onPress={() => setShowCategoryPicker(true)}
            />

            {/* Paid By */}
            <Text style={styles.sectionTitle}>Who pays?</Text>
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

            {/* Frequency */}
            <Text style={styles.sectionTitle}>How often?</Text>
            <View style={styles.frequencyGrid}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[
                    styles.frequencyButton,
                    frequency === f.value && styles.frequencyButtonSelected,
                  ]}
                  onPress={() => setFrequency(f.value)}
                >
                  <Text
                    style={[
                      styles.frequencyLabel,
                      frequency === f.value && styles.frequencyLabelSelected,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Day Selection */}
            {(frequency === "weekly" || frequency === "biweekly") && (
              <>
                <Text style={styles.sectionTitle}>On which day?</Text>
                <View style={styles.daysRow}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        styles.dayButton,
                        dayOfWeek === day.value && styles.dayButtonSelected,
                      ]}
                      onPress={() => setDayOfWeek(day.value)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          dayOfWeek === day.value && styles.dayTextSelected,
                        ]}
                      >
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {frequency === "monthly" && (
              <>
                <Text style={styles.sectionTitle}>On which day of the month?</Text>
                <Input
                  value={String(dayOfMonth)}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 1;
                    setDayOfMonth(Math.max(1, Math.min(31, num)));
                  }}
                  keyboardType="number-pad"
                  placeholder="1-31"
                  containerStyle={styles.inputContainer}
                />
              </>
            )}

            {/* Start Date */}
            <Input
              label="Start date"
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              containerStyle={styles.inputContainer}
            />

            {/* Split */}
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

            {/* Notes */}
            <Input
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional notes..."
              multiline
              numberOfLines={2}
              containerStyle={styles.inputContainer}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Create Recurring Expense"
              onPress={handleSubmit}
              loading={loading}
              disabled={!amount || !description.trim() || !isValidSplit}
            />
          </View>
        </KeyboardAvoidingView>

        <CategoryPicker
          visible={showCategoryPicker}
          selectedCategory={category}
          onSelect={setCategory}
          onClose={() => setShowCategoryPicker(false)}
        />
      </SafeAreaView>
    </>
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
  amountContainer: {
    marginVertical: spacing.xl,
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
  frequencyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.md,
  },
  frequencyButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  frequencyButtonSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  frequencyLabel: {
    ...typography.small,
    color: colors.text,
  },
  frequencyLabelSelected: {
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  dayButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    marginHorizontal: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  dayButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    ...typography.small,
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.white,
    fontFamily: "Inter_600SemiBold",
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
