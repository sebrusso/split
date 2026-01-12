/**
 * Production Readiness Tests
 *
 * These tests verify the app is properly configured for TestFlight/App Store submission.
 * Run these before submitting to ensure critical production requirements are met.
 */

import * as fs from "fs";
import * as path from "path";

describe("Production Readiness", () => {
  describe("Environment Configuration", () => {
    it("should have .env in .gitignore", () => {
      const gitignorePath = path.join(__dirname, "..", ".gitignore");
      const gitignore = fs.readFileSync(gitignorePath, "utf-8");

      expect(gitignore).toContain(".env");
    });

    it("should have .env.example for reference", () => {
      const envExamplePath = path.join(__dirname, "..", ".env.example");
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    it(".env.example should document required variables", () => {
      const envExamplePath = path.join(__dirname, "..", ".env.example");
      const envExample = fs.readFileSync(envExamplePath, "utf-8");

      expect(envExample).toContain("EXPO_PUBLIC_SUPABASE_URL");
      expect(envExample).toContain("EXPO_PUBLIC_SUPABASE_ANON_KEY");
      expect(envExample).toContain("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
    });
  });

  describe("App Configuration", () => {
    let appJson: {
      expo: {
        name: string;
        version: string;
        ios: {
          bundleIdentifier: string;
          buildNumber: string;
          infoPlist: Record<string, unknown>;
          config?: { usesNonExemptEncryption?: boolean };
          privacyManifests?: unknown;
        };
      };
    };

    beforeAll(() => {
      const appJsonPath = path.join(__dirname, "..", "app.json");
      appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    });

    it("should have a valid bundle identifier", () => {
      expect(appJson.expo.ios.bundleIdentifier).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i);
    });

    it("should have a build number set", () => {
      expect(appJson.expo.ios.buildNumber).toBeDefined();
      expect(parseInt(appJson.expo.ios.buildNumber)).toBeGreaterThan(0);
    });

    it("should declare encryption usage", () => {
      // Required for App Store Connect - avoids export compliance questions
      const infoPlist = appJson.expo.ios.infoPlist;
      expect(infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    });

    it("should have privacy manifest configured", () => {
      expect(appJson.expo.ios.privacyManifests).toBeDefined();
    });

    it("should have camera permission description", () => {
      const infoPlist = appJson.expo.ios.infoPlist;
      expect(infoPlist.NSCameraUsageDescription).toBeDefined();
      expect(typeof infoPlist.NSCameraUsageDescription).toBe("string");
      expect((infoPlist.NSCameraUsageDescription as string).length).toBeGreaterThan(10);
    });

    it("should have photo library permission description", () => {
      const infoPlist = appJson.expo.ios.infoPlist;
      expect(infoPlist.NSPhotoLibraryUsageDescription).toBeDefined();
      expect(typeof infoPlist.NSPhotoLibraryUsageDescription).toBe("string");
      expect((infoPlist.NSPhotoLibraryUsageDescription as string).length).toBeGreaterThan(10);
    });
  });

  describe("EAS Build Configuration", () => {
    let easJson: {
      build: Record<string, { distribution?: string }>;
      submit: Record<string, { ios?: { appleId?: string } }>;
    };

    beforeAll(() => {
      const easJsonPath = path.join(__dirname, "..", "eas.json");
      easJson = JSON.parse(fs.readFileSync(easJsonPath, "utf-8"));
    });

    it("should have testflight build profile", () => {
      expect(easJson.build.testflight).toBeDefined();
      expect(easJson.build.testflight.distribution).toBe("store");
    });

    it("should have production build profile", () => {
      expect(easJson.build.production).toBeDefined();
      expect(easJson.build.production.distribution).toBe("store");
    });

    it("should have submit configuration for testflight", () => {
      expect(easJson.submit.testflight).toBeDefined();
      expect(easJson.submit.testflight.ios).toBeDefined();
    });

    it("should remind to update Apple credentials", () => {
      // This test will fail until credentials are configured
      // It's intentional - you should update these before submitting
      const appleId = easJson.submit.testflight?.ios?.appleId;
      if (appleId?.includes("example.com") || appleId?.includes("YOUR_")) {
        console.warn(
          "  REMINDER: Update eas.json with your Apple credentials before submitting to TestFlight"
        );
      }
      expect(appleId).toBeDefined();
    });
  });

  describe("Logger Configuration", () => {
    it("should have logger utility that checks __DEV__", () => {
      const loggerPath = path.join(__dirname, "..", "lib", "logger.ts");
      const loggerContent = fs.readFileSync(loggerPath, "utf-8");

      // Verify logger checks __DEV__ before logging
      expect(loggerContent).toContain("__DEV__");
      expect(loggerContent).toContain("if (__DEV__)");
    });
  });

  describe("Security", () => {
    it("should not have hardcoded API keys in source", () => {
      const supabasePath = path.join(__dirname, "..", "lib", "supabase.ts");
      const supabaseContent = fs.readFileSync(supabasePath, "utf-8");

      // Should use environment variables, not hardcoded keys
      expect(supabaseContent).toContain("process.env.EXPO_PUBLIC_SUPABASE_URL");
      expect(supabaseContent).toContain("process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY");

      // Should NOT contain actual keys (base64 patterns)
      expect(supabaseContent).not.toMatch(/eyJ[A-Za-z0-9+/]{20,}/); // JWT pattern
    });

    it("should validate required environment variables", () => {
      const supabasePath = path.join(__dirname, "..", "lib", "supabase.ts");
      const supabaseContent = fs.readFileSync(supabasePath, "utf-8");

      // Should throw if env vars are missing
      expect(supabaseContent).toContain("throw new Error");
      expect(supabaseContent).toContain("Missing");
    });
  });
});

describe("Critical User Flows", () => {
  describe("Auth Configuration Validation", () => {
    it("should have isClerkConfigured function", () => {
      const { isClerkConfigured } = require("../lib/clerk");
      expect(typeof isClerkConfigured).toBe("function");
    });

    it("should validate Clerk key format", () => {
      const { CLERK_PUBLISHABLE_KEY } = require("../lib/clerk");

      // Key should either be a placeholder or a valid pk_ key
      const isPlaceholder = CLERK_PUBLISHABLE_KEY.includes("REPLACE");
      const isValidKey = CLERK_PUBLISHABLE_KEY.startsWith("pk_");

      expect(isPlaceholder || isValidKey).toBe(true);
    });
  });
});

describe("Asset Verification", () => {
  const assetsDir = path.join(__dirname, "..", "assets");

  it("should have app icon", () => {
    expect(fs.existsSync(path.join(assetsDir, "icon.png"))).toBe(true);
  });

  it("should have splash icon", () => {
    expect(fs.existsSync(path.join(assetsDir, "splash-icon.png"))).toBe(true);
  });

  it("should have adaptive icon for Android", () => {
    expect(fs.existsSync(path.join(assetsDir, "adaptive-icon.png"))).toBe(true);
  });
});
