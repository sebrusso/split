/**
 * Voice Dictation Types
 *
 * Type definitions for the voice dictation feature that allows
 * users to assign receipt items via voice commands.
 */

import { ReceiptItem, Member } from '../types';

// ============================================
// Recording & Transcription Types
// ============================================

export type RecordingState = 'idle' | 'recording' | 'processing' | 'confirming' | 'error';

export interface RecordingResult {
  uri: string;
  durationMs: number;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  durationMs: number;
}

// ============================================
// Voice NLU Types
// ============================================

export interface VoiceClaimIntent {
  /** The receipt item ID this claim refers to */
  itemId: string;
  /** The member ID claiming the item */
  memberId: string;
  /** Fraction of the item being claimed (0-1) */
  shareFraction: number;
  /** Confidence score for this match (0-1) */
  confidence: number;
  /** What the user said that was matched to this item */
  spokenReference: string;
  /** What the user said that was matched to this member */
  spokenMember: string;
}

export interface VoiceUndoIntent {
  type: 'undo';
  /** Optional: specific item to undo */
  itemId?: string;
  /** Optional: specific member to undo for */
  memberId?: string;
  /** What triggered this undo */
  trigger: string;
}

export interface VoiceSplitIntent {
  type: 'split';
  /** The item to split */
  itemId: string;
  /** Members to split between */
  memberIds: string[];
  /** Spoken reference to the item */
  spokenReference: string;
}

export interface UnmatchedReference {
  /** What the user said */
  spokenReference: string;
  /** Why it couldn't be matched */
  reason: 'no_matching_item' | 'ambiguous_item' | 'ambiguous_member' | 'unknown_member' | 'unclear_quantity';
  /** Possible matches if ambiguous */
  possibleMatches?: string[];
}

export interface VoiceNLUResult {
  /** Parsed claim intents */
  claims: VoiceClaimIntent[];
  /** References that couldn't be matched */
  unmatched: UnmatchedReference[];
  /** Undo intent if detected */
  undoIntent?: VoiceUndoIntent;
  /** Split intent if detected */
  splitIntent?: VoiceSplitIntent;
  /** Natural language response to show user */
  response: string;
  /** Whether clarification is needed */
  needsClarification: boolean;
  /** Proactive prompt for remaining items */
  proactivePrompt?: string;
}

// ============================================
// Conversational Context Types (P1)
// ============================================

export interface ConversationTurn {
  /** User's spoken input */
  userInput: string;
  /** Parsed intents from that input */
  parsedIntents: VoiceClaimIntent[];
  /** System response */
  systemResponse: string;
  /** Timestamp */
  timestamp: number;
}

export interface ConversationContext {
  /** Previous turns in this session */
  turns: ConversationTurn[];
  /** Currently pending claims (not yet committed) */
  pendingClaims: VoiceClaimIntent[];
  /** Items that have been mentioned but not fully assigned */
  mentionedItems: Set<string>;
  /** Members that have been mentioned */
  mentionedMembers: Set<string>;
  /** Last error or clarification needed */
  lastClarification?: string;
}

// ============================================
// Voice Dictation Hook Types
// ============================================

export interface VoiceDictationState {
  /** Current state of the recording/processing flow */
  state: RecordingState;
  /** Latest transcript from speech-to-text */
  transcript: string | null;
  /** NLU parsing result */
  nluResult: VoiceNLUResult | null;
  /** Error message if state is 'error' */
  error: string | null;
  /** Recording duration in ms */
  recordingDuration: number;
  /** Conversation context for P1 features */
  conversationContext: ConversationContext;
}

export interface VoiceDictationConfig {
  /** Receipt items to match against */
  items: ReceiptItem[];
  /** Group members to match against */
  members: Member[];
  /** Current user's member ID */
  currentMemberId: string | null;
  /** Receipt currency for display */
  currency: string;
  /** Callback when claims should be applied */
  onApplyClaims: (claims: VoiceClaimIntent[]) => Promise<{ success: boolean; error?: string }>;
  /** Callback when undo is requested */
  onUndo?: (intent: VoiceUndoIntent) => Promise<{ success: boolean; error?: string }>;
}

export interface VoiceDictationActions {
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and process */
  stopRecording: () => Promise<void>;
  /** Cancel current recording */
  cancelRecording: () => void;
  /** Confirm and apply pending claims */
  confirmClaims: () => Promise<void>;
  /** Reject pending claims and reset */
  rejectClaims: () => void;
  /** Clear conversation context and start fresh */
  resetConversation: () => void;
  /** Continue conversation with new input */
  continueConversation: () => Promise<void>;
}

// ============================================
// Fuzzy Matching Types
// ============================================

export interface FuzzyMatchResult<T> {
  item: T;
  score: number; // 0 = perfect match, higher = worse match
  matches?: Array<{
    key: string;
    value: string;
    indices: Array<[number, number]>;
  }>;
}

export interface ItemMatchResult {
  item: ReceiptItem;
  score: number;
  matchedOn: 'description' | 'original_text';
}

export interface MemberMatchResult {
  member: Member;
  score: number;
  matchedAs: 'name' | 'pronoun' | 'relationship';
}

// ============================================
// Audio Recording Types
// ============================================

export interface AudioRecordingConfig {
  /** Max recording duration in ms */
  maxDurationMs: number;
  /** Sample rate for recording */
  sampleRate: number;
  /** Number of audio channels */
  channels: 1 | 2;
  /** Bit rate for encoding */
  bitRate: number;
  /** Output format */
  format: 'wav' | 'm4a' | 'webm';
}

export const DEFAULT_RECORDING_CONFIG: AudioRecordingConfig = {
  maxDurationMs: 60000, // 60 seconds max
  sampleRate: 16000, // Whisper works best with 16kHz
  channels: 1, // Mono is sufficient for speech
  bitRate: 128000,
  format: 'm4a',
};
