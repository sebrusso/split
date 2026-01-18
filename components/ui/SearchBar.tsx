import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, borderRadius, spacing } from "../../lib/theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  debounceMs?: number;
  style?: ViewStyle;
  showClearButton?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  onFocus,
  onBlur,
  onSubmit,
  autoFocus = false,
  debounceMs = 300,
  style,
  showClearButton = true,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChangeText = useCallback(
    (text: string) => {
      setLocalValue(text);

      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Debounce the callback
      debounceTimer.current = setTimeout(() => {
        onChangeText(text);
      }, debounceMs);
    },
    [onChangeText, debounceMs]
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChangeText("");
    inputRef.current?.focus();
  }, [onChangeText]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        style,
      ]}
    >
      <Ionicons
        name="search"
        size={20}
        color={isFocused ? colors.accent : colors.textMuted}
        style={styles.searchIcon}
      />
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={localValue}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {showClearButton && localValue.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Compact search bar that can be tapped to expand/navigate to search screen
 */
interface SearchBarCompactProps {
  onPress: () => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchBarCompact({
  onPress,
  placeholder = "Search expenses, groups...",
  style,
}: SearchBarCompactProps) {
  return (
    <TouchableOpacity
      style={[styles.compactContainer, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name="search"
        size={18}
        color={colors.textMuted}
        style={styles.compactIcon}
      />
      <View style={styles.compactText}>
        <Animated.Text style={styles.compactPlaceholder}>
          {placeholder}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerFocused: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    color: colors.text,
    height: "100%",
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  // Compact variant styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactIcon: {
    marginRight: spacing.sm,
  },
  compactText: {
    flex: 1,
  },
  compactPlaceholder: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.textMuted,
  },
});
