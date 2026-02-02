/**
 * QR Code Scanner Component
 *
 * Reusable component for scanning QR codes.
 * Uses expo-camera's barcode scanning capabilities.
 */

import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, borderRadius } from "../../lib/theme";
import { Button } from "./Button";

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onClose?: () => void;
  instructionText?: string;
  // Parse deep links automatically and extract the code
  parseDeepLink?: boolean;
  // Expected deep link prefix (e.g., "splitfree://join/")
  deepLinkPrefix?: string;
}

/**
 * Parse a splitfree deep link and extract the code
 * Supports: splitfree://join/{code}
 */
function parseDeepLinkCode(data: string, prefix?: string): string | null {
  if (!prefix) return data;

  // Handle URL-encoded data
  const decodedData = decodeURIComponent(data);

  // Check if it matches the expected prefix
  if (decodedData.startsWith(prefix)) {
    return decodedData.substring(prefix.length);
  }

  // Also try without URL encoding
  if (data.startsWith(prefix)) {
    return data.substring(prefix.length);
  }

  return null;
}

export function QRCodeScanner({
  onScan,
  onClose,
  instructionText = "Position QR code within frame",
  parseDeepLink = false,
  deepLinkPrefix,
}: QRCodeScannerProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!isScanning) return;

      const scannedData = result.data;

      // Prevent duplicate scans
      if (scannedData === lastScanned) return;

      setLastScanned(scannedData);
      setIsScanning(false);

      if (parseDeepLink && deepLinkPrefix) {
        const code = parseDeepLinkCode(scannedData, deepLinkPrefix);
        if (code) {
          onScan(code);
        } else {
          // Not a valid deep link, allow scanning again
          setTimeout(() => {
            setIsScanning(true);
            setLastScanned(null);
          }, 1500);
        }
      } else {
        onScan(scannedData);
      }
    },
    [isScanning, lastScanned, onScan, parseDeepLink, deepLinkPrefix]
  );

  const handleRetry = () => {
    setIsScanning(true);
    setLastScanned(null);
  };

  // Permission not determined yet
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="qr-code" size={64} color={colors.textSecondary} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          We need camera access to scan QR codes.
        </Text>
        <View style={styles.permissionButtons}>
          <Button
            title="Enable Camera"
            onPress={requestPermission}
            style={styles.permissionButton}
          />
          {onClose && (
            <Button
              title="Cancel"
              onPress={onClose}
              variant="secondary"
              style={styles.permissionButton}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
      >
        {/* Close button */}
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
        )}

        {/* Guide overlay */}
        <View style={styles.guideOverlay}>
          <View style={styles.guideFrame}>
            <View style={[styles.guideCorner, styles.guideTopLeft]} />
            <View style={[styles.guideCorner, styles.guideTopRight]} />
            <View style={[styles.guideCorner, styles.guideBottomLeft]} />
            <View style={[styles.guideCorner, styles.guideBottomRight]} />
          </View>
          <Text style={styles.guideText}>{instructionText}</Text>
        </View>

        {/* Scanning status */}
        <View style={styles.statusContainer}>
          {isScanning ? (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.statusText}>Scanning...</Text>
            </View>
          ) : lastScanned && !parseDeepLink ? (
            <View style={styles.scannedIndicator}>
              <Ionicons name="checkmark-circle" size={24} color={colors.white} />
              <Text style={styles.statusText}>QR Code Detected!</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color={colors.white} />
              <Text style={styles.statusText}>Tap to scan again</Text>
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.text,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
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
  closeButton: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  guideOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  guideFrame: {
    width: 250,
    height: 250,
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
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  guideTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  guideBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  guideBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  guideText: {
    ...typography.body,
    color: colors.white,
    marginTop: spacing.xl,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  statusContainer: {
    position: "absolute",
    bottom: spacing.xxl,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scanningIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  scannedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.8)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  statusText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});
