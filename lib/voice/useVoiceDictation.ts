/**
 * Voice Dictation Hook
 *
 * Provides a complete voice dictation workflow for receipt claiming:
 * - Recording management
 * - Transcription with Whisper
 * - NLU parsing with Gemini
 * - Claim application
 * - Conversation context (P1)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import {
  VoiceDictationState,
  VoiceDictationConfig,
  VoiceDictationActions,
  RecordingState,
  VoiceClaimIntent,
  ConversationContext,
} from './types';
import {
  startRecording,
  stopRecording,
  cancelRecording,
  transcribeAudio,
  isRecording,
  getRecordingDuration,
  hasMicrophonePermission,
  requestMicrophonePermission,
} from './whisper';
import {
  parseVoiceCommand,
  parseVoiceCommandLocal,
  createConversationContext,
  addConversationTurn,
  clearPendingClaims,
  generateProactivePrompt,
} from './voiceNLU';

// Recording update interval
const DURATION_UPDATE_INTERVAL = 100;

/**
 * Hook for voice dictation functionality
 */
export function useVoiceDictation(config: VoiceDictationConfig): [VoiceDictationState, VoiceDictationActions] {
  // State
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [nluResult, setNluResult] = useState<VoiceDictationState['nluResult']>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [conversationContext, setConversationContext] = useState<ConversationContext>(
    createConversationContext()
  );

  // Refs
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef(config);

  // Keep config ref updated
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Clean up duration interval on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  /**
   * Start recording audio
   */
  const startRecordingAction = useCallback(async () => {
    try {
      // Check/request permission
      const hasPermission = await hasMicrophonePermission();
      if (!hasPermission) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          setError('Microphone permission is required for voice dictation');
          setState('error');
          return;
        }
      }

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Start recording
      await startRecording();

      setState('recording');
      setError(null);
      setTranscript(null);
      setNluResult(null);
      setRecordingDuration(0);

      // Start duration updates
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(getRecordingDuration());
      }, DURATION_UPDATE_INTERVAL);
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Failed to start recording');
      setState('error');
    }
  }, []);

  /**
   * Stop recording and process
   */
  const stopRecordingAction = useCallback(async () => {
    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (!isRecording()) {
      return;
    }

    try {
      setState('processing');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Stop recording
      const recording = await stopRecording();
      if (!recording) {
        throw new Error('No recording captured');
      }

      // Transcribe
      console.log('Transcribing audio...');
      const transcription = await transcribeAudio(recording.uri);
      console.log('Transcription:', transcription.text);
      setTranscript(transcription.text);

      if (!transcription.text || transcription.text.trim().length === 0) {
        setError("I couldn't hear anything. Please try again.");
        setState('error');
        return;
      }

      // Parse with NLU
      console.log('Parsing with NLU...');
      const { items, members, currentMemberId } = configRef.current;

      let result;
      try {
        result = await parseVoiceCommand(
          transcription.text,
          items,
          members,
          currentMemberId,
          conversationContext
        );
      } catch {
        // Fallback to local parsing if Gemini fails
        console.log('Falling back to local parsing...');
        result = parseVoiceCommandLocal(transcription.text, items, members, currentMemberId);
      }

      console.log('NLU Result:', result);
      setNluResult(result);

      // Generate proactive prompt if not already present
      if (!result.proactivePrompt && result.claims.length > 0) {
        const existingClaimedIds = new Set(
          items.filter((i) => i.claims && i.claims.length > 0).map((i) => i.id)
        );
        result.proactivePrompt = generateProactivePrompt(items, result.claims, existingClaimedIds);
      }

      // Haptic feedback for success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setState('confirming');
    } catch (err: any) {
      console.error('Error processing recording:', err);
      setError(err.message || 'Failed to process recording');
      setState('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [conversationContext]);

  /**
   * Cancel current recording
   */
  const cancelRecordingAction = useCallback(() => {
    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    cancelRecording();
    setState('idle');
    setError(null);
    setTranscript(null);
    setNluResult(null);
    setRecordingDuration(0);
  }, []);

  /**
   * Confirm and apply pending claims
   */
  const confirmClaimsAction = useCallback(async () => {
    if (!nluResult || nluResult.claims.length === 0) {
      setState('idle');
      return;
    }

    try {
      const { onApplyClaims } = configRef.current;
      const result = await onApplyClaims(nluResult.claims);

      if (result.success) {
        // Update conversation context
        setConversationContext((ctx) => {
          const updated = addConversationTurn(
            ctx,
            transcript || '',
            nluResult.claims,
            nluResult.response
          );
          return clearPendingClaims(updated);
        });

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setState('idle');
        setTranscript(null);
        setNluResult(null);
      } else {
        setError(result.error || 'Failed to apply claims');
        setState('error');
      }
    } catch (err: any) {
      console.error('Error confirming claims:', err);
      setError(err.message || 'Failed to apply claims');
      setState('error');
    }
  }, [nluResult, transcript]);

  /**
   * Reject pending claims and reset
   */
  const rejectClaimsAction = useCallback(() => {
    setState('idle');
    setTranscript(null);
    setNluResult(null);
    setError(null);
  }, []);

  /**
   * Clear conversation context and start fresh
   */
  const resetConversationAction = useCallback(() => {
    setConversationContext(createConversationContext());
    setState('idle');
    setTranscript(null);
    setNluResult(null);
    setError(null);
    setRecordingDuration(0);
  }, []);

  /**
   * Continue conversation with new input (P1)
   */
  const continueConversationAction = useCallback(async () => {
    // This essentially restarts recording to continue the conversation
    await startRecordingAction();
  }, [startRecordingAction]);

  // Build state object
  const dictationState: VoiceDictationState = {
    state,
    transcript,
    nluResult,
    error,
    recordingDuration,
    conversationContext,
  };

  // Build actions object
  const dictationActions: VoiceDictationActions = {
    startRecording: startRecordingAction,
    stopRecording: stopRecordingAction,
    cancelRecording: cancelRecordingAction,
    confirmClaims: confirmClaimsAction,
    rejectClaims: rejectClaimsAction,
    resetConversation: resetConversationAction,
    continueConversation: continueConversationAction,
  };

  return [dictationState, dictationActions];
}

/**
 * Format recording duration for display
 */
export function formatRecordingDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `0:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Get recording state display text
 */
export function getRecordingStateText(state: RecordingState): string {
  switch (state) {
    case 'idle':
      return 'Tap to speak';
    case 'recording':
      return 'Listening...';
    case 'processing':
      return 'Processing...';
    case 'confirming':
      return 'Review assignments';
    case 'error':
      return 'Error';
    default:
      return '';
  }
}
