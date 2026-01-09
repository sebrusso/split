/**
 * Mock for expo-file-system and expo-file-system/next
 * Used in Jest tests to avoid ESM import issues
 */

// Mock File class for expo-file-system/next
export class File {
  uri: string;

  constructor(uri: string) {
    this.uri = uri;
  }

  async write(content: string): Promise<void> {
    // Mock implementation
  }

  async delete(): Promise<void> {
    // Mock implementation
  }

  async exists(): Promise<boolean> {
    return false;
  }

  async text(): Promise<string> {
    return '';
  }
}

// Mock Paths for expo-file-system/next
export const Paths = {
  cache: '/mock/cache',
  document: '/mock/document',
  appleSharedContainers: {},
};

// Legacy expo-file-system exports
export const documentDirectory = '/mock/document/';
export const cacheDirectory = '/mock/cache/';

export async function getInfoAsync(uri: string): Promise<{
  exists: boolean;
  isDirectory: boolean;
  size: number;
  modificationTime: number;
}> {
  return {
    exists: false,
    isDirectory: false,
    size: 0,
    modificationTime: Date.now(),
  };
}

export async function readAsStringAsync(uri: string): Promise<string> {
  return '';
}

export async function writeAsStringAsync(uri: string, content: string): Promise<void> {
  // Mock implementation
}

export async function deleteAsync(uri: string): Promise<void> {
  // Mock implementation
}

export async function makeDirectoryAsync(uri: string): Promise<void> {
  // Mock implementation
}

export async function copyAsync(options: { from: string; to: string }): Promise<void> {
  // Mock implementation
}

export async function moveAsync(options: { from: string; to: string }): Promise<void> {
  // Mock implementation
}

export default {
  File,
  Paths,
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  makeDirectoryAsync,
  copyAsync,
  moveAsync,
};
