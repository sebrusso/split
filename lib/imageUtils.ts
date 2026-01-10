/**
 * Image Utilities
 *
 * Compression and manipulation for receipt images before upload.
 * Uses expo-image-manipulator for processing.
 */

import * as ImageManipulator from 'expo-image-manipulator';

// Target dimensions for receipt images
// 1200px width is good for OCR readability while keeping file size reasonable
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1600;

// JPEG compression quality (0-1)
// 0.7 gives good quality with significant size reduction
const COMPRESSION_QUALITY = 0.7;

// Thumbnail dimensions
const THUMBNAIL_WIDTH = 300;
const THUMBNAIL_HEIGHT = 400;
const THUMBNAIL_QUALITY = 0.6;

export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  includeBase64?: boolean;
}

/**
 * Compress an image for upload
 * Resizes to max dimensions and applies JPEG compression
 */
export async function compressImage(
  imageUri: string,
  options: ImageCompressionOptions = {}
): Promise<CompressedImage> {
  const {
    maxWidth = MAX_WIDTH,
    maxHeight = MAX_HEIGHT,
    quality = COMPRESSION_QUALITY,
    includeBase64 = false,
  } = options;

  // Resize to fit within max dimensions while maintaining aspect ratio
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [
      {
        resize: {
          width: maxWidth,
          height: maxHeight,
        },
      },
    ],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: includeBase64,
    }
  );

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    base64: result.base64,
  };
}

/**
 * Create a thumbnail version of an image
 */
export async function createThumbnail(
  imageUri: string
): Promise<CompressedImage> {
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [
      {
        resize: {
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
        },
      },
    ],
    {
      compress: THUMBNAIL_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * Compress image and create thumbnail in parallel
 */
export async function prepareImageForUpload(
  imageUri: string,
  options: { includeBase64?: boolean } = {}
): Promise<{
  compressed: CompressedImage;
  thumbnail: CompressedImage;
}> {
  const [compressed, thumbnail] = await Promise.all([
    compressImage(imageUri, { includeBase64: options.includeBase64 }),
    createThumbnail(imageUri),
  ]);

  return { compressed, thumbnail };
}

/**
 * Estimate file size from base64 string
 * Base64 is ~33% larger than binary, so we can estimate
 */
export function estimateBase64FileSize(base64: string): number {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  // Base64 string length * 0.75 gives approximate byte size
  return Math.round(base64Data.length * 0.75);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
