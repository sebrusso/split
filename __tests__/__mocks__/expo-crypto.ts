/**
 * Mock for expo-crypto
 * Used in Jest tests to avoid ESM import issues
 */

export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getRandomBytes(byteCount: number): Uint8Array {
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return getRandomBytes(byteCount);
}

export async function digestStringAsync(
  algorithm: string,
  data: string
): Promise<string> {
  // Simple mock - just return a fixed-length hex string
  return '0'.repeat(64);
}

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
  SHA384: 'SHA-384',
  SHA512: 'SHA-512',
  MD5: 'MD5',
  SHA1: 'SHA-1',
};

export const CryptoEncoding = {
  HEX: 'hex',
  BASE64: 'base64',
};

export default {
  randomUUID,
  getRandomBytes,
  getRandomBytesAsync,
  digestStringAsync,
  CryptoDigestAlgorithm,
  CryptoEncoding,
};
