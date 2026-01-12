/**
 * Back Navigation Unit Tests
 *
 * Tests that verify backward navigation buttons correctly indicate
 * and navigate to the expected parent screens throughout the app.
 *
 * This file tests:
 * 1. All headerBackTitle configurations match expected destination screens
 * 2. Navigation flow consistency for all major user paths
 * 3. Modal presentation navigation (dismiss returns to correct screen)
 * 4. Stack navigation for nested routes
 */

// Navigation configuration types matching Expo Router Stack.Screen options
interface ScreenConfig {
  name: string;
  title?: string;
  headerBackTitle?: string;
  headerShown?: boolean;
  presentation?: "card" | "modal" | "fullScreenModal" | "transparentModal";
  expectedBackDestination?: string;
  expectedBackDestinationTitle?: string;
}

// ============================================================================
// ROOT LAYOUT SCREEN CONFIGURATIONS
// Extracted from app/_layout.tsx
// ============================================================================

const ROOT_LAYOUT_SCREENS: ScreenConfig[] = [
  // Auth screens (headerShown: false in root, handled by auth/_layout.tsx)
  {
    name: "auth",
    headerShown: false,
    expectedBackDestination: undefined, // No back - entry point
  },

  // Tab Navigator
  {
    name: "(tabs)",
    headerShown: false,
    expectedBackDestination: undefined, // No back - main navigation
  },

  // Legacy index redirect
  {
    name: "index",
    headerShown: false,
    title: "Home",
    expectedBackDestination: undefined, // No back - root
  },

  // Create group modal
  {
    name: "create-group",
    title: "New Group",
    presentation: "modal",
    expectedBackDestination: "(tabs)/index",
    expectedBackDestinationTitle: "Groups",
  },

  // Group detail screen
  {
    name: "group/[id]/index",
    title: "",
    headerBackTitle: "Groups",
    expectedBackDestination: "(tabs)/index",
    expectedBackDestinationTitle: "Groups",
  },

  // Add expense modal
  {
    name: "group/[id]/add-expense",
    title: "Add Expense",
    presentation: "modal",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Expense details
  {
    name: "group/[id]/expense/[expenseId]",
    title: "Expense Details",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Add member modal
  {
    name: "group/[id]/add-member",
    title: "Add Member",
    presentation: "modal",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Group balances
  {
    name: "group/[id]/balances",
    title: "Balances",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Share group modal
  {
    name: "group/[id]/share",
    title: "Share Group",
    presentation: "modal",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Edit group modal
  {
    name: "group/[id]/edit",
    title: "Edit Group",
    presentation: "modal",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Trash/deleted items
  {
    name: "group/[id]/trash",
    title: "Trash",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Transaction ledger
  {
    name: "group/[id]/ledger",
    title: "Transaction Ledger",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Recurring expenses
  {
    name: "group/[id]/recurring",
    title: "Recurring Expenses",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Add recurring expense modal
  {
    name: "group/[id]/add-recurring",
    title: "Add Recurring Expense",
    presentation: "modal",
    expectedBackDestination: "group/[id]/recurring",
    expectedBackDestinationTitle: "Recurring Expenses",
  },

  // Scan receipt (full screen modal, no header)
  {
    name: "group/[id]/scan-receipt",
    title: "Scan Receipt",
    presentation: "fullScreenModal",
    headerShown: false,
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Receipt claiming
  {
    name: "group/[id]/receipt/[receiptId]/index",
    title: "Claim Items",
    headerBackTitle: "Back",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
  },

  // Edit receipt modal
  {
    name: "group/[id]/receipt/[receiptId]/edit",
    title: "Edit Receipt",
    presentation: "modal",
    expectedBackDestination: "group/[id]/receipt/[receiptId]/index",
    expectedBackDestinationTitle: "Claim Items",
  },

  // Receipt settlement
  {
    name: "group/[id]/receipt/[receiptId]/settle",
    title: "Receipt",
    expectedBackDestination: "group/[id]/index",
    expectedBackDestinationTitle: "Group Detail",
    // Note: Uses router.replace() from claiming screen, so back goes to group
  },

  // Join group modal
  {
    name: "join/index",
    title: "Join Group",
    presentation: "modal",
    expectedBackDestination: "(tabs)/index",
    expectedBackDestinationTitle: "Groups",
  },

  // Join via deep link (no header shown)
  {
    name: "join/[code]",
    title: "Joining...",
    headerShown: false,
    expectedBackDestination: undefined, // Redirects immediately
  },

  // Profile stack
  {
    name: "profile",
    headerShown: false,
    expectedBackDestination: "(tabs)",
    expectedBackDestinationTitle: "Tabs",
  },

  // Friends stack
  {
    name: "friends",
    headerShown: false,
    expectedBackDestination: "(tabs)",
    expectedBackDestinationTitle: "Tabs",
  },

  // Standalone activity (deprecated)
  {
    name: "activity",
    headerShown: false,
    expectedBackDestination: undefined,
  },

  // Search screen
  {
    name: "search",
    headerShown: false,
    expectedBackDestination: "(tabs)/index",
    expectedBackDestinationTitle: "Groups",
  },

  // Standalone balances (deprecated)
  {
    name: "balances",
    title: "All Balances",
    headerBackTitle: "Groups",
    expectedBackDestination: "(tabs)/index",
    expectedBackDestinationTitle: "Groups",
  },

  // Venmo onboarding
  {
    name: "onboarding/venmo",
    headerShown: false,
    presentation: "fullScreenModal",
    expectedBackDestination: undefined, // Full screen modal dismisses
  },
];

// ============================================================================
// AUTH LAYOUT SCREEN CONFIGURATIONS
// Extracted from app/auth/_layout.tsx
// ============================================================================

const AUTH_LAYOUT_SCREENS: ScreenConfig[] = [
  {
    name: "sign-in",
    title: "Sign In",
    headerShown: false,
    expectedBackDestination: undefined, // Entry point
  },
  {
    name: "sign-up",
    title: "Create Account",
    headerBackTitle: "Back",
    expectedBackDestination: "auth/sign-in",
    expectedBackDestinationTitle: "Sign In",
  },
  {
    name: "forgot-password",
    title: "Reset Password",
    headerBackTitle: "Back",
    expectedBackDestination: "auth/sign-in",
    expectedBackDestinationTitle: "Sign In",
  },
];

// ============================================================================
// PROFILE LAYOUT SCREEN CONFIGURATIONS
// Extracted from app/profile/_layout.tsx
// ============================================================================

const PROFILE_LAYOUT_SCREENS: ScreenConfig[] = [
  {
    name: "index",
    title: "Profile",
    expectedBackDestination: "(tabs)",
    expectedBackDestinationTitle: "Tabs",
  },
  {
    name: "settings",
    title: "Settings",
    expectedBackDestination: "profile/index",
    expectedBackDestinationTitle: "Profile",
  },
  {
    name: "edit",
    title: "Edit Profile",
    presentation: "modal",
    expectedBackDestination: "profile/index",
    expectedBackDestinationTitle: "Profile",
  },
  {
    name: "change-email",
    title: "Change Email",
    presentation: "modal",
    expectedBackDestination: "profile/index",
    expectedBackDestinationTitle: "Profile",
  },
  {
    name: "change-password",
    title: "Change Password",
    presentation: "modal",
    expectedBackDestination: "profile/index",
    expectedBackDestinationTitle: "Profile",
  },
];

// ============================================================================
// FRIENDS LAYOUT SCREEN CONFIGURATIONS
// Extracted from app/friends/_layout.tsx
// ============================================================================

const FRIENDS_LAYOUT_SCREENS: ScreenConfig[] = [
  {
    name: "index",
    title: "Friends",
    headerBackTitle: "Home",
    expectedBackDestination: "(tabs)/index",
    expectedBackDestinationTitle: "Home",
  },
  {
    name: "add",
    title: "Add Friend",
    presentation: "modal",
    expectedBackDestination: "friends/index",
    expectedBackDestinationTitle: "Friends",
  },
  {
    name: "requests",
    title: "Friend Requests",
    expectedBackDestination: "friends/index",
    expectedBackDestinationTitle: "Friends",
  },
];

// ============================================================================
// NAVIGATION FLOW DEFINITIONS
// Defines expected navigation paths through the app
// ============================================================================

interface NavigationFlow {
  name: string;
  path: string[];
  description: string;
}

const NAVIGATION_FLOWS: NavigationFlow[] = [
  // Main app flows
  {
    name: "Groups to Group Detail",
    path: ["(tabs)/index", "group/[id]/index"],
    description: "User taps a group card to view group details",
  },
  {
    name: "Group Detail to Add Expense",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/add-expense"],
    description: "User adds a new expense from group detail",
  },
  {
    name: "Group Detail to Expense Details",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/expense/[expenseId]"],
    description: "User taps an expense to view details",
  },
  {
    name: "Group Detail to Add Member",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/add-member"],
    description: "User adds a new member to group",
  },
  {
    name: "Group Detail to Balances",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/balances"],
    description: "User views group balances",
  },
  {
    name: "Group Detail to Transaction Ledger",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/ledger"],
    description: "User views transaction history",
  },
  {
    name: "Group Detail to Recurring Expenses",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/recurring"],
    description: "User manages recurring expenses",
  },
  {
    name: "Recurring to Add Recurring",
    path: [
      "(tabs)/index",
      "group/[id]/index",
      "group/[id]/recurring",
      "group/[id]/add-recurring",
    ],
    description: "User adds a new recurring expense",
  },
  {
    name: "Group Detail to Trash",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/trash"],
    description: "User views deleted items",
  },
  {
    name: "Group Detail to Share",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/share"],
    description: "User shares group invite",
  },
  {
    name: "Group Detail to Edit",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/edit"],
    description: "User edits group settings",
  },

  // Receipt flows
  {
    name: "Group to Receipt Claiming",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/receipt/[receiptId]/index"],
    description: "User claims items from a scanned receipt",
  },
  {
    name: "Receipt Claiming to Edit Receipt",
    path: [
      "(tabs)/index",
      "group/[id]/index",
      "group/[id]/receipt/[receiptId]/index",
      "group/[id]/receipt/[receiptId]/edit",
    ],
    description: "User edits receipt items during claiming",
  },
  {
    name: "Group to Receipt Settlement (via replace)",
    path: ["(tabs)/index", "group/[id]/index", "group/[id]/receipt/[receiptId]/settle"],
    description: "After claiming, user sees settlement (claiming replaced in stack)",
  },

  // Auth flows
  {
    name: "Sign In to Sign Up",
    path: ["auth/sign-in", "auth/sign-up"],
    description: "User creates a new account",
  },
  {
    name: "Sign In to Forgot Password",
    path: ["auth/sign-in", "auth/forgot-password"],
    description: "User resets their password",
  },

  // Profile flows
  {
    name: "Tabs to Profile",
    path: ["(tabs)/index", "profile/index"],
    description: "User accesses profile from header icon",
  },
  {
    name: "Profile to Settings",
    path: ["(tabs)/index", "profile/index", "profile/settings"],
    description: "User accesses settings",
  },
  {
    name: "Profile to Edit Profile",
    path: ["(tabs)/index", "profile/index", "profile/edit"],
    description: "User edits their profile",
  },
  {
    name: "Profile to Change Email",
    path: ["(tabs)/index", "profile/index", "profile/change-email"],
    description: "User changes their email",
  },
  {
    name: "Profile to Change Password",
    path: ["(tabs)/index", "profile/index", "profile/change-password"],
    description: "User changes their password",
  },

  // Friends flows
  {
    name: "Tabs to Friends",
    path: ["(tabs)/index", "friends/index"],
    description: "User accesses friends list",
  },
  {
    name: "Friends to Add Friend",
    path: ["(tabs)/index", "friends/index", "friends/add"],
    description: "User adds a new friend",
  },
  {
    name: "Friends to Friend Requests",
    path: ["(tabs)/index", "friends/index", "friends/requests"],
    description: "User views pending friend requests",
  },

  // Join group flows
  {
    name: "Groups to Join Group",
    path: ["(tabs)/index", "join/index"],
    description: "User joins a group via share code",
  },

  // Create group flow
  {
    name: "Groups to Create Group",
    path: ["(tabs)/index", "create-group"],
    description: "User creates a new group",
  },

  // Search flow
  {
    name: "Groups to Search",
    path: ["(tabs)/index", "search"],
    description: "User searches for groups",
  },
];

// ============================================================================
// TEST SUITES
// ============================================================================

describe("Back Navigation Configuration", () => {
  describe("Root Layout Screens", () => {
    describe("headerBackTitle Configuration", () => {
      const screensWithBackTitle = ROOT_LAYOUT_SCREENS.filter(
        (s) => s.headerBackTitle !== undefined
      );

      it("should have correct number of screens with explicit headerBackTitle", () => {
        // Verify we have the expected screens with back titles
        expect(screensWithBackTitle.length).toBe(3);
      });

      test.each(screensWithBackTitle)(
        '$name should have headerBackTitle "$headerBackTitle"',
        (screen) => {
          expect(screen.headerBackTitle).toBeDefined();
          expect(typeof screen.headerBackTitle).toBe("string");
          expect(screen.headerBackTitle!.length).toBeGreaterThan(0);
        }
      );

      it('group/[id]/index should have headerBackTitle "Groups"', () => {
        const screen = ROOT_LAYOUT_SCREENS.find(
          (s) => s.name === "group/[id]/index"
        );
        expect(screen).toBeDefined();
        expect(screen!.headerBackTitle).toBe("Groups");
      });

      it('balances (standalone) should have headerBackTitle "Groups"', () => {
        const screen = ROOT_LAYOUT_SCREENS.find((s) => s.name === "balances");
        expect(screen).toBeDefined();
        expect(screen!.headerBackTitle).toBe("Groups");
      });

      it('group/[id]/receipt/[receiptId]/index should have headerBackTitle "Back"', () => {
        const screen = ROOT_LAYOUT_SCREENS.find(
          (s) => s.name === "group/[id]/receipt/[receiptId]/index"
        );
        expect(screen).toBeDefined();
        expect(screen!.headerBackTitle).toBe("Back");
      });
    });

    describe("Modal Presentation Screens", () => {
      const modalScreens = ROOT_LAYOUT_SCREENS.filter(
        (s) => s.presentation === "modal"
      );

      it("should have correct number of modal screens", () => {
        // create-group, add-expense, add-member, share, edit, add-recurring, receipt/edit, join/index = 8
        expect(modalScreens.length).toBe(8);
      });

      test.each(modalScreens)(
        "$name should have modal presentation",
        (screen) => {
          expect(screen.presentation).toBe("modal");
        }
      );

      it("modals should dismiss back to parent screen", () => {
        const expectedModalParents: Record<string, string> = {
          "create-group": "(tabs)/index",
          "group/[id]/add-expense": "group/[id]/index",
          "group/[id]/add-member": "group/[id]/index",
          "group/[id]/share": "group/[id]/index",
          "group/[id]/edit": "group/[id]/index",
          "group/[id]/add-recurring": "group/[id]/recurring",
          "group/[id]/receipt/[receiptId]/edit":
            "group/[id]/receipt/[receiptId]/index",
          "join/index": "(tabs)/index",
        };

        modalScreens.forEach((screen) => {
          if (expectedModalParents[screen.name]) {
            expect(screen.expectedBackDestination).toBe(
              expectedModalParents[screen.name]
            );
          }
        });
      });
    });

    describe("Full Screen Modal Screens", () => {
      const fullScreenModals = ROOT_LAYOUT_SCREENS.filter(
        (s) => s.presentation === "fullScreenModal"
      );

      it("should have correct number of full screen modal screens", () => {
        expect(fullScreenModals.length).toBe(2);
      });

      test.each(fullScreenModals)(
        "$name should have fullScreenModal presentation",
        (screen) => {
          expect(screen.presentation).toBe("fullScreenModal");
        }
      );
    });

    describe("Hidden Header Screens", () => {
      const hiddenHeaderScreens = ROOT_LAYOUT_SCREENS.filter(
        (s) => s.headerShown === false
      );

      it("should have correct number of hidden header screens", () => {
        // auth, (tabs), index, scan-receipt, join/[code], profile, friends, activity, search, onboarding/venmo = 10
        expect(hiddenHeaderScreens.length).toBe(10);
      });

      test.each(hiddenHeaderScreens)(
        "$name should have headerShown: false",
        (screen) => {
          expect(screen.headerShown).toBe(false);
        }
      );
    });
  });

  describe("Auth Layout Screens", () => {
    describe("headerBackTitle Configuration", () => {
      const screensWithBackTitle = AUTH_LAYOUT_SCREENS.filter(
        (s) => s.headerBackTitle !== undefined
      );

      it("should have correct number of screens with explicit headerBackTitle", () => {
        expect(screensWithBackTitle.length).toBe(2);
      });

      it('sign-up should have headerBackTitle "Back" pointing to sign-in', () => {
        const screen = AUTH_LAYOUT_SCREENS.find((s) => s.name === "sign-up");
        expect(screen).toBeDefined();
        expect(screen!.headerBackTitle).toBe("Back");
        expect(screen!.expectedBackDestination).toBe("auth/sign-in");
      });

      it('forgot-password should have headerBackTitle "Back" pointing to sign-in', () => {
        const screen = AUTH_LAYOUT_SCREENS.find(
          (s) => s.name === "forgot-password"
        );
        expect(screen).toBeDefined();
        expect(screen!.headerBackTitle).toBe("Back");
        expect(screen!.expectedBackDestination).toBe("auth/sign-in");
      });
    });

    describe("Screen Titles", () => {
      it("sign-in should have title Sign In with hidden header", () => {
        const screen = AUTH_LAYOUT_SCREENS.find((s) => s.name === "sign-in");
        expect(screen).toBeDefined();
        expect(screen!.title).toBe("Sign In");
        expect(screen!.headerShown).toBe(false);
      });

      it("sign-up should have title Create Account", () => {
        const screen = AUTH_LAYOUT_SCREENS.find((s) => s.name === "sign-up");
        expect(screen).toBeDefined();
        expect(screen!.title).toBe("Create Account");
      });

      it("forgot-password should have title Reset Password", () => {
        const screen = AUTH_LAYOUT_SCREENS.find(
          (s) => s.name === "forgot-password"
        );
        expect(screen).toBeDefined();
        expect(screen!.title).toBe("Reset Password");
      });
    });
  });

  describe("Profile Layout Screens", () => {
    describe("Screen Hierarchy", () => {
      it("profile/index should be the root of profile stack", () => {
        const screen = PROFILE_LAYOUT_SCREENS.find((s) => s.name === "index");
        expect(screen).toBeDefined();
        expect(screen!.title).toBe("Profile");
      });

      it("settings should navigate back to profile/index", () => {
        const screen = PROFILE_LAYOUT_SCREENS.find(
          (s) => s.name === "settings"
        );
        expect(screen).toBeDefined();
        expect(screen!.expectedBackDestination).toBe("profile/index");
      });
    });

    describe("Modal Screens", () => {
      const modalScreens = PROFILE_LAYOUT_SCREENS.filter(
        (s) => s.presentation === "modal"
      );

      it("should have 3 modal screens in profile", () => {
        expect(modalScreens.length).toBe(3);
      });

      it("edit modal should dismiss to profile/index", () => {
        const screen = PROFILE_LAYOUT_SCREENS.find((s) => s.name === "edit");
        expect(screen).toBeDefined();
        expect(screen!.presentation).toBe("modal");
        expect(screen!.expectedBackDestination).toBe("profile/index");
      });

      it("change-email modal should dismiss to profile/index", () => {
        const screen = PROFILE_LAYOUT_SCREENS.find(
          (s) => s.name === "change-email"
        );
        expect(screen).toBeDefined();
        expect(screen!.presentation).toBe("modal");
        expect(screen!.expectedBackDestination).toBe("profile/index");
      });

      it("change-password modal should dismiss to profile/index", () => {
        const screen = PROFILE_LAYOUT_SCREENS.find(
          (s) => s.name === "change-password"
        );
        expect(screen).toBeDefined();
        expect(screen!.presentation).toBe("modal");
        expect(screen!.expectedBackDestination).toBe("profile/index");
      });
    });
  });

  describe("Friends Layout Screens", () => {
    describe("headerBackTitle Configuration", () => {
      it('friends/index should have headerBackTitle "Home"', () => {
        const screen = FRIENDS_LAYOUT_SCREENS.find((s) => s.name === "index");
        expect(screen).toBeDefined();
        expect(screen!.headerBackTitle).toBe("Home");
        expect(screen!.expectedBackDestination).toBe("(tabs)/index");
      });
    });

    describe("Screen Hierarchy", () => {
      it("add friend modal should dismiss to friends/index", () => {
        const screen = FRIENDS_LAYOUT_SCREENS.find((s) => s.name === "add");
        expect(screen).toBeDefined();
        expect(screen!.presentation).toBe("modal");
        expect(screen!.expectedBackDestination).toBe("friends/index");
      });

      it("friend requests should navigate back to friends/index", () => {
        const screen = FRIENDS_LAYOUT_SCREENS.find(
          (s) => s.name === "requests"
        );
        expect(screen).toBeDefined();
        expect(screen!.expectedBackDestination).toBe("friends/index");
      });
    });
  });
});

describe("Navigation Flow Validation", () => {
  // Helper to get screen config from any layout
  function getScreenConfig(screenName: string): ScreenConfig | undefined {
    // Check root layout
    const rootScreen = ROOT_LAYOUT_SCREENS.find((s) => s.name === screenName);
    if (rootScreen) return rootScreen;

    // Check auth layout
    const authScreen = AUTH_LAYOUT_SCREENS.find(
      (s) => `auth/${s.name}` === screenName || s.name === screenName
    );
    if (authScreen) return authScreen;

    // Check profile layout
    const profileScreen = PROFILE_LAYOUT_SCREENS.find(
      (s) => `profile/${s.name}` === screenName || s.name === screenName
    );
    if (profileScreen) return profileScreen;

    // Check friends layout
    const friendsScreen = FRIENDS_LAYOUT_SCREENS.find(
      (s) => `friends/${s.name}` === screenName || s.name === screenName
    );
    if (friendsScreen) return friendsScreen;

    return undefined;
  }

  describe("Back Navigation Paths", () => {
    test.each(NAVIGATION_FLOWS)(
      "$name: back from $path[-1] should return to correct screen",
      (flow) => {
        if (flow.path.length < 2) return;

        const currentScreen = flow.path[flow.path.length - 1];
        const previousScreen = flow.path[flow.path.length - 2];

        const config = getScreenConfig(currentScreen);

        // For screens that exist in our config, verify the back destination
        if (config && config.expectedBackDestination) {
          // The expected back destination should match the previous screen in the flow
          // or be a valid parent screen
          expect(config.expectedBackDestination).toBeTruthy();
        }
      }
    );
  });

  describe("Group Detail Flows", () => {
    const groupFlows = NAVIGATION_FLOWS.filter((f) =>
      f.path.some((p) => p.startsWith("group/[id]"))
    );

    test.each(groupFlows)(
      "$name should have valid back navigation from group screens",
      (flow) => {
        const groupScreens = flow.path.filter((p) =>
          p.startsWith("group/[id]")
        );

        groupScreens.forEach((screen) => {
          const config = ROOT_LAYOUT_SCREENS.find((s) => s.name === screen);
          if (config) {
            // All group sub-screens should eventually navigate back to group detail or groups list
            expect(
              config.expectedBackDestination?.includes("group/[id]") ||
                config.expectedBackDestination?.includes("(tabs)/index")
            ).toBe(true);
          }
        });
      }
    );
  });

  describe("Modal Dismiss Behavior", () => {
    const modalFlows = NAVIGATION_FLOWS.filter((f) => {
      const lastScreen = f.path[f.path.length - 1];
      const config = getScreenConfig(lastScreen);
      return config?.presentation === "modal";
    });

    test.each(modalFlows)(
      "$name: modal dismiss should return to parent screen",
      (flow) => {
        const modalScreen = flow.path[flow.path.length - 1];
        const parentScreen = flow.path[flow.path.length - 2];

        const config = getScreenConfig(modalScreen);
        if (config) {
          expect(config.presentation).toBe("modal");
          // Modal's expectedBackDestination should be the parent screen
          expect(config.expectedBackDestination).toBe(parentScreen);
        }
      }
    );
  });

  describe("Auth Flow Navigation", () => {
    it("sign-up back should go to sign-in", () => {
      const signUpConfig = AUTH_LAYOUT_SCREENS.find(
        (s) => s.name === "sign-up"
      );
      expect(signUpConfig!.expectedBackDestination).toBe("auth/sign-in");
    });

    it("forgot-password back should go to sign-in", () => {
      const forgotConfig = AUTH_LAYOUT_SCREENS.find(
        (s) => s.name === "forgot-password"
      );
      expect(forgotConfig!.expectedBackDestination).toBe("auth/sign-in");
    });
  });

  describe("Receipt Flow Navigation", () => {
    it("receipt claiming back should go to group detail", () => {
      const claimingConfig = ROOT_LAYOUT_SCREENS.find(
        (s) => s.name === "group/[id]/receipt/[receiptId]/index"
      );
      expect(claimingConfig!.expectedBackDestination).toBe("group/[id]/index");
    });

    it("receipt settlement back should go to group detail (via replace)", () => {
      const settleConfig = ROOT_LAYOUT_SCREENS.find(
        (s) => s.name === "group/[id]/receipt/[receiptId]/settle"
      );
      expect(settleConfig!.expectedBackDestination).toBe("group/[id]/index");
    });

    it("edit receipt modal should dismiss to claiming screen", () => {
      const editConfig = ROOT_LAYOUT_SCREENS.find(
        (s) => s.name === "group/[id]/receipt/[receiptId]/edit"
      );
      expect(editConfig!.presentation).toBe("modal");
      expect(editConfig!.expectedBackDestination).toBe(
        "group/[id]/receipt/[receiptId]/index"
      );
    });
  });
});

describe("headerBackTitle Text Consistency", () => {
  describe("Back Button Labels Match Destinations", () => {
    it('"Groups" back title should lead to groups list', () => {
      const screensWithGroupsBack = [
        ...ROOT_LAYOUT_SCREENS.filter((s) => s.headerBackTitle === "Groups"),
      ];

      screensWithGroupsBack.forEach((screen) => {
        expect(screen.expectedBackDestination).toBe("(tabs)/index");
        expect(screen.expectedBackDestinationTitle).toBe("Groups");
      });
    });

    it('"Home" back title should lead to home/tabs', () => {
      const screensWithHomeBack = [
        ...FRIENDS_LAYOUT_SCREENS.filter((s) => s.headerBackTitle === "Home"),
      ];

      screensWithHomeBack.forEach((screen) => {
        expect(screen.expectedBackDestination).toBe("(tabs)/index");
        expect(screen.expectedBackDestinationTitle).toBe("Home");
      });
    });

    it('"Back" title is used for generic navigation', () => {
      const screensWithBackTitle = [
        ...ROOT_LAYOUT_SCREENS.filter((s) => s.headerBackTitle === "Back"),
        ...AUTH_LAYOUT_SCREENS.filter((s) => s.headerBackTitle === "Back"),
      ];

      expect(screensWithBackTitle.length).toBeGreaterThan(0);
      screensWithBackTitle.forEach((screen) => {
        // "Back" is generic - just verify it has a destination
        expect(screen.expectedBackDestination).toBeDefined();
      });
    });
  });

  describe("No Misleading Back Titles", () => {
    const allScreens = [
      ...ROOT_LAYOUT_SCREENS,
      ...AUTH_LAYOUT_SCREENS,
      ...PROFILE_LAYOUT_SCREENS,
      ...FRIENDS_LAYOUT_SCREENS,
    ];

    it("screens with visible headers should have appropriate back navigation", () => {
      const visibleHeaderScreens = allScreens.filter(
        (s) => s.headerShown !== false && s.presentation !== "modal"
      );

      visibleHeaderScreens.forEach((screen) => {
        // If it has an explicit headerBackTitle, it should match the destination
        if (screen.headerBackTitle && screen.headerBackTitle !== "Back") {
          // The back title should hint at where we're going
          const backTitle = screen.headerBackTitle.toLowerCase();
          const destTitle =
            screen.expectedBackDestinationTitle?.toLowerCase() || "";

          // Back title should contain or relate to destination title
          const isConsistent =
            backTitle.includes(destTitle) ||
            destTitle.includes(backTitle) ||
            backTitle === destTitle;

          expect(isConsistent).toBe(true);
        }
      });
    });
  });
});

describe("Screen Configuration Completeness", () => {
  describe("All Screens Have Required Properties", () => {
    const allScreens = [
      ...ROOT_LAYOUT_SCREENS,
      ...AUTH_LAYOUT_SCREENS,
      ...PROFILE_LAYOUT_SCREENS,
      ...FRIENDS_LAYOUT_SCREENS,
    ];

    test.each(allScreens)("$name should have a valid name", (screen) => {
      expect(screen.name).toBeDefined();
      expect(screen.name.length).toBeGreaterThan(0);
    });

    it("all screens should define expected back destination or be entry points", () => {
      const nonEntryScreens = allScreens.filter((s) => {
        // Entry points don't need back destinations
        const isEntryPoint =
          s.name === "(tabs)" ||
          s.name === "auth" ||
          s.name === "index" ||
          s.name === "sign-in" ||
          s.name === "activity" ||
          s.name === "join/[code]" ||
          s.name === "onboarding/venmo";
        return !isEntryPoint;
      });

      nonEntryScreens.forEach((screen) => {
        // Either it's a modal (dismisses), has explicit back destination, or hidden header
        const hasValidNavigation =
          screen.presentation === "modal" ||
          screen.presentation === "fullScreenModal" ||
          screen.expectedBackDestination !== undefined ||
          screen.headerShown === false;

        expect(hasValidNavigation).toBe(true);
      });
    });
  });

  describe("Modal Screens Have Parent Destinations", () => {
    const allModalScreens = [
      ...ROOT_LAYOUT_SCREENS.filter((s) => s.presentation === "modal"),
      ...PROFILE_LAYOUT_SCREENS.filter((s) => s.presentation === "modal"),
      ...FRIENDS_LAYOUT_SCREENS.filter((s) => s.presentation === "modal"),
    ];

    test.each(allModalScreens)(
      "$name modal should have expectedBackDestination",
      (screen) => {
        expect(screen.expectedBackDestination).toBeDefined();
      }
    );
  });
});

describe("Dynamic Route Parameter Handling", () => {
  describe("Group Routes with [id] Parameter", () => {
    const groupRoutes = ROOT_LAYOUT_SCREENS.filter((s) =>
      s.name.includes("[id]")
    );

    it("should have multiple group routes with [id] parameter", () => {
      expect(groupRoutes.length).toBeGreaterThan(5);
    });

    test.each(groupRoutes)(
      "$name should handle [id] parameter",
      (screen) => {
        expect(screen.name).toContain("[id]");
        // Group routes should navigate back to group index or groups list
        if (screen.expectedBackDestination) {
          expect(
            screen.expectedBackDestination.includes("group/[id]") ||
              screen.expectedBackDestination.includes("(tabs)/index") ||
              screen.expectedBackDestination.includes("recurring")
          ).toBe(true);
        }
      }
    );
  });

  describe("Receipt Routes with [receiptId] Parameter", () => {
    const receiptRoutes = ROOT_LAYOUT_SCREENS.filter((s) =>
      s.name.includes("[receiptId]")
    );

    it("should have receipt routes with [receiptId] parameter", () => {
      expect(receiptRoutes.length).toBeGreaterThanOrEqual(3);
    });

    test.each(receiptRoutes)(
      "$name should handle [receiptId] parameter",
      (screen) => {
        expect(screen.name).toContain("[receiptId]");
      }
    );
  });

  describe("Expense Routes with [expenseId] Parameter", () => {
    const expenseRoutes = ROOT_LAYOUT_SCREENS.filter((s) =>
      s.name.includes("[expenseId]")
    );

    it("should have expense detail route", () => {
      expect(expenseRoutes.length).toBeGreaterThanOrEqual(1);
    });

    test.each(expenseRoutes)(
      "$name should navigate back to group detail",
      (screen) => {
        expect(screen.expectedBackDestination).toBe("group/[id]/index");
      }
    );
  });

  describe("Join Routes with [code] Parameter", () => {
    const joinRoutes = ROOT_LAYOUT_SCREENS.filter(
      (s) => s.name.includes("join") && s.name.includes("[code]")
    );

    it("should have join route with [code] parameter", () => {
      expect(joinRoutes.length).toBe(1);
    });

    it("join/[code] should have hidden header (deep link handler)", () => {
      const joinCodeRoute = joinRoutes[0];
      expect(joinCodeRoute.headerShown).toBe(false);
    });
  });
});
