import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from "../../lib/theme";
import { Card } from "../../components/ui";
import {
  getDefaultCurrency,
  setDefaultCurrency as saveDefaultCurrency,
  clearAllLocalData,
} from "../../lib/preferences";
import { exportAllUserData } from "../../lib/export";
import { useAuth } from "../../lib/auth-context";
import { useAnalytics } from "../../lib/analytics-provider";

// Available currencies
const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
];

/**
 * Settings Screen
 * App preferences and configuration
 */
export default function SettingsScreen() {
  const { userId } = useAuth();
  const { isOptedOut, setOptOut } = useAnalytics();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Notification preferences (placeholders for future implementation)
  const [expenseNotifications, setExpenseNotifications] = useState(true);
  const [settlementNotifications, setSettlementNotifications] = useState(true);
  const [groupUpdates, setGroupUpdates] = useState(false);

  // Analytics opt-out (local state to handle async updates)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(!isOptedOut);

  // Sync analytics state with provider
  useEffect(() => {
    setAnalyticsEnabled(!isOptedOut);
  }, [isOptedOut]);

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const currency = await getDefaultCurrency();
        setDefaultCurrency(currency);
      } catch (error) {
        console.error("Error loading preferences:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const handleCurrencyChange = useCallback(async (currencyCode: string) => {
    try {
      await saveDefaultCurrency(currencyCode);
      setDefaultCurrency(currencyCode);
      setShowCurrencyPicker(false);
      Alert.alert("Currency Updated", `Default currency set to ${currencyCode}`);
    } catch (error) {
      Alert.alert("Error", "Failed to save currency preference");
    }
  }, []);

  const handleAnalyticsToggle = useCallback(async (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    await setOptOut(!enabled);
  }, [setOptOut]);

  const selectedCurrency = CURRENCIES.find((c) => c.code === defaultCurrency);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Currency Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <Card style={styles.settingCard}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Default Currency</Text>
                <Text style={styles.settingDescription}>
                  Used for new groups you create
                </Text>
              </View>
              <View style={styles.currencyValue}>
                <Text style={styles.currencySymbol}>
                  {selectedCurrency?.symbol}
                </Text>
                <Text style={styles.currencyCode}>{defaultCurrency}</Text>
                <Text style={styles.expandArrow}>
                  {showCurrencyPicker ? "▲" : "▼"}
                </Text>
              </View>
            </TouchableOpacity>

            {showCurrencyPicker && (
              <View style={styles.currencyList}>
                {CURRENCIES.map((currency) => (
                  <TouchableOpacity
                    key={currency.code}
                    style={[
                      styles.currencyOption,
                      currency.code === defaultCurrency &&
                        styles.currencyOptionSelected,
                    ]}
                    onPress={() => handleCurrencyChange(currency.code)}
                  >
                    <View style={styles.currencyOptionContent}>
                      <Text style={styles.currencyOptionSymbol}>
                        {currency.symbol}
                      </Text>
                      <View>
                        <Text style={styles.currencyOptionCode}>
                          {currency.code}
                        </Text>
                        <Text style={styles.currencyOptionName}>
                          {currency.name}
                        </Text>
                      </View>
                    </View>
                    {currency.code === defaultCurrency && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.sectionDescription}>
            Push notifications coming soon
          </Text>
          <Card style={styles.settingCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>New Expenses</Text>
                <Text style={styles.settingDescription}>
                  When someone adds an expense to your group
                </Text>
              </View>
              <Switch
                value={expenseNotifications}
                onValueChange={setExpenseNotifications}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={
                  expenseNotifications ? colors.primary : colors.textMuted
                }
                disabled // Disabled until push notifications are implemented
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Settlements</Text>
                <Text style={styles.settingDescription}>
                  When someone settles up with you
                </Text>
              </View>
              <Switch
                value={settlementNotifications}
                onValueChange={setSettlementNotifications}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={
                  settlementNotifications ? colors.primary : colors.textMuted
                }
                disabled
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Group Updates</Text>
                <Text style={styles.settingDescription}>
                  New members, group name changes
                </Text>
              </View>
              <Switch
                value={groupUpdates}
                onValueChange={setGroupUpdates}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={groupUpdates ? colors.primary : colors.textMuted}
                disabled
              />
            </View>
          </Card>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <Card style={styles.settingCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Help Improve SplitFree</Text>
                <Text style={styles.settingDescription}>
                  Share anonymous usage data to help us improve the app
                </Text>
              </View>
              <Switch
                value={analyticsEnabled}
                onValueChange={handleAnalyticsToggle}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={
                  analyticsEnabled ? colors.primary : colors.textMuted
                }
              />
            </View>
          </Card>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <Card style={styles.settingCard}>
            <TouchableOpacity
              style={styles.settingItem}
              disabled={exporting}
              onPress={async () => {
                if (!userId) {
                  Alert.alert("Error", "Please sign in to export data");
                  return;
                }
                setExporting(true);
                try {
                  await exportAllUserData(userId);
                } finally {
                  setExporting(false);
                }
              }}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>
                  {exporting ? "Exporting..." : "Export Data"}
                </Text>
                <Text style={styles.settingDescription}>
                  Download your expense history as CSV
                </Text>
              </View>
              <Text style={styles.menuArrow}>{exporting ? "⏳" : "→"}</Text>
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                Alert.alert(
                  "Clear Local Data",
                  "This will clear cached data. Your account and groups will not be affected.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await clearAllLocalData();
                          setDefaultCurrency("USD"); // Reset to default
                          Alert.alert("Done", "Local cache cleared");
                        } catch (error) {
                          Alert.alert("Error", "Failed to clear local data");
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Clear Local Data</Text>
                <Text style={styles.settingDescription}>
                  Free up space on your device
                </Text>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Card style={styles.settingCard}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                Linking.openURL(
                  "mailto:feedback@splitfree.app?subject=SplitFree%20Feedback"
                );
              }}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Send Feedback</Text>
                <Text style={styles.settingDescription}>
                  Help us improve SplitFree
                </Text>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                Alert.alert(
                  "Help & Support",
                  "For questions or issues, email us at:\nsupport@splitfree.app"
                );
              }}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Help Center</Text>
                <Text style={styles.settingDescription}>
                  Get help with common issues
                </Text>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <Card style={styles.settingCard}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                Alert.alert(
                  "Privacy Policy",
                  "View our privacy policy at:\nhttps://splitfree.app/privacy"
                );
              }}
            >
              <Text style={styles.settingLabel}>Privacy Policy</Text>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {
                Alert.alert(
                  "Terms of Service",
                  "View our terms at:\nhttps://splitfree.app/terms"
                );
              }}
            >
              <Text style={styles.settingLabel}>Terms of Service</Text>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>SplitFree</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appTagline}>
            100% free expense splitting.{"\n"}No limits. No paywalls.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  settingCard: {
    padding: 0,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
  },
  settingContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.bodyMedium,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.lg,
  },
  menuArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  currencyValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  currencySymbol: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: colors.primary,
  },
  currencyCode: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  expandArrow: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  currencyList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  currencyOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  currencyOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  currencyOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  currencyOptionSymbol: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    width: 30,
    textAlign: "center",
  },
  currencyOptionCode: {
    ...typography.bodyMedium,
  },
  currencyOptionName: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  checkmark: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "bold",
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    marginTop: spacing.lg,
  },
  appName: {
    ...typography.h3,
    color: colors.primary,
  },
  appVersion: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  appTagline: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 20,
  },
});
