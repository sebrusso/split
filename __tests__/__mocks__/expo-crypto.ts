/**
 * Mock for expo-crypto module
 * Used in Jest tests
 */

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  // Generate pseudo-random bytes for testing
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export function getRandomBytes(byteCount: number): Uint8Array {
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export const digestStringAsync = jest.fn();
export const CryptoDigestAlgorithm = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA384: 'SHA-384',
  SHA512: 'SHA-512',
  MD5: 'MD5',
};

export default {
  getRandomBytesAsync,
  getRandomBytes,
  digestStringAsync,
  CryptoDigestAlgorithm,
};
