import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { Member, Group } from "../../../lib/types";
import { colors, spacing, typography, borderRadius } from "../../../lib/theme";
import { Button, Input, Avatar, Card } from "../../../components/ui";

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        setSplitBetween(membersData.map((m) => m.id));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const toggleSplit = (memberId: string) => {
    setSplitBetween((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
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

    if (splitBetween.length === 0) {
      setError("Please select at least one person to split with");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          group_id: id,
          description: description.trim(),
          amount: amountNum,
          paid_by: paidBy,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Create splits (equal split)
      const splitAmount = amountNum / splitBetween.length;
      const splits = splitBetween.map((memberId) => ({
        expense_id: expense.id,
        member_id: memberId,
        amount: Math.round(splitAmount * 100) / 100,
      }));

      const { error: splitsError } = await supabase
        .from("splits")
        .insert(splits);

      if (splitsError) throw splitsError;

      router.back();
    } catch (err) {
      console.error("Error creating expense:", err);
      setError("Failed to add expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
          {/* Amount Input */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          {/* Description */}
          <Input
            label="What's it for?"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g., Dinner, Uber, Groceries"
            containerStyle={styles.inputContainer}
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

          {/* Split Between */}
          <Text style={styles.sectionTitle}>Split between</Text>
          <View style={styles.splitGrid}>
            {members.map((member) => {
              const isSelected = splitBetween.includes(member.id);
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.splitButton,
                    isSelected && styles.splitButtonSelected,
                  ]}
                  onPress={() => toggleSplit(member.id)}
                >
                  <Avatar
                    name={member.name}
                    size="sm"
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.splitButtonText,
                      isSelected && styles.splitButtonTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {member.name}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Split Preview */}
          {amount && splitBetween.length > 0 && (
            <Card style={styles.previewCard}>
              <Text style={styles.previewTitle}>Split Preview</Text>
              <Text style={styles.previewAmount}>
                ${(parseFloat(amount) / splitBetween.length).toFixed(2)} each
              </Text>
              <Text style={styles.previewSubtext}>
                Split equally between {splitBetween.length} people
              </Text>
            </Card>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Add Expense"
            onPress={handleSubmit}
            loading={loading}
            disabled={!amount || !description.trim()}
          />
        </View>
      </KeyboardAvoidingView>
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
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.xl,
  },
  currencySymbol: {
    ...typography.amount,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  amountInput: {
    ...typography.amount,
    minWidth: 120,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  membersScroll: {
    marginBottom: spacing.xl,
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
  splitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.xl,
  },
  splitButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  splitButtonText: {
    ...typography.caption,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  splitButtonTextSelected: {
    color: colors.primary,
    fontFamily: "Inter_500Medium",
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  previewCard: {
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  previewTitle: {
    ...typography.small,
    color: colors.primary,
  },
  previewAmount: {
    ...typography.h2,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  previewSubtext: {
    ...typography.caption,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
