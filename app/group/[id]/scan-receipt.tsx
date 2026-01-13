/**
 * Scan Receipt Screen
 *
 * Camera-first interface for capturing receipt images.
 * Supports both camera capture and gallery selection.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../../lib/theme';
import { Button } from '../../../components/ui';
import { useReceiptUpload } from '../../../lib/useReceipts';
import { useAuth } from '../../../lib/auth-context';
import { supabase } from '../../../lib/supabase';
import { Member } from '../../../lib/types';
import { useAnalytics, AnalyticsEvents } from '../../../lib/analytics-provider';

export default function ScanReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { trackEvent } = useAnalytics();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [loadingMember, setLoadingMember] = useState(true);

  const { uploadReceipt, processReceipt, uploading, processing, error } =
    useReceiptUpload(id);

  // Fetch current user's member record
  useEffect(() => {
    const fetchMember = async () => {
      if (!id || !userId) {
        setLoadingMember(false);
        return;
      }

      try {
        const { data: member } = await supabase
          .from('members')
          .select('*')
          .eq('group_id', id)
          .eq('clerk_user_id', userId)
          .single();

        setCurrentMember(member);
      } catch (err) {
        console.error('Error fetching member:', err);
      } finally {
        setLoadingMember(false);
      }
    };

    fetchMember();
  }, [id, userId]);

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
      console.error('Error capturing photo:', err);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
    if (!capturedImage || !currentMember) {
      Alert.alert('Error', 'Unable to upload. Please try again.');
      return;
    }

    // Upload the receipt
    const uploadResult = await uploadReceipt(capturedImage, currentMember.id);

    if (!uploadResult.success || !uploadResult.receipt) {
      Alert.alert('Upload Failed', uploadResult.error || 'Failed to upload receipt');
      return;
    }

    // Process with OCR
    const processResult = await processReceipt(uploadResult.receipt.id, capturedImage);

    if (!processResult.success) {
      Alert.alert(
        'OCR Failed',
        processResult.error || 'Failed to extract receipt data. You can add items manually.',
        [
          {
            text: 'Add Manually',
            onPress: () => {
              router.replace(`/group/${id}/receipt/${uploadResult.receipt!.id}/edit`);
            },
          },
          {
            text: 'Try Again',
            onPress: handleRetake,
          },
        ]
      );
      return;
    }

    // Show warnings if any
    if (processResult.warnings && processResult.warnings.length > 0) {
      Alert.alert(
        'Review Recommended',
        `Receipt processed with warnings:\n\n${processResult.warnings.join('\n')}`,
        [
          {
            text: 'Review',
            onPress: () => {
              router.replace(`/group/${id}/receipt/${uploadResult.receipt!.id}/edit`);
            },
          },
          {
            text: 'Continue',
            onPress: () => {
              router.replace(`/group/${id}/receipt/${uploadResult.receipt!.id}`);
            },
          },
        ]
      );
      return;
    }

    // Track successful receipt scan
    trackEvent(AnalyticsEvents.RECEIPT_SCANNED, {
      groupId: id,
    });

    // Success - navigate to claiming screen
    router.replace(`/group/${id}/receipt/${uploadResult.receipt.id}`);
  };

  // Loading state
  if (loadingMember) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No member found
  if (!currentMember) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.danger} />
          <Text style={styles.errorTitle}>Unable to Continue</Text>
          <Text style={styles.errorText}>
            You must be a member of this group to upload receipts.
          </Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
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
            We need camera access to scan your receipt. You can also choose an image
            from your photo library.
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

  // Preview captured image
  if (capturedImage) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />

          {(uploading || processing) && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={styles.processingText}>
                {uploading ? 'Uploading...' : 'Scanning receipt...'}
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

  // Camera view
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
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

          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButtons: {
    width: '100%',
    gap: spacing.md,
  },
  permissionButton: {
    width: '100%',
  },
  camera: {
    flex: 1,
  },
  guideOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: '85%',
    height: '60%',
    position: 'relative',
  },
  guideCorner: {
    position: 'absolute',
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
    marginTop: spacing.xl,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
  },
  closeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
    backgroundColor: colors.text,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    ...typography.body,
    color: colors.white,
    marginTop: spacing.md,
  },
  previewActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  actionButton: {
    flex: 1,
  },
});
