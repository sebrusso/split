/**
 * Mock for expo-sharing
 * Used in Jest tests to avoid ESM import issues
 */

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export async function shareAsync(
  url: string,
  options?: {
    mimeType?: string;
    dialogTitle?: string;
    UTI?: string;
  }
): Promise<void> {
  // Mock implementation - does nothing
}

export default {
  isAvailableAsync,
  shareAsync,
};
