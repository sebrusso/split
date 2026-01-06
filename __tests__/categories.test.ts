/**
 * Category Utilities Tests
 *
 * Comprehensive tests for category-related functions in lib/categories.ts
 */

import {
  DEFAULT_CATEGORIES,
  CATEGORY_GROUPS,
  Category,
  getCategoryById,
  getCategoryDisplay,
  getDefaultCategory,
  getCategoriesSortedByFrequency,
} from "../lib/categories";

describe("DEFAULT_CATEGORIES", () => {
  it("should contain all expected categories", () => {
    const expectedIds = [
      "food",
      "transport",
      "shopping",
      "entertainment",
      "utilities",
      "rent",
      "travel",
      "groceries",
      "gas",
      "health",
      "subscriptions",
      "other",
    ];

    expect(DEFAULT_CATEGORIES).toHaveLength(expectedIds.length);
    expectedIds.forEach((id) => {
      expect(DEFAULT_CATEGORIES.find((c) => c.id === id)).toBeDefined();
    });
  });

  it("should have valid structure for each category", () => {
    DEFAULT_CATEGORIES.forEach((category) => {
      expect(category).toHaveProperty("id");
      expect(category).toHaveProperty("name");
      expect(category).toHaveProperty("icon");
      expect(category).toHaveProperty("color");

      expect(typeof category.id).toBe("string");
      expect(typeof category.name).toBe("string");
      expect(typeof category.icon).toBe("string");
      expect(typeof category.color).toBe("string");

      expect(category.id.length).toBeGreaterThan(0);
      expect(category.name.length).toBeGreaterThan(0);
      expect(category.icon.length).toBeGreaterThan(0);
    });
  });

  it("should have valid hex color codes", () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    DEFAULT_CATEGORIES.forEach((category) => {
      expect(category.color).toMatch(hexColorRegex);
    });
  });

  it("should have unique IDs", () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have unique names", () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

describe("CATEGORY_GROUPS", () => {
  it("should contain all expected group types", () => {
    expect(CATEGORY_GROUPS).toHaveProperty("frequent");
    expect(CATEGORY_GROUPS).toHaveProperty("home");
    expect(CATEGORY_GROUPS).toHaveProperty("lifestyle");
    expect(CATEGORY_GROUPS).toHaveProperty("other");
  });

  it("should have frequent categories", () => {
    expect(CATEGORY_GROUPS.frequent).toContain("food");
    expect(CATEGORY_GROUPS.frequent).toContain("transport");
    expect(CATEGORY_GROUPS.frequent).toContain("groceries");
    expect(CATEGORY_GROUPS.frequent).toContain("gas");
  });

  it("should have home categories", () => {
    expect(CATEGORY_GROUPS.home).toContain("utilities");
    expect(CATEGORY_GROUPS.home).toContain("rent");
    expect(CATEGORY_GROUPS.home).toContain("subscriptions");
  });

  it("should have lifestyle categories", () => {
    expect(CATEGORY_GROUPS.lifestyle).toContain("shopping");
    expect(CATEGORY_GROUPS.lifestyle).toContain("entertainment");
    expect(CATEGORY_GROUPS.lifestyle).toContain("travel");
    expect(CATEGORY_GROUPS.lifestyle).toContain("health");
  });

  it("should have other categories", () => {
    expect(CATEGORY_GROUPS.other).toContain("other");
  });

  it("should contain only valid category IDs", () => {
    const validIds = DEFAULT_CATEGORIES.map((c) => c.id);
    const allGroupIds = [
      ...CATEGORY_GROUPS.frequent,
      ...CATEGORY_GROUPS.home,
      ...CATEGORY_GROUPS.lifestyle,
      ...CATEGORY_GROUPS.other,
    ];

    allGroupIds.forEach((id) => {
      expect(validIds).toContain(id);
    });
  });

  it("should cover all categories exactly once", () => {
    const allGroupIds = [
      ...CATEGORY_GROUPS.frequent,
      ...CATEGORY_GROUPS.home,
      ...CATEGORY_GROUPS.lifestyle,
      ...CATEGORY_GROUPS.other,
    ];

    expect(allGroupIds.length).toBe(DEFAULT_CATEGORIES.length);
    expect(new Set(allGroupIds).size).toBe(allGroupIds.length);
  });
});

describe("getCategoryById", () => {
  it("should return category for valid ID", () => {
    const foodCategory = getCategoryById("food");

    expect(foodCategory).toBeDefined();
    expect(foodCategory?.id).toBe("food");
    expect(foodCategory?.name).toBe("Food & Drink");
    expect(foodCategory?.icon).toBe("🍔");
    expect(foodCategory?.color).toBe("#F59E0B");
  });

  it("should return undefined for invalid ID", () => {
    expect(getCategoryById("nonexistent")).toBeUndefined();
    expect(getCategoryById("")).toBeUndefined();
    expect(getCategoryById("FOOD")).toBeUndefined(); // case sensitive
  });

  it("should return correct category for each valid ID", () => {
    DEFAULT_CATEGORIES.forEach((expected) => {
      const result = getCategoryById(expected.id);

      expect(result).toBeDefined();
      expect(result).toEqual(expected);
    });
  });

  it("should handle edge case inputs", () => {
    expect(getCategoryById(" food")).toBeUndefined(); // leading space
    expect(getCategoryById("food ")).toBeUndefined(); // trailing space
    expect(getCategoryById("Food")).toBeUndefined(); // wrong case
    expect(getCategoryById("TRANSPORT")).toBeUndefined();
  });
});

describe("getCategoryDisplay", () => {
  it("should return display info for valid category ID", () => {
    const display = getCategoryDisplay("food");

    expect(display).toEqual({
      name: "Food & Drink",
      icon: "🍔",
      color: "#F59E0B",
    });
  });

  it("should return display info for all valid categories", () => {
    DEFAULT_CATEGORIES.forEach((category) => {
      const display = getCategoryDisplay(category.id);

      expect(display.name).toBe(category.name);
      expect(display.icon).toBe(category.icon);
      expect(display.color).toBe(category.color);
    });
  });

  it("should return 'Other' fallback for invalid ID", () => {
    const display = getCategoryDisplay("nonexistent");

    expect(display).toEqual({
      name: "Other",
      icon: "📦",
      color: "#9CA3AF",
    });
  });

  it("should return 'Other' fallback for empty string", () => {
    const display = getCategoryDisplay("");

    expect(display.name).toBe("Other");
    expect(display.icon).toBe("📦");
    expect(display.color).toBe("#9CA3AF");
  });

  it("should return 'Other' fallback for case mismatch", () => {
    const display = getCategoryDisplay("Food");

    expect(display.name).toBe("Other");
  });

  it("should handle null-like values gracefully", () => {
    // @ts-expect-error - testing runtime behavior with invalid input
    expect(() => getCategoryDisplay(null)).not.toThrow();
    // @ts-expect-error - testing runtime behavior with invalid input
    expect(() => getCategoryDisplay(undefined)).not.toThrow();
  });

  it("should return correct display for 'other' category", () => {
    const display = getCategoryDisplay("other");

    expect(display.name).toBe("Other");
    expect(display.icon).toBe("📦");
    expect(display.color).toBe("#9CA3AF");
  });

  it("should handle special characters in ID", () => {
    const display = getCategoryDisplay("food&drink");
    expect(display.name).toBe("Other"); // Invalid ID

    const display2 = getCategoryDisplay("food-drink");
    expect(display2.name).toBe("Other");
  });
});

describe("getDefaultCategory", () => {
  it("should return the 'other' category", () => {
    const defaultCategory = getDefaultCategory();

    expect(defaultCategory.id).toBe("other");
    expect(defaultCategory.name).toBe("Other");
    expect(defaultCategory.icon).toBe("📦");
    expect(defaultCategory.color).toBe("#9CA3AF");
  });

  it("should return a valid Category object", () => {
    const defaultCategory = getDefaultCategory();

    expect(defaultCategory).toHaveProperty("id");
    expect(defaultCategory).toHaveProperty("name");
    expect(defaultCategory).toHaveProperty("icon");
    expect(defaultCategory).toHaveProperty("color");
  });

  it("should return a category that exists in DEFAULT_CATEGORIES", () => {
    const defaultCategory = getDefaultCategory();
    const found = DEFAULT_CATEGORIES.find((c) => c.id === defaultCategory.id);

    expect(found).toBeDefined();
    expect(found).toEqual(defaultCategory);
  });

  it("should always return the same result", () => {
    const first = getDefaultCategory();
    const second = getDefaultCategory();

    expect(first).toEqual(second);
  });
});

describe("getCategoriesSortedByFrequency", () => {
  it("should return all categories", () => {
    const sorted = getCategoriesSortedByFrequency();

    expect(sorted).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it("should return valid Category objects", () => {
    const sorted = getCategoriesSortedByFrequency();

    sorted.forEach((category) => {
      expect(category).toHaveProperty("id");
      expect(category).toHaveProperty("name");
      expect(category).toHaveProperty("icon");
      expect(category).toHaveProperty("color");
    });
  });

  it("should have frequent categories first", () => {
    const sorted = getCategoriesSortedByFrequency();
    const frequentCategories = CATEGORY_GROUPS.frequent;

    // First N items should be the frequent categories
    frequentCategories.forEach((id, index) => {
      expect(sorted[index].id).toBe(id);
    });
  });

  it("should have home categories after frequent", () => {
    const sorted = getCategoriesSortedByFrequency();
    const frequentCount = CATEGORY_GROUPS.frequent.length;
    const homeCategories = CATEGORY_GROUPS.home;

    homeCategories.forEach((id, index) => {
      expect(sorted[frequentCount + index].id).toBe(id);
    });
  });

  it("should have lifestyle categories after home", () => {
    const sorted = getCategoriesSortedByFrequency();
    const offset = CATEGORY_GROUPS.frequent.length + CATEGORY_GROUPS.home.length;
    const lifestyleCategories = CATEGORY_GROUPS.lifestyle;

    lifestyleCategories.forEach((id, index) => {
      expect(sorted[offset + index].id).toBe(id);
    });
  });

  it("should have 'other' category last", () => {
    const sorted = getCategoriesSortedByFrequency();

    expect(sorted[sorted.length - 1].id).toBe("other");
  });

  it("should contain no duplicates", () => {
    const sorted = getCategoriesSortedByFrequency();
    const ids = sorted.map((c) => c.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should match the expected order exactly", () => {
    const sorted = getCategoriesSortedByFrequency();
    const expectedOrder = [
      ...CATEGORY_GROUPS.frequent,
      ...CATEGORY_GROUPS.home,
      ...CATEGORY_GROUPS.lifestyle,
      ...CATEGORY_GROUPS.other,
    ];

    sorted.forEach((category, index) => {
      expect(category.id).toBe(expectedOrder[index]);
    });
  });

  it("should return a new array each time (not mutate original)", () => {
    const first = getCategoriesSortedByFrequency();
    const second = getCategoriesSortedByFrequency();

    expect(first).not.toBe(second); // Different references
    expect(first).toEqual(second); // Same content
  });
});

describe("Category Type Interface", () => {
  it("should satisfy Category interface requirements", () => {
    const validCategory: Category = {
      id: "test",
      name: "Test Category",
      icon: "🧪",
      color: "#000000",
    };

    expect(validCategory.id).toBe("test");
    expect(validCategory.name).toBe("Test Category");
    expect(validCategory.icon).toBe("🧪");
    expect(validCategory.color).toBe("#000000");
  });
});

describe("Integration Scenarios", () => {
  it("should work together for expense categorization flow", () => {
    // User selects a category from sorted list
    const sortedCategories = getCategoriesSortedByFrequency();
    const selectedCategory = sortedCategories[0]; // First (most frequent)

    // Verify the category exists
    const foundCategory = getCategoryById(selectedCategory.id);
    expect(foundCategory).toEqual(selectedCategory);

    // Get display info for UI
    const display = getCategoryDisplay(selectedCategory.id);
    expect(display.name).toBe(selectedCategory.name);
  });

  it("should provide fallback when loading expense with missing category", () => {
    // Simulate loading an expense with a category that no longer exists
    const oldCategoryId = "deprecated_category";
    const display = getCategoryDisplay(oldCategoryId);

    // Should gracefully fall back to "Other"
    expect(display.name).toBe("Other");
    expect(display.icon).toBe("📦");
  });

  it("should handle new expense with default category", () => {
    const defaultCategory = getDefaultCategory();
    const display = getCategoryDisplay(defaultCategory.id);

    expect(display.name).toBe(defaultCategory.name);
    expect(display.icon).toBe(defaultCategory.icon);
  });
});
