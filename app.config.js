/**
 * Expo configuration with environment variable support
 *
 * Environment variables prefixed with EXPO_PUBLIC_ are automatically
 * available in the app via process.env.EXPO_PUBLIC_*
 *
 * For development, create a .env file (copy from .env.example)
 * For production builds, configure secrets in EAS or your CI/CD
 */

const IS_DEV = process.env.APP_VARIANT === "development";

// Validate required environment variables in production
function validateEnvVars() {
  const required = [
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && !IS_DEV) {
    console.warn(
      `Warning: Missing environment variables: ${missing.join(", ")}\n` +
        "Copy .env.example to .env and fill in your values."
    );
  }
}

validateEnvVars();

// Warn if using test Clerk key in production
const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
if (clerkKey.startsWith("pk_test_") && process.env.NODE_ENV === "production") {
  console.warn(
    "Warning: Using Clerk test key in production. " +
      "Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to a production key."
  );
}

export default {
  expo: {
    name: "SplitFree",
    slug: "splitfree",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "splitfree",
    owner: "splitfree",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#10B981",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.splitfree.app",
      associatedDomains: ["applinks:splitfree.app"],
      buildNumber: "1",
      infoPlist: {
        NSCameraUsageDescription:
          "SplitFree uses the camera to scan QR codes for joining groups.",
        CFBundleAllowMixedLocalizations: true,
        ITSAppUsesNonExemptEncryption: false,
      },
      config: {
        usesNonExemptEncryption: false,
      },
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType:
              "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
        ],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#10B981",
      },
      package: "com.splitfree.app",
      versionCode: 1,
      edgeToEdgeEnabled: true,
      permissions: ["INTERNET", "CAMERA"],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "splitfree",
              host: "join",
              pathPrefix: "/",
            },
            {
              scheme: "https",
              host: "splitfree.app",
              pathPrefix: "/join",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png",
    },
    plugins: ["expo-router", "expo-font"],
    extra: {
      eas: {
        projectId: "your-project-id",
      },
    },
    updates: {
      url: "https://u.expo.dev/your-project-id",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
  },
};
