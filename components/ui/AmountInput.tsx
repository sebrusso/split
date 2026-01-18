import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { colors, spacing, typography, borderRadius } from "../../lib/theme";

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  currency?: string;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
  error?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  testID?: string;
}

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "Fr",
  CNY: "¥",
  INR: "₹",
  MXN: "$",
  BRL: "R$",
  KRW: "₩",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || "$";
}

export function AmountInput({
  value,
  onChangeText,
  currency = "USD",
  placeholder = "0.00",
  autoFocus = false,
  size = "lg",
  style,
  error,
  onFocus,
  onBlur,
  testID,
}: AmountInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const currencySymbol = getCurrencySymbol(currency);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  // Format the input value to ensure valid decimal
  const handleChangeText = (text: string) => {
    // Remove any non-numeric characters except decimal point
    let cleaned = text.replace(/[^0-9.]/g, "");

    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }

    // Limit decimal places to 2
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = parts[0] + "." + parts[1].slice(0, 2);
    }

    onChangeText(cleaned);
  };

  const containerStyle = [
    styles.container,
    styles[`container_${size}`],
    isFocused && styles.containerFocused,
    error && styles.containerError,
    style,
  ];

  const symbolStyle = [
    styles.currencySymbol,
    styles[`symbol_${size}`],
    isFocused && styles.symbolFocused,
  ];

  const inputStyle = [
    styles.input,
    styles[`input_${size}`],
    isFocused && styles.inputFocused,
  ];

  return (
    <View>
      <TouchableOpacity
        style={containerStyle}
        onPress={() => inputRef.current?.focus()}
        activeOpacity={1}
      >
        <Text style={symbolStyle}>{currencySymbol}</Text>
        <TextInput
          ref={inputRef}
          testID={testID}
          style={inputStyle}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectTextOnFocus
        />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// Inline small amount input for split amounts
interface InlineAmountInputProps {
  value: number;
  onChange: (value: number) => void;
  currency?: string;
  placeholder?: string;
  style?: ViewStyle;
}

export function InlineAmountInput({
  value,
  onChange,
  currency = "USD",
  placeholder = "0.00",
  style,
}: InlineAmountInputProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const [localValue, setLocalValue] = useState(value > 0 ? value.toString() : "");

  useEffect(() => {
    setLocalValue(value > 0 ? value.toString() : "");
  }, [value]);

  const handleChangeText = (text: string) => {
    // Remove any non-numeric characters except decimal point
    let cleaned = text.replace(/[^0-9.]/g, "");

    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }

    // Limit decimal places to 2
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = parts[0] + "." + parts[1].slice(0, 2);
    }

    setLocalValue(cleaned);
    onChange(parseFloat(cleaned) || 0);
  };

  return (
    <View style={[styles.inlineContainer, style]}>
      <Text style={styles.inlineSymbol}>{currencySymbol}</Text>
      <TextInput
        style={styles.inlineInput}
        value={localValue}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  container_sm: {
    paddingVertical: spacing.xs,
  },
  container_md: {
    paddingVertical: spacing.sm,
  },
  container_lg: {
    paddingVertical: spacing.md,
  },
  containerFocused: {},
  containerError: {},
  currencySymbol: {
    fontWeight: "700",
    color: colors.textMuted,
  },
  symbol_sm: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  symbol_md: {
    fontSize: 32,
    marginRight: spacing.xs,
  },
  symbol_lg: {
    fontSize: 48,
    marginRight: spacing.xs,
  },
  symbolFocused: {
    color: colors.text,
  },
  input: {
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  input_sm: {
    fontSize: 20,
    minWidth: 60,
  },
  input_md: {
    fontSize: 32,
    minWidth: 100,
  },
  input_lg: {
    fontSize: 48,
    minWidth: 120,
  },
  inputFocused: {},
  errorText: {
    ...typography.small,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  // Inline input styles
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inlineSymbol: {
    ...typography.body,
    color: colors.textSecondary,
  },
  inlineInput: {
    ...typography.body,
    flex: 1,
    textAlign: "right",
    minWidth: 50,
  },
});
