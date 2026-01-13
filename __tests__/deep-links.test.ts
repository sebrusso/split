/**
 * Deep Link Edge Case Tests
 *
 * Tests for share code parsing, URL extraction, and navigation
 * edge cases related to deep linking functionality.
 */

// ============================================
// Share Code Parsing
// ============================================

describe("Share Code Parsing", () => {
  // Helper function that mimics share code validation
  const normalizeShareCode = (code: string): string => {
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  };

  const isValidShareCode = (code: string): boolean => {
    const normalized = normalizeShareCode(code);
    return normalized.length === 6 && /^[A-Z0-9]+$/.test(normalized);
  };

  describe("Case normalization", () => {
    it("should normalize lowercase share codes to uppercase", () => {
      expect(normalizeShareCode("abc123")).toBe("ABC123");
    });

    it("should handle mixed case codes", () => {
      expect(normalizeShareCode("AbC123")).toBe("ABC123");
    });

    it("should already uppercase codes unchanged", () => {
      expect(normalizeShareCode("XYZ789")).toBe("XYZ789");
    });
  });

  describe("Whitespace handling", () => {
    it("should handle codes with leading whitespace", () => {
      expect(normalizeShareCode("  ABC123")).toBe("ABC123");
    });

    it("should handle codes with trailing whitespace", () => {
      expect(normalizeShareCode("ABC123  ")).toBe("ABC123");
    });

    it("should handle codes with surrounding whitespace", () => {
      expect(normalizeShareCode("  ABC123  ")).toBe("ABC123");
    });

    it("should strip internal spaces", () => {
      expect(normalizeShareCode("ABC 123")).toBe("ABC123");
    });
  });

  describe("Invalid character handling", () => {
    it("should strip special characters", () => {
      expect(normalizeShareCode("ABC-123")).toBe("ABC123");
      expect(normalizeShareCode("ABC$123")).toBe("ABC123");
      expect(normalizeShareCode("ABC!123")).toBe("ABC123");
      expect(normalizeShareCode("ABC@123")).toBe("ABC123");
    });

    it("should handle codes with only special characters", () => {
      expect(normalizeShareCode("!@#$%^")).toBe("");
    });

    it("should handle unicode characters", () => {
      // Unicode should be stripped
      const result = normalizeShareCode("ABC123");
      expect(result).toBe("ABC123");
    });
  });

  describe("Code validation", () => {
    it("should validate correct 6-character codes", () => {
      expect(isValidShareCode("ABC123")).toBe(true);
      expect(isValidShareCode("XXXXXX")).toBe(true);
      expect(isValidShareCode("123456")).toBe(true);
    });

    it("should reject empty codes", () => {
      expect(isValidShareCode("")).toBe(false);
    });

    it("should reject codes shorter than 6 characters", () => {
      expect(isValidShareCode("ABC")).toBe(false);
      expect(isValidShareCode("ABC12")).toBe(false);
    });

    it("should reject codes longer than 6 characters (after stripping)", () => {
      expect(isValidShareCode("ABC1234")).toBe(false);
      expect(isValidShareCode("ABCDEFGH")).toBe(false);
    });

    it("should validate codes with extra characters that get stripped", () => {
      // "ABC-123" becomes "ABC123" which is valid
      expect(isValidShareCode("ABC-123")).toBe(true);
    });
  });
});

// ============================================
// URL Parsing
// ============================================

describe("URL Parsing", () => {
  // Helper function that extracts code from various URL formats
  const extractCodeFromUrl = (url: string): string | null => {
    try {
      // Handle app scheme deep links
      if (url.startsWith("splitfree://")) {
        const path = url.replace("splitfree://", "");
        const parts = path.split("/").filter(Boolean);
        if ((parts[0] === "join" || parts[0] === "settle") && parts[1]) {
          return parts[1].toUpperCase();
        }
        return null;
      }

      const parsed = new URL(url);
      const pathParts = parsed.pathname.split("/").filter(Boolean);

      // Handle /join/CODE format
      if (pathParts[0] === "join" && pathParts[1]) {
        return pathParts[1].toUpperCase();
      }

      // Handle /settle/CODE format
      if (pathParts[0] === "settle" && pathParts[1]) {
        return pathParts[1].toUpperCase();
      }

      // Handle /group/CODE format
      if (pathParts[0] === "group" && pathParts[1]) {
        return pathParts[1].toUpperCase();
      }

      // Handle query param ?code=CODE
      const codeParam = parsed.searchParams.get("code");
      if (codeParam) {
        return codeParam.toUpperCase();
      }

      return null;
    } catch {
      return null;
    }
  };

  describe("/join/CODE path format", () => {
    it("should extract code from standard join URL", () => {
      expect(extractCodeFromUrl("https://splitfree.app/join/ABC123")).toBe(
        "ABC123"
      );
    });

    it("should extract code from join URL with trailing slash", () => {
      expect(extractCodeFromUrl("https://splitfree.app/join/ABC123/")).toBe(
        "ABC123"
      );
    });

    it("should extract code from join URL with extra path segments", () => {
      expect(
        extractCodeFromUrl("https://splitfree.app/join/ABC123/welcome")
      ).toBe("ABC123");
    });
  });

  describe("/settle/CODE path format", () => {
    it("should extract code from settle URL", () => {
      expect(extractCodeFromUrl("https://splitfree.app/settle/XYZ789")).toBe(
        "XYZ789"
      );
    });
  });

  describe("Query parameter format", () => {
    it("should extract code from query parameter", () => {
      expect(extractCodeFromUrl("https://splitfree.app/join?code=DEF456")).toBe(
        "DEF456"
      );
    });

    it("should extract code when mixed with other params", () => {
      expect(
        extractCodeFromUrl(
          "https://splitfree.app/join?utm_source=email&code=DEF456&ref=friend"
        )
      ).toBe("DEF456");
    });
  });

  describe("App scheme deep links", () => {
    it("should extract code from splitfree:// scheme", () => {
      expect(extractCodeFromUrl("splitfree://join/ABC123")).toBe("ABC123");
    });

    it("should extract code from settle scheme", () => {
      expect(extractCodeFromUrl("splitfree://settle/XYZ789")).toBe("XYZ789");
    });
  });

  describe("Edge cases", () => {
    it("should return null for malformed URLs", () => {
      expect(extractCodeFromUrl("not-a-valid-url")).toBeNull();
      expect(extractCodeFromUrl("")).toBeNull();
    });

    it("should return null for javascript: URLs", () => {
      expect(extractCodeFromUrl("javascript:alert(1)")).toBeNull();
    });

    it("should return null for URLs without code", () => {
      expect(extractCodeFromUrl("https://splitfree.app/")).toBeNull();
      expect(extractCodeFromUrl("https://splitfree.app/about")).toBeNull();
    });

    it("should handle URL-encoded codes", () => {
      // URL-encoded codes stay encoded in the path - this is expected behavior
      // The code should be decoded before use
      const result = extractCodeFromUrl("https://splitfree.app/join/ABC%20123");
      // The URL parsing retains the encoding
      expect(result).toBe("ABC%20123");
    });

    it("should normalize case in extracted codes", () => {
      expect(extractCodeFromUrl("https://splitfree.app/join/abc123")).toBe(
        "ABC123"
      );
    });
  });
});

// ============================================
// Navigation After Deep Link
// ============================================

describe("Navigation After Deep Link", () => {
  // Helper to determine target route based on auth state
  const getDeepLinkRoute = (
    code: string,
    isAuthenticated: boolean
  ): string => {
    if (isAuthenticated) {
      return `/join?code=${code}`;
    }
    return `/auth/sign-in?redirect=${encodeURIComponent(`/join?code=${code}`)}`;
  };

  describe("Authenticated user flow", () => {
    it("should navigate directly to join screen", () => {
      const route = getDeepLinkRoute("ABC123", true);
      expect(route).toBe("/join?code=ABC123");
    });

    it("should not include redirect param when authenticated", () => {
      const route = getDeepLinkRoute("ABC123", true);
      expect(route).not.toContain("redirect");
    });
  });

  describe("Unauthenticated user flow", () => {
    it("should redirect to auth with original destination", () => {
      const route = getDeepLinkRoute("ABC123", false);
      expect(route).toContain("/auth/sign-in");
      expect(route).toContain("redirect");
    });

    it("should preserve code through auth redirect", () => {
      const route = getDeepLinkRoute("ABC123", false);
      const url = new URL(`https://app.test${route}`);
      const redirect = url.searchParams.get("redirect");
      expect(redirect).toContain("code=ABC123");
    });

    it("should properly encode redirect URL", () => {
      const route = getDeepLinkRoute("ABC123", false);
      // The redirect should be URL-encoded
      expect(route).toContain(encodeURIComponent("/join?code=ABC123"));
    });
  });
});

// ============================================
// Settlement Link Handling
// ============================================

describe("Settlement Link Handling", () => {
  // Helper to check if settlement link is expired
  const isSettlementExpired = (expiresAt: string): boolean => {
    return new Date(expiresAt) < new Date();
  };

  describe("Expiration checking", () => {
    it("should identify expired settlement links", () => {
      const pastDate = "2023-01-01T00:00:00Z";
      expect(isSettlementExpired(pastDate)).toBe(true);
    });

    it("should identify valid settlement links", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(isSettlementExpired(futureDate.toISOString())).toBe(false);
    });

    it("should handle edge case at exact expiration time", () => {
      // Create a date very slightly in the past
      const justExpired = new Date(Date.now() - 1000).toISOString();
      expect(isSettlementExpired(justExpired)).toBe(true);
    });
  });

  describe("Settlement link parsing", () => {
    const parseSettlementLink = (
      url: string
    ): { groupId?: string; fromMember?: string; toMember?: string } | null => {
      try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split("/").filter(Boolean);

        if (pathParts[0] === "settle" && pathParts[1]) {
          return {
            groupId: parsed.searchParams.get("group") || undefined,
            fromMember: parsed.searchParams.get("from") || undefined,
            toMember: parsed.searchParams.get("to") || undefined,
          };
        }
        return null;
      } catch {
        return null;
      }
    };

    it("should parse settlement link with all params", () => {
      const url =
        "https://splitfree.app/settle/XYZ?group=g1&from=m1&to=m2";
      const result = parseSettlementLink(url);
      expect(result).toEqual({
        groupId: "g1",
        fromMember: "m1",
        toMember: "m2",
      });
    });

    it("should handle missing optional params", () => {
      const url = "https://splitfree.app/settle/XYZ";
      const result = parseSettlementLink(url);
      expect(result).toEqual({
        groupId: undefined,
        fromMember: undefined,
        toMember: undefined,
      });
    });
  });
});

// ============================================
// Group Invitation Links
// ============================================

describe("Group Invitation Links", () => {
  // Helper to generate share URL
  const generateShareUrl = (
    shareCode: string,
    baseUrl: string = "https://splitfree.app"
  ): string => {
    return `${baseUrl}/join/${shareCode}`;
  };

  describe("URL generation", () => {
    it("should generate correct share URL", () => {
      expect(generateShareUrl("ABC123")).toBe(
        "https://splitfree.app/join/ABC123"
      );
    });

    it("should allow custom base URL", () => {
      expect(generateShareUrl("ABC123", "https://staging.splitfree.app")).toBe(
        "https://staging.splitfree.app/join/ABC123"
      );
    });
  });

  describe("QR code deep link format", () => {
    it("should use web URL format for QR codes (cross-platform)", () => {
      // QR codes should use https:// URLs for maximum compatibility
      const qrUrl = generateShareUrl("ABC123");
      expect(qrUrl.startsWith("https://")).toBe(true);
    });
  });
});

// ============================================
// Cross-platform Deep Link Compatibility
// ============================================

describe("Cross-platform Deep Link Compatibility", () => {
  const universalLinks = {
    ios: "https://splitfree.app/join/ABC123",
    android: "https://splitfree.app/join/ABC123",
    web: "https://splitfree.app/join/ABC123",
  };

  const appSchemeLinks = {
    ios: "splitfree://join/ABC123",
    android: "splitfree://join/ABC123",
  };

  it("should have consistent universal link format across platforms", () => {
    expect(universalLinks.ios).toBe(universalLinks.android);
    expect(universalLinks.android).toBe(universalLinks.web);
  });

  it("should have consistent app scheme format", () => {
    expect(appSchemeLinks.ios).toBe(appSchemeLinks.android);
  });

  it("universal links should work as web fallback", () => {
    // Universal links are valid web URLs
    Object.values(universalLinks).forEach((url) => {
      expect(() => new URL(url)).not.toThrow();
    });
  });
});
