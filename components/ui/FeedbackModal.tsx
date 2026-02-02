/**
 * Feedback Modal Component
 *
 * Bottom sheet modal for users to submit feedback (feature requests, general feedback).
 * Bug reports are routed to Sentry for better correlation with crash data.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../lib/theme";
import { FeedbackType } from "../../lib/types";
import { submitFeedback, FEEDBACK_TYPES } from "../../lib/feedback";
import { submitBugReport } from "../../lib/sentry";
import { useSupabase } from "../../lib/supabase";

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  /** Current screen name for context */
  screenName?: string;
  /** Pre-select a feedback type */
  initialType?: FeedbackType;
}

const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 2000;

export function FeedbackModal({
  visible,
  onClose,
  screenName,
  initialType = "general",
}: FeedbackModalProps) {
  const { user } = useUser();
  const { getSupabase } = useSupabase();

  const [selectedType, setSelectedType] = useState<FeedbackType>(initialType);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedType(initialType);
      setMessage("");
      setError(null);
      setSuccess(false);
    }
  }, [visible, initialType]);

  const handleSubmit = useCallback(async () => {
    // Validate message length
    if (message.trim().length < MIN_MESSAGE_LENGTH) {
      setError(`Please enter at least ${MIN_MESSAGE_LENGTH} characters`);
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedType === "bug") {
        // Route bug reports to Sentry
        submitBugReport({
          name: user?.fullName || user?.firstName || "Anonymous",
          email: user?.primaryEmailAddress?.emailAddress,
          comments: message.trim(),
        });
        setSuccess(true);
      } else {
        // Submit feature requests and general feedback to Supabase
        const supabase = await getSupabase();
        const result = await submitFeedback(
          supabase,
          user?.id || "anonymous",
          user?.primaryEmailAddress?.emailAddress || undefined,
          user?.fullName || user?.firstName || undefined,
          {
            type: selectedType,
            message: message.trim(),
            screen_name: screenName,
          }
        );

        if (result) {
          setSuccess(true);
        } else {
          setError("Failed to submit feedback. Please try again.");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [message, selectedType, user, getSupabase, screenName]);

  const handleClose = useCallback(() => {
    if (!loading) {
      onClose();
    }
  }, [loading, onClose]);

  const getPlaceholder = () => {
    const config = FEEDBACK_TYPES.find((t) => t.type === selectedType);
    return config?.placeholder || "Tell us what's on your mind...";
  };

  const getTypeIcon = (type: FeedbackType): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case "feature":
        return "bulb-outline";
      case "bug":
        return "bug-outline";
      case "general":
      default:
        return "chatbubble-outline";
    }
  };

  // Success state
  if (success) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable
            style={styles.modal}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons
                  name="checkmark-circle"
                  size={64}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.successTitle}>Thank You!</Text>
              <Text style={styles.successMessage}>
                {selectedType === "bug"
                  ? "Your bug report has been submitted. We'll look into it."
                  : "Your feedback has been received. We really appreciate it!"}
              </Text>
              <TouchableOpacity
                style={styles.successButton}
                onPress={handleClose}
              >
                <Text style={styles.successButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable
            style={styles.modal}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Send Feedback</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeButton}
                  disabled={loading}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Type Selector */}
              <Text style={styles.sectionLabel}>What type of feedback?</Text>
              <View style={styles.typeSelector}>
                {FEEDBACK_TYPES.map((feedbackType) => {
                  const isSelected = selectedType === feedbackType.type;
                  return (
                    <TouchableOpacity
                      key={feedbackType.type}
                      style={[
                        styles.typeButton,
                        isSelected && styles.typeButtonSelected,
                      ]}
                      onPress={() => setSelectedType(feedbackType.type)}
                      disabled={loading}
                    >
                      <Ionicons
                        name={getTypeIcon(feedbackType.type)}
                        size={24}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.typeLabel,
                          isSelected && styles.typeLabelSelected,
                        ]}
                      >
                        {feedbackType.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bug Report Note */}
              {selectedType === "bug" && (
                <View style={styles.infoBox}>
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.infoText}>
                    Bug reports are sent to our error tracking system for faster
                    resolution.
                  </Text>
                </View>
              )}

              {/* Message Input */}
              <Text style={styles.sectionLabel}>Your message</Text>
              <TextInput
                style={styles.textInput}
                placeholder={getPlaceholder()}
                placeholderTextColor={colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={MAX_MESSAGE_LENGTH}
                editable={!loading}
              />
              <Text style={styles.charCount}>
                {message.length}/{MAX_MESSAGE_LENGTH}
              </Text>

              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={colors.danger}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (loading || message.trim().length < MIN_MESSAGE_LENGTH) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading || message.trim().length < MIN_MESSAGE_LENGTH}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="send"
                      size={18}
                      color={colors.white}
                      style={styles.submitIcon}
                    />
                    <Text style={styles.submitButtonText}>Submit Feedback</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 20, // Extra padding for safe area
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeSelector: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeButton: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  typeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typeLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  typeLabelSelected: {
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    ...typography.small,
    color: colors.primary,
    flex: 1,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    minHeight: 120,
    maxHeight: 200,
  },
  charCount: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "#FEE2E2",
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
  },
  submitButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  submitButtonDisabled: {
    backgroundColor: colors.borderLight,
  },
  submitIcon: {
    marginRight: spacing.sm,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontFamily: "Inter_600SemiBold",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  successMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  successButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  successButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontFamily: "Inter_600SemiBold",
  },
});
