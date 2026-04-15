import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_COLORS, APP_FONTS } from "@/constants/theme";

type OnboardingProgressHeaderProps = {
  currentStep: number;
};

export function OnboardingProgressHeader({
  currentStep,
}: OnboardingProgressHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.copyRow}>
        <Text style={styles.eyebrow}>90초 설정</Text>
        <Text style={styles.stepLabel}>{currentStep + 1} / 4</Text>
      </View>
      <View style={styles.progressRow}>
        {Array.from({ length: 4 }, (_, index) => {
          const active = index <= currentStep;

          return (
            <View
              key={index}
              style={[styles.progressSegment, active && styles.progressSegmentActive]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: APP_COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.line,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: APP_COLORS.accent,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: APP_FONTS.mono,
    fontWeight: "700",
  },
  stepLabel: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
  },
  progressSegment: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: APP_COLORS.line,
  },
  progressSegmentActive: {
    backgroundColor: APP_COLORS.accent,
  },
});
