/**
 * Expense categories with icons and colors
 */

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "food", name: "Food & Drink", icon: "🍔", color: "#F59E0B" },
  { id: "transport", name: "Transport", icon: "🚗", color: "#3B82F6" },
  { id: "shopping", name: "Shopping", icon: "🛍️", color: "#EC4899" },
  { id: "entertainment", name: "Entertainment", icon: "🎬", color: "#8B5CF6" },
  { id: "utilities", name: "Utilities", icon: "💡", color: "#6B7280" },
  { id: "rent", name: "Rent", icon: "🏠", color: "#10B981" },
  { id: "travel", name: "Travel", icon: "✈️", color: "#06B6D4" },
  { id: "groceries", name: "Groceries", icon: "🛒", color: "#84CC16" },
  { id: "gas", name: "Gas", icon: "⛽", color: "#EF4444" },
  { id: "health", name: "Health", icon: "💊", color: "#14B8A6" },
  { id: "subscriptions", name: "Subscriptions", icon: "📺", color: "#A855F7" },
  { id: "other", name: "Other", icon: "📦", color: "#9CA3AF" },
];

/**
 * Get category by ID
 */
export function getCategoryById(id: string): Category | undefined {
  return DEFAULT_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Get category display info
 */
export function getCategoryDisplay(id: string): { name: string; icon: string; color: string } {
  const category = getCategoryById(id);
  if (category) {
    return { name: category.name, icon: category.icon, color: category.color };
  }
  return { name: "Other", icon: "📦", color: "#9CA3AF" };
}

/**
 * Get default category (for new expenses)
 */
export function getDefaultCategory(): Category {
  return DEFAULT_CATEGORIES.find((cat) => cat.id === "other")!;
}

/**
 * Group categories by type for better organization
 */
export const CATEGORY_GROUPS = {
  frequent: ["food", "transport", "groceries", "gas"],
  home: ["utilities", "rent", "subscriptions"],
  lifestyle: ["shopping", "entertainment", "travel", "health"],
  other: ["other"],
};

/**
 * Get categories sorted by usage (frequent first)
 */
export function getCategoriesSortedByFrequency(): Category[] {
  const order = [
    ...CATEGORY_GROUPS.frequent,
    ...CATEGORY_GROUPS.home,
    ...CATEGORY_GROUPS.lifestyle,
    ...CATEGORY_GROUPS.other,
  ];

  return order
    .map((id) => DEFAULT_CATEGORIES.find((cat) => cat.id === id))
    .filter((cat): cat is Category => cat !== undefined);
}
