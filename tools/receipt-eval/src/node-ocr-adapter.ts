/**
 * Node.js adapter for the OCR module
 *
 * Re-exports OCR functions from lib/ocr.ts and provides
 * Node.js-specific helpers for file operations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Re-export OCR functions - these work in Node.js 18+ (uses fetch)
export {
  extractReceipt,
  processReceiptSinglePass,
  processReceiptTwoPass,
  validateOCRResult,
  setOCRMode,
  getOCRMode,
  parseReceiptTextBasic,
} from '../../../lib/ocr';

// Re-export types
export type {
  OCRResult,
  OCRExtractedItem,
  OCRExtractedMetadata,
  OCRProvider,
  OCRServiceCharge,
  OCRDiscount,
  OCRTaxEntry,
  ServiceChargeType,
} from '../../../lib/types';

/**
 * Load an image file and convert to base64
 */
export function loadImageAsBase64(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  return buffer.toString('base64');
}

/**
 * Get the MIME type for an image file based on extension
 */
export function getMediaType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Check if the Gemini API key is configured
 */
export function isApiKeyConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_GEMINI_API_KEY;
}

/**
 * Get the configured API key (for debugging)
 */
export function getApiKeyPrefix(): string {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) return '(not set)';
  return key.substring(0, 8) + '...';
}
