import { Redirect, router } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { fadeInUp, layoutTransition } from "@/animations/motion";
import { MotionPressable } from "@/components/motion/MotionPressable";
import { OnboardingStepScreen } from "@/components/onboarding/OnboardingStepScreen";
import { DEV_AREA_LABELS, DEV_AREA_THEME } from "@/constants/devAreas";
import type { MaterialSlug } from "@/constants/materials";
import { APP_COLORS, APP_FONTS } from "@/constants/theme";
import { recommend } from "@/engine/recommend";
import { buildOnboardingFilterInput } from "@/onboarding/utils";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Play } from "@/types";
import { getPlayRepresentativeEmoji } from "@/utils/playEmoji";

const CARD_PASTELS = ["#FDE8EF", "#E5F7EF", "#FEF3E2"] as const;

function getMaterialSummary(
  play: Play,
  ownedMaterialsSet: Set<MaterialSlug>,
): {
  label: string;
  tone: "ready" | "partial" | "missing";
  detail: string;
} {
  const requiredCount = play.materials.required.length;
  const optionalCount = play.materials.optional.length;
  const totalCount = requiredCount + optionalCount;

  if (totalCount === 0) {
    return {
      label: "준비물 없이 가능",
      tone: "ready",
      detail: "바로 시작할 수 있어요",
    };
  }

  const ownedRequiredCount = play.materials.required.filter((material) =>
    ownedMaterialsSet.has(material),
  ).length;
  const missingRequiredCount = requiredCount - ownedRequiredCount;
  const ownedOptionalCount = play.materials.optional.filter((material) =>
    ownedMaterialsSet.has(material),
  ).length;
  const missingOptionalCount = optionalCount - ownedOptionalCount;

  if (missingRequiredCount === 0 && missingOptionalCount === 0) {
    return {
      label: "지금 바로 가능",
      tone: "ready",
      detail: `준비물 ${totalCount}/${totalCount}개를 갖고 있어요`,
    };
  }

  if (missingRequiredCount === 0) {
    return {
      label: "지금 시작 가능",
      tone: "ready",
      detail: `필수 재료는 모두 있고 선택 재료 ${missingOptionalCount}개가 더 있으면 좋아요`,
    };
  }

  if (ownedRequiredCount > 0) {
    return {
      label: `${missingRequiredCount}개만 더 필요`,
      tone: "partial",
      detail: `필수 재료 ${ownedRequiredCount}/${requiredCount}개를 갖고 있어요`,
    };
  }

  return {
    label: "재료 보충 필요",
    tone: "missing",
    detail: `필수 재료 ${requiredCount}개를 준비하면 시작할 수 있어요`,
  };
}

export default function FirstResultScreen() {
  const plays = usePlaysStore((state) => state.plays);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const userContext = useSessionStore((state) => state.userContext);
  const reduceMotion = useReducedMotion();
  const shouldAnimate = !reduceMotion && Platform.OS !== "web";
  const filterInput = buildOnboardingFilterInput(userContext);

  if (!filterInput) {
    return <Redirect href="/(onboarding)/child-info" />;
  }

  const recommendation = recommend(plays, filterInput, { totalPlays: 0 });
  const selectedMaterialsSet = new Set<MaterialSlug>(filterInput.availableMaterials);

  return (
    <OnboardingStepScreen
      title="첫 추천이 준비됐어요"
      description="놀이 홈에서 보게 될 추천 카드와 같은 방식으로 먼저 3개를 보여드립니다. 지금 바로 가능한지까지 함께 확인할 수 있어요."
      footer={
        <MotionPressable
          accessibilityRole="button"
          onPress={() => {
            void completeOnboarding().then(() => router.replace("/(main)"));
          }}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.primaryButtonText}>놀이 홈으로</Text>
        </MotionPressable>
      }
    >
      {filterInput.childAgeMonths <= 5 ? (
        <Animated.View
          entering={shouldAnimate ? fadeInUp(40) : undefined}
          layout={shouldAnimate ? layoutTransition : undefined}
          style={styles.notice}
        >
          <Text style={styles.noticeText}>
            이 월령대는 준비된 놀이가 적을 수 있어요. 비슷한 감각·교감 놀이까지 함께 넓혀서
            보여드릴게요.
          </Text>
        </Animated.View>
      ) : null}

      {recommendation.usedFallback ? (
        <Animated.View
          entering={shouldAnimate ? fadeInUp(70) : undefined}
          layout={shouldAnimate ? layoutTransition : undefined}
          style={styles.notice}
        >
          <Text style={styles.noticeText}>
            현재 재료 기준으로 맞는 놀이가 적어 일부 조건을 완화해 함께 추천했습니다.
          </Text>
        </Animated.View>
      ) : null}

      {recommendation.results.map((play, index) => {
        const playEmoji = getPlayRepresentativeEmoji(play);
        const materialSummary = getMaterialSummary(play, selectedMaterialsSet);
        const pastelColor = CARD_PASTELS[index % CARD_PASTELS.length];

        return (
          <Animated.View
            key={play.id}
            entering={shouldAnimate ? fadeInUp(100 + index * 50) : undefined}
            layout={shouldAnimate ? layoutTransition : undefined}
            style={[styles.card, { backgroundColor: pastelColor }]}
          >
            <View style={styles.cardBody}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{playEmoji}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusChip, styles.statusChipFresh]}>
                    <Text style={[styles.statusChipText, styles.statusChipTextFresh]}>
                      {index + 1}순위 추천
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusChip,
                      materialSummary.tone === "ready"
                        ? styles.materialChipReady
                        : materialSummary.tone === "partial"
                          ? styles.materialChipPartial
                          : styles.materialChipMissing,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        materialSummary.tone === "ready"
                          ? styles.materialChipTextReady
                          : materialSummary.tone === "partial"
                            ? styles.materialChipTextPartial
                            : styles.materialChipTextMissing,
                      ]}
                    >
                      {materialSummary.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.playName}>{play.name}</Text>
                <Text style={styles.meta}>
                  {play.ageMin}~{play.ageMax}개월 · {play.durationMin}~{play.durationMax}분 · 준비{" "}
                  {play.prepTime}분
                </Text>
                <Text style={styles.cardSummary}>{materialSummary.detail}</Text>
                <View style={styles.tagRow}>
                  {play.devAreas.map((area) => (
                    <View
                      key={area}
                      style={[styles.devTag, { backgroundColor: DEV_AREA_THEME[area].backgroundColor }]}
                    >
                      <Text style={[styles.devTagText, { color: DEV_AREA_THEME[area].textColor }]}>
                        #{DEV_AREA_LABELS[area]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.watermark}>{playEmoji}</Text>
              </View>
            </View>
          </Animated.View>
        );
      })}
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  noticeText: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  card: {
    padding: 18,
    borderRadius: 28,
    overflow: "hidden",
  },
  cardBody: {
    flexDirection: "row",
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    gap: 10,
  },
  cardRight: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  cardIcon: {
    fontSize: 28,
  },
  watermark: {
    fontSize: 56,
    opacity: 0.18,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusChipFresh: {
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  statusChipTextFresh: {
    color: APP_COLORS.ink,
  },
  materialChipReady: {
    backgroundColor: "#DCFCE7",
  },
  materialChipPartial: {
    backgroundColor: "#FEF3C7",
  },
  materialChipMissing: {
    backgroundColor: "#FEE2E2",
  },
  materialChipTextReady: {
    color: "#166534",
  },
  materialChipTextPartial: {
    color: "#92400E",
  },
  materialChipTextMissing: {
    color: "#991B1B",
  },
  playName: {
    color: APP_COLORS.ink,
    fontSize: 24,
    lineHeight: 32,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  meta: {
    color: APP_COLORS.muted,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  cardSummary: {
    color: APP_COLORS.ink,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  devTag: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  devTagText: {
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: APP_COLORS.ink,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: APP_COLORS.surface,
    fontSize: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
});
