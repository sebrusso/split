/**
 * Voice Dictation Modal Component
 *
 * Displays the voice dictation interface including:
 * - Live transcript
 * - Parsed claim confirmations
 * - Unmatched items that need clarification
 * - Action buttons (confirm, retry, cancel)
 * - Proactive prompts for remaining items (P1)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { VoiceDictationState } from '../../lib/voice/types';
import { ReceiptItem, Member } from '../../lib/types';
import { formatRecordingDuration } from '../../lib/voice/useVoiceDictation';
import { formatReceiptAmount } from '../../lib/receipts';

interface VoiceDictationModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Current dictation state */
  dictationState: VoiceDictationState;
  /** Receipt items for display */
  items: ReceiptItem[];
  /** Group members for display */
  members: Member[];
  /** Currency for formatting */
  currency: string;
  /** Callback to start recording */
  onStartRecording: () => void;
  /** Callback to stop recording */
  onStopRecording: () => void;
  /** Callback to confirm claims */
  onConfirm: () => void;
  /** Callback to retry (reject and restart) */
  onRetry: () => void;
  /** Callback to cancel/close */
  onCancel: () => void;
  /** Callback to continue conversation (P1) */
  onContinue?: () => void;
}

export function VoiceDictationModal({
  visible,
  dictationState,
  items,
  members,
  currency,
  onStartRecording,
  onStopRecording,
  onConfirm,
  onRetry,
  onCancel,
  onContinue,
}: VoiceDictationModalProps) {
  const { state, transcript, nluResult, error, recordingDuration } = dictationState;

  // Get item by ID
  const getItem = (itemId: string) => items.find((i) => i.id === itemId);
  // Get member by ID
  const getMember = (memberId: string) => members.find((m) => m.id === memberId);

  const renderRecordingView = () => (
    <View style={styles.recordingView}>
      {/* Waveform placeholder */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveform}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: Math.random() * 40 + 10,
                  opacity: 0.5 + Math.random() * 0.5,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Text style={styles.recordingDuration}>
        {formatRecordingDuration(recordingDuration)}
      </Text>

      <Text style={styles.recordingHint}>Listening... Say who had which items</Text>

      <TouchableOpacity style={styles.stopButton} onPress={onStopRecording}>
        <Ionicons name="stop" size={32} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderProcessingView = () => (
    <View style={styles.processingView}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.processingText}>Processing your voice...</Text>
      {transcript && (
        <View style={styles.transcriptPreview}>
          <Text style={styles.transcriptPreviewText}>"{transcript}"</Text>
        </View>
      )}
    </View>
  );

  const renderConfirmationView = () => {
    if (!nluResult) return null;

    return (
      <ScrollView style={styles.confirmationView} showsVerticalScrollIndicator={false}>
        {/* Transcript */}
        <Card style={styles.transcriptCard}>
          <View style={styles.transcriptHeader}>
            <Ionicons name="chatbubble" size={16} color={colors.textSecondary} />
            <Text style={styles.transcriptLabel}>You said:</Text>
          </View>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </Card>

        {/* AI Response */}
        <Card style={styles.responseCard}>
          <Text style={styles.responseText}>{nluResult.response}</Text>
        </Card>

        {/* Parsed Claims */}
        {nluResult.claims.length > 0 && (
          <View style={styles.claimsSection}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} /> Assignments
            </Text>
            {nluResult.claims.map((claim, index) => {
              const item = getItem(claim.itemId);
              const member = getMember(claim.memberId);
              if (!item || !member) return null;

              return (
                <View key={index} style={styles.claimRow}>
                  <View style={styles.claimMember}>
                    <Avatar name={member.name} size="sm" />
                    <Text style={styles.claimMemberName}>{member.name}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                  <View style={styles.claimItem}>
                    <Text style={styles.claimItemName} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <Text style={styles.claimItemPrice}>
                      {claim.shareFraction < 1
                        ? `${Math.round(claim.shareFraction * 100)}% of `
                        : ''}
                      {formatReceiptAmount(item.total_price * claim.shareFraction, currency)}
                    </Text>
                  </View>
                  {claim.confidence < 0.8 && (
                    <Ionicons name="help-circle" size={16} color={colors.warning} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Unmatched References */}
        {nluResult.unmatched.length > 0 && (
          <View style={styles.unmatchedSection}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="alert-circle" size={16} color={colors.warning} /> Couldn't match
            </Text>
            {nluResult.unmatched.map((um, index) => (
              <View key={index} style={styles.unmatchedRow}>
                <Text style={styles.unmatchedText}>"{um.spokenReference}"</Text>
                <Text style={styles.unmatchedReason}>
                  {um.reason === 'no_matching_item' && "Couldn't find this item"}
                  {um.reason === 'unknown_member' && "Don't recognize this person"}
                  {um.reason === 'ambiguous_item' && 'Multiple items match'}
                  {um.reason === 'ambiguous_member' && 'Multiple people match'}
                </Text>
                {um.possibleMatches && um.possibleMatches.length > 0 && (
                  <Text style={styles.possibleMatches}>
                    Did you mean: {um.possibleMatches.join(', ')}?
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Proactive Prompt (P1) */}
        {nluResult.proactivePrompt && (
          <Card style={styles.proactiveCard}>
            <Text style={styles.proactiveText}>{nluResult.proactivePrompt}</Text>
            {onContinue && (
              <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
                <Ionicons name="mic" size={18} color={colors.primary} />
                <Text style={styles.continueButtonText}>Continue speaking</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {nluResult.claims.length > 0 ? (
            <>
              <Button
                title="Confirm"
                onPress={onConfirm}
                style={styles.confirmButton}
              />
              <Button
                title="Try Again"
                variant="secondary"
                onPress={onRetry}
                style={styles.retryButton}
              />
            </>
          ) : (
            <Button title="Try Again" onPress={onRetry} style={styles.fullButton} />
          )}
        </View>
      </ScrollView>
    );
  };

  const renderErrorView = () => (
    <View style={styles.errorView}>
      <Ionicons name="alert-circle" size={48} color={colors.danger} />
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <Button title="Try Again" onPress={onRetry} style={styles.retryButton} />
    </View>
  );

  const renderIdleView = () => (
    <View style={styles.idleView}>
      <View style={styles.idleIconContainer}>
        <Ionicons name="mic" size={48} color={colors.primary} />
      </View>
      <Text style={styles.idleTitle}>Voice Assign</Text>
      <Text style={styles.idleSubtitle}>
        Say who had which items. For example:{'\n'}
        "I had the burger, Drew got the salmon"
      </Text>
      <Button
        title="Start Speaking"
        onPress={onStartRecording}
        style={styles.startButton}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Voice Assign</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content based on state */}
          <View style={styles.content}>
            {state === 'idle' && renderIdleView()}
            {state === 'recording' && renderRecordingView()}
            {state === 'processing' && renderProcessingView()}
            {state === 'confirming' && renderConfirmationView()}
            {state === 'error' && renderErrorView()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    ...typography.h3,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    minHeight: 300,
  },
  // Idle View
  idleView: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  idleIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  idleTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  idleSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  startButton: {
    minWidth: 200,
  },
  // Recording View
  recordingView: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  waveformContainer: {
    height: 80,
    width: '100%',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  waveformBar: {
    width: 4,
    backgroundColor: colors.danger,
    borderRadius: 2,
  },
  recordingDuration: {
    ...typography.h1,
    color: colors.danger,
    fontVariant: ['tabular-nums'],
    marginBottom: spacing.sm,
  },
  recordingHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  // Processing View
  processingView: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  processingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  transcriptPreview: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.md,
    maxWidth: '100%',
  },
  transcriptPreviewText: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
  },
  // Confirmation View
  confirmationView: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  transcriptCard: {
    marginBottom: spacing.md,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  transcriptLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  transcriptText: {
    ...typography.body,
    fontStyle: 'italic',
  },
  responseCard: {
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  responseText: {
    ...typography.body,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  claimsSection: {
    marginBottom: spacing.lg,
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  claimMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  claimMemberName: {
    ...typography.bodyMedium,
  },
  claimItem: {
    flex: 2,
    alignItems: 'flex-end',
  },
  claimItemName: {
    ...typography.small,
    color: colors.textSecondary,
  },
  claimItemPrice: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  unmatchedSection: {
    marginBottom: spacing.lg,
  },
  unmatchedRow: {
    padding: spacing.sm,
    backgroundColor: colors.warningLight || '#FFF3CD',
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  unmatchedText: {
    ...typography.body,
    fontStyle: 'italic',
  },
  unmatchedReason: {
    ...typography.small,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  possibleMatches: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  proactiveCard: {
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  proactiveText: {
    ...typography.body,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  continueButtonText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  confirmButton: {
    flex: 2,
  },
  retryButton: {
    flex: 1,
  },
  fullButton: {
    flex: 1,
  },
  // Error View
  errorView: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  errorTitle: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
