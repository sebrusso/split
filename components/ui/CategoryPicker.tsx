import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { DEFAULT_CATEGORIES, Category, getCategoriesSortedByFrequency } from "../../lib/categories";

interface CategoryPickerProps {
  visible: boolean;
  selectedCategory: string;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}

export function CategoryPicker({
  visible,
  selectedCategory,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  const categories = getCategoriesSortedByFrequency();

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select Category</Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category.id && styles.categoryButtonSelected,
                  ]}
                  onPress={() => handleSelect(category.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: category.color + "20" },
                    ]}
                  >
                    <Text style={styles.icon}>{category.icon}</Text>
                  </View>
                  <Text
                    style={[
                      styles.categoryName,
                      selectedCategory === category.id && styles.categoryNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                  {selectedCategory === category.id && (
                    <View style={[styles.checkmark, { backgroundColor: category.color }]}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface CategoryButtonProps {
  categoryId: string;
  onPress: () => void;
}

export function CategoryButton({ categoryId, onPress }: CategoryButtonProps) {
  const category = DEFAULT_CATEGORIES.find((c) => c.id === categoryId) || DEFAULT_CATEGORIES[0];

  return (
    <TouchableOpacity
      style={styles.selectButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.selectIconContainer, { backgroundColor: category.color + "20" }]}>
        <Text style={styles.selectIcon}>{category.icon}</Text>
      </View>
      <Text style={styles.selectText}>{category.name}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: "70%",
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  scrollView: {
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  categoryButton: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    margin: "1%",
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  categoryButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  categoryName: {
    ...typography.caption,
    flex: 1,
  },
  categoryNameSelected: {
    color: colors.primary,
    fontFamily: "Inter_500Medium",
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "bold",
  },
  // CategoryButton styles
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  selectIcon: {
    fontSize: 22,
  },
  selectText: {
    ...typography.bodyMedium,
    flex: 1,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
});
