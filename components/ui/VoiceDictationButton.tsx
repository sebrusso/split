/**
 * Voice Dictation Button Component
 *
 * A floating action button for initiating voice dictation.
 * Shows recording state, waveform visualization, and duration.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { RecordingState } from '../../lib/voice/types';
import { formatRecordingDuration } from '../../lib/voice/useVoiceDictation';

interface VoiceDictationButtonProps {
  /** Current recording state */
  state: RecordingState;
  /** Recording duration in ms */
  durationMs: number;
  /** Called when button is pressed (starts/stops recording) */
  onPress: () => void;
  /** Called when long-pressed to cancel */
  onLongPress?: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
}

export function VoiceDictationButton({
  state,
  durationMs,
  onPress,
  onLongPress,
  disabled = false,
}: VoiceDictationButtonProps) {
  // Animated values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for recording state
  useEffect(() => {
    if (state === 'recording') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state, pulseAnim]);

  // Rotate animation for processing state
  useEffect(() => {
    if (state === 'processing') {
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotate.start();
      return () => rotate.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [state, rotateAnim]);

  const getIcon = () => {
    switch (state) {
      case 'recording':
        return 'stop';
      case 'processing':
        return 'sync';
      case 'confirming':
        return 'checkmark-circle';
      case 'error':
        return 'alert-circle';
      default:
        return 'mic';
    }
  };

  const getBackgroundColor = () => {
    switch (state) {
      case 'recording':
        return colors.danger;
      case 'processing':
        return colors.warning;
      case 'confirming':
        return colors.success;
      case 'error':
        return colors.danger;
      default:
        return colors.primary;
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Duration label - shows when recording */}
      {state === 'recording' && (
        <View style={styles.durationContainer}>
          <View style={styles.recordingIndicator} />
          <Text style={styles.durationText}>{formatRecordingDuration(durationMs)}</Text>
        </View>
      )}

      {/* Main button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled || state === 'processing'}
        delayLongPress={500}
      >
        <Animated.View
          style={[
            styles.button,
            { backgroundColor: getBackgroundColor() },
            {
              transform: [
                { scale: pulseAnim },
                { rotate: state === 'processing' ? rotateInterpolate : '0deg' },
              ],
            },
          ]}
        >
          <Ionicons name={getIcon()} size={28} color={colors.white} />
        </Animated.View>
      </TouchableOpacity>

      {/* State label */}
      <Text style={styles.stateLabel}>
        {state === 'idle' && 'Tap to speak'}
        {state === 'recording' && 'Tap to stop'}
        {state === 'processing' && 'Processing...'}
        {state === 'confirming' && 'Review'}
        {state === 'error' && 'Try again'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  durationText: {
    ...typography.small,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['tabular-nums'],
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  stateLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
