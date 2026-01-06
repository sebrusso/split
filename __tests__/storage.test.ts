/**
 * Storage Utilities Tests
 *
 * Comprehensive tests for storage-related functions in lib/storage.ts
 * Tests pure utility functions and mocks external dependencies.
 */

import {
  isValidImageType,
  getReceiptThumbnailUrl,
  MAX_RECEIPT_SIZE,
  getFileSize,
  validateReceiptImage,
} from "../lib/storage";

// Mock supabase module
jest.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        getPublicUrl: jest.fn((path: string, options?: { transform?: object }) => ({
          data: {
            publicUrl: options?.transform
              ? `https://storage.supabase.co/receipts/${path}?width=${(options.transform as any).width}&height=${(options.transform as any).height}`
              : `https://storage.supabase.co/receipts/${path}`,
          },
        })),
        upload: jest.fn(),
        remove: jest.fn(),
      })),
    },
  },
}));

// Store original fetch
const originalFetch = global.fetch;

beforeEach(() => {
  // Reset fetch mock before each test
  global.fetch = jest.fn();
});

afterEach(() => {
  // Restore fetch
  global.fetch = originalFetch;
});

describe("MAX_RECEIPT_SIZE", () => {
  it("should be 5MB in bytes", () => {
    expect(MAX_RECEIPT_SIZE).toBe(5 * 1024 * 1024);
  });

  it("should be exactly 5242880 bytes", () => {
    expect(MAX_RECEIPT_SIZE).toBe(5242880);
  });
});

describe("isValidImageType", () => {
  describe("valid image types", () => {
    it("should return true for .jpg files", () => {
      expect(isValidImageType("photo.jpg")).toBe(true);
      expect(isValidImageType("/path/to/photo.jpg")).toBe(true);
      expect(isValidImageType("file:///data/photo.jpg")).toBe(true);
    });

    it("should return true for .jpeg files", () => {
      expect(isValidImageType("photo.jpeg")).toBe(true);
      expect(isValidImageType("/path/to/photo.jpeg")).toBe(true);
    });

    it("should return true for .png files", () => {
      expect(isValidImageType("image.png")).toBe(true);
      expect(isValidImageType("/path/to/image.png")).toBe(true);
    });

    it("should return true for .gif files", () => {
      expect(isValidImageType("animation.gif")).toBe(true);
      expect(isValidImageType("/path/to/animation.gif")).toBe(true);
    });

    it("should return true for .webp files", () => {
      expect(isValidImageType("modern.webp")).toBe(true);
      expect(isValidImageType("/path/to/modern.webp")).toBe(true);
    });

    it("should return true for .heic files", () => {
      expect(isValidImageType("iphone.heic")).toBe(true);
      expect(isValidImageType("/path/to/iphone.heic")).toBe(true);
    });
  });

  describe("case insensitivity", () => {
    it("should handle uppercase extensions", () => {
      expect(isValidImageType("photo.JPG")).toBe(true);
      expect(isValidImageType("photo.PNG")).toBe(true);
      expect(isValidImageType("photo.JPEG")).toBe(true);
      expect(isValidImageType("photo.GIF")).toBe(true);
      expect(isValidImageType("photo.WEBP")).toBe(true);
      expect(isValidImageType("photo.HEIC")).toBe(true);
    });

    it("should handle mixed case extensions", () => {
      expect(isValidImageType("photo.Jpg")).toBe(true);
      expect(isValidImageType("photo.JpEg")).toBe(true);
      expect(isValidImageType("photo.PnG")).toBe(true);
    });
  });

  describe("invalid image types", () => {
    it("should return false for .pdf files", () => {
      expect(isValidImageType("document.pdf")).toBe(false);
    });

    it("should return false for .doc files", () => {
      expect(isValidImageType("document.doc")).toBe(false);
      expect(isValidImageType("document.docx")).toBe(false);
    });

    it("should return false for .txt files", () => {
      expect(isValidImageType("notes.txt")).toBe(false);
    });

    it("should return false for .svg files", () => {
      expect(isValidImageType("logo.svg")).toBe(false);
    });

    it("should return false for .bmp files", () => {
      expect(isValidImageType("image.bmp")).toBe(false);
    });

    it("should return false for .tiff files", () => {
      expect(isValidImageType("photo.tiff")).toBe(false);
      expect(isValidImageType("photo.tif")).toBe(false);
    });

    it("should return false for .raw files", () => {
      expect(isValidImageType("photo.raw")).toBe(false);
    });

    it("should return false for video files", () => {
      expect(isValidImageType("video.mp4")).toBe(false);
      expect(isValidImageType("video.mov")).toBe(false);
      expect(isValidImageType("video.avi")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return false for files without extension", () => {
      expect(isValidImageType("filename")).toBe(false);
      expect(isValidImageType("/path/to/filename")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidImageType("")).toBe(false);
    });

    it("should return false for just a dot", () => {
      expect(isValidImageType(".")).toBe(false);
    });

    it("should return true for extension only (treated as valid extension)", () => {
      // Note: ".jpg" extracts "jpg" as the extension, which is valid
      expect(isValidImageType(".jpg")).toBe(true);
    });

    it("should handle multiple dots in filename", () => {
      expect(isValidImageType("photo.backup.jpg")).toBe(true);
      expect(isValidImageType("2024.01.15.receipt.png")).toBe(true);
    });

    it("should handle query strings in URL", () => {
      expect(isValidImageType("photo.jpg?token=abc")).toBe(false); // Extension is "jpg?token=abc"
    });

    it("should handle spaces in filename", () => {
      expect(isValidImageType("my photo.jpg")).toBe(true);
    });

    it("should handle special characters in filename", () => {
      expect(isValidImageType("photo-2024_01.jpg")).toBe(true);
      expect(isValidImageType("photo (1).png")).toBe(true);
    });

    it("should handle unicode in filename", () => {
      expect(isValidImageType("照片.jpg")).toBe(true);
      expect(isValidImageType("фото.png")).toBe(true);
    });
  });
});

describe("getReceiptThumbnailUrl", () => {
  const baseUrl = "https://storage.supabase.co/storage/v1/object/public/receipts/group-1/expense-1.jpg";

  describe("URL transformation", () => {
    it("should return original URL for invalid URL format", () => {
      const invalidUrl = "not-a-url";
      const result = getReceiptThumbnailUrl(invalidUrl);

      expect(result).toBe(invalidUrl);
    });

    it("should return original URL when path extraction fails", () => {
      const urlWithoutBucket = "https://storage.supabase.co/other/path/file.jpg";
      const result = getReceiptThumbnailUrl(urlWithoutBucket);

      expect(result).toBe(urlWithoutBucket);
    });

    it("should extract correct path from valid receipt URL", () => {
      const result = getReceiptThumbnailUrl(baseUrl);

      // Should contain the path and transformation parameters
      expect(result).toContain("group-1/expense-1.jpg");
    });
  });

  describe("default dimensions", () => {
    it("should use default width of 200 when not specified", () => {
      const result = getReceiptThumbnailUrl(baseUrl);

      expect(result).toContain("width=200");
    });

    it("should use default height of 200 when not specified", () => {
      const result = getReceiptThumbnailUrl(baseUrl);

      expect(result).toContain("height=200");
    });
  });

  describe("custom dimensions", () => {
    it("should use custom width when specified", () => {
      const result = getReceiptThumbnailUrl(baseUrl, 300);

      expect(result).toContain("width=300");
    });

    it("should use custom height when specified", () => {
      const result = getReceiptThumbnailUrl(baseUrl, 200, 400);

      expect(result).toContain("height=400");
    });

    it("should use both custom dimensions when specified", () => {
      const result = getReceiptThumbnailUrl(baseUrl, 150, 250);

      expect(result).toContain("width=150");
      expect(result).toContain("height=250");
    });

    it("should handle very small dimensions", () => {
      const result = getReceiptThumbnailUrl(baseUrl, 10, 10);

      expect(result).toContain("width=10");
      expect(result).toContain("height=10");
    });

    it("should handle very large dimensions", () => {
      const result = getReceiptThumbnailUrl(baseUrl, 2000, 2000);

      expect(result).toContain("width=2000");
      expect(result).toContain("height=2000");
    });

    it("should handle zero dimensions", () => {
      const result = getReceiptThumbnailUrl(baseUrl, 0, 0);

      expect(result).toContain("width=0");
      expect(result).toContain("height=0");
    });
  });

  describe("error handling", () => {
    it("should not throw for malformed URL", () => {
      expect(() => getReceiptThumbnailUrl(":::invalid:::")).not.toThrow();
    });

    it("should return original for null-like values", () => {
      // @ts-expect-error - testing runtime behavior
      expect(getReceiptThumbnailUrl(null)).toBe(null);
    });
  });
});

describe("getFileSize", () => {
  it("should return blob size for valid fetch response", async () => {
    const mockBlob = { size: 1024 };
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const size = await getFileSize("file:///path/to/image.jpg");

    expect(size).toBe(1024);
  });

  it("should return 0 for failed fetch", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const size = await getFileSize("file:///invalid/path.jpg");

    expect(size).toBe(0);
  });

  it("should return 0 for failed blob conversion", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockRejectedValue(new Error("Blob error")),
    });

    const size = await getFileSize("file:///path/to/image.jpg");

    expect(size).toBe(0);
  });

  it("should handle large file sizes", async () => {
    const mockBlob = { size: 50 * 1024 * 1024 }; // 50MB
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const size = await getFileSize("file:///path/to/large.jpg");

    expect(size).toBe(52428800);
  });

  it("should handle zero size files", async () => {
    const mockBlob = { size: 0 };
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const size = await getFileSize("file:///path/to/empty.jpg");

    expect(size).toBe(0);
  });
});

describe("validateReceiptImage", () => {
  describe("file type validation", () => {
    it("should return invalid for non-image file types", async () => {
      const result = await validateReceiptImage("document.pdf");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("valid image file");
    });

    it("should return invalid for text files", async () => {
      const result = await validateReceiptImage("notes.txt");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("valid image file");
    });

    it("should list supported formats in error message", async () => {
      const result = await validateReceiptImage("file.xyz");

      expect(result.error).toContain("JPG");
      expect(result.error).toContain("PNG");
    });
  });

  describe("file size validation", () => {
    it("should return valid for image under size limit", async () => {
      const mockBlob = { size: 1024 * 1024 }; // 1MB
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("image.jpg");

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should return invalid for image over size limit", async () => {
      const mockBlob = { size: 10 * 1024 * 1024 }; // 10MB
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("large-image.jpg");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("too large");
      expect(result.error).toContain("5MB");
    });

    it("should return valid for image exactly at size limit", async () => {
      const mockBlob = { size: MAX_RECEIPT_SIZE }; // Exactly 5MB
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("exact-limit.jpg");

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should return invalid for image 1 byte over limit", async () => {
      const mockBlob = { size: MAX_RECEIPT_SIZE + 1 };
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("just-over.jpg");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("too large");
    });
  });

  describe("combined validation", () => {
    it("should check type before size", async () => {
      // Even if size check would pass, type should fail first
      const mockBlob = { size: 1024 };
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("document.pdf");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("valid image file");
      // fetch should not be called for invalid type
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should return valid for small valid image", async () => {
      const mockBlob = { size: 500 * 1024 }; // 500KB
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("receipt.png");

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle zero size files", async () => {
      const mockBlob = { size: 0 };
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("empty.jpg");

      expect(result.isValid).toBe(true); // 0 is under 5MB
    });

    it("should handle fetch errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await validateReceiptImage("image.jpg");

      // getFileSize returns 0 on error, which is valid size
      expect(result.isValid).toBe(true);
    });

    it("should handle HEIC files from iPhone", async () => {
      const mockBlob = { size: 2 * 1024 * 1024 };
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("IMG_1234.HEIC");

      expect(result.isValid).toBe(true);
    });
  });

  describe("return type", () => {
    it("should return object with isValid boolean", async () => {
      const mockBlob = { size: 1024 };
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const result = await validateReceiptImage("image.jpg");

      expect(typeof result.isValid).toBe("boolean");
    });

    it("should return object with error string or null", async () => {
      const mockBlob = { size: 1024 };
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const validResult = await validateReceiptImage("image.jpg");
      expect(validResult.error).toBeNull();

      const invalidResult = await validateReceiptImage("doc.pdf");
      expect(typeof invalidResult.error).toBe("string");
    });
  });
});

describe("Integration Scenarios", () => {
  it("should validate typical receipt upload flow", async () => {
    // Step 1: Check if file type is valid
    const uri = "file:///var/mobile/Containers/Data/Application/.../receipt.jpg";
    const isValid = isValidImageType(uri);
    expect(isValid).toBe(true);

    // Step 2: Validate the file
    const mockBlob = { size: 2 * 1024 * 1024 }; // 2MB
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const validation = await validateReceiptImage(uri);
    expect(validation.isValid).toBe(true);
  });

  it("should reject oversized file in upload flow", async () => {
    const uri = "file:///path/to/large-receipt.jpg";

    // Large file
    const mockBlob = { size: 8 * 1024 * 1024 }; // 8MB
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const validation = await validateReceiptImage(uri);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain("5MB");
  });

  it("should generate thumbnail URL for viewing", () => {
    const originalUrl = "https://storage.supabase.co/storage/v1/object/public/receipts/group-1/expense-1.jpg";

    // Small thumbnail for list view
    const smallThumb = getReceiptThumbnailUrl(originalUrl, 100, 100);
    expect(smallThumb).toContain("width=100");

    // Larger preview
    const preview = getReceiptThumbnailUrl(originalUrl, 400, 600);
    expect(preview).toContain("width=400");
    expect(preview).toContain("height=600");
  });

  it("should handle all supported formats from camera roll", async () => {
    const formats = [
      "photo.jpg",
      "photo.jpeg",
      "photo.png",
      "animation.gif",
      "modern.webp",
      "iphone.heic",
    ];

    const mockBlob = { size: 1024 * 1024 };
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    for (const format of formats) {
      const result = await validateReceiptImage(`file:///path/to/${format}`);
      expect(result.isValid).toBe(true);
    }
  });
});
