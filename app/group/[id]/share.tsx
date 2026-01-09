import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Share,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../../../lib/supabase";
import { Group } from "../../../lib/types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../../lib/theme";
import { Card, Button } from "../../../components/ui";

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchGroup = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setGroup(data);
    } catch (error) {
      console.error("Error fetching group:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchGroup();
    }, [fetchGroup]),
  );

  const getDeepLink = (): string => {
    return `splitfree://join/${group?.share_code}`;
  };

  const handleShare = async () => {
    if (!group) return;
    try {
      const deepLink = getDeepLink();
      await Share.share({
        message: `Join my expense group "${group.name}" on SplitFree!\n\n${deepLink}\n\nOr enter code: ${group.share_code}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleCopyLink = async () => {
    if (!group) return;
    try {
      await Clipboard.setStringAsync(getDeepLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying:", error);
      Alert.alert("Error", "Failed to copy link");
    }
  };

  const handleCopyCode = async () => {
    if (!group) return;
    try {
      await Clipboard.setStringAsync(group.share_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying:", error);
      Alert.alert("Error", "Failed to copy code");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Share Group",
          presentation: "modal",
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Group Info */}
          <View style={styles.groupInfo}>
            <Text style={styles.groupEmoji}>{group?.emoji || "👥"}</Text>
            <Text style={styles.groupName}>{group?.name}</Text>
          </View>

          {/* QR Code */}
          <Card style={styles.qrCard}>
            <View style={styles.qrContainer}>
              <QRCode
                value={getDeepLink()}
                size={200}
                backgroundColor={colors.card}
                color={colors.text}
              />
            </View>
            <Text style={styles.qrHint}>
              Scan to join this group
            </Text>
          </Card>

          {/* Share Code */}
          <Card style={styles.codeCard}>
            <Text style={styles.codeLabel}>Share Code</Text>
            <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
              <Text style={styles.codeText}>{group?.share_code}</Text>
            </TouchableOpacity>
            <Text style={styles.codeTapHint}>Tap to copy</Text>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title={copied ? "Copied!" : "Copy Link"}
              onPress={handleCopyLink}
              variant={copied ? "secondary" : "primary"}
              style={styles.button}
            />
            <Button
              title="Share"
              onPress={handleShare}
              variant="secondary"
              style={styles.button}
            />
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>How to join:</Text>
            <Text style={styles.instructionsText}>
              1. Scan the QR code above, or{"\n"}
              2. Open the shared link, or{"\n"}
              3. Enter the code manually in the app
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    alignItems: "center",
  },
  groupInfo: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  groupEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  groupName: {
    ...typography.h2,
    textAlign: "center",
  },
  qrCard: {
    alignItems: "center",
    padding: spacing.xl,
    marginBottom: spacing.lg,
    width: "100%",
  },
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
  },
  qrHint: {
    ...typography.caption,
    marginTop: spacing.md,
  },
  codeCard: {
    alignItems: "center",
    padding: spacing.lg,
    marginBottom: spacing.xl,
    width: "100%",
  },
  codeLabel: {
    ...typography.small,
    marginBottom: spacing.xs,
  },
  codeText: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: colors.primary,
    letterSpacing: 4,
  },
  codeTapHint: {
    ...typography.small,
    marginTop: spacing.xs,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
    width: "100%",
  },
  button: {
    flex: 1,
  },
  instructions: {
    backgroundColor: colors.borderLight,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    width: "100%",
  },
  instructionsTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  instructionsText: {
    ...typography.caption,
    lineHeight: 22,
  },
});
