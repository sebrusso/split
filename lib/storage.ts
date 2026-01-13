/**
 * Supabase storage helpers for receipt images
 */

import { supabase } from "./supabase";
import { handleAsync, AsyncResult } from "./utils";

const RECEIPTS_BUCKET = "receipts";

/** Valid image extensions for receipts */
const VALID_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];

/**
 * Extract file extension from URI with proper URL handling
 * Fixes bug where URLs like "https://example.com/image" returned "com/image"
 * @param uri File URI or URL
 * @returns Valid image extension or "jpg" as default
 */
export function getFileExtension(uri: string): string {
  // Handle data URIs (e.g., data:image/png;base64,...)
  if (uri.startsWith("data:image/")) {
    const mimeType = uri.split(";")[0].split("/")[1];
    if (mimeType === "jpeg") return "jpg";
    if (VALID_IMAGE_EXTENSIONS.includes(mimeType)) return mimeType;
    return "jpg";
  }

  try {
    // Try to parse as URL first
    const url = new URL(uri);
    const pathname = url.pathname;
    const lastSegment = pathname.split("/").pop() || "";

    // Check if the last segment has a dot (file extension)
    if (lastSegment.includes(".")) {
      const ext = lastSegment.split(".").pop()?.toLowerCase();
      if (ext && VALID_IMAGE_EXTENSIONS.includes(ext)) {
        return ext;
      }
    }
  } catch {
    // Not a valid URL, try simple extraction from file path
    const parts = uri.split("/").pop()?.split(".") || [];
    if (parts.length > 1) {
      const ext = parts.pop()?.toLowerCase();
      if (ext && VALID_IMAGE_EXTENSIONS.includes(ext)) {
        return ext;
      }
    }
  }

  // Default to jpg if no valid extension found
  return "jpg";
}

/**
 * Get the correct content type for an image extension
 * Fixes bug with HEIC content-type handling
 * @param extension File extension
 * @returns MIME type string
 */
export function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };

  return contentTypes[extension.toLowerCase()] || "application/octet-stream";
}

/**
 * Upload a receipt image to Supabase storage
 * @param uri Local URI of the image
 * @param groupId Group ID for organizing receipts
 * @param expenseId Expense ID for unique filename
 * @param userId User ID for user-scoped storage paths (prevents overwrites)
 * @returns Public URL of the uploaded image
 */
export async function uploadReceipt(
  uri: string,
  groupId: string,
  expenseId: string,
  userId: string
): Promise<AsyncResult<string>> {
  return handleAsync(async () => {
    // Get file extension using new helper (fixes bug with URLs without extensions)
    const extension = getFileExtension(uri);
    // User-scoped path prevents cross-user receipt overwrites
    const filename = `${userId}/${groupId}/${expenseId}.${extension}`;

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
    // Using upsert: false to prevent accidental overwrites
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(filename, bytes, {
        contentType: getContentType(extension),
        upsert: false,
      });

    if (error) {
      // Check if error is due to file already existing
      if (error.message?.includes("already exists") || error.message?.includes("Duplicate")) {
        throw new Error(
          "A receipt already exists for this expense. Delete it first to upload a new one."
        );
      }
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
  // Handle data URIs specially
  if (uri.startsWith("data:image/")) {
    const mimeType = uri.split(";")[0].split("/")[1];
    return VALID_IMAGE_EXTENSIONS.includes(mimeType) || mimeType === "jpeg";
  }

  // For regular URIs, extract the extension directly (not using getFileExtension
  // which defaults to jpg - we want to reject unknown types here)
  try {
    // Try to parse as URL first
    const url = new URL(uri);
    const pathname = url.pathname;
    const lastSegment = pathname.split("/").pop() || "";

    if (lastSegment.includes(".")) {
      const ext = lastSegment.split(".").pop()?.toLowerCase();
      return ext ? VALID_IMAGE_EXTENSIONS.includes(ext) : false;
    }
    // URL without extension - accept it (will use default jpg for upload)
    return true;
  } catch {
    // Not a valid URL, try simple file path extraction
    const filename = uri.split("/").pop() || uri;
    if (filename.includes(".")) {
      const ext = filename.split(".").pop()?.toLowerCase();
      return ext ? VALID_IMAGE_EXTENSIONS.includes(ext) : false;
    }
    // No extension found - reject (unless it's a URL which was handled above)
    return false;
  }
}

/**
 * Get file size from URI (for validation)
 * Returns AsyncResult to properly handle errors instead of silently returning 0
 * (Fixes bug where validation could be bypassed on fetch failure)
 * @param uri File URI
 * @returns AsyncResult with file size in bytes or error
 */
export async function getFileSize(uri: string): Promise<AsyncResult<number>> {
  return handleAsync(async () => {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("File appears to be empty");
    }
    return blob.size;
  }, "Failed to get file size");
}

/**
 * Maximum file size for receipts (5MB)
 */
export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

/**
 * Validate receipt image before upload
 * Now properly handles file fetch errors instead of silently passing validation
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

  const sizeResult = await getFileSize(uri);

  // Handle file fetch errors (fixes validation bypass bug)
  if (sizeResult.error) {
    return {
      isValid: false,
      error: "Unable to validate file. Please try selecting the image again.",
    };
  }

  // Handle null/zero size (shouldn't happen if no error, but be defensive)
  if (sizeResult.data === null || sizeResult.data === 0) {
    return {
      isValid: false,
      error: "Invalid file. Please select a different image.",
    };
  }

  if (sizeResult.data > MAX_RECEIPT_SIZE) {
    return {
      isValid: false,
      error: "Image is too large. Maximum size is 5MB.",
    };
  }

  return { isValid: true, error: null };
}
