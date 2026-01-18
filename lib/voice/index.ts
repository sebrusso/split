/**
 * Voice Dictation Module
 *
 * Exports all voice dictation functionality for receipt claiming.
 */

// Types
export * from './types';

// Whisper transcription
export {
  requestMicrophonePermission,
  hasMicrophonePermission,
  startRecording,
  stopRecording,
  cancelRecording,
  getRecordingStatus,
  isRecording,
  getRecordingDuration,
  transcribeAudio,
  cleanupRecordings,
} from './whisper';

// Item/Member matching
export {
  createItemSearcher,
  findBestItemMatch,
  findAllItemMatches,
  isConfidentItemMatch,
  normalizeItemReference,
  createMemberSearcher,
  findBestMemberMatch,
  findAllMemberMatches,
  isConfidentMemberMatch,
  isEveryoneReference,
  isCurrentUserReference,
  parseBasicClaimStatement,
  extractItemReferences,
  extractMemberReferences,
} from './itemMatcher';

// Voice NLU
export {
  parseVoiceCommand,
  parseVoiceCommandLocal,
  createConversationContext,
  addConversationTurn,
  clearPendingClaims,
  generateProactivePrompt,
} from './voiceNLU';

// Hook
export {
  useVoiceDictation,
  formatRecordingDuration,
  getRecordingStateText,
} from './useVoiceDictation';
