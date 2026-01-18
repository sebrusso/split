import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { DEFAULT_CATEGORIES } from "../../lib/categories";
import { SearchFilters } from "../../lib/types";
import { Button } from "./Button";
import { Input } from "./Input";

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onApplyFilters: (filters: SearchFilters) => void;
  onClearFilters: () => void;
}

export function FilterSheet({
  visible,
  onClose,
  filters,
  onApplyFilters,
  onClearFilters,
}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

  // Reset local state when sheet opens
  React.useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible, filters]);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      category: prev.category === categoryId ? undefined : categoryId,
    }));
  }, []);

  const handleDateFromChange = useCallback((text: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      dateFrom: text || undefined,
    }));
  }, []);

  const handleDateToChange = useCallback((text: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      dateTo: text || undefined,
    }));
  }, []);

  const handleAmountMinChange = useCallback((text: string) => {
    const value = parseFloat(text);
    setLocalFilters((prev) => ({
      ...prev,
      amountMin: isNaN(value) ? undefined : value,
    }));
  }, []);

  const handleAmountMaxChange = useCallback((text: string) => {
    const value = parseFloat(text);
    setLocalFilters((prev) => ({
      ...prev,
      amountMax: isNaN(value) ? undefined : value,
    }));
  }, []);

  const handleApply = useCallback(() => {
    onApplyFilters(localFilters);
    onClose();
  }, [localFilters, onApplyFilters, onClose]);

  const handleClear = useCallback(() => {
    setLocalFilters({});
    onClearFilters();
    onClose();
  }, [onClearFilters, onClose]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.category) count++;
    if (localFilters.dateFrom) count++;
    if (localFilters.dateTo) count++;
    if (localFilters.amountMin !== undefined) count++;
    if (localFilters.amountMax !== undefined) count++;
    return count;
  }, [localFilters]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Category Filter */}
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoryGrid}>
            {DEFAULT_CATEGORIES.map((category) => {
              const isSelected = localFilters.category === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                  ]}
                  onPress={() => handleCategoryToggle(category.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text
                    style={[
                      styles.categoryName,
                      isSelected && styles.categoryNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.primary}
                      style={styles.checkIcon}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Date Range Filter */}
          <Text style={styles.sectionTitle}>Date Range</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateInput}>
              <Input
                label="From"
                value={localFilters.dateFrom || ""}
                onChangeText={handleDateFromChange}
                placeholder="YYYY-MM-DD"
                keyboardType={Platform.OS === "ios" ? "default" : "default"}
              />
            </View>
            <View style={styles.dateSeparator}>
              <Text style={styles.dateSeparatorText}>to</Text>
            </View>
            <View style={styles.dateInput}>
              <Input
                label="To"
                value={localFilters.dateTo || ""}
                onChangeText={handleDateToChange}
                placeholder="YYYY-MM-DD"
                keyboardType={Platform.OS === "ios" ? "default" : "default"}
              />
            </View>
          </View>

          {/* Quick Date Filters */}
          <View style={styles.quickFilters}>
            <QuickDateButton
              label="Today"
              onPress={() => {
                const today = new Date().toISOString().split("T")[0];
                setLocalFilters((prev) => ({
                  ...prev,
                  dateFrom: today,
                  dateTo: today,
                }));
              }}
            />
            <QuickDateButton
              label="This Week"
              onPress={() => {
                const today = new Date();
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                setLocalFilters((prev) => ({
                  ...prev,
                  dateFrom: weekStart.toISOString().split("T")[0],
                  dateTo: today.toISOString().split("T")[0],
                }));
              }}
            />
            <QuickDateButton
              label="This Month"
              onPress={() => {
                const today = new Date();
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                setLocalFilters((prev) => ({
                  ...prev,
                  dateFrom: monthStart.toISOString().split("T")[0],
                  dateTo: today.toISOString().split("T")[0],
                }));
              }}
            />
          </View>

          {/* Amount Range Filter */}
          <Text style={styles.sectionTitle}>Amount Range</Text>
          <View style={styles.amountRow}>
            <View style={styles.amountInput}>
              <Input
                label="Min"
                value={localFilters.amountMin?.toString() || ""}
                onChangeText={handleAmountMinChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                prefix="$"
              />
            </View>
            <View style={styles.amountSeparator}>
              <Text style={styles.amountSeparatorText}>-</Text>
            </View>
            <View style={styles.amountInput}>
              <Input
                label="Max"
                value={localFilters.amountMax?.toString() || ""}
                onChangeText={handleAmountMaxChange}
                placeholder="999.99"
                keyboardType="decimal-pad"
                prefix="$"
              />
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View style={styles.footer}>
          <Button
            title={`Apply Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}`}
            onPress={handleApply}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface QuickDateButtonProps {
  label: string;
  onPress: () => void;
}

function QuickDateButton({ label, onPress }: QuickDateButtonProps) {
  return (
    <TouchableOpacity style={styles.quickDateButton} onPress={onPress}>
      <Text style={styles.quickDateText}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Filter chip button for showing active filter count
 */
interface FilterButtonProps {
  filterCount: number;
  onPress: () => void;
}

export function FilterButton({ filterCount, onPress }: FilterButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.filterButton, filterCount > 0 && styles.filterButtonActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name="options-outline"
        size={18}
        color={filterCount > 0 ? colors.primary : colors.textSecondary}
      />
      {filterCount > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{filterCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h3,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearButtonText: {
    ...typography.bodyMedium,
    color: colors.danger,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  categoryName: {
    ...typography.caption,
    color: colors.text,
  },
  categoryNameSelected: {
    color: colors.primaryDark,
    fontWeight: "500",
  },
  checkIcon: {
    marginLeft: spacing.xs,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  dateInput: {
    flex: 1,
  },
  dateSeparator: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  dateSeparatorText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  quickFilters: {
    flexDirection: "row",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  quickDateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickDateText: {
    ...typography.small,
    color: colors.primary,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  amountInput: {
    flex: 1,
  },
  amountSeparator: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  amountSeparatorText: {
    ...typography.body,
    color: colors.textMuted,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Filter button styles
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.white,
  },
});
