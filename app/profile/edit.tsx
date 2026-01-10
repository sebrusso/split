import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from "../../lib/theme";
import { Button, Input, Avatar, Card } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { getVenmoUsername, updateVenmoUsername } from "../../lib/user-profile";

/**
 * Edit Profile Screen
 * Allows users to update their profile information
 */
export default function EditProfileScreen() {
  const { user, isLoaded } = useUser();
  const { userId } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [venmoUsername, setVenmoUsername] = useState("");
  const [venmoLoading, setVenmoLoading] = useState(true);

  // Sync state with user data when it loads
  useEffect(() => {
    if (isLoaded && user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [isLoaded, user]);

  // Load Venmo username from database
  useEffect(() => {
    async function loadVenmoUsername() {
      if (userId) {
        const username = await getVenmoUsername(userId);
        setVenmoUsername(username || "");
        setVenmoLoading(false);
      }
    }
    loadVenmoUsername();
  }, [userId]);

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleSave = async () => {
    if (!user || !userId) return;

    setSaving(true);
    try {
      // Update Clerk profile
      await user.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      // Update Venmo username in Supabase
      const venmoUpdated = await updateVenmoUsername(
        userId,
        venmoUsername.trim() || null
      );

      if (!venmoUpdated && venmoUsername.trim()) {
        Alert.alert(
          "Partial Success",
          "Profile updated but failed to save Venmo username. Please try again."
        );
      } else {
        Alert.alert("Success", "Profile updated successfully");
      }
      router.back();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Alert.alert(
        "Error",
        error.errors?.[0]?.message || "Failed to update profile"
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    if (!user) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Please allow access to your photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingImage(true);
    try {
      const uri = result.assets[0].uri;

      // Fetch the image and convert to base64
      const response = await fetch(uri);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await user.setProfileImage({ file: base64 });
      Alert.alert("Success", "Profile photo updated");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      Alert.alert(
        "Error",
        error.errors?.[0]?.message || "Failed to upload photo"
      );
    } finally {
      setUploadingImage(false);
    }
  };

  if (!isLoaded || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user.fullName || user.firstName || user.username || "User";
  const avatarUrl = user.imageUrl;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Edit Profile",
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
            {/* Profile Photo */}
            <View style={styles.photoSection}>
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={uploadingImage}
                style={styles.photoButton}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Avatar name={displayName} size="lg" style={styles.avatar} />
                )}
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>
                    {uploadingImage ? "..." : "✎"}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Tap to change photo</Text>
            </View>

            {/* Name Fields */}
            <Card style={styles.formCard}>
              <Text style={styles.label}>First Name</Text>
              <Input
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter your first name"
                autoCapitalize="words"
              />

              <Text style={[styles.label, styles.labelSpaced]}>Last Name</Text>
              <Input
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter your last name"
                autoCapitalize="words"
              />
            </Card>

            {/* Payment Accounts */}
            <Card style={styles.formCard}>
              <Text style={styles.sectionTitle}>Payment Accounts</Text>
              <Text style={styles.sectionHint}>
                Link your payment accounts for faster settlements
              </Text>

              <Text style={[styles.label, styles.labelSpaced]}>Venmo Username</Text>
              <Input
                value={venmoUsername}
                onChangeText={(text) => setVenmoUsername(text.replace(/^@/, ""))}
                placeholder="your-venmo-username"
                autoCapitalize="none"
                autoCorrect={false}
                prefix="@"
              />
              <Text style={styles.inputHint}>
                Your friends will see this when settling up
              </Text>
            </Card>

            {/* Email (Read-only) */}
            <Card style={styles.infoCard}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>
                {user.primaryEmailAddress?.emailAddress}
              </Text>
              <Text style={styles.infoHint}>
                Email can be changed from the profile menu
              </Text>
            </Card>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Save Changes"
              onPress={handleSave}
              loading={saving}
              disabled={saving || uploadingImage}
            />
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  photoSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  photoButton: {
    position: "relative",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.background,
  },
  editBadgeText: {
    color: colors.card,
    fontSize: 14,
  },
  photoHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  labelSpaced: {
    marginTop: spacing.lg,
  },
  inputHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  infoCard: {
    padding: spacing.lg,
  },
  infoLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },
  infoHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
