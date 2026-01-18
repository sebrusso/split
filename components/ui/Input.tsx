import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { colors, borderRadius, spacing, typography, shadows } from "../../lib/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  prefix?: string;
  suffix?: string;
  inputTestID?: string;
}

export function Input({
  label,
  error,
  containerStyle,
  prefix,
  suffix,
  style,
  multiline,
  numberOfLines,
  inputTestID,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          shadows.sm,
          multiline && styles.inputContainerMultiline,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {prefix && <Text style={[styles.prefix, isFocused && styles.prefixFocused]}>{prefix}</Text>}
        <TextInput
          testID={inputTestID}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? "top" : "center"}
          autoCorrect={false}
          autoCapitalize="words"
          {...props}
        />
        {suffix && <Text style={[styles.suffix, isFocused && styles.suffixFocused]}>{suffix}</Text>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    // Borderless by default - uses shadow
    borderWidth: 0,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
  },
  inputContainerMultiline: {
    height: "auto",
    minHeight: 80,
    alignItems: "flex-start",
    paddingVertical: spacing.md,
  },
  inputFocused: {
    // Add accent border on focus
    borderWidth: 2,
    borderColor: colors.accent,
  },
  inputError: {
    borderWidth: 2,
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 60,
    paddingTop: 0,
  },
  prefix: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  prefixFocused: {
    color: colors.text,
  },
  suffix: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  suffixFocused: {
    color: colors.text,
  },
  error: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
