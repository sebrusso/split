import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors, typography, spacing } from "../../lib/theme";

/**
 * Deep link handler for splitfree://join/CODE
 * Redirects to the join screen with the code pre-filled
 */
export default function JoinWithCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    if (code) {
      // Redirect to main join screen with code as param
      router.replace({
        pathname: "/join",
        params: { code: code.toUpperCase() },
      });
    }
  }, [code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Joining group...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  text: {
    ...typography.caption,
    marginTop: spacing.md,
  },
});
