import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_COLORS, APP_FONTS } from "@/constants/theme";

type OnboardingProgressHeaderProps = {
  currentStep: number;
};

const STEP_LABELS = ["아이 정보 입력", "준비물 선택"] as const;
const TOTAL_STEPS = STEP_LABELS.length;

export function OnboardingProgressHeader({
  currentStep,
}: OnboardingProgressHeaderProps) {
  const insets = useSafeAreaInsets();
  const safeStep = Math.min(Math.max(currentStep, 0), TOTAL_STEPS - 1);
  const progress = `${((safeStep + 1) / TOTAL_STEPS) * 100}%` as `${number}%`;
  const showBackButton = safeStep > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerRow}>
        {showBackButton ? (
          <Pressable
            accessibilityLabel="이전 단계로 이동"
            accessibilityRole="button"
            onPress={() => router.replace("/(onboarding)/child-info")}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
        ) : null}
        <View style={styles.copyRow}>
          <Text style={styles.stepCount}>{safeStep + 1}/{TOTAL_STEPS}</Text>
          <Text style={styles.stepLabel}>{STEP_LABELS[safeStep]}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progress }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: APP_COLORS.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  backButtonPressed: {
    opacity: 0.62,
  },
  backButtonText: {
    color: APP_COLORS.ink,
    fontSize: 34,
    lineHeight: 34,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  stepCount: {
    color: APP_COLORS.accent,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  stepLabel: {
    color: APP_COLORS.muted,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: APP_COLORS.accentSoft,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
});
