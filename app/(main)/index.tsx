import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { fadeInUp, fadeOutDownSoft, layoutTransition, quickFadeIn } from "@/animations/motion";
import { MotionPressable } from "@/components/motion/MotionPressable";
import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { MATERIAL_DISPLAY_NAMES, type MaterialSlug } from "@/constants/materials";
import { getMaterialVisualSpec } from "@/constants/materialVisuals";
import { getPlayImageSource } from "@/constants/playImages";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getFavorites, getPlayLogCount, getPlayLogs } from "@/db/queries";
import { recommend } from "@/engine/recommend";
import {
  getAgeMonthsFromBirthMonth,
  getVisibleMaterialCategories,
  ONBOARDING_DEFAULT_MATERIALS,
} from "@/onboarding/utils";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Play, PlayLogRecord, PlayPlace } from "@/types";

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type MaterialTone = "ready" | "partial" | "missing";

const SITUATION_CARDS = [
  { label: "집콕 놀이", icon: "⌂", place: "indoor", tone: "coral" },
  { label: "밖에서 놀 때", icon: "☀", place: "outdoor", tone: "yellow" },
  { label: "어디서나", icon: "○", place: "any", tone: "mint" },
] as const;

const visibleCategories = getVisibleMaterialCategories();
const MATERIAL_TILE_GAP = 8;
const MATERIAL_TILE_MIN_WIDTH = 76;

function mergeRecommendedPlays(primary: Play[], fallback: Play[], limit: number): Play[] {
  const merged = [...primary];

  for (const play of fallback) {
    if (merged.some((candidate) => candidate.id === play.id)) {
      continue;
    }

    merged.push(play);

    if (merged.length === limit) {
      break;
    }
  }

  return merged.slice(0, limit);
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function isSameCalendarDay(value: Date, target: Date): boolean {
  return (
    value.getFullYear() === target.getFullYear() &&
    value.getMonth() === target.getMonth() &&
    value.getDate() === target.getDate()
  );
}

function formatTodayLabel(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function formatDuration(play: Play): string {
  return play.durationMin === play.durationMax
    ? `${play.durationMin}분`
    : `${play.durationMin}-${play.durationMax}분`;
}

function formatCompletedAtLabel(completedAt: string): string {
  const completedDate = new Date(completedAt);

  if (Number.isNaN(completedDate.getTime())) {
    return "최근 완료";
  }

  return `${completedDate.getMonth() + 1}.${completedDate.getDate()} 완료`;
}

function getLatestCompletedAtByPlayId(logs: PlayLogRecord[]): Map<string, string> {
  const latestByPlayId = new Map<string, string>();

  for (const log of logs) {
    if (!latestByPlayId.has(log.playId)) {
      latestByPlayId.set(log.playId, log.completedAt);
    }
  }

  return latestByPlayId;
}

function getRecentCompletedPlayIds(logs: PlayLogRecord[]): string[] {
  return [...new Set(logs.map((log) => log.playId))];
}

function getPrimaryAreaLabel(play: Play): string {
  return DEV_AREA_LABELS[play.devAreas[0] ?? "cognitive"];
}

function getMaterialFitScore(play: Play, selectedMaterials: MaterialSlug[]): number {
  const selectedMaterialsSet = new Set(selectedMaterials);
  const matchedRequired = play.materials.required.filter((material) => selectedMaterialsSet.has(material)).length;
  const matchedOptional = play.materials.optional.filter((material) => selectedMaterialsSet.has(material)).length;

  return matchedRequired * 100 + matchedOptional * 10 - play.prepTime;
}

function playMatchesAgeMonths(play: Play, childAgeMonths: number): boolean {
  return play.ageMin <= childAgeMonths && play.ageMax >= childAgeMonths;
}

function hasBlockedMaterial(play: Play, blockedMaterialsSet: Set<MaterialSlug>): boolean {
  return [
    ...play.materials.required,
    ...play.materials.optional,
    ...play.materials.substitutes,
  ].some((material) => blockedMaterialsSet.has(material));
}

function pickFeaturedPlay(plays: Play[], selectedMaterials: MaterialSlug[]): Play | null {
  if (plays.length === 0) {
    return null;
  }

  let bestPlay = plays[0];
  let bestScore = getMaterialFitScore(bestPlay, selectedMaterials);

  for (const candidate of plays.slice(1)) {
    const nextScore = getMaterialFitScore(candidate, selectedMaterials);

    if (nextScore > bestScore) {
      bestPlay = candidate;
      bestScore = nextScore;
    }
  }

  return bestPlay;
}

function getMaterialSummary(
  play: Play,
  ownedMaterialsSet: Set<MaterialSlug>,
): {
  detail: string;
  label: string;
  tone: MaterialTone;
} {
  const requiredCount = play.materials.required.length;
  const optionalCount = play.materials.optional.length;
  const totalCount = requiredCount + optionalCount;

  if (totalCount === 0) {
    return {
      label: "바로 가능",
      tone: "ready",
      detail: "준비물 없이 시작할 수 있어요",
    };
  }

  const ownedRequiredCount = play.materials.required.filter((material) => ownedMaterialsSet.has(material)).length;
  const missingRequiredCount = requiredCount - ownedRequiredCount;
  const ownedOptionalCount = play.materials.optional.filter((material) => ownedMaterialsSet.has(material)).length;
  const missingOptionalCount = optionalCount - ownedOptionalCount;

  if (missingRequiredCount === 0 && missingOptionalCount === 0) {
    return {
      label: "지금 가능",
      tone: "ready",
      detail: `준비물 ${totalCount}/${totalCount}개가 있어요`,
    };
  }

  if (missingRequiredCount === 0) {
    return {
      label: "시작 가능",
      tone: "ready",
      detail: `선택 재료 ${missingOptionalCount}개가 더 있으면 좋아요`,
    };
  }

  if (ownedRequiredCount > 0) {
    return {
      label: `${missingRequiredCount}개 필요`,
      tone: "partial",
      detail: `필수 재료 ${ownedRequiredCount}/${requiredCount}개를 갖고 있어요`,
    };
  }

  return {
    label: "재료 필요",
    tone: "missing",
    detail: `필수 재료 ${requiredCount}개를 준비해 주세요`,
  };
}

function getCompletionLabel(latestCompletedAt: string | undefined): string | null {
  if (!latestCompletedAt) {
    return null;
  }

  const completedDate = new Date(latestCompletedAt);

  if (!Number.isNaN(completedDate.getTime()) && isSameCalendarDay(completedDate, new Date())) {
    return "오늘 완료";
  }

  return formatCompletedAtLabel(latestCompletedAt);
}

function openPlayDetail(play: Play, selectedMaterials: MaterialSlug[], usedFallback: boolean) {
  router.push({
    pathname: "/(main)/play/[id]",
    params: {
      id: play.id,
      fallback: usedFallback ? "1" : "0",
      materials: selectedMaterials.join(","),
    },
  });
}

function ImageSlot({
  dimmed = false,
  index,
  large = false,
  playId,
}: {
  dimmed?: boolean;
  index: number;
  large?: boolean;
  playId?: string;
}) {
  const imageSource = playId ? getPlayImageSource(playId) : null;

  return (
    <View
      style={[
        styles.imageSlot,
        large && styles.imageSlotLarge,
        index % 4 === 0
          ? styles.imageSlotYellow
          : index % 4 === 1
            ? styles.imageSlotPink
            : index % 4 === 2
              ? styles.imageSlotMint
              : styles.imageSlotPurple,
      ]}
    >
      {imageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          blurRadius={dimmed ? 2 : 0}
          resizeMode="cover"
          source={imageSource}
          style={styles.playImage}
        />
      ) : (
        <>
          <View style={styles.imageShapeOne} />
          <View style={styles.imageShapeTwo} />
          <View style={styles.imageShapeThree} />
        </>
      )}
      {dimmed ? <View pointerEvents="none" style={styles.completedImageOverlay} /> : null}
    </View>
  );
}

function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: MaterialCommunityIconName;
  label: string;
  onPress?: () => void;
}) {
  const iconElement = <MaterialCommunityIcons name={icon} size={23} color={APP_COLORS.ink} />;

  if (!onPress) {
    return (
      <View accessibilityLabel={label} style={styles.headerIconButton}>
        {iconElement}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
    >
      {iconElement}
    </Pressable>
  );
}

function MaterialStatusPill({ tone, label }: { label: string; tone: MaterialTone }) {
  return (
    <View
      style={[
        styles.statusPill,
        tone === "ready"
          ? styles.statusPillReady
          : tone === "partial"
            ? styles.statusPillPartial
            : styles.statusPillMissing,
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          tone === "ready"
            ? styles.statusPillTextReady
            : tone === "partial"
              ? styles.statusPillTextPartial
              : styles.statusPillTextMissing,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function PlayCard({
  completedAt,
  favorite,
  index,
  materialSummary,
  onPress,
  play,
}: {
  completedAt?: string;
  favorite: boolean;
  index: number;
  materialSummary: ReturnType<typeof getMaterialSummary>;
  onPress: () => void;
  play: Play;
}) {
  const completionLabel = getCompletionLabel(completedAt);
  const isCompleted = completionLabel !== null;

  return (
    <MotionPressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.playCard, pressed && styles.pressed]}
    >
      <ImageSlot dimmed={isCompleted} index={index} playId={play.id} />
      <View style={styles.playCardBadge}>
        <Text style={styles.playCardBadgeText}>{play.ageMin}-{play.ageMax}개월</Text>
      </View>
      <Text style={styles.playCardTitle}>{play.name}</Text>
      <Text style={styles.playCardMeta}>#{getPrimaryAreaLabel(play)}</Text>
      <View style={styles.playCardFooter}>
        <MaterialStatusPill label={completionLabel ?? materialSummary.label} tone={completionLabel ? "ready" : materialSummary.tone} />
        <Text style={[styles.heartOutline, favorite && styles.heartFilled]}>{favorite ? "♥" : "♡"}</Text>
      </View>
    </MotionPressable>
  );
}

function SituationCard({
  icon,
  label,
  place,
  tone,
}: {
  icon: string;
  label: string;
  place: PlayPlace;
  tone: (typeof SITUATION_CARDS)[number]["tone"];
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/(main)/search",
          params: { label, place },
        })
      }
      style={({ pressed }) => [styles.situationCard, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.situationIcon,
          tone === "coral"
            ? styles.situationCoral
            : tone === "yellow"
              ? styles.situationYellow
              : styles.situationMint,
        ]}
      >
        <Text style={styles.situationIconText}>{icon}</Text>
      </View>
      <Text style={styles.situationLabel}>{label}</Text>
    </MotionPressable>
  );
}

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ completedPlayId?: string | string[] }>();
  const [returningCompletedPlayId, setReturningCompletedPlayId] = useState<string | null>(null);
  const [materialsEditorOpen, setMaterialsEditorOpen] = useState(false);
  const plays = usePlaysStore((state) => state.plays);
  const guestId = useSessionStore((state) => state.guestId);
  const childName = useSessionStore((state) => state.childName);
  const userContext = useSessionStore((state) => state.userContext);
  const todayMaterials = useSessionStore((state) => state.todayMaterials);
  const setTodayMaterials = useSessionStore((state) => state.setTodayMaterials);
  const pinnedRecommendationIds = useSessionStore((state) => state.pinnedHomeRecommendationIds);
  const pinnedRecommendationKey = useSessionStore((state) => state.pinnedHomeRecommendationKey);
  const setPinnedHomeRecommendations = useSessionStore((state) => state.setPinnedHomeRecommendations);
  const [totalPlays, setTotalPlays] = useState(0);
  const [recentLogs, setRecentLogs] = useState<PlayLogRecord[]>([]);
  const [favoritePlayIds, setFavoritePlayIds] = useState<Set<string>>(() => new Set());

  const baseMaterials = useMemo(
    () =>
      userContext.ownedMaterials.length > 0 ? userContext.ownedMaterials : ONBOARDING_DEFAULT_MATERIALS,
    [userContext.ownedMaterials],
  );
  const selectedMaterials = todayMaterials ?? baseMaterials;
  const selectedMaterialsSet = new Set<MaterialSlug>(selectedMaterials);
  const materialTileColumns = width >= 560 ? 4 : width < 330 ? 2 : 3;
  const materialTileContentWidth = width - 40 - 36;
  const materialTileWidth = Math.max(MATERIAL_TILE_MIN_WIDTH, Math.floor(
    (materialTileContentWidth - MATERIAL_TILE_GAP * (materialTileColumns - 1)) /
      materialTileColumns,
  ));
  const childAgeMonths =
    userContext.childBirthMonth === null
      ? null
      : getAgeMonthsFromBirthMonth(userContext.childBirthMonth);

  useEffect(() => {
    const completedPlayId = readParam(params.completedPlayId);

    if (completedPlayId) {
      setReturningCompletedPlayId(completedPlayId);
    }
  }, [params.completedPlayId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!guestId) {
        setTotalPlays(0);
        setRecentLogs([]);
        setFavoritePlayIds(new Set());
        return () => {
          active = false;
        };
      }

      void Promise.all([getPlayLogCount(guestId), getPlayLogs(guestId, 12), getFavorites(guestId, 200)])
        .then(([count, logs, favorites]) => {
          if (active) {
            setTotalPlays(count);
            setRecentLogs(logs);
            setFavoritePlayIds(new Set(favorites.map((favorite) => favorite.playId)));
          }
        })
        .catch(() => {
          if (active) {
            setTotalPlays(0);
            setRecentLogs([]);
            setFavoritePlayIds(new Set());
          }
        });

      return () => {
        active = false;
      };
    }, [guestId]),
  );

  const latestCompletedAtByPlayId = getLatestCompletedAtByPlayId(recentLogs);
  const recentCompletedPlayIds = getRecentCompletedPlayIds(recentLogs);

  const recommendation =
    childAgeMonths === null
      ? { results: [], usedFallback: false, appliedWeights: null }
      : recommend(
          plays,
          {
            childAgeMonths,
            availableMaterials: selectedMaterials,
            blockedMaterials: userContext.blockedMaterials,
            availableMinutes: 999,
            place: "any",
            devGaps: userContext.devGaps,
            userFeedback: userContext.userFeedback,
          },
          { totalPlays, recentCompletedPlayIds },
        );

  const recommendationPinKey = useMemo(
    () =>
      JSON.stringify({
        childAgeMonths,
        selectedMaterials,
        blockedMaterials: userContext.blockedMaterials,
        playCount: plays.length,
      }),
    [childAgeMonths, plays.length, selectedMaterials, userContext.blockedMaterials],
  );

  useEffect(() => {
    if (pinnedRecommendationKey === recommendationPinKey) {
      return;
    }

    void setPinnedHomeRecommendations({
      ids: recommendation.results.map((play) => play.id),
      key: recommendationPinKey,
    });
  }, [
    pinnedRecommendationKey,
    recommendation.results,
    recommendationPinKey,
    setPinnedHomeRecommendations,
  ]);

  const pinnedResults = useMemo(() => {
    if (pinnedRecommendationIds.length === 0) {
      return recommendation.results;
    }

    const playMap = new Map(plays.map((play) => [play.id, play]));
    const pinned = pinnedRecommendationIds
      .map((playId) => playMap.get(playId))
      .filter((play): play is Play => Boolean(play));

    if (pinned.length === 0) {
      return recommendation.results;
    }

    return mergeRecommendedPlays(pinned, recommendation.results, 3);
  }, [pinnedRecommendationIds, plays, recommendation.results]);

  const visibleRecommendations = useMemo(() => {
    if (!returningCompletedPlayId) {
      return pinnedResults;
    }

    const justCompletedPlay = plays.find((play) => play.id === returningCompletedPlayId);

    if (!justCompletedPlay || pinnedResults.some((play) => play.id === returningCompletedPlayId)) {
      return pinnedResults;
    }

    return [...pinnedResults.slice(0, 2), justCompletedPlay];
  }, [pinnedResults, plays, returningCompletedPlayId]);

  const featuredPlay = useMemo(
    () => pickFeaturedPlay(visibleRecommendations, selectedMaterials),
    [visibleRecommendations, selectedMaterials],
  );

  const ageMatchedOtherPlays = useMemo(() => {
    if (childAgeMonths === null) {
      return [];
    }

    const recommendedIds = new Set(visibleRecommendations.map((play) => play.id));
    const blockedMaterialsSet = new Set(userContext.blockedMaterials);

    return plays
      .filter((play) =>
        play.status === "live" &&
        playMatchesAgeMonths(play, childAgeMonths) &&
        !recommendedIds.has(play.id) &&
        !hasBlockedMaterial(play, blockedMaterialsSet),
      )
      .sort((left, right) => {
        const materialFitDiff =
          getMaterialFitScore(right, selectedMaterials) -
          getMaterialFitScore(left, selectedMaterials);

        if (materialFitDiff !== 0) {
          return materialFitDiff;
        }

        if (left.prepTime !== right.prepTime) {
          return left.prepTime - right.prepTime;
        }

        return left.name.localeCompare(right.name, "ko");
      })
      .slice(0, 8);
  }, [
    childAgeMonths,
    plays,
    selectedMaterials,
    userContext.blockedMaterials,
    visibleRecommendations,
  ]);

  const allRecommendedCompleted =
    visibleRecommendations.length > 0 &&
    visibleRecommendations.every((play) => latestCompletedAtByPlayId.has(play.id));

  const selectedMaterialsPreview =
    selectedMaterials.length === 0
      ? "선택 없음"
      : selectedMaterials
          .slice(0, 3)
          .map((material) => MATERIAL_DISPLAY_NAMES[material])
          .join(", ");

  const displayName = childName.trim().length > 0 ? childName.trim() : "오늘도";

  function toggleMaterial(material: MaterialSlug) {
    const nextMaterials = selectedMaterials.includes(material)
      ? selectedMaterials.filter((item) => item !== material)
      : [...selectedMaterials, material];

    setReturningCompletedPlayId(null);
    void setTodayMaterials(nextMaterials);
  }

  function clearMaterials() {
    setReturningCompletedPlayId(null);
    void setTodayMaterials([]);
  }

  return (
    <Animated.ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 18 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp()}
        layout={reduceMotion ? undefined : layoutTransition}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <View style={styles.avatarFace} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>
            {displayName} 육아하느라{"\n"}정말 수고했어요!
          </Text>
          <Text style={styles.headerDate}>{formatTodayLabel()}</Text>
        </View>
        <View style={styles.headerActions}>
          <HeaderIconButton icon="bell-outline" label="알림" />
          <HeaderIconButton
            icon="heart-outline"
            label="찜으로 이동"
            onPress={() => router.push("/(main)/favorites")}
          />
        </View>
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : fadeInUp(50)} style={styles.searchRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(main)/search")}
          style={({ pressed }) => [styles.searchBox, pressed && styles.pressed]}
        >
          <Text style={styles.searchIcon}>⌕</Text>
          <Text style={styles.searchPlaceholder}>놀이, 재료, 상황으로 검색해 보세요</Text>
        </Pressable>
        <MotionPressable
          accessibilityRole="button"
          accessibilityState={{ expanded: materialsEditorOpen }}
          onPress={() => setMaterialsEditorOpen((current) => !current)}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
        >
          <Text style={styles.filterButtonText}>☷</Text>
        </MotionPressable>
      </Animated.View>

      {materialsEditorOpen ? (
        <Animated.View
          entering={reduceMotion ? undefined : fadeInUp(60)}
          exiting={reduceMotion ? undefined : fadeOutDownSoft()}
          layout={reduceMotion ? undefined : layoutTransition}
          style={styles.materialPanel}
        >
          <View style={styles.materialPanelHeader}>
            <View style={styles.materialPanelCopy}>
              <Text style={styles.panelEyebrow}>오늘 재료</Text>
              <Text style={styles.panelTitle}>재료를 바꾸면 추천이 다시 맞춰져요</Text>
              <Text style={styles.panelBody}>
                {selectedMaterialsPreview}
                {selectedMaterials.length > 3 ? ` 외 ${selectedMaterials.length - 3}개` : ""}
              </Text>
            </View>
            <MotionPressable
              accessibilityRole="button"
              onPress={clearMaterials}
              style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
            >
              <Text style={styles.resetButtonText}>전체 해제</Text>
            </MotionPressable>
          </View>

          {visibleCategories.map((category) => (
            <View key={category.name} style={styles.materialCategory}>
              <Text style={styles.materialCategoryTitle}>{category.name}</Text>
              <View style={styles.materialChipRow}>
                {category.materials.map((material) => {
                  const active = selectedMaterials.includes(material);
                  const visual = getMaterialVisualSpec(material, category.name);

                  return (
                    <MotionPressable
                      key={material}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={`${MATERIAL_DISPLAY_NAMES[material]} 선택`}
                      onPress={() => toggleMaterial(material)}
                      style={({ pressed }) => [
                        styles.materialChip,
                        { width: materialTileWidth },
                        active && styles.materialChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.materialChipImageSlot}>
                        <Image
                          accessibilityIgnoresInvertColors
                          resizeMode="contain"
                          source={visual.imageSource}
                          style={styles.materialChipImage}
                        />
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[styles.materialChipText, active && styles.materialChipTextActive]}
                      >
                        {MATERIAL_DISPLAY_NAMES[material]}
                      </Text>
                      <View style={[styles.materialChipCheck, active && styles.materialChipCheckActive]}>
                        {active ? <Text style={styles.materialChipCheckText}>✓</Text> : null}
                      </View>
                    </MotionPressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp(100)}
        layout={reduceMotion ? undefined : layoutTransition}
      >
        <MotionPressable
          accessibilityRole="button"
          disabled={!featuredPlay}
          onPress={() => {
            if (featuredPlay) {
              openPlayDetail(featuredPlay, selectedMaterials, recommendation.usedFallback);
            }
          }}
          style={({ pressed }) => [styles.heroBanner, pressed && featuredPlay && styles.pressed]}
        >
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>오늘 뭐하지?</Text>
            <Text style={styles.heroTitle}>
              아이와 함께하는{"\n"}즐거운 <Text style={styles.heroAccent}>놀이 레시피</Text>
            </Text>
            <View style={styles.heroButton}>
              <Text style={styles.heroButtonText}>오늘의 추천 놀이 보기 ›</Text>
            </View>
          </View>
          <View style={styles.heroImageWrap}>
            <ImageSlot index={0} large playId={featuredPlay?.id} />
          </View>
        </MotionPressable>
      </Animated.View>

      {allRecommendedCompleted ? (
        <Animated.View
          entering={reduceMotion ? undefined : quickFadeIn(100)}
          layout={reduceMotion ? undefined : layoutTransition}
          style={styles.completionCard}
        >
          <Text style={styles.panelEyebrow}>TODAY 완료</Text>
          <Text style={styles.completionTitle}>오늘의 놀이를 모두 완료했어요</Text>
          <Text style={styles.panelBody}>재료를 바꾸면 새로운 추천 3개를 받을 수 있어요.</Text>
          <MotionPressable
            accessibilityRole="button"
            onPress={() => setMaterialsEditorOpen(true)}
            style={({ pressed }) => [styles.completionButton, pressed && styles.pressed]}
          >
            <Text style={styles.completionButtonText}>새 추천 받기</Text>
          </MotionPressable>
        </Animated.View>
      ) : null}

      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp(130)}
        layout={reduceMotion ? undefined : layoutTransition}
        style={styles.section}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘 바로 가능한 놀이</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(main)/search")}>
            <Text style={styles.sectionLink}>전체보기 ›</Text>
          </Pressable>
        </View>
        {visibleRecommendations.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.playCardRow}
          >
            {visibleRecommendations.map((play, index) => (
              <PlayCard
                key={play.id}
                completedAt={latestCompletedAtByPlayId.get(play.id)}
                favorite={favoritePlayIds.has(play.id)}
                index={index}
                materialSummary={getMaterialSummary(play, selectedMaterialsSet)}
                onPress={() => openPlayDetail(play, selectedMaterials, recommendation.usedFallback)}
                play={play}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>추천할 놀이를 준비 중이에요</Text>
            <Text style={styles.emptyBody}>아이 월령과 재료를 확인하면 바로 추천을 만들 수 있어요.</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp(160)}
        layout={reduceMotion ? undefined : layoutTransition}
        style={styles.section}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>아이 개월수에 맞는 다른 놀이</Text>
          {childAgeMonths !== null ? (
            <Text style={styles.sectionMeta}>{childAgeMonths}개월</Text>
          ) : null}
        </View>
        {ageMatchedOtherPlays.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.playCardRow}
          >
            {ageMatchedOtherPlays.slice(0, 6).map((play, index) => (
              <PlayCard
                key={play.id}
                completedAt={latestCompletedAtByPlayId.get(play.id)}
                favorite={favoritePlayIds.has(play.id)}
                index={index + 3}
                materialSummary={getMaterialSummary(play, selectedMaterialsSet)}
                onPress={() => openPlayDetail(play, selectedMaterials, false)}
                play={play}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>다른 놀이를 찾고 있어요</Text>
            <Text style={styles.emptyBody}>아이 월령에 맞는 놀이가 더 쌓이면 이곳에 보여드릴게요.</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp(190)}
        layout={reduceMotion ? undefined : layoutTransition}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>상황별 추천 놀이</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.situationRow}
        >
          {SITUATION_CARDS.map((card) => (
            <SituationCard key={card.label} {...card} />
          ))}
        </ScrollView>
      </Animated.View>

    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 22,
    paddingHorizontal: 20,
    paddingBottom: 34,
    backgroundColor: APP_COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#FFF0CD",
  },
  avatarFace: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#F5C3AD",
    borderWidth: 5,
    borderColor: APP_COLORS.surface,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: APP_COLORS.ink,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  headerDate: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBox: {
    minHeight: 60,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  searchIcon: {
    color: APP_COLORS.ink,
    fontSize: 27,
    lineHeight: 28,
  },
  searchPlaceholder: {
    flex: 1,
    color: "#9B9B9B",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  filterButton: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  filterButtonText: {
    color: APP_COLORS.ink,
    fontSize: 28,
    lineHeight: 30,
  },
  materialPanel: {
    gap: 16,
    padding: 18,
    borderRadius: 28,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  materialPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  materialPanelCopy: {
    flex: 1,
    gap: 4,
  },
  panelEyebrow: {
    color: "#D4A900",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  panelTitle: {
    color: APP_COLORS.ink,
    fontSize: 19,
    lineHeight: 25,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  panelBody: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  resetButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: APP_COLORS.card,
  },
  resetButtonText: {
    color: APP_COLORS.ink,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  materialCategory: {
    gap: 9,
  },
  materialCategoryTitle: {
    color: APP_COLORS.ink,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  materialChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: MATERIAL_TILE_GAP,
  },
  materialChip: {
    height: 112,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 7,
    borderRadius: 14,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  materialChipActive: {
    backgroundColor: APP_COLORS.card,
    borderColor: APP_COLORS.accent,
    ...APP_SHADOWS.control,
  },
  materialChipImageSlot: {
    width: "100%",
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: APP_COLORS.surface,
  },
  materialChipImage: {
    width: "100%",
    height: "100%",
  },
  materialChipText: {
    width: "100%",
    minHeight: 30,
    color: APP_COLORS.ink,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  materialChipTextActive: {
    color: APP_COLORS.accentText,
    fontWeight: "700",
  },
  materialChipCheck: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  materialChipCheckActive: {
    borderColor: APP_COLORS.accent,
    backgroundColor: APP_COLORS.accent,
  },
  materialChipCheckText: {
    color: APP_COLORS.surface,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  heroBanner: {
    minHeight: 250,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: "#FFF3CB",
    ...APP_SHADOWS.card,
  },
  heroCopy: {
    flex: 1.1,
    gap: 12,
    justifyContent: "center",
    paddingLeft: 24,
    paddingVertical: 24,
  },
  heroEyebrow: {
    color: APP_COLORS.ink,
    fontSize: 18,
    fontFamily: APP_FONTS.body,
    fontWeight: "500",
  },
  heroTitle: {
    color: APP_COLORS.ink,
    fontSize: 31,
    lineHeight: 42,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  heroAccent: {
    color: "#F2A218",
  },
  heroButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: APP_COLORS.surface,
  },
  heroButtonText: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  heroImageWrap: {
    flex: 0.95,
    justifyContent: "flex-end",
    paddingRight: 14,
    paddingBottom: 12,
  },
  completionCard: {
    gap: 10,
    padding: 20,
    borderRadius: 26,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  completionTitle: {
    color: APP_COLORS.ink,
    fontSize: 24,
    lineHeight: 31,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  completionButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
  completionButtonText: {
    color: APP_COLORS.accentText,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 23,
    lineHeight: 31,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  sectionLink: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  sectionMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  playCardRow: {
    gap: 16,
    paddingRight: 2,
  },
  playCard: {
    width: 190,
    gap: 9,
  },
  imageSlot: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: 22,
  },
  imageSlotLarge: {
    aspectRatio: 0.9,
    borderRadius: 28,
  },
  imageSlotYellow: {
    backgroundColor: "#FFEBA7",
  },
  imageSlotPink: {
    backgroundColor: "#FFE1E4",
  },
  imageSlotMint: {
    backgroundColor: "#DDF8EF",
  },
  imageSlotPurple: {
    backgroundColor: "#EEE4FF",
  },
  playImage: {
    width: "100%",
    height: "100%",
  },
  completedImageOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  imageShapeOne: {
    position: "absolute",
    right: -30,
    bottom: -32,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.56)",
  },
  imageShapeTwo: {
    position: "absolute",
    left: 22,
    bottom: 28,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.68)",
  },
  imageShapeThree: {
    position: "absolute",
    left: 52,
    top: 36,
    width: 74,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.48)",
    transform: [{ rotate: "-18deg" }],
  },
  playCardBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
  playCardBadgeText: {
    color: APP_COLORS.accentText,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  playCardTitle: {
    color: APP_COLORS.ink,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  playCardMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  playCardFooter: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillReady: {
    backgroundColor: APP_COLORS.sageSoft,
  },
  statusPillPartial: {
    backgroundColor: APP_COLORS.mustardSoft,
  },
  statusPillMissing: {
    backgroundColor: APP_COLORS.coralSoft,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  statusPillTextReady: {
    color: "#22765D",
  },
  statusPillTextPartial: {
    color: "#8A6800",
  },
  statusPillTextMissing: {
    color: "#A64F48",
  },
  heartOutline: {
    color: "#B5B5B5",
    fontSize: 25,
    lineHeight: 27,
  },
  heartFilled: {
    color: APP_COLORS.coral,
  },
  emptyCard: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  emptyTitle: {
    color: APP_COLORS.ink,
    fontSize: 18,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  emptyBody: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  situationRow: {
    gap: 14,
    paddingRight: 2,
  },
  situationCard: {
    width: 126,
    minHeight: 134,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 14,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  situationIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  situationCoral: {
    backgroundColor: APP_COLORS.coralSoft,
  },
  situationYellow: {
    backgroundColor: APP_COLORS.mustardSoft,
  },
  situationMint: {
    backgroundColor: APP_COLORS.sageSoft,
  },
  situationIconText: {
    color: APP_COLORS.ink,
    fontSize: 31,
    lineHeight: 34,
  },
  situationLabel: {
    color: APP_COLORS.ink,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.86,
  },
});
