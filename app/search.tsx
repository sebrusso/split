import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, borderRadius, shadows } from "../lib/theme";
import { SearchBar } from "../components/ui/SearchBar";
import { FilterSheet, FilterButton } from "../components/ui/FilterSheet";
import { Card, Avatar } from "../components/ui";
import { searchAll, ExpenseSearchResult, SearchFilters } from "../lib/search";
import { Group, Expense } from "../lib/types";
import { formatCurrency, formatRelativeDate } from "../lib/utils";
import { getCategoryDisplay } from "../lib/categories";

type SearchResultSection = {
  title: string;
  data: (ExpenseSearchResult | Group)[];
  type: "expenses" | "groups";
};

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseSearchResult[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const activeFilterCount = Object.keys(filters).filter(
    (key) => filters[key as keyof SearchFilters] !== undefined
  ).length;

  const performSearch = useCallback(async () => {
    if (!query.trim() && activeFilterCount === 0) {
      setExpenses([]);
      setGroups([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const results = await searchAll(query, filters);
      setExpenses(results.expenses);
      setGroups(results.groups);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }, [query, filters, activeFilterCount]);

  // Trigger search when query or filters change
  useEffect(() => {
    performSearch();
  }, [query, filters]);

  const handleApplyFilters = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleExpensePress = (expense: ExpenseSearchResult) => {
    if (expense.group) {
      router.push(`/group/${expense.group.id}`);
    }
  };

  const handleGroupPress = (group: Group) => {
    router.push(`/group/${group.id}`);
  };

  const sections: SearchResultSection[] = [];

  if (groups.length > 0) {
    sections.push({
      title: `Groups (${groups.length})`,
      data: groups,
      type: "groups",
    });
  }

  if (expenses.length > 0) {
    sections.push({
      title: `Expenses (${expenses.length})`,
      data: expenses,
      type: "expenses",
    });
  }

  const renderExpenseItem = ({ item }: { item: ExpenseSearchResult }) => {
    const group = item.group as unknown as Group | undefined;
    const categoryDisplay = getCategoryDisplay(item.category || "other");

    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => handleExpensePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.categoryIcon, { backgroundColor: categoryDisplay.color + "20" }]}>
          <Text style={styles.categoryEmoji}>{categoryDisplay.icon}</Text>
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {group?.emoji} {group?.name || "Unknown group"} • {formatRelativeDate(item.expense_date || item.created_at)}
          </Text>
          {item.merchant && (
            <Text style={styles.resultMeta} numberOfLines={1}>
              {item.merchant}
            </Text>
          )}
        </View>
        <Text style={styles.resultAmount}>
          {formatCurrency(item.amount, group?.currency)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderGroupItem = ({ item }: { item: Group }) => {
    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.groupEmoji}>{item.emoji || "💰"}</Text>
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.resultSubtitle}>
            Code: {item.share_code}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, section }: { item: ExpenseSearchResult | Group; section: SearchResultSection }) => {
    if (section.type === "expenses") {
      return renderExpenseItem({ item: item as ExpenseSearchResult });
    }
    return renderGroupItem({ item: item as Group });
  };

  const renderSectionHeader = ({ section }: { section: SearchResultSection }) => (
    <Text style={styles.sectionTitle}>{section.title}</Text>
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (!hasSearched) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Search SplitFree</Text>
          <Text style={styles.emptyText}>
            Find expenses by description, merchant, or notes.{"\n"}
            Search groups by name or share code.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptyText}>
          Try a different search term or adjust your filters.
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={handleClearFilters}
          >
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.searchContainer}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search expenses, groups..."
              autoFocus
              debounceMs={400}
            />
          </View>
          <FilterButton
            filterCount={activeFilterCount}
            onPress={() => setShowFilters(true)}
          />
        </View>

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <View style={styles.activeFilters}>
            {filters.category && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>
                  {getCategoryDisplay(filters.category).icon}{" "}
                  {getCategoryDisplay(filters.category).name}
                </Text>
                <TouchableOpacity
                  onPress={() => setFilters({ ...filters, category: undefined })}
                  hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
            {(filters.dateFrom || filters.dateTo) && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>
                  {filters.dateFrom || "Start"} - {filters.dateTo || "End"}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setFilters({ ...filters, dateFrom: undefined, dateTo: undefined })
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
            {(filters.amountMin !== undefined || filters.amountMax !== undefined) && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>
                  ${filters.amountMin ?? 0} - ${filters.amountMax ?? "any"}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setFilters({ ...filters, amountMin: undefined, amountMax: undefined })
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Results */}
        {sections.length > 0 ? (
          <SectionList
            sections={sections}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item, index) => item.id + index}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        ) : (
          renderEmptyState()
        )}

        {/* Filter Sheet */}
        <FilterSheet
          visible={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    flex: 1,
  },
  activeFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  filterChipText: {
    ...typography.small,
    color: colors.primaryDark,
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  groupEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  resultInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  resultTitle: {
    ...typography.bodyMedium,
  },
  resultSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  resultMeta: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  resultAmount: {
    ...typography.bodyMedium,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  clearFiltersButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
  },
  clearFiltersText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});
