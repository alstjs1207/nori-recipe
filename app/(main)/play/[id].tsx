import { useEffect, useRef, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEV_AREA_LABELS, DEV_AREA_THEME } from "@/constants/devAreas";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_SLUGS,
  type MaterialSlug,
} from "@/constants/materials";
import { getMaterialVisualSpec } from "@/constants/materialVisuals";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { isFavorite, toggleFavorite } from "@/db/queries";
import {
  advanceAutoProgress,
  completeStep,
  getNextIncompleteStepIndex,
} from "@/play/stepProgress";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Play } from "@/types";

type DetailTab = "overview" | "steps" | "safety";

type MaterialReadinessSummary = {
  body: string;
  tone: "missing" | "ready";
  title: string;
};

type StepRowProps = {
  active: boolean;
  completed: boolean;
  index: number;
  onPress?: () => void;
  text: string;
};

type MaterialCheckCardProps = {
  material: MaterialSlug;
  missing: boolean;
  requirementLabel: string;
};

type IconCircleButtonProps = {
  accent?: boolean;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  text: string;
};

type ArtworkVariant = "bath" | "dough" | "plate" | "paper" | "book" | "blocks";

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "요약" },
  { key: "steps", label: "놀이방법" },
  { key: "safety", label: "주의사항" },
];

const PLACE_LABELS: Record<Play["place"], string> = {
  indoor: "실내",
  outdoor: "실외",
  any: "어디서나",
};

const DIFFICULTY_LABELS: Record<Play["difficulty"], string> = {
  1: "쉬워요",
  2: "보통이에요",
  3: "어려워요",
};

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function readMaterialParams(value: string | string[] | undefined): MaterialSlug[] {
  const rawValues =
    typeof value === "string"
      ? value.split(",")
      : Array.isArray(value)
        ? value.flatMap((item) => item.split(","))
        : [];
  const validMaterials = new Set<MaterialSlug>(MATERIAL_SLUGS);

  return rawValues.filter(
    (material): material is MaterialSlug => validMaterials.has(material as MaterialSlug),
  );
}

function formatDuration(play: Play): string {
  if (play.durationMin === play.durationMax) {
    return `${play.durationMin}분`;
  }

  return `${play.durationMin}~${play.durationMax}분`;
}

function formatAgeRange(play: Play): string {
  if (play.ageMin === play.ageMax) {
    return `${play.ageMin}개월`;
  }

  return `${play.ageMin}~${play.ageMax}개월`;
}

function getPrepTimeLabel(play: Play): string {
  return play.prepTime === 0 ? "준비 없음" : `준비 ${play.prepTime}분`;
}

function getMaterialCategoryName(material: MaterialSlug): string {
  const category = Object.entries(MATERIAL_CATEGORIES).find(([, materials]) =>
    (materials as string[]).includes(material),
  );

  return category?.[0] ?? "도구";
}

function getPrimaryActionLabel({
  allStepsCompleted,
  hasStartedPlay,
  isAutoProgressing,
  nextIncompleteStepIndex,
}: {
  allStepsCompleted: boolean;
  hasStartedPlay: boolean;
  isAutoProgressing: boolean;
  nextIncompleteStepIndex: number;
}): string {
  if (!hasStartedPlay) {
    return "놀이 시작하기";
  }

  if (allStepsCompleted) {
    return "놀이 마치고 기록하기";
  }

  if (isAutoProgressing) {
    return "자동 진행 중";
  }

  return nextIncompleteStepIndex >= 0
    ? `${nextIncompleteStepIndex + 1}단계 완료하기`
    : "놀이 기록하기";
}

function getMaterialReadinessSummary(
  play: Play,
  selectedMaterialsSet: Set<MaterialSlug>,
): MaterialReadinessSummary {
  const missingRequiredCount = play.materials.required.filter(
    (material) => !selectedMaterialsSet.has(material),
  ).length;
  const missingOptionalCount = play.materials.optional.filter(
    (material) => !selectedMaterialsSet.has(material),
  ).length;

  if (play.materials.required.length === 0 && play.materials.optional.length === 0) {
    return {
      title: "준비물 없이 바로 시작 가능",
      body: "별도 준비 없이 바로 놀이를 시작할 수 있어요.",
      tone: "ready",
    };
  }

  if (missingRequiredCount > 0) {
    return {
      title: `필수 재료 ${missingRequiredCount}개 부족`,
      body: "없는 필수 재료를 먼저 확인하고 시작해 주세요.",
      tone: "missing",
    };
  }

  if (missingOptionalCount > 0) {
    return {
      title: "지금 시작 가능",
      body: `선택 재료 ${missingOptionalCount}개가 더 있으면 놀이를 더 풍부하게 할 수 있어요.`,
      tone: "ready",
    };
  }

  return {
    title: "준비 완료",
    body: "필수와 선택 재료가 모두 준비되어 있어요.",
    tone: "ready",
  };
}

function getArtworkVariant(play: Play): ArtworkVariant {
  const text = [play.name, ...play.tags].join(" ").replace(/\s+/g, "").toLowerCase();
  const allMaterials = [
    ...play.materials.required,
    ...play.materials.optional,
    ...play.materials.substitutes,
  ];

  if (
    text.includes("목욕") ||
    text.includes("물") ||
    allMaterials.includes("water") ||
    allMaterials.includes("bubble")
  ) {
    return "bath";
  }

  if (
    text.includes("밀가루") ||
    text.includes("반죽") ||
    text.includes("점토") ||
    text.includes("슬라임") ||
    allMaterials.includes("flour") ||
    allMaterials.includes("clay") ||
    allMaterials.includes("slime")
  ) {
    return "dough";
  }

  if (text.includes("요리") || text.includes("접시") || text.includes("음식")) {
    return "plate";
  }

  if (text.includes("책") || text.includes("동화") || allMaterials.includes("book")) {
    return "book";
  }

  if (
    text.includes("그리기") ||
    text.includes("그림") ||
    allMaterials.includes("paper") ||
    allMaterials.includes("paint") ||
    allMaterials.includes("crayon")
  ) {
    return "paper";
  }

  return "blocks";
}

function IconCircleButton({
  accent = false,
  disabled = false,
  label,
  onPress,
  text,
}: IconCircleButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        accent && styles.iconButtonAccent,
        disabled && styles.iconButtonDisabled,
        pressed && !disabled && styles.iconButtonPressed,
      ]}
    >
      <Text style={[styles.iconButtonText, accent && styles.iconButtonTextAccent]}>{text}</Text>
    </Pressable>
  );
}

function MaterialImage({ material, size = 40 }: { material: MaterialSlug; size?: number }) {
  const visual = getMaterialVisualSpec(material, getMaterialCategoryName(material));

  return (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={visual.imageSource}
      style={{ width: size, height: size }}
    />
  );
}

function MaterialCheckCard({ material, missing, requirementLabel }: MaterialCheckCardProps) {
  return (
    <View style={styles.materialCheckCard}>
      <View style={styles.materialCheckImageSlot}>
        <MaterialImage material={material} size={38} />
      </View>
      <Text style={styles.materialCheckRequirement}>{requirementLabel}</Text>
      <Text numberOfLines={2} style={styles.materialCheckLabel}>
        {MATERIAL_DISPLAY_NAMES[material]}
      </Text>
      <View style={[styles.materialMiniStatus, missing && styles.materialMiniStatusMissing]}>
        <Text
          style={[
            styles.materialMiniStatusText,
            missing && styles.materialMiniStatusTextMissing,
          ]}
        >
          {missing ? "" : "✓"}
        </Text>
      </View>
    </View>
  );
}

function StepRow({ active, completed, index, onPress, text }: StepRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ checked: completed }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepRow,
        active && styles.stepRowActive,
        completed && styles.stepRowCompleted,
        pressed && styles.stepRowPressed,
      ]}
    >
      <View style={[styles.stepBadge, active && styles.stepBadgeActive]}>
        <Text style={[styles.stepBadgeText, active && styles.stepBadgeTextActive]}>
          {completed ? "✓" : index + 1}
        </Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={[styles.stepText, completed && styles.stepTextCompleted]}>{text}</Text>
      </View>
    </Pressable>
  );
}

function PlayHeroArtwork({ play }: { play: Play }) {
  const variant = getArtworkVariant(play);

  return (
    <View style={styles.artFrame}>
      <View style={styles.artShadow} />
      <View style={styles.artStage}>
        <View style={styles.artPlateOuter} />
        <View style={styles.artPlateInner} />
        {variant === "bath" ? (
          <>
            <View style={styles.artBathTub} />
            <View style={styles.artBubbleOne} />
            <View style={styles.artBubbleTwo} />
            <View style={styles.artBubbleThree} />
          </>
        ) : null}
        {variant === "dough" ? (
          <>
            <View style={styles.artDoughBlob} />
            <View style={styles.artDoughStem} />
            <View style={styles.artDoughDotOne} />
            <View style={styles.artDoughDotTwo} />
            <View style={styles.artDoughDotThree} />
          </>
        ) : null}
        {variant === "plate" ? (
          <>
            <View style={styles.artPlateFoodLeft} />
            <View style={styles.artPlateFoodRight} />
            <View style={styles.artPlateFoodTop} />
          </>
        ) : null}
        {variant === "paper" ? (
          <>
            <View style={styles.artPaperSheet} />
            <View style={styles.artPaperMarkOne} />
            <View style={styles.artPaperMarkTwo} />
          </>
        ) : null}
        {variant === "book" ? (
          <>
            <View style={styles.artBookLeft} />
            <View style={styles.artBookRight} />
            <View style={styles.artBookSpine} />
          </>
        ) : null}
        {variant === "blocks" ? (
          <>
            <View style={styles.artBlockBase} />
            <View style={styles.artBlockLeft} />
            <View style={styles.artBlockRight} />
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function PlayDetailScreen() {
  const autoProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; fallback?: string; materials?: string | string[] }>();
  const playId = readParam(params.id);
  const guestId = useSessionStore((state) => state.guestId);
  const play = usePlaysStore((state) => state.plays.find((item) => item.id === playId));
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [hasStartedPlay, setHasStartedPlay] = useState(false);
  const [isAutoProgressing, setIsAutoProgressing] = useState(false);
  const [favorite, setFavorite] = useState(false);

  function clearAutoProgressTimer() {
    if (!autoProgressTimerRef.current) {
      return;
    }

    clearTimeout(autoProgressTimerRef.current);
    autoProgressTimerRef.current = null;
  }

  useEffect(() => {
    clearAutoProgressTimer();
    setActiveTab("overview");
    setCompletedSteps([]);
    setHasStartedPlay(false);
    setIsAutoProgressing(false);
    setFavorite(false);
  }, [playId]);

  useEffect(() => clearAutoProgressTimer, []);

  useEffect(() => {
    if (!guestId || !playId) {
      setFavorite(false);
      return;
    }

    let active = true;

    void isFavorite(guestId, playId)
      .then((value) => {
        if (active) {
          setFavorite(value);
        }
      })
      .catch(() => {
        if (active) {
          setFavorite(false);
        }
      });

    return () => {
      active = false;
    };
  }, [guestId, playId]);

  async function handleToggleFavorite() {
    if (!guestId || !play) {
      return;
    }

    try {
      const nextValue = await toggleFavorite(guestId, play.id);
      setFavorite(nextValue);
    } catch {
      setFavorite((current) => current);
    }
  }

  async function handleShare() {
    if (!play) {
      return;
    }

    try {
      await Share.share({
        title: play.name,
        message: `${play.name}\n${formatAgeRange(play)} · ${formatDuration(play)} · ${getPrepTimeLabel(play)}`,
      });
    } catch {
      // Native share sheets can fail on unsupported platforms or cancelled flows.
    }
  }

  function moveToFeedback() {
    if (!play) {
      return;
    }

    router.push({
      pathname: "/(main)/feedback/[id]",
      params: { id: play.id },
    });
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(main)");
  }

  function toggleStep(index: number) {
    if (!hasStartedPlay) {
      setHasStartedPlay(true);
      setActiveTab("steps");
    }

    setCompletedSteps((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : completeStep(current, index),
    );
  }

  function handlePrimaryAction() {
    if (isAutoProgressing) {
      return;
    }

    if (hasStartedPlay && allStepsCompleted) {
      moveToFeedback();
      return;
    }

    setActiveTab("steps");

    if (!hasStartedPlay) {
      setHasStartedPlay(true);
      setIsAutoProgressing(true);
      return;
    }

    if (nextIncompleteStepIndex >= 0) {
      setIsAutoProgressing(true);
    }
  }

  const selectedMaterials = readMaterialParams(params.materials);
  const selectedMaterialsSet = new Set(selectedMaterials);
  const requiredMaterials = play?.materials.required ?? [];
  const optionalMaterials = play?.materials.optional ?? [];
  const allMaterials = play
    ? [
        ...requiredMaterials.map((material) => ({ material, optional: false })),
        ...optionalMaterials.map((material) => ({ material, optional: true })),
      ]
    : [];
  const materialReadiness = play
    ? getMaterialReadinessSummary(play, selectedMaterialsSet)
    : null;
  const totalStepCount = play?.steps.length ?? 0;
  const allStepsCompleted = totalStepCount > 0 && completedSteps.length === totalStepCount;
  const nextIncompleteStepIndex = getNextIncompleteStepIndex(totalStepCount, completedSteps);
  const primaryActionLabel = getPrimaryActionLabel({
    allStepsCompleted,
    hasStartedPlay,
    isAutoProgressing,
    nextIncompleteStepIndex,
  });

  useEffect(() => {
    if (!hasStartedPlay || !isAutoProgressing) {
      clearAutoProgressTimer();
      return;
    }

    if (allStepsCompleted || nextIncompleteStepIndex < 0) {
      clearAutoProgressTimer();
      setIsAutoProgressing(false);
      return;
    }

    clearAutoProgressTimer();
    autoProgressTimerRef.current = setTimeout(() => {
      setCompletedSteps((current) => advanceAutoProgress(totalStepCount, current).completedSteps);
    }, 1000);

    return clearAutoProgressTimer;
  }, [allStepsCompleted, hasStartedPlay, isAutoProgressing, nextIncompleteStepIndex, totalStepCount]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + 12,
              paddingBottom: play ? 110 + Math.max(insets.bottom, 16) : 32,
            },
          ]}
        >
          {play ? (
            <>
              <View style={styles.heroImageCard}>
                <View style={styles.heroTopBar}>
                  <IconCircleButton label="뒤로 가기" onPress={handleBack} text="‹" />
                  <IconCircleButton
                    label={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    onPress={handleToggleFavorite}
                    text={favorite ? "★" : "☆"}
                  />
                </View>
                <PlayHeroArtwork play={play} />
                <View style={styles.heroFallbackLabel}>
                  <Text style={styles.heroFallbackLabelText}>대표 이미지 준비 중</Text>
                </View>
              </View>

              <View style={styles.summaryPanel}>
                <View style={styles.agePill}>
                  <Text style={styles.agePillText}>{formatAgeRange(play)}</Text>
                </View>
                <Text style={styles.heroTitle}>{play.name}</Text>

                <View style={styles.heroMetaRow}>
                  <View style={styles.heroMetaItem}>
                    <Text style={styles.heroMetaIcon}>◷</Text>
                    <Text style={styles.heroMetaText}>{formatDuration(play)}</Text>
                  </View>
                  <View style={styles.heroMetaDivider} />
                  <View style={styles.heroMetaItem}>
                    <Text style={styles.heroMetaIcon}>⏱</Text>
                    <Text style={styles.heroMetaText}>{getPrepTimeLabel(play)}</Text>
                  </View>
                  <View style={styles.heroMetaDivider} />
                  <View style={styles.heroMetaItem}>
                    <Text style={styles.heroMetaIcon}>▥</Text>
                    <Text style={styles.heroMetaText}>{DIFFICULTY_LABELS[play.difficulty]}</Text>
                  </View>
                </View>

                <View style={styles.materialCheckHeader}>
                  <Text style={styles.materialCheckTitle}>준비물 체크</Text>
                </View>
                {allMaterials.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.materialCheckRow}
                  >
                    {allMaterials.map(({ material, optional }) => (
                      <MaterialCheckCard
                        key={`${play.id}-summary-material-${material}-${optional ? "optional" : "required"}`}
                        material={material}
                        missing={!selectedMaterialsSet.has(material)}
                        requirementLabel={optional ? "선택" : "필수"}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.readinessBar}>
                    <Text style={styles.readinessIcon}>✓</Text>
                    <Text style={styles.readinessText}>준비물이 없는 놀이예요.</Text>
                  </View>
                )}

                {materialReadiness ? (
                  <View
                    style={[
                      styles.readinessBar,
                      materialReadiness.tone === "missing" && styles.readinessBarMissing,
                    ]}
                  >
                    <Text style={styles.readinessIcon}>
                      {materialReadiness.tone === "missing" ? "!" : "✓"}
                    </Text>
                    <Text style={styles.readinessText}>{materialReadiness.title}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.tabBar}>
                {DETAIL_TABS.map((tab) => (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="button"
                    onPress={() => setActiveTab(tab.key)}
                    style={styles.tabButton}
                  >
                    <Text
                      style={[
                        styles.tabButtonText,
                        activeTab === tab.key && styles.tabButtonTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <View style={[styles.tabUnderline, activeTab === tab.key && styles.tabUnderlineActive]} />
                  </Pressable>
                ))}
              </View>

              {activeTab === "overview" ? (
                <View style={styles.contentSection}>
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>놀이 정보</Text>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryGridItem}>
                        <Text style={styles.summaryGridLabel}>장소</Text>
                        <Text style={styles.summaryGridValue}>{PLACE_LABELS[play.place]}</Text>
                      </View>
                      <View style={styles.summaryGridItem}>
                        <Text style={styles.summaryGridLabel}>난이도</Text>
                        <Text style={styles.summaryGridValue}>{DIFFICULTY_LABELS[play.difficulty]}</Text>
                      </View>
                      <View style={styles.summaryGridItem}>
                        <Text style={styles.summaryGridLabel}>단계</Text>
                        <Text style={styles.summaryGridValue}>{play.steps.length}단계</Text>
                      </View>
                    </View>
                    <View style={styles.devTagRow}>
                      {play.devAreas.map((devArea) => (
                        <View
                          key={devArea}
                          style={[
                            styles.devTag,
                            { backgroundColor: DEV_AREA_THEME[devArea].backgroundColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.devTagText,
                              { color: DEV_AREA_THEME[devArea].textColor },
                            ]}
                          >
                            {DEV_AREA_LABELS[devArea]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {play.educationalEffects.length > 0 ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.sectionTitle}>이 놀이가 좋은 점</Text>
                      <View style={styles.effectGrid}>
                        {play.educationalEffects.slice(0, 3).map((effect, index) => (
                          <View key={`${play.id}-effect-card-${index}`} style={styles.effectCard}>
                            <Text style={styles.effectIcon}>{index === 0 ? "◌" : index === 1 ? "◉" : "✋"}</Text>
                            <Text numberOfLines={2} style={styles.effectText}>{effect}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {play.tip ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.sectionTitle}>놀이 팁</Text>
                      <Text style={styles.bodyText}>{play.tip}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {activeTab === "steps" ? (
                <View style={styles.contentSection}>
                  <View style={styles.sectionHeadingRow}>
                    <Text style={styles.sectionHeadingIcon}>✋</Text>
                    <Text style={styles.sectionHeading}>놀이방법</Text>
                  </View>
                  <View style={styles.stepList}>
                    {play.steps.map((step, index) => (
                      <StepRow
                        active={hasStartedPlay && index === nextIncompleteStepIndex}
                        key={`${play.id}-step-${index}`}
                        completed={completedSteps.includes(index)}
                        index={index}
                        onPress={isAutoProgressing ? undefined : () => toggleStep(index)}
                        text={step}
                      />
                    ))}
                  </View>
                  {play.safetyNotes.length > 0 ? (
                    <>
                      <View style={styles.sectionDivider} />
                      <View style={styles.sectionHeadingRow}>
                        <Text style={styles.sectionHeadingIcon}>◆</Text>
                        <Text style={styles.sectionHeading}>주의사항</Text>
                      </View>
                      <View style={styles.infoCard}>
                        <View style={styles.noteList}>
                          {play.safetyNotes.map((note, index) => (
                            <View key={`${play.id}-steps-safety-${index}`} style={styles.noteRow}>
                              <View style={styles.noteBullet} />
                              <Text style={styles.bodyText}>{note}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}

              {activeTab === "safety" ? (
                <View style={styles.contentSection}>
                  <View style={styles.sectionHeadingRow}>
                    <Text style={styles.sectionHeadingIcon}>◆</Text>
                    <Text style={styles.sectionHeading}>주의사항</Text>
                  </View>
                  {play.safetyNotes.length > 0 ? (
                    <View style={styles.infoCard}>
                      <View style={styles.noteList}>
                        {play.safetyNotes.map((note, index) => (
                          <View key={`${play.id}-safety-${index}`} style={styles.noteRow}>
                            <View style={styles.noteBullet} />
                            <Text style={styles.bodyText}>{note}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.infoCard}>
                      <Text style={styles.bodyText}>따로 등록된 주의사항이 없어요.</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>놀이를 찾지 못했어요</Text>
              <Text style={styles.bodyText}>
                선택한 카드가 현재 번들 목록에 없는 상태입니다. 홈으로 돌아가 다시 선택해 주세요.
              </Text>
            </View>
          )}
        </ScrollView>

        {play ? (
          <View style={[styles.footerWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.footerBar}>
              <IconCircleButton label="공유하기" onPress={handleShare} text="⇧" />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isAutoProgressing }}
                disabled={isAutoProgressing}
                onPress={handlePrimaryAction}
                style={({ pressed }) => [
                  styles.footerPrimaryButton,
                  isAutoProgressing && styles.footerPrimaryButtonDisabled,
                  pressed && !isAutoProgressing && styles.footerPrimaryButtonPressed,
                ]}
              >
                <Text style={styles.footerPrimaryIcon}>{allStepsCompleted ? "✓" : "▶"}</Text>
                <Text style={styles.footerPrimaryText}>{primaryActionLabel}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  container: {
    paddingHorizontal: 16,
    backgroundColor: APP_COLORS.background,
  },
  heroImageCard: {
    height: 240,
    overflow: "hidden",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#FFF1D4",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#EFE1C7",
  },
  heroTopBar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#E7E0D3",
    ...APP_SHADOWS.control,
  },
  iconButtonAccent: {
    backgroundColor: APP_COLORS.mustard,
    borderColor: APP_COLORS.mustard,
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  iconButtonPressed: {
    opacity: 0.88,
  },
  iconButtonText: {
    color: APP_COLORS.ink,
    fontSize: 24,
    lineHeight: 26,
    fontFamily: APP_FONTS.heading,
  },
  iconButtonTextAccent: {
    color: "#4E3B0F",
  },
  heroFallbackLabel: {
    position: "absolute",
    top: 88,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: "rgba(255,250,238,0.74)",
    borderWidth: 1,
    borderColor: "rgba(211,179,111,0.32)",
    transform: [{ rotate: "-4deg" }],
  },
  heroFallbackLabelText: {
    color: "#59462A",
    fontSize: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  summaryPanel: {
    marginTop: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderColor: APP_COLORS.line,
  },
  agePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: APP_COLORS.mustard,
  },
  agePillText: {
    color: APP_COLORS.accentText,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 14,
    color: APP_COLORS.ink,
    fontSize: 28,
    lineHeight: 36,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  heroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetaIcon: {
    color: "#6D6D6D",
    fontSize: 18,
    fontFamily: APP_FONTS.body,
  },
  heroMetaText: {
    color: "#4F4F4F",
    fontSize: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  heroMetaDivider: {
    width: 1,
    height: 18,
    backgroundColor: APP_COLORS.line,
  },
  materialCheckHeader: {
    marginTop: 20,
  },
  materialCheckTitle: {
    color: APP_COLORS.ink,
    fontSize: 18,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  materialCheckRow: {
    gap: 8,
    paddingTop: 12,
    paddingRight: 4,
  },
  materialCheckCard: {
    width: 82,
    minHeight: 98,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 12,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  materialCheckImageSlot: {
    width: 48,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  materialCheckRequirement: {
    marginTop: 2,
    color: APP_COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  materialCheckLabel: {
    minHeight: 32,
    marginTop: 2,
    color: APP_COLORS.ink,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  materialMiniStatus: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: APP_COLORS.mustard,
  },
  materialMiniStatusMissing: {
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1.5,
    borderColor: "#8B8B8B",
  },
  materialMiniStatusText: {
    color: APP_COLORS.accentText,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: APP_FONTS.heading,
  },
  materialMiniStatusTextMissing: {
    color: "transparent",
  },
  readinessBar: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFF7E5",
  },
  readinessBarMissing: {
    backgroundColor: "#FFF3D6",
  },
  readinessIcon: {
    width: 24,
    height: 24,
    overflow: "hidden",
    borderRadius: 12,
    color: APP_COLORS.surface,
    backgroundColor: APP_COLORS.mustard,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  readinessText: {
    flex: 1,
    color: "#514A3E",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: APP_FONTS.body,
  },
  tabBar: {
    flexDirection: "row",
    minHeight: 58,
    marginTop: 0,
    backgroundColor: APP_COLORS.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: APP_COLORS.line,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 14,
  },
  tabButtonText: {
    color: "#6F6F6F",
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: APP_COLORS.ink,
    fontFamily: APP_FONTS.heading,
  },
  tabUnderline: {
    width: 54,
    height: 2,
    marginTop: 13,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  tabUnderlineActive: {
    backgroundColor: APP_COLORS.mustard,
  },
  contentSection: {
    gap: 16,
    paddingTop: 24,
  },
  sectionDivider: {
    height: 1,
    marginTop: 8,
    backgroundColor: APP_COLORS.line,
  },
  sectionHeading: {
    color: APP_COLORS.ink,
    fontSize: 23,
    lineHeight: 30,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionHeadingIcon: {
    color: APP_COLORS.mustard,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: APP_FONTS.heading,
  },
  infoCard: {
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 18,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
  },
  summaryGridItem: {
    flex: 1,
    gap: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  summaryGridLabel: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
  },
  summaryGridValue: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  devTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  devTag: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  devTagText: {
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  effectGrid: {
    flexDirection: "row",
    gap: 10,
  },
  effectCard: {
    flex: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  effectIcon: {
    color: APP_COLORS.mustard,
    fontSize: 27,
    lineHeight: 30,
    fontFamily: APP_FONTS.heading,
  },
  effectText: {
    color: APP_COLORS.ink,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  bodyText: {
    color: APP_COLORS.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  subtleText: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  noteList: {
    gap: 10,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noteBullet: {
    width: 5,
    height: 5,
    marginTop: 7,
    borderRadius: 999,
    backgroundColor: APP_COLORS.ink,
  },
  stepList: {
    gap: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  stepRowActive: {
    borderColor: APP_COLORS.accent,
    backgroundColor: "#FFFBEC",
  },
  stepRowCompleted: {
    backgroundColor: "#F8F6F1",
  },
  stepRowPressed: {
    opacity: 0.92,
  },
  stepBadge: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: APP_COLORS.mustard,
  },
  stepBadgeActive: {
    backgroundColor: APP_COLORS.mustard,
  },
  stepBadgeText: {
    color: APP_COLORS.accentText,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  stepBadgeTextActive: {
    color: "#4E3B0F",
  },
  stepBody: {
    flex: 1,
  },
  stepText: {
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: APP_FONTS.body,
  },
  stepTextCompleted: {
    color: APP_COLORS.muted,
  },
  footerWrap: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
  },
  footerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  footerPrimaryButton: {
    flex: 1,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    backgroundColor: APP_COLORS.mustard,
  },
  footerPrimaryButtonDisabled: {
    backgroundColor: "#E0D7BD",
  },
  footerPrimaryButtonPressed: {
    opacity: 0.9,
  },
  footerPrimaryIcon: {
    width: 28,
    height: 28,
    overflow: "hidden",
    borderRadius: 14,
    color: APP_COLORS.mustard,
    backgroundColor: APP_COLORS.surface,
    fontSize: 15,
    lineHeight: 28,
    textAlign: "center",
    fontFamily: APP_FONTS.heading,
  },
  footerPrimaryText: {
    color: APP_COLORS.accentText,
    fontSize: 18,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  artFrame: {
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  artShadow: {
    position: "absolute",
    bottom: 42,
    width: 190,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(126,90,31,0.08)",
  },
  artStage: {
    width: 260,
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: 28 }],
  },
  artPlateOuter: {
    position: "absolute",
    bottom: 28,
    width: 130,
    height: 34,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.surface,
  },
  artPlateInner: {
    position: "absolute",
    bottom: 34,
    width: 92,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#938B7A",
    backgroundColor: "rgba(244,235,214,0.7)",
  },
  artBathTub: {
    position: "absolute",
    bottom: 42,
    width: 86,
    height: 40,
    borderRadius: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.lavenderSoft,
  },
  artBubbleOne: {
    position: "absolute",
    bottom: 74,
    left: 68,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.surface,
  },
  artBubbleTwo: {
    position: "absolute",
    bottom: 82,
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.surface,
  },
  artBubbleThree: {
    position: "absolute",
    bottom: 74,
    right: 68,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.surface,
  },
  artDoughBlob: {
    position: "absolute",
    bottom: 46,
    width: 74,
    height: 34,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: "#EFE5C8",
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artDoughStem: {
    position: "absolute",
    bottom: 76,
    width: 8,
    height: 12,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
  artDoughDotOne: {
    position: "absolute",
    bottom: 68,
    left: 93,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_COLORS.coral,
  },
  artDoughDotTwo: {
    position: "absolute",
    bottom: 66,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_COLORS.mustard,
  },
  artDoughDotThree: {
    position: "absolute",
    bottom: 70,
    right: 93,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_COLORS.sky,
  },
  artPlateFoodLeft: {
    position: "absolute",
    bottom: 44,
    left: 78,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: APP_COLORS.coralSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artPlateFoodRight: {
    position: "absolute",
    bottom: 46,
    right: 74,
    width: 26,
    height: 18,
    borderRadius: 999,
    backgroundColor: APP_COLORS.sageSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artPlateFoodTop: {
    position: "absolute",
    bottom: 64,
    width: 8,
    height: 14,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
  artPaperSheet: {
    position: "absolute",
    bottom: 40,
    width: 98,
    height: 68,
    borderRadius: 4,
    backgroundColor: APP_COLORS.surface,
    transform: [{ rotate: "7deg" }],
  },
  artPaperMarkOne: {
    position: "absolute",
    bottom: 73,
    width: 32,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,142,134,0.72)",
    transform: [{ rotate: "-20deg" }],
  },
  artPaperMarkTwo: {
    position: "absolute",
    bottom: 53,
    width: 34,
    height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(97,214,179,0.62)",
    transform: [{ rotate: "18deg" }],
  },
  artBookLeft: {
    position: "absolute",
    bottom: 40,
    left: 72,
    width: 34,
    height: 48,
    backgroundColor: APP_COLORS.coralSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 16,
  },
  artBookRight: {
    position: "absolute",
    bottom: 40,
    right: 72,
    width: 34,
    height: 48,
    backgroundColor: APP_COLORS.mustardSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 16,
  },
  artBookSpine: {
    position: "absolute",
    bottom: 40,
    width: 8,
    height: 48,
    backgroundColor: APP_COLORS.surface,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: "#5E594D",
  },
  artBlockBase: {
    position: "absolute",
    bottom: 40,
    width: 62,
    height: 26,
    borderRadius: 10,
    backgroundColor: APP_COLORS.lavenderSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artBlockLeft: {
    position: "absolute",
    bottom: 58,
    left: 76,
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: APP_COLORS.mustardSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artBlockRight: {
    position: "absolute",
    bottom: 58,
    right: 76,
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: APP_COLORS.coralSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
});
