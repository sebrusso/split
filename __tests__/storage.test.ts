/**
 * Storage Unit Tests
 *
 * Tests for the bug fixes in lib/storage.ts:
 * 1. Extension extraction for URLs without extensions
 * 2. File size validation bypass (returning 0 on error)
 * 3. Content type handling for HEIC files
 * 4. User-scoped storage paths
 */

// Mock Supabase before importing storage module
jest.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        remove: jest.fn(),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: "mock-url" } })),
      })),
    },
  },
}));

import {
  getFileExtension,
  getContentType,
  isValidImageType,
} from "../lib/storage";

// ============================================
// Bug Fix #1: Extension Extraction
// ============================================

describe("getFileExtension", () => {
  describe("URLs with extensions", () => {
    it("should extract jpg from URL with extension", () => {
      expect(getFileExtension("https://example.com/image.jpg")).toBe("jpg");
    });

    it("should extract png from URL with extension", () => {
      expect(getFileExtension("https://example.com/photo.png")).toBe("png");
    });

    it("should extract heic from URL with extension", () => {
      expect(getFileExtension("https://example.com/photo.heic")).toBe("heic");
    });

    it("should handle URL with query params", () => {
      expect(
        getFileExtension("https://example.com/receipt.jpg?token=abc123")
      ).toBe("jpg");
    });

    it("should handle URL with multiple dots in path", () => {
      expect(
        getFileExtension("https://api.example.com/v1.0/image.png")
      ).toBe("png");
    });

    it("should handle uppercase extensions (normalized to lowercase)", () => {
      expect(getFileExtension("https://example.com/PHOTO.JPG")).toBe("jpg");
      expect(getFileExtension("https://example.com/image.PNG")).toBe("png");
    });
  });

  describe("URLs without extensions (Bug Fix)", () => {
    it("should return jpg for URL without extension", () => {
      // This was returning "com/image" before the fix
      expect(getFileExtension("https://example.com/image")).toBe("jpg");
    });

    it("should return jpg for URL with path but no extension", () => {
      expect(getFileExtension("https://api.example.com/uploads/12345")).toBe(
        "jpg"
      );
    });

    it("should return jpg for URL ending with slash", () => {
      expect(getFileExtension("https://example.com/images/")).toBe("jpg");
    });
  });

  describe("File paths", () => {
    it("should extract extension from file path", () => {
      expect(getFileExtension("/path/to/receipt.jpg")).toBe("jpg");
    });

    it("should extract extension from file:// URI", () => {
      expect(getFileExtension("file:///var/mobile/photo.png")).toBe("png");
    });

    it("should return jpg for file path without extension", () => {
      expect(getFileExtension("/path/to/image")).toBe("jpg");
    });
  });

  describe("Data URIs", () => {
    it("should extract png from data URI", () => {
      expect(getFileExtension("data:image/png;base64,ABC123")).toBe("png");
    });

    it("should extract jpg from jpeg data URI", () => {
      expect(getFileExtension("data:image/jpeg;base64,ABC123")).toBe("jpg");
    });

    it("should extract heic from heic data URI", () => {
      expect(getFileExtension("data:image/heic;base64,ABC123")).toBe("heic");
    });

    it("should return jpg for unknown image type in data URI", () => {
      expect(getFileExtension("data:image/unknown;base64,ABC123")).toBe("jpg");
    });
  });

  describe("Edge cases", () => {
    it("should return jpg for empty string", () => {
      expect(getFileExtension("")).toBe("jpg");
    });

    it("should return jpg for invalid URL", () => {
      expect(getFileExtension("not-a-valid-url")).toBe("jpg");
    });

    it("should reject invalid extensions and return jpg", () => {
      expect(getFileExtension("https://example.com/file.exe")).toBe("jpg");
      expect(getFileExtension("https://example.com/file.pdf")).toBe("jpg");
      expect(getFileExtension("https://example.com/file.txt")).toBe("jpg");
    });

    it("should handle double extensions correctly (last extension wins)", () => {
      expect(getFileExtension("receipt.jpg.exe")).toBe("jpg"); // .exe not valid
      expect(getFileExtension("malware.exe.jpg")).toBe("jpg"); // .jpg is valid
    });
  });
});

// ============================================
// Bug Fix #4: Content Type Handling
// ============================================

describe("getContentType", () => {
  describe("Standard image types", () => {
    it("should return image/jpeg for jpg", () => {
      expect(getContentType("jpg")).toBe("image/jpeg");
    });

    it("should return image/jpeg for jpeg", () => {
      expect(getContentType("jpeg")).toBe("image/jpeg");
    });

    it("should return image/png for png", () => {
      expect(getContentType("png")).toBe("image/png");
    });

    it("should return image/gif for gif", () => {
      expect(getContentType("gif")).toBe("image/gif");
    });

    it("should return image/webp for webp", () => {
      expect(getContentType("webp")).toBe("image/webp");
    });
  });

  describe("HEIC/HEIF handling (Bug Fix)", () => {
    it("should return image/heic for heic", () => {
      expect(getContentType("heic")).toBe("image/heic");
    });

    it("should return image/heif for heif", () => {
      expect(getContentType("heif")).toBe("image/heif");
    });
  });

  describe("Case insensitivity", () => {
    it("should handle uppercase extensions", () => {
      expect(getContentType("JPG")).toBe("image/jpeg");
      expect(getContentType("PNG")).toBe("image/png");
      expect(getContentType("HEIC")).toBe("image/heic");
    });

    it("should handle mixed case extensions", () => {
      expect(getContentType("JpG")).toBe("image/jpeg");
      expect(getContentType("HeIc")).toBe("image/heic");
    });
  });

  describe("Unknown extensions", () => {
    it("should return application/octet-stream for unknown extension", () => {
      expect(getContentType("unknown")).toBe("application/octet-stream");
    });

    it("should return application/octet-stream for empty string", () => {
      expect(getContentType("")).toBe("application/octet-stream");
    });
  });
});

// ============================================
// isValidImageType Tests
// ============================================

describe("isValidImageType", () => {
  describe("Valid image URIs", () => {
    it("should accept .jpg files", () => {
      expect(isValidImageType("receipt.jpg")).toBe(true);
    });

    it("should accept .jpeg files", () => {
      expect(isValidImageType("receipt.jpeg")).toBe(true);
    });

    it("should accept .png files", () => {
      expect(isValidImageType("receipt.png")).toBe(true);
    });

    it("should accept .gif files", () => {
      expect(isValidImageType("receipt.gif")).toBe(true);
    });

    it("should accept .webp files", () => {
      expect(isValidImageType("receipt.webp")).toBe(true);
    });

    it("should accept .heic files", () => {
      expect(isValidImageType("receipt.heic")).toBe(true);
    });

    it("should accept .heif files", () => {
      expect(isValidImageType("receipt.heif")).toBe(true);
    });
  });

  describe("URLs without extensions", () => {
    it("should accept URLs without extension (defaults to jpg)", () => {
      // After bug fix, URLs without extensions are accepted
      expect(isValidImageType("https://example.com/image")).toBe(true);
    });
  });

  describe("Data URIs", () => {
    it("should accept valid image data URIs", () => {
      expect(isValidImageType("data:image/png;base64,ABC123")).toBe(true);
      expect(isValidImageType("data:image/jpeg;base64,ABC123")).toBe(true);
      expect(isValidImageType("data:image/heic;base64,ABC123")).toBe(true);
    });
  });

  describe("Case insensitivity", () => {
    it("should accept uppercase extensions", () => {
      expect(isValidImageType("receipt.JPG")).toBe(true);
      expect(isValidImageType("receipt.PNG")).toBe(true);
    });
  });

  describe("Invalid types", () => {
    it("should reject .pdf files", () => {
      expect(isValidImageType("document.pdf")).toBe(false);
    });

    it("should reject .txt files", () => {
      expect(isValidImageType("notes.txt")).toBe(false);
    });

    it("should reject .exe files", () => {
      expect(isValidImageType("malware.exe")).toBe(false);
    });

    it("should reject .js files", () => {
      expect(isValidImageType("script.js")).toBe(false);
    });
  });
});

// ============================================
// Integration scenarios
// ============================================

describe("Storage Bug Fix Integration", () => {
  it("should handle real-world Supabase URL without query params", () => {
    const url =
      "https://rzwuknfycyqitcbotsvx.supabase.co/storage/v1/object/public/receipts/group123/expense456.jpg";
    expect(getFileExtension(url)).toBe("jpg");
    expect(isValidImageType(url)).toBe(true);
  });

  it("should handle Supabase URL with transformation params", () => {
    const url =
      "https://rzwuknfycyqitcbotsvx.supabase.co/storage/v1/object/public/receipts/group123/expense456.jpg?width=200&height=200";
    expect(getFileExtension(url)).toBe("jpg");
  });

  it("should handle expo-image-picker URI format", () => {
    const uri =
      "file:///var/mobile/Containers/Data/Application/ABC123/tmp/photo.jpg";
    expect(getFileExtension(uri)).toBe("jpg");
    expect(isValidImageType(uri)).toBe(true);
  });

  it("should handle expo-camera photo URI", () => {
    const uri = "file:///var/mobile/Containers/Data/Application/ABC123/tmp/CAM_1234.jpg";
    expect(getFileExtension(uri)).toBe("jpg");
  });
});
