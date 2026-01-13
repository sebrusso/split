import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Group } from "../../lib/types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from "../../lib/theme";
import { Button, Card, Input } from "../../components/ui";
import { useAnalytics, AnalyticsEvents } from "../../lib/analytics-provider";

export default function JoinGroupScreen() {
  // Get code from deep link if present
  const { code: deepLinkCode } = useLocalSearchParams<{ code?: string }>();
  const { trackEvent } = useAnalytics();

  const [shareCode, setShareCode] = useState(deepLinkCode || "");
  const [memberName, setMemberName] = useState("");
  const [foundGroup, setFoundGroup] = useState<Group | null>(null);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-search if deep link code is provided
  useEffect(() => {
    if (deepLinkCode && deepLinkCode.length === 6) {
      handleSearch();
    }
  }, [deepLinkCode]);

  const handleSearch = async () => {
    const code = shareCode.trim().toUpperCase();

    if (code.length !== 6) {
      setError("Share code must be 6 characters");
      return;
    }

    setSearching(true);
    setError(null);
    setFoundGroup(null);

    try {
      const { data, error: searchError } = await supabase
        .from("groups")
        .select("*")
        .eq("share_code", code)
        .single();

      if (searchError) {
        if (searchError.code === "PGRST116") {
          setError("No group found with this code");
        } else {
          throw searchError;
        }
        return;
      }

      setFoundGroup(data);
    } catch (err) {
      console.error("Error searching for group:", err);
      setError("Failed to search. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleJoin = async () => {
    const name = memberName.trim();

    if (!name) {
      Alert.alert("Name Required", "Please enter your name to join the group.");
      return;
    }

    if (!foundGroup) {
      Alert.alert("Error", "No group selected.");
      return;
    }

    setJoining(true);

    try {
      // Check if member with same name already exists in group
      const { data: existingMembers } = await supabase
        .from("members")
        .select("id, name")
        .eq("group_id", foundGroup.id)
        .ilike("name", name);

      if (existingMembers && existingMembers.length > 0) {
        Alert.alert(
          "Name Already Exists",
          `Someone named "${name}" is already in this group. Please use a different name or add a last initial.`,
        );
        setJoining(false);
        return;
      }

      // Create member
      const { data: newMember, error: memberError } = await supabase
        .from("members")
        .insert({
          group_id: foundGroup.id,
          name: name,
        })
        .select()
        .single();

      if (memberError) throw memberError;

      trackEvent(AnalyticsEvents.GROUP_JOINED, {
        groupId: foundGroup.id,
        viaDeepLink: !!deepLinkCode,
      });
      // Navigate to the group
      router.replace(`/group/${foundGroup.id}`);
    } catch (err) {
      console.error("Error joining group:", err);
      Alert.alert("Error", "Failed to join group. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleCodeChange = (text: string) => {
    // Only allow alphanumeric, convert to uppercase, max 6 chars
    const cleaned = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
    setShareCode(cleaned);
    // Clear found group when code changes
    if (foundGroup && cleaned !== foundGroup.share_code) {
      setFoundGroup(null);
      setError(null);
    }
  };

  const handleReset = () => {
    setShareCode("");
    setMemberName("");
    setFoundGroup(null);
    setError(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Join Group",
          presentation: "modal",
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerEmoji}>🔗</Text>
              <Text style={styles.headerTitle}>Join a Group</Text>
              <Text style={styles.headerSubtitle}>
                Enter the share code to join an existing group
              </Text>
            </View>

            {/* Code Input */}
            {!foundGroup && (
              <View style={styles.section}>
                <Input
                  label="Share Code"
                  value={shareCode}
                  onChangeText={handleCodeChange}
                  placeholder="ABC123"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  error={error || undefined}
                  style={styles.codeInput}
                />
                <Button
                  title={searching ? "Searching..." : "Find Group"}
                  onPress={handleSearch}
                  disabled={shareCode.length !== 6 || searching}
                  loading={searching}
                  style={styles.searchButton}
                />
              </View>
            )}

            {/* Found Group */}
            {foundGroup && (
              <View style={styles.section}>
                <Card style={styles.groupCard}>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupEmoji}>
                      {foundGroup.emoji || "👥"}
                    </Text>
                    <View style={styles.groupText}>
                      <Text style={styles.groupName}>{foundGroup.name}</Text>
                      <Text style={styles.groupCode}>
                        Code: {foundGroup.share_code}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                </Card>

                <Input
                  label="Your Name"
                  value={memberName}
                  onChangeText={setMemberName}
                  placeholder="Enter your name"
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={styles.nameInput}
                />

                <Button
                  title={joining ? "Joining..." : "Join Group"}
                  onPress={handleJoin}
                  disabled={!memberName.trim() || joining}
                  loading={joining}
                  style={styles.joinButton}
                />

                <Button
                  title="Search for Different Group"
                  onPress={handleReset}
                  variant="ghost"
                  style={styles.resetButton}
                />
              </View>
            )}

            {/* Instructions */}
            <View style={styles.instructions}>
              <Text style={styles.instructionsTitle}>How to get a code:</Text>
              <Text style={styles.instructionsText}>
                Ask the group creator to share the code with you, or scan their
                QR code.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    textAlign: "center",
  },
  headerSubtitle: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  codeInput: {
    marginBottom: spacing.md,
  },
  searchButton: {
    marginTop: spacing.sm,
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    backgroundColor: colors.primaryLight,
  },
  groupInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  groupEmoji: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  groupText: {
    flex: 1,
  },
  groupName: {
    ...typography.h3,
    color: colors.primaryDark,
  },
  groupCode: {
    ...typography.small,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  nameInput: {
    marginBottom: spacing.md,
  },
  joinButton: {
    marginTop: spacing.sm,
  },
  resetButton: {
    marginTop: spacing.md,
  },
  instructions: {
    backgroundColor: colors.borderLight,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: "auto",
  },
  instructionsTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  instructionsText: {
    ...typography.caption,
    lineHeight: 20,
  },
});
