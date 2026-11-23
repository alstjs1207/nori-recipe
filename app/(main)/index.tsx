import { useNativeScroll } from "@/navigation/useNativeScroll";
import { ContentImage as Image } from "@/components/web/ContentImage";
import { NewPlayBadge } from "@/components/NewPlayBadge";
import { WebFirstVisit } from "@/components/web/WebFirstVisit";
import { HomeRedesign } from "@/components/web/HomeRedesign";
import { IntentReadinessPanel } from "@/components/IntentReadinessPanel";
import { useContentDimensions } from "@/hooks/useContentDimensions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { appRuntime } from "@/platform/runtime";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { appRouter as router } from "@/navigation/router";
import { useFocusEffect } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { fadeInUp, fadeOutDownSoft, layoutTransition } from "@/animations/motion";
import { MotionPressable } from "@/components/motion/MotionPressable";
import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { MATERIAL_DISPLAY_NAMES, type MaterialSlug } from "@/constants/materials";
import { getMaterialVisualSpec } from "@/constants/materialVisuals";
import { getPlayThumbnailSource } from "@/constants/playImages";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getFavorites, getPlayLogCount, getPlayLogs, getPlayLogsByIds } from "@/db/queries";
import { recommend } from "@/engine/recommend";
import { homeCompletionCelebration } from "@/engine/homeCompletion";
import { createMaterialComparator, getMaterialRecommendationNotice, pickFeaturedPlay } from "@/engine/materialFit";
import { getConditionalIntentCandidates, getConditionalRecommendationNotice, getIntentConfirmationKey, isEligibleHomeRecommendation, readinessAllowsPlay } from "@/engine/intentRecommendation";
import { isReadyIntentMatch } from "@/engine/intentSignals";
import {
  getAgeMonthsFromBirthMonth,
  getVisibleMaterialCategories,
  ONBOARDING_DEFAULT_MATERIALS,
} from "@/onboarding/utils";
import { usePlaysStore } from "@/store/playsStore";
import { useHomeRecommendationStore } from "@/store/homeRecommendationStore";
import { getHomeRoundRecords } from "@/store/homeRecommendationRound";
import { useSessionStore } from "@/store/sessionStore";
import type { FilterInput, IntentReadiness, Play, PlayLogRecord, PlayPlace } from "@/types";

type MaterialTone = "ready" | "partial" | "missing";

const SITUATION_CARDS = [
  { label: "집콕 놀이", icon: "⌂", place: "indoor", tone: "coral" },
  { label: "밖에서 놀 때", icon: "☀", place: "outdoor", tone: "yellow" },
  { label: "어디서나", icon: "○", place: "any", tone: "mint" },
] as const;

const visibleCategories = getVisibleMaterialCategories();
const MATERIAL_TILE_GAP = 8;
const MATERIAL_TILE_MIN_WIDTH = 76;
const PLAY_CARD_ROW_GAP = 12;
const PLAY_CARD_MIN_WIDTH = 154;
const PLAY_CARD_MAX_WIDTH = 184;

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

function formatPlayCardTitle(name: string): string {
  return name.replaceAll("·", "·\u200B");
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
  const imageSource = playId ? getPlayThumbnailSource(playId) : null;

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
      {dimmed ? <View pointerEvents="none" style={[styles.completedImageOverlay, { alignItems: "center", justifyContent: "center" }]}><View style={styles.nativeStamp}><MaterialCommunityIcons name="flower" size={25} color={APP_COLORS.ink} /><Text style={styles.nativeStampText}>참 잘했어요{`\n`}놀이 완료</Text></View></View> : null}
    </View>
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
  cardWidth,
  completedAt,
  favorite,
  index,
  materialSummary,
  onPress,
  play,
}: {
  cardWidth: number;
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
      style={({ pressed }) => [styles.playCard, { width: cardWidth }, pressed && styles.pressed]}
    >
      <ImageSlot dimmed={isCompleted} index={index} playId={play.id} />
      <View style={styles.playCardBadge}>
        <Text style={styles.playCardBadgeText}>{play.ageMin}-{play.ageMax}개월</Text>
      </View>
      <Text numberOfLines={2} style={styles.playCardTitle}>{formatPlayCardTitle(play.name)}</Text>
      <View style={styles.playCardMetaRow}>
        <Text style={styles.playCardMeta}>#{getPrimaryAreaLabel(play)}</Text>
        <NewPlayBadge createdAt={play.createdAt} />
      </View>
      <View style={styles.playCardFooter}>
        <MaterialStatusPill label={completionLabel ?? materialSummary.label} tone={completionLabel ? "ready" : materialSummary.tone} />
        <MaterialCommunityIcons
          name={favorite ? "heart" : "heart-outline"}
          size={24}
          color={favorite ? APP_COLORS.coral : "#B5B5B5"}
          style={styles.favoriteIcon}
        />
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
          params: { label, place, reset: "1" },
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
  const scroll = useNativeScroll();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width } = useContentDimensions();
  const compactWebHero = Platform.OS === "web" && width < 400;
  const [materialsEditorOpen, setMaterialsEditorOpen] = useState(false);
  const plays = usePlaysStore((state) => state.plays);
  const guestId = useSessionStore((state) => state.guestId);
  const childName = useSessionStore((state) => state.childName);
  const userContext = useSessionStore((state) => state.userContext);
  const todayMaterials = useSessionStore((state) => state.todayMaterials);
  const setTodayMaterials = useSessionStore((state) => state.setTodayMaterials);
  const round = useHomeRecommendationStore((state) => state.round);
  const updatingRecommendations = useSessionStore((state) => state.updatingHomeRecommendations);
  const pinnedRecommendationIds = round?.ids ?? [];
  const pinnedRecommendationKey = round?.key ?? null;
  const setPinnedHomeRecommendations = useSessionStore((state) => state.setPinnedHomeRecommendations);
  const homeIntentConfirmation = useSessionStore((state) => state.homeIntentConfirmation);
  const setHomeIntentConfirmation = useSessionStore((state) => state.setHomeIntentConfirmation);
  const [totalPlays, setTotalPlays] = useState(0);
  const [recentLogs, setRecentLogs] = useState<PlayLogRecord[]>([]);
  const [roundLogs, setRoundLogs] = useState<PlayLogRecord[]>([]);
  const [loadedRoundKey, setLoadedRoundKey] = useState<string | null>(null);
  const [celebrateCompletion, setCelebrateCompletion] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [favoritePlayIds, setFavoritePlayIds] = useState<Set<string>>(() => new Set());

  const baseMaterials = useMemo(
    () =>
      userContext.ownedMaterials.length > 0 ? userContext.ownedMaterials : ONBOARDING_DEFAULT_MATERIALS,
    [userContext.ownedMaterials],
  );
  const selectedMaterials = todayMaterials ?? baseMaterials;
  const selectedMaterialsSet = new Set<MaterialSlug>(selectedMaterials);
  const contentWidth = width - 40;
  const minPlayCardWidth = width < 360 ? 138 : PLAY_CARD_MIN_WIDTH;
  const playCardWidth = Math.min(
    PLAY_CARD_MAX_WIDTH,
    Math.max(minPlayCardWidth, Math.floor((contentWidth - PLAY_CARD_ROW_GAP) / 2)),
  );
  const materialTileColumns = width >= 680 ? 4 : width >= 360 ? 3 : 2;
  const materialTileContentWidth = contentWidth - 42;
  const materialTileWidth = Math.max(MATERIAL_TILE_MIN_WIDTH, Math.floor(
    (materialTileContentWidth - MATERIAL_TILE_GAP * (materialTileColumns - 1)) /
      materialTileColumns,
  ));
  const childAgeMonths =
    userContext.childBirthMonth === null
      ? null
      : getAgeMonthsFromBirthMonth(userContext.childBirthMonth);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const focusedRound = useHomeRecommendationStore.getState().round;
      setCelebrateCompletion(false);

      if (!guestId) {
        setTotalPlays(0);
        setRecentLogs([]);
        setFavoritePlayIds(new Set());
        return () => {
          active = false;
        };
      }

      void Promise.all([
        getPlayLogCount(guestId),
        getPlayLogs(guestId, Platform.OS === "web" ? 10000 : 12),
        getFavorites(guestId, 200),
        getPlayLogsByIds(guestId, focusedRound?.records.map(record => record.id) ?? []),
      ])
        .then(([count, logs, favorites, assignedLogs]) => {
          if (active) {
            setTotalPlays(count);
            setRecentLogs(logs);
            const completed = getHomeRoundRecords(focusedRound, guestId, assignedLogs);
            setRoundLogs(completed);
            setLoadedRoundKey(`${focusedRound?.id}:${focusedRound?.revision ?? 0}`);
            setCelebrateCompletion(homeCompletionCelebration.consume(guestId, focusedRound?.ids ?? [], completed, focusedRound?.id ?? null));
            setFavoritePlayIds(new Set(favorites.map((favorite) => favorite.playId)));
            appRuntime.completionAd?.home(focusedRound?.ids ?? [], completed);
          }
        })
        .catch(() => {
          if (active) {
            homeCompletionCelebration.consume(guestId, [], [], focusedRound?.id ?? null);
            setRoundLogs([]);
            setTotalPlays(0);
            setRecentLogs([]);
            setFavoritePlayIds(new Set());
          }
        });

      return () => {
        active = false;
        // Leaving before the history read finishes must not defer the effect
        // until a later visit to home.
        homeCompletionCelebration.consume(guestId, [], [], focusedRound?.id ?? null);
        setCelebrateCompletion(false);
      };
    }, [guestId, round?.id, round?.revision]),
  );

  const latestCompletedAtByPlayId = getLatestCompletedAtByPlayId(getHomeRoundRecords(round, guestId, roundLogs));
  const recentCompletedPlayIds = getRecentCompletedPlayIds(recentLogs.slice(0, 12));

  const confirmationKey = childAgeMonths === null ? null : getIntentConfirmationKey({ childAgeMonths, availableMaterials: selectedMaterials, blockedMaterials: userContext.blockedMaterials });
  const intentReadiness = homeIntentConfirmation?.key === confirmationKey ? homeIntentConfirmation?.readiness : undefined;
  const filterInput: FilterInput = {
    childAgeMonths: childAgeMonths ?? 0,
    availableMaterials: selectedMaterials,
    blockedMaterials: userContext.blockedMaterials,
    availableMinutes: 999,
    place: "any",
    devGaps: userContext.devGaps,
    userFeedback: userContext.userFeedback,
    intentReadiness,
  };
  const potentialConditionalCandidate = childAgeMonths === null ? undefined : getConditionalIntentCandidates(plays, filterInput)[0];
  const onConfirmIntent = async (readiness: IntentReadiness | null) => {
    await setHomeIntentConfirmation(readiness && confirmationKey ? { key: confirmationKey, readiness } : null);
  };
  const recommendation =
    childAgeMonths === null
      ? { results: [], usedFallback: false, appliedWeights: null }
      : recommend(
          plays,
          filterInput,
          { totalPlays, recentCompletedPlayIds },
        );
  const conditionalCandidate = intentReadiness || recommendation.results.filter((p) => p.ageMin <= (childAgeMonths ?? 0) && isReadyIntentMatch(p, selectedMaterials)).length < 3
    ? potentialConditionalCandidate : undefined;

  const recommendationPinKey = useMemo(
    () =>
      JSON.stringify({
        childAgeMonths,
        selectedMaterials,
        blockedMaterials: userContext.blockedMaterials,
        playCount: plays.length,
        ...(intentReadiness ? { intentConfirmation: confirmationKey } : {}),
      }),
    [childAgeMonths, plays.length, selectedMaterials, userContext.blockedMaterials, intentReadiness, confirmationKey],
  );

  const pinnedResults = useMemo(() => {
    if (pinnedRecommendationIds.length === 0) {
      return recommendation.results;
    }

    const playMap = new Map(plays.map((play) => [play.id, play]));
    const completedIds = new Set(getHomeRoundRecords(round, guestId, roundLogs).map(log => log.playId));
    const pinned = pinnedRecommendationIds
      .map((playId) => playMap.get(playId))
      .filter((play): play is Play => Boolean(play && (isEligibleHomeRecommendation(play, filterInput) ||
        (completedIds.has(play.id) && play.status === "live" && !hasBlockedMaterial(play, new Set(userContext.blockedMaterials)) && play.ageMax >= (childAgeMonths ?? 0) && play.ageMin <= (childAgeMonths ?? 0) + 3))));

    if (pinned.length === 0) {
      return recommendation.results;
    }

    return mergeRecommendedPlays(pinned, recommendation.results, 3);
  }, [pinnedRecommendationIds, pinnedRecommendationKey, recommendationPinKey, plays, recommendation.results, childAgeMonths, selectedMaterials, userContext.blockedMaterials, intentReadiness, roundLogs]);

  useEffect(() => {
    // Age/content changes repair only ineligible items. Explicit new rounds
    // already have empty IDs; neither midnight nor ordinary re-ranking resets progress.
    if (!updatingRecommendations && round && loadedRoundKey === `${round.id}:${round.revision ?? 0}` && (pinnedRecommendationKey !== recommendationPinKey || pinnedResults.map((p) => p.id).join(",") !== pinnedRecommendationIds.join(","))) {
      void setPinnedHomeRecommendations({ ids: pinnedResults.map((p) => p.id), key: recommendationPinKey, roundId: round.id, revision: round.revision ?? 0 })
        .then(() => setPinError(null)).catch(() => setPinError("추천을 저장하지 못했어요. 다시 시도해 주세요."));
    }
  }, [pinnedRecommendationIds, pinnedRecommendationKey, pinnedResults, recommendationPinKey, setPinnedHomeRecommendations, updatingRecommendations, round?.id, round?.revision, loadedRoundKey]);

  const visibleRecommendations = pinnedResults;

  const featuredPlay = useMemo(
    () => pickFeaturedPlay(visibleRecommendations, selectedMaterials, childAgeMonths ?? undefined),
    [visibleRecommendations, selectedMaterials, childAgeMonths],
  );

  const ageMatchedOtherPlays = useMemo(() => {
    if (childAgeMonths === null) {
      return [];
    }

    const recommendedIds = new Set(visibleRecommendations.map((play) => play.id));
    const blockedMaterialsSet = new Set(userContext.blockedMaterials);
    const compareMaterials = createMaterialComparator(selectedMaterials);

    return plays
      .filter((play) =>
        play.status === "live" &&
        playMatchesAgeMonths(play, childAgeMonths) &&
        !recommendedIds.has(play.id) &&
        !hasBlockedMaterial(play, blockedMaterialsSet),
      )
      .sort((left, right) => {
        const materialFitDiff = compareMaterials(left, right);

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
    visibleRecommendations.length === 3 &&
    visibleRecommendations.every((play) => latestCompletedAtByPlayId.has(play.id));

  const selectedMaterialsPreview =
    selectedMaterials.length === 0
      ? "선택 없음"
      : selectedMaterials
          .slice(0, 3)
          .map((material) => MATERIAL_DISPLAY_NAMES[material])
          .join(", ");

  const childDisplayName = childName.trim();
  const displayName = childDisplayName.length > 0 ? childDisplayName : "오늘도";
  const avatarInitial = childDisplayName.length > 0 ? childDisplayName.slice(0, 1) : null;

  function toggleMaterial(material: MaterialSlug) {
    const nextMaterials = selectedMaterials.includes(material)
      ? selectedMaterials.filter((item) => item !== material)
      : [...selectedMaterials, material];

    void setTodayMaterials(nextMaterials).catch(() => setPinError("재료를 저장하지 못했어요. 다시 시도해 주세요."));
  }

  function clearMaterials() {
    void setTodayMaterials([]).catch(() => setPinError("재료를 저장하지 못했어요. 다시 시도해 주세요."));
  }

  if (Platform.OS === "web" && childAgeMonths === null) {
    return <WebFirstVisit />;
  }

  if (Platform.OS === "web" && childAgeMonths !== null) {
    const webFeatured = pickFeaturedPlay(pinnedResults, selectedMaterials, childAgeMonths);
    return (
      <HomeRedesign
        featured={webFeatured}
        recommendations={pinnedResults}
        otherPlays={ageMatchedOtherPlays.filter(
          (play) => !pinnedResults.some((recommended) => recommended.id === play.id),
        )}
        selectedMaterials={selectedMaterials}
        completedDates={latestCompletedAtByPlayId}
        recommendationError={pinError}
        onRetryRecommendations={() => {
          if (!round) return;
          void setPinnedHomeRecommendations({ ids: pinnedResults.map(play => play.id), key: recommendationPinKey, roundId: round.id, revision: round.revision ?? 0 })
            .then(() => setPinError(null)).catch(() => setPinError("추천을 저장하지 못했어요. 다시 시도해 주세요."));
        }}
        celebrateCompletion={celebrateCompletion}
        allCompleted={pinnedResults.length === 3 && pinnedResults.every(
          (play) => latestCompletedAtByPlayId.has(play.id),
        )}
        age={childAgeMonths}
        intentOptions={conditionalCandidate ? (
          <IntentReadinessPanel key={confirmationKey} candidate={conditionalCandidate} materials={selectedMaterials}
            confirmed={readinessAllowsPlay(conditionalCandidate, filterInput)} onChange={onConfirmIntent} />
        ) : null}
        onSaveMaterials={async (materials) => {
          await setTodayMaterials(materials);
        }}
      />
    );
  }

  return (
    <Animated.ScrollView
      {...scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 18 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp()}
        layout={reduceMotion ? undefined : layoutTransition}
        style={styles.header}
      >
        <View
          accessibilityLabel={`${displayName} 아이 아바타`}
          accessibilityRole="image"
          style={styles.avatar}
        >
          {avatarInitial ? (
            <Text style={styles.avatarInitial}>{avatarInitial}</Text>
          ) : (
            <MaterialCommunityIcons
              name="baby-face-outline"
              size={32}
              color={APP_COLORS.accentText}
            />
          )}
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>
            {displayName} 육아하느라{"\n"}정말 수고했어요!
          </Text>
          <Text style={styles.headerDate}>{formatTodayLabel()}</Text>
          {childAgeMonths !== null ? (
            <Text style={styles.headerDate}>{childAgeMonths}개월 아이에게 맞춘 놀이</Text>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : fadeInUp(50)} style={styles.searchRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(main)/search")}
          style={({ pressed }) => [styles.searchBox, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="magnify" size={25} color="#6F6A61" style={styles.searchIcon} />
          <Text numberOfLines={Platform.OS === "web" ? 1 : undefined} style={styles.searchPlaceholder}>
            {Platform.OS === "web" ? "놀이·재료 검색" : "놀이, 재료, 상황으로 검색해 보세요"}
          </Text>
        </Pressable>
        <MotionPressable
          accessibilityLabel="오늘 재료 설정"
          accessibilityRole="button"
          accessibilityState={{ expanded: materialsEditorOpen }}
          onPress={() => setMaterialsEditorOpen((current) => !current)}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="tune-variant" size={26} color={APP_COLORS.ink} style={styles.filterButtonIcon} />
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
                      disabled={updatingRecommendations}
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

      <View style={styles.nativeChallenge}>
        <View style={styles.sectionHeader}>
          <View><Text style={styles.panelEyebrow}>이번 놀이 도전</Text><Text style={styles.nativeChallengeTitle}>{allRecommendedCompleted ? "세 가지 놀이 완성!" : "놀이 3개, 함께해봐요"}</Text></View>
          <Text style={styles.nativeChallengeCount}>{visibleRecommendations.filter(play => latestCompletedAtByPlayId.has(play.id)).length} / 3</Text>
        </View>
        <Text style={styles.nativeChallengeNote}>{allRecommendedCompleted ? "다음 놀이를 시작해도 완성한 묶음은 기록에 남아요." : latestCompletedAtByPlayId.size ? `재료를 바꿔도 완료한 ${latestCompletedAtByPlayId.size}개는 그대로 이어가요.` : "재료를 바꾸면 놀이 3개를 다시 추천해요."}</Text>
        {allRecommendedCompleted ? <Pressable accessibilityRole="button" onPress={() => router.push("/(main)/record")}><Text style={styles.sectionLink}>완성한 놀이 보기 ›</Text></Pressable> : null}
      </View>
      {featuredPlay ? <MotionPressable accessibilityRole="button" onPress={() => openPlayDetail(featuredPlay, selectedMaterials, recommendation.usedFallback)} style={styles.nativeFeatured}>
        <ImageSlot index={0} playId={featuredPlay.id} dimmed={latestCompletedAtByPlayId.has(featuredPlay.id)} />
        <View style={styles.nativeFeaturedCopy}><Text style={styles.nativeChallengeNote}>오늘의 추천 놀이</Text><Text style={styles.sectionTitle}>{featuredPlay.name}</Text><Text style={styles.nativeChallengeNote}>{formatDuration(featuredPlay)} · {getPrimaryAreaLabel(featuredPlay)}</Text></View>
      </MotionPressable> : null}

      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp(130)}
        layout={reduceMotion ? undefined : layoutTransition}
        style={styles.section}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>함께 추천하는 놀이</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(main)/search")}>
            <Text style={styles.sectionLink}>전체보기 ›</Text>
          </Pressable>
        </View>
        {pinError ? <Text style={styles.panelBody} accessibilityRole="alert">{pinError}</Text> : null}
        {conditionalCandidate ? (
          <IntentReadinessPanel key={confirmationKey} candidate={conditionalCandidate} materials={selectedMaterials}
            confirmed={readinessAllowsPlay(conditionalCandidate, filterInput)} onChange={onConfirmIntent} />
        ) : null}
        {childAgeMonths !== null && getConditionalRecommendationNotice(visibleRecommendations, selectedMaterials, childAgeMonths) ? (
          <Text style={styles.panelBody}>{getConditionalRecommendationNotice(visibleRecommendations, selectedMaterials, childAgeMonths)}</Text>
        ) : null}
        {getMaterialRecommendationNotice(visibleRecommendations, selectedMaterials) ? (
          <Text style={styles.panelBody} accessibilityLiveRegion="polite">
            {getMaterialRecommendationNotice(visibleRecommendations, selectedMaterials)}
          </Text>
        ) : null}
        {visibleRecommendations.length > 0 ? (
          <View style={styles.nativeCompanions}>
            {visibleRecommendations.filter(play => play.id !== featuredPlay?.id).map((play, index) => (
              <PlayCard
                key={play.id}
                cardWidth={playCardWidth}
                completedAt={latestCompletedAtByPlayId.get(play.id)}
                favorite={favoritePlayIds.has(play.id)}
                index={index}
                materialSummary={getMaterialSummary(play, selectedMaterialsSet)}
                onPress={() => openPlayDetail(play, selectedMaterials, recommendation.usedFallback)}
                play={play}
              />
            ))}
          </View>
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
                cardWidth={playCardWidth}
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
  nativeChallenge: { padding: 14, gap: 7, borderRadius: 14, backgroundColor: APP_COLORS.card },
  nativeChallengeTitle: { fontSize: 14, color: APP_COLORS.ink, fontFamily: APP_FONTS.heading },
  nativeChallengeCount: { fontSize: 24, color: APP_COLORS.ink, fontFamily: APP_FONTS.heading },
  nativeChallengeNote: { fontSize: 12, color: APP_COLORS.muted, fontFamily: APP_FONTS.body },
  nativeFeatured: { gap: 12, paddingBottom: 15, backgroundColor: APP_COLORS.surface, borderRadius: 22, overflow: "hidden" },
  nativeFeaturedCopy: { paddingHorizontal: 14, gap: 7 },
  nativeCompanions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  nativeStamp: { width: 92, height: 92, alignItems: "center", justifyContent: "center", borderRadius: 46, borderWidth: 1.5, borderColor: APP_COLORS.ink, backgroundColor: APP_COLORS.card, transform: [{ rotate: "-10deg" }] },
  nativeStampText: { textAlign: "center", fontSize: 12, color: APP_COLORS.ink, lineHeight: 17, fontFamily: APP_FONTS.heading },
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
    backgroundColor: APP_COLORS.mustardSoft,
    borderWidth: 1,
    borderColor: "#F2DE9C",
    ...APP_SHADOWS.control,
  },
  avatarInitial: {
    color: APP_COLORS.accentText,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
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
    width: 26,
    textAlign: "center",
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
  filterButtonIcon: {
    width: 28,
    textAlign: "center",
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
    height: 104,
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
    minHeight: 28,
    color: APP_COLORS.ink,
    fontSize: 10,
    lineHeight: 14,
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
    flex: 0.9,
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
    fontSize: 28,
    lineHeight: 36,
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
    flex: 1.08,
    justifyContent: "flex-end",
    paddingRight: 14,
    paddingBottom: 12,
  },
  heroBannerCompact: {
    minHeight: 210,
  },
  heroCopyCompact: {
    flex: 1.15,
    paddingLeft: 18,
    paddingVertical: 18,
  },
  heroTitleCompact: {
    fontSize: 22,
    lineHeight: 30,
  },
  heroButtonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  heroButtonTextCompact: {
    fontSize: 12,
  },
  heroImageWrapCompact: {
    flex: 1,
    paddingRight: 10,
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
    gap: PLAY_CARD_ROW_GAP,
    paddingRight: 2,
  },
  playCard: {
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
    minHeight: 44,
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  playCardMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  playCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
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
  favoriteIcon: {
    width: 25,
    textAlign: "center",
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
