import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from "../../lib/theme";
import { Button } from "../../components/ui";
import { useAnalytics, AnalyticsEvents } from "../../lib/analytics-provider";

const { width } = Dimensions.get("window");

// Storage key for tracking if user has seen welcome
export const WELCOME_SEEN_KEY = "@splitfree/welcome_seen";

interface WelcomeSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  highlight?: string;
}

const SLIDES: WelcomeSlide[] = [
  {
    id: "1",
    icon: "wallet-outline",
    title: "Split Expenses Easily",
    description: "Track shared expenses with friends, roommates, and travel buddies. No more awkward money conversations.",
    highlight: "100% Free",
  },
  {
    id: "2",
    icon: "infinite-outline",
    title: "No Limits. Ever.",
    description: "Unlike other apps, SplitFree has no paywalls, no transaction limits, and no premium tiers.",
    highlight: "Unlimited Groups",
  },
  {
    id: "3",
    icon: "receipt-outline",
    title: "Scan Receipts Instantly",
    description: "Snap a photo of any receipt and let AI extract the items. Split individual items or the whole bill.",
    highlight: "AI-Powered",
  },
];

export default function WelcomeScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<WelcomeSlide>>(null);
  const { trackEvent } = useAnalytics();

  // Track onboarding started when screen mounts
  useEffect(() => {
    trackEvent(AnalyticsEvents.ONBOARDING_STARTED, {
      total_steps: SLIDES.length,
    });
  }, [trackEvent]);

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
        step: currentIndex + 1,
        step_name: SLIDES[currentIndex].id,
      });
    }
  };

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, "true");
      trackEvent(AnalyticsEvents.ONBOARDING_COMPLETED, {
        total_steps: SLIDES.length,
      });
      router.replace("/auth/sign-in");
    } catch {
      router.replace("/auth/sign-in");
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, "true");
      trackEvent(AnalyticsEvents.ONBOARDING_SKIPPED, {
        skipped_at_step: currentIndex + 1,
      });
      router.replace("/auth/sign-in");
    } catch {
      router.replace("/auth/sign-in");
    }
  };

  const renderSlide = ({ item }: { item: WelcomeSlide }) => (
    <View style={styles.slide}>
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon} size={80} color={colors.primary} />
      </View>
      {item.highlight && (
        <View style={styles.highlightBadge}>
          <Text style={styles.highlightText}>{item.highlight}</Text>
        </View>
      )}
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideDescription}>{item.description}</Text>
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Skip button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.carousel}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {isLastSlide ? (
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            style={styles.button}
          />
        ) : (
          <Button
            title="Next"
            onPress={handleNext}
            style={styles.button}
          />
        )}
      </View>

      {/* Sign in link */}
      <View style={styles.signInContainer}>
        <Text style={styles.signInText}>Already have an account?</Text>
        <TouchableOpacity onPress={handleGetStarted}>
          <Text style={styles.signInLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipButton: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
  },
  skipText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width,
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
    alignItems: "center",
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  highlightBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  highlightText: {
    ...typography.small,
    color: colors.white,
    fontWeight: "600",
  },
  slideTitle: {
    ...typography.h1,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  slideDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  button: {
    width: "100%",
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  signInText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  signInLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});
