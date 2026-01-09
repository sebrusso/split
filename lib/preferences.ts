/**
 * User preferences storage using AsyncStorage
 * Handles persistent user settings like currency, notification preferences, etc.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import logger from "./logger";

// Storage keys
const KEYS = {
  DEFAULT_CURRENCY: "user_default_currency",
  EXPENSE_NOTIFICATIONS: "pref_expense_notifications",
  SETTLEMENT_NOTIFICATIONS: "pref_settlement_notifications",
  GROUP_UPDATE_NOTIFICATIONS: "pref_group_updates",
} as const;

// Default values
const DEFAULTS = {
  DEFAULT_CURRENCY: "USD",
  EXPENSE_NOTIFICATIONS: true,
  SETTLEMENT_NOTIFICATIONS: true,
  GROUP_UPDATE_NOTIFICATIONS: true,
};

/**
 * Get user's default currency
 */
export async function getDefaultCurrency(): Promise<string> {
  try {
    const value = await AsyncStorage.getItem(KEYS.DEFAULT_CURRENCY);
    return value || DEFAULTS.DEFAULT_CURRENCY;
  } catch (error) {
    logger.error("Error getting default currency:", error);
    return DEFAULTS.DEFAULT_CURRENCY;
  }
}

/**
 * Set user's default currency
 */
export async function setDefaultCurrency(currency: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.DEFAULT_CURRENCY, currency);
  } catch (error) {
    logger.error("Error setting default currency:", error);
    throw error;
  }
}

/**
 * Get notification preference
 */
export async function getNotificationPreference(
  type: "expense" | "settlement" | "groupUpdate"
): Promise<boolean> {
  try {
    const key =
      type === "expense"
        ? KEYS.EXPENSE_NOTIFICATIONS
        : type === "settlement"
          ? KEYS.SETTLEMENT_NOTIFICATIONS
          : KEYS.GROUP_UPDATE_NOTIFICATIONS;
    const value = await AsyncStorage.getItem(key);
    return value === null ? true : value === "true";
  } catch (error) {
    logger.error("Error getting notification preference:", error);
    return true;
  }
}

/**
 * Set notification preference
 */
export async function setNotificationPreference(
  type: "expense" | "settlement" | "groupUpdate",
  enabled: boolean
): Promise<void> {
  try {
    const key =
      type === "expense"
        ? KEYS.EXPENSE_NOTIFICATIONS
        : type === "settlement"
          ? KEYS.SETTLEMENT_NOTIFICATIONS
          : KEYS.GROUP_UPDATE_NOTIFICATIONS;
    await AsyncStorage.setItem(key, enabled.toString());
  } catch (error) {
    logger.error("Error setting notification preference:", error);
    throw error;
  }
}

/**
 * Get all preferences at once
 */
export async function getAllPreferences(): Promise<{
  defaultCurrency: string;
  expenseNotifications: boolean;
  settlementNotifications: boolean;
  groupUpdateNotifications: boolean;
}> {
  try {
    const keys = Object.values(KEYS);
    const values = await AsyncStorage.multiGet(keys);
    const prefs = Object.fromEntries(values);

    return {
      defaultCurrency: prefs[KEYS.DEFAULT_CURRENCY] || DEFAULTS.DEFAULT_CURRENCY,
      expenseNotifications:
        prefs[KEYS.EXPENSE_NOTIFICATIONS] === null
          ? DEFAULTS.EXPENSE_NOTIFICATIONS
          : prefs[KEYS.EXPENSE_NOTIFICATIONS] === "true",
      settlementNotifications:
        prefs[KEYS.SETTLEMENT_NOTIFICATIONS] === null
          ? DEFAULTS.SETTLEMENT_NOTIFICATIONS
          : prefs[KEYS.SETTLEMENT_NOTIFICATIONS] === "true",
      groupUpdateNotifications:
        prefs[KEYS.GROUP_UPDATE_NOTIFICATIONS] === null
          ? DEFAULTS.GROUP_UPDATE_NOTIFICATIONS
          : prefs[KEYS.GROUP_UPDATE_NOTIFICATIONS] === "true",
    };
  } catch (error) {
    logger.error("Error getting all preferences:", error);
    return {
      defaultCurrency: DEFAULTS.DEFAULT_CURRENCY,
      expenseNotifications: DEFAULTS.EXPENSE_NOTIFICATIONS,
      settlementNotifications: DEFAULTS.SETTLEMENT_NOTIFICATIONS,
      groupUpdateNotifications: DEFAULTS.GROUP_UPDATE_NOTIFICATIONS,
    };
  }
}

/**
 * Clear all user preferences (for logout or data clearing)
 */
export async function clearAllPreferences(): Promise<void> {
  try {
    const keys = Object.values(KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    logger.error("Error clearing preferences:", error);
    throw error;
  }
}

/**
 * Clear all local data (preferences + any cached data)
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    logger.error("Error clearing all local data:", error);
    throw error;
  }
}
