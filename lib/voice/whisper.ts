/**
 * Whisper API Transcription Service
 *
 * Handles speech-to-text transcription using OpenAI's Whisper API.
 * Records audio locally, then sends to Whisper for transcription.
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  RecordingResult,
  TranscriptionResult,
  AudioRecordingConfig,
  DEFAULT_RECORDING_CONFIG,
} from './types';

// API configuration
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

// Recording instance
let currentRecording: Audio.Recording | null = null;
let recordingStartTime: number = 0;

/**
 * Request microphone permissions
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    return false;
  }
}

/**
 * Check if microphone permission is granted
 */
export async function hasMicrophonePermission(): Promise<boolean> {
  try {
    const { status } = await Audio.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error checking microphone permission:', error);
    return false;
  }
}

/**
 * Start audio recording
 */
export async function startRecording(
  config: Partial<AudioRecordingConfig> = {}
): Promise<void> {
  const mergedConfig = { ...DEFAULT_RECORDING_CONFIG, ...config };

  // Ensure permission
  const hasPermission = await hasMicrophonePermission();
  if (!hasPermission) {
    const granted = await requestMicrophonePermission();
    if (!granted) {
      throw new Error('Microphone permission not granted');
    }
  }

  // Stop any existing recording
  if (currentRecording) {
    await stopRecording();
  }

  try {
    // Configure audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    // Create recording with high quality settings
    const { recording } = await Audio.Recording.createAsync(
      {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: mergedConfig.sampleRate,
          numberOfChannels: mergedConfig.channels,
          bitRate: mergedConfig.bitRate,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: mergedConfig.sampleRate,
          numberOfChannels: mergedConfig.channels,
          bitRate: mergedConfig.bitRate,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: mergedConfig.bitRate,
        },
      },
      undefined,
      100 // Update every 100ms for waveform visualization
    );

    currentRecording = recording;
    recordingStartTime = Date.now();
  } catch (error) {
    console.error('Error starting recording:', error);
    throw new Error('Failed to start recording');
  }
}

/**
 * Stop audio recording and return the recording URI
 */
export async function stopRecording(): Promise<RecordingResult | null> {
  if (!currentRecording) {
    return null;
  }

  try {
    const durationMs = Date.now() - recordingStartTime;

    await currentRecording.stopAndUnloadAsync();
    const uri = currentRecording.getURI();

    // Reset audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    currentRecording = null;

    if (!uri) {
      throw new Error('No recording URI available');
    }

    return {
      uri,
      durationMs,
    };
  } catch (error) {
    console.error('Error stopping recording:', error);
    currentRecording = null;
    throw new Error('Failed to stop recording');
  }
}

/**
 * Cancel current recording without saving
 */
export async function cancelRecording(): Promise<void> {
  if (!currentRecording) {
    return;
  }

  try {
    await currentRecording.stopAndUnloadAsync();

    // Delete the recording file
    const uri = currentRecording.getURI();
    if (uri) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }

    // Reset audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    currentRecording = null;
  } catch (error) {
    console.error('Error cancelling recording:', error);
    currentRecording = null;
  }
}

/**
 * Get current recording status
 */
export async function getRecordingStatus(): Promise<Audio.RecordingStatus | null> {
  if (!currentRecording) {
    return null;
  }

  try {
    return await currentRecording.getStatusAsync();
  } catch {
    return null;
  }
}

/**
 * Check if currently recording
 */
export function isRecording(): boolean {
  return currentRecording !== null;
}

/**
 * Get recording duration in milliseconds
 */
export function getRecordingDuration(): number {
  if (!currentRecording) {
    return 0;
  }
  return Date.now() - recordingStartTime;
}

/**
 * Transcribe audio file using Whisper API
 */
export async function transcribeAudio(
  audioUri: string,
  language: string = 'en'
): Promise<TranscriptionResult> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      'OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in your environment.'
    );
  }

  const startTime = Date.now();

  try {
    // Read the audio file
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }

    // Create form data for the API request
    const formData = new FormData();

    // Read file as blob for upload
    const response = await fetch(audioUri);
    const blob = await response.blob();

    // Determine file extension and mime type
    const extension = audioUri.split('.').pop() || 'm4a';
    const mimeType =
      extension === 'webm'
        ? 'audio/webm'
        : extension === 'wav'
          ? 'audio/wav'
          : 'audio/m4a';

    formData.append('file', blob, `recording.${extension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'json');

    // Make API request
    const apiResponse = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`Whisper API error: ${apiResponse.status} - ${errorText}`);
    }

    const data = await apiResponse.json();

    if (!data.text) {
      throw new Error('No transcription returned from Whisper API');
    }

    const durationMs = Date.now() - startTime;

    return {
      text: data.text.trim(),
      language: data.language || language,
      durationMs,
    };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

/**
 * Record and transcribe in one call
 * Useful for testing or simple use cases
 */
export async function recordAndTranscribe(
  maxDurationMs: number = 30000
): Promise<TranscriptionResult> {
  await startRecording({ maxDurationMs });

  // Wait for user to stop or max duration
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const recording = await stopRecording();
        if (!recording) {
          reject(new Error('No recording captured'));
          return;
        }

        const transcription = await transcribeAudio(recording.uri);
        resolve(transcription);
      } catch (error) {
        reject(error);
      }
    }, maxDurationMs);
  });
}

/**
 * Clean up any temporary audio files
 */
export async function cleanupRecordings(): Promise<void> {
  try {
    // Cancel any active recording
    await cancelRecording();

    // Clean up temp directory if needed
    const tempDir = FileSystem.cacheDirectory + 'recordings/';
    const dirInfo = await FileSystem.getInfoAsync(tempDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
    }
  } catch (error) {
    console.error('Error cleaning up recordings:', error);
  }
}
