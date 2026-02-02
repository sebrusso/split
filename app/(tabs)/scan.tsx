/**
 * Scan Tab Screen
 *
 * Combined scanning interface for:
 * - Receipt scanning (OCR-based for expense tracking)
 * - QR code scanning (for joining groups)
 */

import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, borderRadius } from "../../lib/theme";
import { Button, QRCodeScanner } from "../../components/ui";
import { useReceiptUploadNoGroup } from "../../lib/useReceipts";
import { useAuth } from "../../lib/auth-context";

type ScanMode = "receipt" | "qr";

// Mode toggle component to avoid TypeScript narrowing issues
function ModeToggle({
  currentMode,
  onModeChange,
}: {
  currentMode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
}) {
  const isReceipt = currentMode === "receipt";
  const isQR = currentMode === "qr";

  return (
    <View style={modeStyles.modeToggle}>
      <TouchableOpacity
        style={[modeStyles.modeButton, isReceipt && modeStyles.modeButtonActive]}
        onPress={() => onModeChange("receipt")}
      >
        <Ionicons
          name="receipt-outline"
          size={18}
          color={isReceipt ? colors.white : colors.textSecondary}
        />
        <Text
          style={[
            modeStyles.modeButtonText,
            isReceipt && modeStyles.modeButtonTextActive,
          ]}
        >
          Receipt
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[modeStyles.modeButton, isQR && modeStyles.modeButtonActive]}
        onPress={() => onModeChange("qr")}
      >
        <Ionicons
          name="qr-code-outline"
          size={18}
          color={isQR ? colors.white : colors.textSecondary}
        />
        <Text
          style={[
            modeStyles.modeButtonText,
            isQR && modeStyles.modeButtonTextActive,
          ]}
        >
          Join Group
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const modeStyles = StyleSheet.create({
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: borderRadius.full,
    padding: 4,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: colors.white,
  },
});

export default function ScanScreen() {
  const { userId } = useAuth();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>("receipt");

  const { uploadReceipt, processReceipt, uploading, processing, error } =
    useReceiptUploadNoGroup();

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setCapturedImage(photo.uri);
      }
    } catch (err) {
      __DEV__ && console.error("Error capturing photo:", err);
      Alert.alert("Error", "Failed to capture photo");
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleUpload = async () => {
    if (!capturedImage || !userId) {
      Alert.alert("Error", "Unable to upload. Please try again.");
      return;
    }

    // Upload the receipt (without group)
    const uploadResult = await uploadReceipt(capturedImage, userId);

    if (!uploadResult.success || !uploadResult.receiptId) {
      Alert.alert(
        "Upload Failed",
        uploadResult.error || "Failed to upload receipt"
      );
      return;
    }

    // Process with OCR
    const processResult = await processReceipt(
      uploadResult.receiptId,
      capturedImage
    );

    if (!processResult.success) {
      Alert.alert(
        "OCR Failed",
        processResult.error ||
          "Failed to extract receipt data. You can add items manually.",
        [
          {
            text: "Continue Anyway",
            onPress: () => {
              router.push(`/assign-receipt/${uploadResult.receiptId}`);
            },
          },
          {
            text: "Try Again",
            onPress: handleRetake,
          },
        ]
      );
      return;
    }

    // Show warnings if any
    if (processResult.warnings && processResult.warnings.length > 0) {
      Alert.alert(
        "Review Recommended",
        `Receipt processed with warnings:\n\n${processResult.warnings.join("\n")}`,
        [
          {
            text: "Continue",
            onPress: () => {
              router.push(`/assign-receipt/${uploadResult.receiptId}`);
            },
          },
        ]
      );
      return;
    }

    // Success - navigate to assignment screen
    setCapturedImage(null); // Reset for next scan
    router.push(`/assign-receipt/${uploadResult.receiptId}`);
  };

  const handleQRCodeScanned = (code: string) => {
    // Navigate to join screen with the extracted code
    router.push(`/join?code=${code}`);
  };

  // Not logged in
  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="person-circle" size={64} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Sign In Required</Text>
          <Text style={styles.errorText}>
            Please sign in to scan receipts and QR codes.
          </Text>
          <Button
            title="Go to Profile"
            onPress={() => router.push("/profile")}
            variant="secondary"
          />
        </View>
      </SafeAreaView>
    );
  }

  // Permission not granted
  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera" size={64} color={colors.textSecondary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan receipts and QR codes. You can also
            choose an image from your photo library for receipts.
          </Text>
          <View style={styles.permissionButtons}>
            <Button
              title="Enable Camera"
              onPress={requestPermission}
              style={styles.permissionButton}
            />
            <Button
              title="Choose from Library"
              onPress={handlePickImage}
              variant="secondary"
              style={styles.permissionButton}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // QR Code scanning mode
  if (scanMode === "qr") {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {/* Mode Toggle */}
        <View style={styles.modeToggleContainer}>
          <ModeToggle currentMode={scanMode} onModeChange={setScanMode} />
        </View>

        <QRCodeScanner
          onScan={handleQRCodeScanned}
          instructionText="Scan a group's QR code to join"
          parseDeepLink={true}
          deepLinkPrefix="splitfree://join/"
        />
      </SafeAreaView>
    );
  }

  // Preview captured image
  if (capturedImage) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />

          {(uploading || processing) && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={styles.processingText}>
                {uploading ? "Uploading..." : "Scanning receipt..."}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.previewActions}>
          <Button
            title="Retake"
            onPress={handleRetake}
            variant="secondary"
            style={styles.actionButton}
            disabled={uploading || processing}
          />
          <Button
            title="Use Photo"
            onPress={handleUpload}
            style={styles.actionButton}
            loading={uploading || processing}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Receipt Camera view (default)
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Mode Toggle */}
        <View style={styles.modeToggleOverlay}>
          <ModeToggle currentMode={scanMode} onModeChange={setScanMode} />
        </View>

        {/* Guide overlay */}
        <View style={styles.guideOverlay}>
          <View style={styles.guideFrame}>
            <View style={[styles.guideCorner, styles.guideTopLeft]} />
            <View style={[styles.guideCorner, styles.guideTopRight]} />
            <View style={[styles.guideCorner, styles.guideBottomLeft]} />
            <View style={[styles.guideCorner, styles.guideBottomRight]} />
          </View>
          <Text style={styles.guideText}>Position receipt within frame</Text>
        </View>

        {/* Bottom controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.galleryButton} onPress={handlePickImage}>
            <Ionicons name="images" size={28} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <View style={styles.placeholderButton} />
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  errorTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  permissionText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  permissionButtons: {
    width: "100%",
    gap: spacing.md,
  },
  permissionButton: {
    width: "100%",
  },
  camera: {
    flex: 1,
  },
  modeToggleContainer: {
    position: "absolute",
    top: spacing.lg,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  modeToggleOverlay: {
    position: "absolute",
    top: spacing.lg,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  guideOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  guideFrame: {
    width: "85%",
    height: "60%",
    position: "relative",
  },
  guideCorner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: colors.white,
  },
  guideTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  guideTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  guideBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  guideBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  guideText: {
    ...typography.body,
    color: colors.white,
    marginTop: spacing.lg,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  galleryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.text,
  },
  placeholderButton: {
    width: 56,
    height: 56,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: colors.text,
  },
  previewImage: {
    flex: 1,
    resizeMode: "contain",
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    ...typography.body,
    color: colors.white,
    marginTop: spacing.md,
  },
  previewActions: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.card,
  },
  actionButton: {
    flex: 1,
  },
});
