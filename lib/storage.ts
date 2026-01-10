/**
 * Supabase storage helpers for receipt images
 *
 * Uses signed URLs for security - receipts are not publicly accessible
 */

import { supabase } from "./supabase";
import { handleAsync, AsyncResult } from "./utils";

const RECEIPTS_BUCKET = "receipts";

/**
 * Default expiration time for signed URLs (1 hour)
 */
const SIGNED_URL_EXPIRY_SECONDS = 3600;

/**
 * Upload a receipt image to Supabase storage
 * @param uri Local URI of the image
 * @param groupId Group ID for organizing receipts
 * @param expenseId Expense ID for unique filename
 * @returns Storage path (not URL) for the uploaded image
 */
export async function uploadReceipt(
  uri: string,
  groupId: string,
  expenseId: string
): Promise<AsyncResult<string>> {
  return handleAsync(async () => {
    // Get file extension from URI
    const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${groupId}/${expenseId}.${extension}`;

    // Fetch the image as blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Convert blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(filename, arrayBuffer, {
        contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // Return the storage path, not a public URL
    // Use getReceiptSignedUrl to get a time-limited access URL
    return filename;
  }, "Failed to upload receipt");
}

/**
 * Get a signed URL for a receipt image
 * URLs expire after the specified duration for security
 * @param storagePath The storage path of the receipt
 * @param expiresIn Expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null if error
 */
export async function getReceiptSignedUrl(
  storagePath: string,
  expiresIn: number = SIGNED_URL_EXPIRY_SECONDS
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data) {
      if (__DEV__) {
        console.error("Error creating signed URL:", error);
      }
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    if (__DEV__) {
      console.error("Error creating signed URL:", error);
    }
    return null;
  }
}

/**
 * Get a signed thumbnail URL for a receipt
 * Uses Supabase image transformation with signed URL
 * @param storagePath The storage path of the receipt
 * @param width Desired thumbnail width
 * @param height Desired thumbnail height
 * @param expiresIn Expiration time in seconds
 * @returns Signed URL with transformation or null if error
 */
export async function getReceiptThumbnailSignedUrl(
  storagePath: string,
  width: number = 200,
  height: number = 200,
  expiresIn: number = SIGNED_URL_EXPIRY_SECONDS
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(storagePath, expiresIn, {
        transform: {
          width,
          height,
          resize: "cover",
        },
      });

    if (error || !data) {
      if (__DEV__) {
        console.error("Error creating signed thumbnail URL:", error);
      }
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    if (__DEV__) {
      console.error("Error creating signed thumbnail URL:", error);
    }
    return null;
  }
}

/**
 * Delete a receipt image from Supabase storage
 * @param storagePath The storage path of the receipt
 * @returns Success result
 */
export async function deleteReceipt(storagePath: string): Promise<AsyncResult<boolean>> {
  return handleAsync(async () => {
    const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([storagePath]);

    if (error) {
      throw error;
    }

    return true;
  }, "Failed to delete receipt");
}

/**
 * Extract storage path from a signed or public URL
 * @param url The full URL
 * @returns Storage path or null if invalid
 */
export function extractStoragePath(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split(`/${RECEIPTS_BUCKET}/`);
    if (pathParts.length < 2) {
      return null;
    }
    // Remove any query parameters from the path
    return pathParts[1].split("?")[0];
  } catch {
    return null;
  }
}

/**
 * @deprecated Use getReceiptSignedUrl or getReceiptThumbnailSignedUrl instead
 * Get the thumbnail URL for a receipt (public URL - less secure)
 */
export function getReceiptThumbnailUrl(
  receiptUrl: string,
  width: number = 200,
  height: number = 200
): string {
  // Extract path from URL
  try {
    const url = new URL(receiptUrl);
    const pathParts = url.pathname.split(`/${RECEIPTS_BUCKET}/`);
    if (pathParts.length < 2) {
      return receiptUrl;
    }
    const path = pathParts[1];

    // Use Supabase image transformation
    const { data } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path, {
      transform: {
        width,
        height,
        resize: "cover",
      },
    });

    return data.publicUrl;
  } catch {
    return receiptUrl;
  }
}

/**
 * Check if a file is a valid image type
 * @param uri File URI
 * @returns Whether the file is a valid image
 */
export function isValidImageType(uri: string): boolean {
  const extension = uri.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(extension || "");
}

/**
 * Get file size from URI (for validation)
 * Note: This is an estimate based on the blob size
 * @param uri File URI
 * @returns File size in bytes
 */
export async function getFileSize(uri: string): Promise<number> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return 0;
  }
}

/**
 * Maximum file size for receipts (5MB)
 */
export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

/**
 * Validate receipt image before upload
 * @param uri File URI
 * @returns Validation result
 */
export async function validateReceiptImage(
  uri: string
): Promise<{ isValid: boolean; error: string | null }> {
  if (!isValidImageType(uri)) {
    return {
      isValid: false,
      error: "Please select a valid image file (JPG, PNG, GIF, WEBP, or HEIC)",
    };
  }

  const size = await getFileSize(uri);
  if (size > MAX_RECEIPT_SIZE) {
    return {
      isValid: false,
      error: "Image is too large. Maximum size is 5MB.",
    };
  }

  return { isValid: true, error: null };
}
