/**
 * Supabase storage helpers for receipt images
 */

import { supabase } from "./supabase";
import { handleAsync, AsyncResult } from "./utils";

const RECEIPTS_BUCKET = "receipts";

/**
 * Upload a receipt image to Supabase storage
 * @param uri Local URI of the image
 * @param groupId Group ID for organizing receipts
 * @param expenseId Expense ID for unique filename
 * @returns Public URL of the uploaded image
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

    // In React Native, blob.arrayBuffer() may not be available
    // Use FileReader to convert blob to base64, then decode
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Extract base64 data from data URL (remove "data:image/xxx;base64," prefix)
        const base64Data = dataUrl.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Decode base64 to Uint8Array for upload
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(filename, bytes, {
        contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
        upsert: true,
      });

    if (error) {
      // Check if error is due to missing bucket
      if (error.message?.includes("Bucket not found") || error.message?.includes("bucket")) {
        throw new Error(
          "Receipt storage is not yet configured. Please contact support or check your Supabase configuration."
        );
      }
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(RECEIPTS_BUCKET)
      .getPublicUrl(filename);

    return urlData.publicUrl;
  }, "Failed to upload receipt");
}

/**
 * Delete a receipt image from Supabase storage
 * @param receiptUrl Full URL of the receipt image
 * @returns Success result
 */
export async function deleteReceipt(receiptUrl: string): Promise<AsyncResult<boolean>> {
  return handleAsync(async () => {
    // Extract path from URL
    const url = new URL(receiptUrl);
    const pathParts = url.pathname.split(`/${RECEIPTS_BUCKET}/`);
    if (pathParts.length < 2) {
      throw new Error("Invalid receipt URL");
    }
    const path = pathParts[1];

    const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);

    if (error) {
      throw error;
    }

    return true;
  }, "Failed to delete receipt");
}

/**
 * Get the thumbnail URL for a receipt
 * Supabase can transform images on the fly
 * @param receiptUrl Original receipt URL
 * @param width Desired thumbnail width
 * @param height Desired thumbnail height
 * @returns Transformed image URL
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
