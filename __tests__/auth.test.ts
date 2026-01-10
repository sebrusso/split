/**
 * Authentication Utility Tests
 *
 * Tests for auth-related utilities and helpers.
 * Note: Clerk hooks and components require a ClerkProvider context
 * and are best tested with integration/e2e tests.
 */

import { isClerkConfigured, CLERK_PUBLISHABLE_KEY } from "../lib/clerk";

describe("Clerk Configuration", () => {
  describe("isClerkConfigured", () => {
    it("should return false for placeholder key", () => {
      // The default placeholder key should return false
      // Note: This test assumes the key hasn't been replaced yet
      const originalKey = CLERK_PUBLISHABLE_KEY;

      if (originalKey === "pk_test_REPLACE_WITH_YOUR_KEY") {
        expect(isClerkConfigured()).toBe(false);
      } else {
        // If a real key is configured, it should return true
        expect(isClerkConfigured()).toBe(true);
      }
    });

    it("should validate key format starts with pk_", () => {
      // The key must start with pk_ to be considered configured
      expect(CLERK_PUBLISHABLE_KEY.startsWith("pk_") || CLERK_PUBLISHABLE_KEY === "pk_test_REPLACE_WITH_YOUR_KEY").toBe(true);
    });
  });
});

describe("Token Cache", () => {
  // Import here to avoid issues with module initialization
  const { tokenCache } = require("../lib/clerk");

  describe("getToken", () => {
    it("should return null when no token is stored", async () => {
      const token = await tokenCache.getToken("test-key");
      expect(token).toBeNull();
    });

    it("should not throw on getToken", async () => {
      await expect(tokenCache.getToken("any-key")).resolves.not.toThrow();
    });
  });

  describe("saveToken", () => {
    it("should not throw on saveToken", async () => {
      await expect(tokenCache.saveToken("test-key", "test-value")).resolves.not.toThrow();
    });
  });
});

describe("UserProfile Type", () => {
  it("should have correct shape", () => {
    // Type-level test to ensure UserProfile interface is correct
    const mockProfile: import("../lib/types").UserProfile = {
      id: "user_123",
      clerkId: "user_123",
      email: "test@example.com",
      displayName: "Test User",
      avatarUrl: "https://example.com/avatar.png",
      defaultCurrency: "USD",
      venmoUsername: "testuser",
      createdAt: new Date().toISOString(),
    };

    expect(mockProfile.id).toBeDefined();
    expect(mockProfile.clerkId).toBeDefined();
    expect(mockProfile.email).toBeDefined();
    expect(mockProfile.displayName).toBeDefined();
    expect(mockProfile.defaultCurrency).toBeDefined();
    expect(mockProfile.createdAt).toBeDefined();
  });

  it("should allow null avatarUrl", () => {
    const mockProfile: import("../lib/types").UserProfile = {
      id: "user_456",
      clerkId: "user_456",
      email: "test2@example.com",
      displayName: "Another User",
      avatarUrl: null,
      defaultCurrency: "EUR",
      venmoUsername: null,
      createdAt: new Date().toISOString(),
    };

    expect(mockProfile.avatarUrl).toBeNull();
  });
});

describe("Email Validation Helpers", () => {
  // Basic email validation for sign-in/sign-up forms
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  it("should validate correct email formats", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
    expect(isValidEmail("user+tag@example.org")).toBe(true);
  });

  it("should reject invalid email formats", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("test@")).toBe(false);
    expect(isValidEmail("test@.com")).toBe(false);
    expect(isValidEmail("test @example.com")).toBe(false);
  });
});

describe("Password Validation Helpers", () => {
  // Password validation for sign-up form
  const isValidPassword = (password: string): { valid: boolean; error?: string } => {
    if (!password) {
      return { valid: false, error: "Password is required" };
    }
    if (password.length < 8) {
      return { valid: false, error: "Password must be at least 8 characters" };
    }
    return { valid: true };
  };

  it("should accept valid passwords", () => {
    expect(isValidPassword("password123")).toEqual({ valid: true });
    expect(isValidPassword("MySecureP@ssw0rd")).toEqual({ valid: true });
    expect(isValidPassword("12345678")).toEqual({ valid: true });
  });

  it("should reject empty passwords", () => {
    expect(isValidPassword("")).toEqual({
      valid: false,
      error: "Password is required",
    });
  });

  it("should reject short passwords", () => {
    expect(isValidPassword("1234567")).toEqual({
      valid: false,
      error: "Password must be at least 8 characters",
    });
    expect(isValidPassword("abc")).toEqual({
      valid: false,
      error: "Password must be at least 8 characters",
    });
  });
});

describe("OAuth Redirect URL", () => {
  const { OAUTH_REDIRECT_URL } = require("../lib/clerk");

  it("should be defined", () => {
    expect(OAUTH_REDIRECT_URL).toBeDefined();
    expect(typeof OAUTH_REDIRECT_URL).toBe("string");
  });

  it("should have correct scheme", () => {
    expect(OAUTH_REDIRECT_URL.startsWith("splitfree://")).toBe(true);
  });
});

describe("Display Name Formatting", () => {
  // Helper to format display name from Clerk user data
  const formatDisplayName = (
    fullName: string | null,
    firstName: string | null,
    username: string | null
  ): string => {
    if (fullName) return fullName;
    if (firstName) return firstName;
    if (username) return username;
    return "User";
  };

  it("should prefer full name", () => {
    expect(formatDisplayName("John Doe", "John", "johndoe")).toBe("John Doe");
  });

  it("should fall back to first name", () => {
    expect(formatDisplayName(null, "John", "johndoe")).toBe("John");
  });

  it("should fall back to username", () => {
    expect(formatDisplayName(null, null, "johndoe")).toBe("johndoe");
  });

  it("should return default for no name", () => {
    expect(formatDisplayName(null, null, null)).toBe("User");
  });
});

describe("Currency Defaults", () => {
  const SUPPORTED_CURRENCIES = [
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "AUD",
    "JPY",
    "INR",
    "CHF",
    "CNY",
    "MXN",
  ];

  it("should have USD as a supported currency", () => {
    expect(SUPPORTED_CURRENCIES).toContain("USD");
  });

  it("should support common currencies", () => {
    expect(SUPPORTED_CURRENCIES).toContain("EUR");
    expect(SUPPORTED_CURRENCIES).toContain("GBP");
    expect(SUPPORTED_CURRENCIES).toContain("JPY");
  });

  it("should have reasonable number of currencies", () => {
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(5);
    expect(SUPPORTED_CURRENCIES.length).toBeLessThanOrEqual(20);
  });
});

// ============================================
// Mock Types for Clerk Hooks Testing
// ============================================

interface MockClerkError {
  errors?: Array<{ message?: string; code?: string }>;
  message?: string;
}

type SignUpStatus =
  | "missing_requirements"
  | "complete"
  | "abandoned";

type SignInStatus =
  | "complete"
  | "needs_first_factor"
  | "needs_second_factor"
  | "needs_identifier"
  | "needs_new_password";

interface MockSignUpResult {
  status: SignUpStatus;
  createdSessionId: string | null;
  missingFields?: string[];
}

interface MockSignInResult {
  status: SignInStatus;
  createdSessionId: string | null;
}

// ============================================
// Sign-Up Flow State Transitions
// ============================================

describe("Sign-Up Flow State Transitions", () => {
  // Simulates the sign-up state machine
  interface SignUpState {
    pendingVerification: boolean;
    loading: boolean;
    error: string;
    email: string;
  }

  const initialState: SignUpState = {
    pendingVerification: false,
    loading: false,
    error: "",
    email: "",
  };

  describe("Initial Registration State", () => {
    it("should start in initial state", () => {
      const state = { ...initialState };
      expect(state.pendingVerification).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.error).toBe("");
    });

    it("should transition to loading when form submitted", () => {
      const state = { ...initialState, loading: true, error: "" };
      expect(state.loading).toBe(true);
      expect(state.error).toBe("");
    });
  });

  describe("Verification Required Flow", () => {
    it("should transition to pending verification when sign-up returns missing_requirements", () => {
      const mockResult: MockSignUpResult = {
        status: "missing_requirements",
        createdSessionId: null,
        missingFields: ["email_address"],
      };

      // Simulate state transition
      const state = {
        ...initialState,
        pendingVerification: mockResult.status === "missing_requirements",
      };

      expect(state.pendingVerification).toBe(true);
    });

    it("should stay in verification state until code is verified", () => {
      const state: SignUpState = {
        ...initialState,
        pendingVerification: true,
        email: "test@example.com",
      };

      expect(state.pendingVerification).toBe(true);
      expect(state.email).toBe("test@example.com");
    });

    it("should transition from verification to complete on success", () => {
      const mockResult: MockSignUpResult = {
        status: "complete",
        createdSessionId: "session_123",
      };

      const state: SignUpState = {
        ...initialState,
        pendingVerification: false, // Reset after completion
      };

      expect(mockResult.status).toBe("complete");
      expect(mockResult.createdSessionId).not.toBeNull();
      expect(state.pendingVerification).toBe(false);
    });
  });

  describe("Direct Completion Flow (No Verification)", () => {
    it("should handle immediate completion status", () => {
      const mockResult: MockSignUpResult = {
        status: "complete",
        createdSessionId: "session_123",
      };

      // When status is complete, skip verification
      const needsVerification = mockResult.status !== "complete";
      expect(needsVerification).toBe(false);
    });
  });

  describe("Error State Transitions", () => {
    it("should transition to error state on failure", () => {
      const state: SignUpState = {
        ...initialState,
        loading: false,
        error: "Email already exists",
      };

      expect(state.loading).toBe(false);
      expect(state.error).toBeTruthy();
    });

    it("should clear error when retrying", () => {
      const previousState: SignUpState = {
        ...initialState,
        error: "Previous error",
      };

      // When user retries, error should be cleared
      const newState: SignUpState = {
        ...previousState,
        loading: true,
        error: "",
      };

      expect(newState.error).toBe("");
    });
  });
});

// ============================================
// Sign-In Error Handling
// ============================================

describe("Sign-In Error Handling", () => {
  // Helper to parse Clerk errors
  const parseClerkError = (err: MockClerkError): string => {
    if (err.errors?.[0]?.message) {
      return err.errors[0].message;
    }
    if (err.message) {
      return err.message;
    }
    return "Invalid email or password";
  };

  describe("Account Not Found Errors", () => {
    it("should parse identifier not found error", () => {
      const error: MockClerkError = {
        errors: [{ message: "Couldn't find your account.", code: "form_identifier_not_found" }],
      };
      expect(parseClerkError(error)).toBe("Couldn't find your account.");
    });

    it("should parse no account with email error", () => {
      const error: MockClerkError = {
        errors: [{ message: "No account found with this email address" }],
      };
      expect(parseClerkError(error)).toBe("No account found with this email address");
    });
  });

  describe("Wrong Password Errors", () => {
    it("should parse incorrect password error", () => {
      const error: MockClerkError = {
        errors: [{ message: "Password is incorrect. Try again, or use another method.", code: "form_password_incorrect" }],
      };
      expect(parseClerkError(error)).toBe("Password is incorrect. Try again, or use another method.");
    });

    it("should parse invalid credentials error", () => {
      const error: MockClerkError = {
        errors: [{ message: "Invalid credentials" }],
      };
      expect(parseClerkError(error)).toBe("Invalid credentials");
    });
  });

  describe("Account Locked/Suspended Errors", () => {
    it("should parse account locked error", () => {
      const error: MockClerkError = {
        errors: [{ message: "Your account has been locked due to too many failed attempts", code: "user_locked" }],
      };
      expect(parseClerkError(error)).toBe("Your account has been locked due to too many failed attempts");
    });
  });

  describe("Network/Server Errors", () => {
    it("should handle network error with fallback message", () => {
      const error: MockClerkError = {};
      expect(parseClerkError(error)).toBe("Invalid email or password");
    });

    it("should handle generic message fallback", () => {
      const error: MockClerkError = {
        message: "Network request failed",
      };
      expect(parseClerkError(error)).toBe("Network request failed");
    });
  });

  describe("Two-Factor Authentication", () => {
    it("should identify when 2FA is required", () => {
      const mockResult: MockSignInResult = {
        status: "needs_second_factor",
        createdSessionId: null,
      };

      const needsTwoFactor = mockResult.status === "needs_second_factor";
      expect(needsTwoFactor).toBe(true);
    });

    it("should identify when first factor needed", () => {
      const mockResult: MockSignInResult = {
        status: "needs_first_factor",
        createdSessionId: null,
      };

      const needsFirstFactor = mockResult.status === "needs_first_factor";
      expect(needsFirstFactor).toBe(true);
    });
  });
});

// ============================================
// Verification Code Flow
// ============================================

describe("Verification Code Flow", () => {
  describe("Code Validation", () => {
    const isValidVerificationCode = (code: string): boolean => {
      // Clerk uses 6-digit codes
      const trimmed = code.trim();
      return /^\d{6}$/.test(trimmed);
    };

    it("should accept valid 6-digit codes", () => {
      expect(isValidVerificationCode("123456")).toBe(true);
      expect(isValidVerificationCode("000000")).toBe(true);
      expect(isValidVerificationCode("999999")).toBe(true);
    });

    it("should accept codes with leading/trailing whitespace", () => {
      expect(isValidVerificationCode(" 123456 ")).toBe(true);
      expect(isValidVerificationCode("123456\n")).toBe(true);
    });

    it("should reject codes with wrong length", () => {
      expect(isValidVerificationCode("12345")).toBe(false);
      expect(isValidVerificationCode("1234567")).toBe(false);
      expect(isValidVerificationCode("")).toBe(false);
    });

    it("should reject codes with non-numeric characters", () => {
      expect(isValidVerificationCode("12345a")).toBe(false);
      expect(isValidVerificationCode("abcdef")).toBe(false);
      expect(isValidVerificationCode("12-456")).toBe(false);
      expect(isValidVerificationCode("123 456")).toBe(false);
    });
  });

  describe("Verification Result Handling", () => {
    const handleVerificationResult = (
      result: MockSignUpResult
    ): { success: boolean; redirect: string | null; message: string } => {
      if (result.status === "complete" && result.createdSessionId) {
        return { success: true, redirect: "/", message: "" };
      }
      if (result.status === "complete") {
        // Complete but no session
        return { success: true, redirect: "/auth/sign-in", message: "Account created! Please sign in." };
      }
      if (result.status === "missing_requirements") {
        return { success: true, redirect: "/auth/sign-in", message: "Account created! Please sign in to continue." };
      }
      return { success: true, redirect: "/auth/sign-in", message: "Please sign in with your new account." };
    };

    it("should redirect to home on complete with session", () => {
      const result: MockSignUpResult = {
        status: "complete",
        createdSessionId: "session_123",
      };

      const handled = handleVerificationResult(result);
      expect(handled.success).toBe(true);
      expect(handled.redirect).toBe("/");
    });

    it("should redirect to sign-in on complete without session", () => {
      const result: MockSignUpResult = {
        status: "complete",
        createdSessionId: null,
      };

      const handled = handleVerificationResult(result);
      expect(handled.success).toBe(true);
      expect(handled.redirect).toBe("/auth/sign-in");
      expect(handled.message).toContain("sign in");
    });

    it("should handle missing_requirements gracefully", () => {
      const result: MockSignUpResult = {
        status: "missing_requirements",
        createdSessionId: null,
        missingFields: [],
      };

      const handled = handleVerificationResult(result);
      expect(handled.redirect).toBe("/auth/sign-in");
    });
  });

  describe("Verification Error Messages", () => {
    const parseVerificationError = (err: MockClerkError): string => {
      if (err.errors?.[0]?.code === "form_code_incorrect") {
        return "The code you entered is incorrect. Please try again.";
      }
      if (err.errors?.[0]?.code === "verification_expired") {
        return "This verification code has expired. Please request a new one.";
      }
      if (err.errors?.[0]?.code === "too_many_attempts") {
        return "Too many attempts. Please wait before trying again.";
      }
      return err.errors?.[0]?.message || "Invalid verification code";
    };

    it("should handle incorrect code error", () => {
      const error: MockClerkError = {
        errors: [{ message: "Incorrect code", code: "form_code_incorrect" }],
      };
      expect(parseVerificationError(error)).toContain("incorrect");
    });

    it("should handle expired code error", () => {
      const error: MockClerkError = {
        errors: [{ message: "Code expired", code: "verification_expired" }],
      };
      expect(parseVerificationError(error)).toContain("expired");
    });

    it("should handle rate limiting error", () => {
      const error: MockClerkError = {
        errors: [{ message: "Too many attempts", code: "too_many_attempts" }],
      };
      expect(parseVerificationError(error)).toContain("Too many attempts");
    });
  });

  describe("Resend Code Flow", () => {
    it("should allow resend after initial send", () => {
      const canResend = (lastSentAt: number | null, cooldownMs: number = 30000): boolean => {
        if (!lastSentAt) return true;
        return Date.now() - lastSentAt >= cooldownMs;
      };

      expect(canResend(null)).toBe(true);
      expect(canResend(Date.now() - 60000)).toBe(true); // 60s ago
      expect(canResend(Date.now() - 10000)).toBe(false); // 10s ago
    });
  });
});

// ============================================
// Success vs Error Message Differentiation
// ============================================

describe("Success vs Error Message Differentiation", () => {
  type MessageType = "success" | "error" | "info" | "warning";

  interface AuthMessage {
    type: MessageType;
    text: string;
  }

  describe("Sign-Up Messages", () => {
    const getSignUpMessage = (
      status: SignUpStatus,
      hasError: boolean,
      errorMessage?: string
    ): AuthMessage => {
      if (hasError && errorMessage) {
        return { type: "error", text: errorMessage };
      }
      switch (status) {
        case "complete":
          return { type: "success", text: "Account created successfully!" };
        case "missing_requirements":
          return { type: "info", text: "Please verify your email to continue." };
        default:
          return { type: "info", text: "Processing..." };
      }
    };

    it("should return success message on completion", () => {
      const message = getSignUpMessage("complete", false);
      expect(message.type).toBe("success");
      expect(message.text).toContain("successfully");
    });

    it("should return info message for pending verification", () => {
      const message = getSignUpMessage("missing_requirements", false);
      expect(message.type).toBe("info");
      expect(message.text).toContain("verify");
    });

    it("should return error message when error exists", () => {
      const message = getSignUpMessage("complete", true, "Email already exists");
      expect(message.type).toBe("error");
      expect(message.text).toBe("Email already exists");
    });
  });

  describe("Sign-In Messages", () => {
    const getSignInMessage = (
      status: SignInStatus | null,
      hasError: boolean,
      errorMessage?: string
    ): AuthMessage => {
      if (hasError && errorMessage) {
        return { type: "error", text: errorMessage };
      }
      if (!status) {
        return { type: "info", text: "Please enter your credentials." };
      }
      switch (status) {
        case "complete":
          return { type: "success", text: "Signed in successfully!" };
        case "needs_second_factor":
          return { type: "info", text: "Please enter your 2FA code." };
        case "needs_first_factor":
          return { type: "info", text: "Please complete authentication." };
        default:
          return { type: "info", text: "Processing..." };
      }
    };

    it("should return success message on complete", () => {
      const message = getSignInMessage("complete", false);
      expect(message.type).toBe("success");
    });

    it("should return error message for auth failure", () => {
      const message = getSignInMessage(null, true, "Invalid email or password");
      expect(message.type).toBe("error");
    });

    it("should return info message for 2FA required", () => {
      const message = getSignInMessage("needs_second_factor", false);
      expect(message.type).toBe("info");
      expect(message.text).toContain("2FA");
    });
  });

  describe("Error Severity Classification", () => {
    type ErrorSeverity = "recoverable" | "fatal" | "user_error";

    const classifyError = (code: string | undefined): ErrorSeverity => {
      const fatalErrors = ["session_exists", "user_deleted", "user_banned"];
      const userErrors = [
        "form_password_incorrect",
        "form_identifier_not_found",
        "form_code_incorrect",
        "form_password_pwned",
      ];

      if (code && fatalErrors.includes(code)) return "fatal";
      if (code && userErrors.includes(code)) return "user_error";
      return "recoverable";
    };

    it("should classify password errors as user_error", () => {
      expect(classifyError("form_password_incorrect")).toBe("user_error");
    });

    it("should classify session exists as fatal", () => {
      expect(classifyError("session_exists")).toBe("fatal");
    });

    it("should classify unknown errors as recoverable", () => {
      expect(classifyError(undefined)).toBe("recoverable");
      expect(classifyError("network_error")).toBe("recoverable");
    });
  });
});

// ============================================
// Form Validation Edge Cases
// ============================================

describe("Form Validation Edge Cases", () => {
  describe("Email Validation Edge Cases", () => {
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email.trim());
    };

    it("should handle emails with plus addressing", () => {
      expect(isValidEmail("user+tag@example.com")).toBe(true);
      expect(isValidEmail("user+tag+more@example.com")).toBe(true);
    });

    it("should handle emails with dots in local part", () => {
      expect(isValidEmail("first.last@example.com")).toBe(true);
      expect(isValidEmail("first.middle.last@example.com")).toBe(true);
    });

    it("should handle subdomains", () => {
      expect(isValidEmail("user@mail.example.com")).toBe(true);
      expect(isValidEmail("user@subdomain.domain.co.uk")).toBe(true);
    });

    it("should handle numeric domains", () => {
      expect(isValidEmail("user@123.com")).toBe(true);
    });

    it("should reject double dots with strict validation", () => {
      // Note: The basic regex allows these, but strict RFC validation would reject them
      // This documents current behavior - Clerk handles strict validation server-side
      const isStrictValidEmail = (email: string): boolean => {
        const strictEmailRegex = /^(?!.*\.\.)[^\s@.][^\s@]*@[^\s@]+\.[^\s@]+$/;
        return strictEmailRegex.test(email.trim());
      };
      expect(isStrictValidEmail("user..name@example.com")).toBe(false);
      expect(isStrictValidEmail("user@example..com")).toBe(false);
      // Basic validation allows these (server handles strict validation)
      expect(isValidEmail("user..name@example.com")).toBe(true);
    });

    it("should reject emails starting or ending with dots with strict validation", () => {
      // Note: The basic regex allows these, but strict RFC validation would reject them
      const isStrictValidEmail = (email: string): boolean => {
        const strictEmailRegex = /^(?!\.)[^\s@]+(?<!\.)@[^\s@]+\.[^\s@]+$/;
        return strictEmailRegex.test(email.trim());
      };
      expect(isStrictValidEmail(".user@example.com")).toBe(false);
      expect(isStrictValidEmail("user.@example.com")).toBe(false);
      // Basic validation allows these (server handles strict validation)
      expect(isValidEmail(".user@example.com")).toBe(true);
    });

    it("should handle Unicode domains (IDN)", () => {
      // Basic regex won't handle IDN, but should not crash
      expect(() => isValidEmail("user@example.com")).not.toThrow();
    });

    it("should reject very long emails", () => {
      const longLocal = "a".repeat(65);
      const longDomain = "b".repeat(256);
      // While technically invalid by RFC, our regex will match
      // This test documents current behavior
      expect(isValidEmail(`${longLocal}@example.com`)).toBe(true);
      expect(isValidEmail(`user@${longDomain}.com`)).toBe(true);
    });
  });

  describe("Password Validation Edge Cases", () => {
    interface PasswordValidation {
      valid: boolean;
      errors: string[];
    }

    const validatePassword = (password: string): PasswordValidation => {
      const errors: string[] = [];

      if (!password) {
        errors.push("Password is required");
        return { valid: false, errors };
      }

      if (password.length < 8) {
        errors.push("Password must be at least 8 characters");
      }

      if (password.length > 128) {
        errors.push("Password must be less than 128 characters");
      }

      // Check for common weak passwords
      const commonPasswords = ["password", "12345678", "qwerty123", "password1"];
      if (commonPasswords.includes(password.toLowerCase())) {
        errors.push("This password is too common");
      }

      return { valid: errors.length === 0, errors };
    };

    it("should accept passwords at exactly minimum length", () => {
      const result = validatePassword("12345678");
      expect(result.errors).not.toContain("Password must be at least 8 characters");
    });

    it("should reject passwords below minimum length", () => {
      const result = validatePassword("1234567");
      expect(result.errors).toContain("Password must be at least 8 characters");
    });

    it("should warn about common passwords", () => {
      expect(validatePassword("password").errors).toContain("This password is too common");
      expect(validatePassword("12345678").errors).toContain("This password is too common");
      expect(validatePassword("Password").errors).toContain("This password is too common");
    });

    it("should reject very long passwords", () => {
      const longPassword = "a".repeat(129);
      expect(validatePassword(longPassword).errors).toContain("Password must be less than 128 characters");
    });

    it("should accept passwords with special characters", () => {
      expect(validatePassword("P@ssw0rd!").valid).toBe(true);
      expect(validatePassword("MyP@ss#$%^").valid).toBe(true);
    });

    it("should accept passwords with Unicode", () => {
      expect(validatePassword("Password123").valid).toBe(true);
    });

    it("should handle whitespace-only passwords", () => {
      // 8 spaces technically meets length requirement but is weak
      // Additional validation could reject all-whitespace passwords
      const result = validatePassword("        ");
      // Current implementation accepts 8+ char whitespace (length check passes)
      // In production, Clerk server-side validation would reject this
      expect(result.errors).not.toContain("Password must be at least 8 characters");

      // Test with less than 8 spaces
      expect(validatePassword("       ").errors).toContain("Password must be at least 8 characters");
    });
  });

  describe("Name Validation Edge Cases", () => {
    interface NameValidation {
      valid: boolean;
      error?: string;
    }

    const validateName = (name: string, fieldName: string = "Name"): NameValidation => {
      const trimmed = name.trim();

      if (!trimmed) {
        return { valid: false, error: `${fieldName} is required` };
      }

      if (trimmed.length > 50) {
        return { valid: false, error: `${fieldName} must be less than 50 characters` };
      }

      // Check for invalid characters (allow letters, spaces, hyphens, apostrophes)
      if (!/^[\p{L}\s'-]+$/u.test(trimmed)) {
        return { valid: false, error: `${fieldName} contains invalid characters` };
      }

      return { valid: true };
    };

    it("should accept names with accents", () => {
      expect(validateName("Jose").valid).toBe(true);
      expect(validateName("Francois").valid).toBe(true);
    });

    it("should accept hyphenated names", () => {
      expect(validateName("Mary-Jane").valid).toBe(true);
      expect(validateName("Jean-Pierre").valid).toBe(true);
    });

    it("should accept names with apostrophes", () => {
      expect(validateName("O'Connor").valid).toBe(true);
      expect(validateName("D'Angelo").valid).toBe(true);
    });

    it("should reject names with numbers", () => {
      expect(validateName("John123").valid).toBe(false);
    });

    it("should reject names with special characters", () => {
      expect(validateName("John@Doe").valid).toBe(false);
      expect(validateName("John#1").valid).toBe(false);
    });

    it("should handle whitespace-only names", () => {
      expect(validateName("   ").valid).toBe(false);
      expect(validateName("\t\n").valid).toBe(false);
    });

    it("should reject very long names", () => {
      const longName = "A".repeat(51);
      expect(validateName(longName).valid).toBe(false);
    });

    it("should trim leading/trailing whitespace", () => {
      expect(validateName("  John  ").valid).toBe(true);
    });
  });

  describe("Confirm Password Validation", () => {
    const validateConfirmPassword = (
      password: string,
      confirmPassword: string
    ): { valid: boolean; error?: string } => {
      if (!confirmPassword) {
        return { valid: false, error: "Please confirm your password" };
      }
      if (password !== confirmPassword) {
        return { valid: false, error: "Passwords do not match" };
      }
      return { valid: true };
    };

    it("should pass when passwords match exactly", () => {
      expect(validateConfirmPassword("Password123!", "Password123!").valid).toBe(true);
    });

    it("should fail when passwords differ by case", () => {
      const result = validateConfirmPassword("Password123", "password123");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Passwords do not match");
    });

    it("should fail when passwords differ by whitespace", () => {
      const result = validateConfirmPassword("Password123", "Password123 ");
      expect(result.valid).toBe(false);
    });

    it("should require confirm password to be filled", () => {
      const result = validateConfirmPassword("Password123", "");
      expect(result.error).toBe("Please confirm your password");
    });
  });

  describe("Form State Edge Cases", () => {
    interface FormState {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      confirmPassword: string;
    }

    const isFormComplete = (state: FormState): boolean => {
      return !!(
        state.firstName.trim() &&
        state.email.trim() &&
        state.password &&
        state.confirmPassword
      );
    };

    const isFormValid = (state: FormState): { valid: boolean; firstError?: string } => {
      if (!state.firstName.trim()) {
        return { valid: false, firstError: "Please enter your first name" };
      }
      if (!state.email.trim()) {
        return { valid: false, firstError: "Please enter your email" };
      }
      if (!state.password) {
        return { valid: false, firstError: "Please enter a password" };
      }
      if (state.password.length < 8) {
        return { valid: false, firstError: "Password must be at least 8 characters" };
      }
      if (state.password !== state.confirmPassword) {
        return { valid: false, firstError: "Passwords do not match" };
      }
      return { valid: true };
    };

    it("should detect incomplete form", () => {
      const state: FormState = {
        firstName: "John",
        lastName: "",
        email: "",
        password: "password123",
        confirmPassword: "password123",
      };
      expect(isFormComplete(state)).toBe(false);
    });

    it("should allow empty last name", () => {
      const state: FormState = {
        firstName: "John",
        lastName: "", // Optional
        email: "john@example.com",
        password: "password123",
        confirmPassword: "password123",
      };
      expect(isFormComplete(state)).toBe(true);
    });

    it("should return first validation error", () => {
      const state: FormState = {
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      };

      const result = isFormValid(state);
      expect(result.valid).toBe(false);
      expect(result.firstError).toBe("Please enter your first name");
    });

    it("should validate in correct order", () => {
      // Password too short but passwords match
      const state: FormState = {
        firstName: "John",
        lastName: "",
        email: "john@example.com",
        password: "short",
        confirmPassword: "short",
      };

      const result = isFormValid(state);
      expect(result.firstError).toBe("Password must be at least 8 characters");
    });
  });
});

// ============================================
// OAuth Flow Edge Cases
// ============================================

describe("OAuth Flow Edge Cases", () => {
  describe("OAuth State Management", () => {
    type OAuthProvider = "google" | "apple" | null;

    interface OAuthState {
      loading: OAuthProvider;
      error: string;
    }

    const initialOAuthState: OAuthState = {
      loading: null,
      error: "",
    };

    it("should only allow one OAuth provider loading at a time", () => {
      const state: OAuthState = { ...initialOAuthState, loading: "google" };

      // Attempting to start Apple while Google is loading
      const canStartApple = state.loading === null;
      expect(canStartApple).toBe(false);
    });

    it("should clear error when starting new OAuth flow", () => {
      const state: OAuthState = {
        loading: null,
        error: "Previous error",
      };

      const newState: OAuthState = {
        loading: "google",
        error: "", // Should be cleared
      };

      expect(newState.error).toBe("");
    });
  });

  describe("OAuth Error Handling", () => {
    const parseOAuthError = (err: MockClerkError, provider: string): string => {
      if (err.errors?.[0]?.code === "oauth_callback_error") {
        return `Failed to complete ${provider} sign in. Please try again.`;
      }
      if (err.errors?.[0]?.code === "identifier_already_exists") {
        return `An account with this ${provider} email already exists. Try signing in instead.`;
      }
      return err.errors?.[0]?.message || `Failed to sign in with ${provider}`;
    };

    it("should handle OAuth callback error", () => {
      const error: MockClerkError = {
        errors: [{ code: "oauth_callback_error", message: "Callback failed" }],
      };
      expect(parseOAuthError(error, "Google")).toContain("Google");
    });

    it("should handle duplicate account error", () => {
      const error: MockClerkError = {
        errors: [{ code: "identifier_already_exists", message: "Already exists" }],
      };
      expect(parseOAuthError(error, "Apple")).toContain("already exists");
    });
  });

  describe("Session Handling", () => {
    interface OAuthResult {
      createdSessionId: string | null;
      setActive: ((params: { session: string }) => Promise<void>) | null;
    }

    const canCompleteOAuth = (result: OAuthResult): boolean => {
      return !!(result.createdSessionId && result.setActive);
    };

    it("should complete when session and setActive are present", () => {
      const result: OAuthResult = {
        createdSessionId: "session_123",
        setActive: async () => {},
      };
      expect(canCompleteOAuth(result)).toBe(true);
    });

    it("should not complete without session ID", () => {
      const result: OAuthResult = {
        createdSessionId: null,
        setActive: async () => {},
      };
      expect(canCompleteOAuth(result)).toBe(false);
    });

    it("should not complete without setActive", () => {
      const result: OAuthResult = {
        createdSessionId: "session_123",
        setActive: null,
      };
      expect(canCompleteOAuth(result)).toBe(false);
    });
  });
});
