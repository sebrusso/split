import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from "react-native";
import { colors, spacing, typography, borderRadius } from "../../lib/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ReceiptViewerProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  onDelete?: () => void;
}

export function ReceiptViewer({
  visible,
  imageUrl,
  onClose,
  onDelete,
}: ReceiptViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Receipt</Text>
          {onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Image */}
        <View style={styles.imageContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.white} />
            </View>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>!</Text>
              <Text style={styles.errorText}>Failed to load image</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setError(false);
                  setLoading(true);
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// Thumbnail component for displaying receipt preview
interface ReceiptThumbnailProps {
  imageUrl: string | null;
  onPress?: () => void;
  onRemove?: () => void;
  size?: "sm" | "md" | "lg";
}

export function ReceiptThumbnail({
  imageUrl,
  onPress,
  onRemove,
  size = "md",
}: ReceiptThumbnailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!imageUrl) {
    return null;
  }

  const sizeStyle = styles[`thumbnail_${size}`];

  return (
    <TouchableOpacity
      style={[styles.thumbnail, sizeStyle]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      {loading && (
        <View style={styles.thumbnailLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {error ? (
        <View style={styles.thumbnailError}>
          <Text style={styles.thumbnailErrorIcon}>!</Text>
        </View>
      ) : (
        <Image
          source={{ uri: imageUrl }}
          style={styles.thumbnailImage}
          resizeMode="cover"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}

      {onRemove && (
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      )}

      <View style={styles.thumbnailOverlay}>
        <Text style={styles.thumbnailLabel}>View</Text>
      </View>
    </TouchableOpacity>
  );
}

// Button to add/capture receipt
interface AddReceiptButtonProps {
  onPress: () => void;
  hasReceipt?: boolean;
}

export function AddReceiptButton({ onPress, hasReceipt = false }: AddReceiptButtonProps) {
  return (
    <TouchableOpacity style={styles.addButton} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.addIconContainer}>
        <Text style={styles.addIcon}>{hasReceipt ? "📷" : "📷"}</Text>
      </View>
      <Text style={styles.addText}>{hasReceipt ? "Change Receipt" : "Add Receipt"}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Full screen viewer
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + 20, // Account for status bar
    paddingBottom: spacing.lg,
  },
  closeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  title: {
    ...typography.h3,
    color: colors.white,
  },
  deleteButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  deleteText: {
    ...typography.bodyMedium,
    color: colors.danger,
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  errorIcon: {
    fontSize: 48,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.white,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  retryText: {
    ...typography.bodyMedium,
    color: colors.white,
  },

  // Thumbnail
  thumbnail: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
    backgroundColor: colors.border,
    position: "relative",
  },
  thumbnail_sm: {
    width: 60,
    height: 60,
  },
  thumbnail_md: {
    width: 80,
    height: 80,
  },
  thumbnail_lg: {
    width: 120,
    height: 120,
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.border,
  },
  thumbnailError: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.dangerLight,
  },
  thumbnailErrorIcon: {
    fontSize: 24,
    color: colors.danger,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0,
  },
  thumbnailLabel: {
    ...typography.small,
    color: colors.white,
  },
  removeButton: {
    position: "absolute",
    top: -spacing.xs,
    right: -spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
  },
  removeText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "bold",
    marginTop: -2,
  },

  // Add button
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  addIcon: {
    fontSize: 22,
  },
  addText: {
    ...typography.bodyMedium,
    flex: 1,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
});
