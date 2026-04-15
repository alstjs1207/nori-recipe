import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MATERIAL_DISPLAY_NAMES, type MaterialSlug } from "@/constants/materials";
import { DEV_AREA_LABELS, DEV_AREA_THEME } from "@/constants/devAreas";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getPlayLogCount } from "@/db/queries";
import { recommend } from "@/engine/recommend";
import {
  ONBOARDING_DEFAULT_MATERIALS,
  getAgeMonthsFromBirthMonth,
} from "@/onboarding/utils";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";

const TIME_OPTIONS = [
  { label: "10분", value: 10 },
  { label: "30분", value: 30 },
  { label: "1시간+", value: 60 },
] as const;
const PLACE_OPTIONS = [
  { label: "실내", value: "indoor" },
  { label: "실외", value: "outdoor" },
] as const;
const AUTO_APPLY_DELAY_MS = 180;

type SearchFilters = {
  place: (typeof PLACE_OPTIONS)[number]["value"];
  minutes: (typeof TIME_OPTIONS)[number]["value"];
  materials: MaterialSlug[];
};

function createDefaultFilters(materials: MaterialSlug[]): SearchFilters {
  return {
    place: "indoor",
    minutes: 30,
    materials,
  };
}

function syncMaterialSelection(filters: SearchFilters, materials: MaterialSlug[]): SearchFilters {
  const nextMaterials = materials.filter((material) => filters.materials.includes(material));

  return {
    ...filters,
    materials: nextMaterials.length > 0 ? nextMaterials : materials,
  };
}

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const plays = usePlaysStore((state) => state.plays);
  const guestId = useSessionStore((state) => state.guestId);
  const childName = useSessionStore((state) => state.childName);
  const userContext = useSessionStore((state) => state.userContext);
  const registeredMaterials =
    userContext.ownedMaterials.length > 0 ? userContext.ownedMaterials : ONBOARDING_DEFAULT_MATERIALS;
  const scrollRef = useRef<ScrollView>(null);
  const childAgeMonths =
    userContext.childBirthMonth === null
      ? null
      : getAgeMonthsFromBirthMonth(userContext.childBirthMonth);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(() =>
    createDefaultFilters(registeredMaterials),
  );
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(() =>
    createDefaultFilters(registeredMaterials),
  );
  const [resultsAnchorY, setResultsAnchorY] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);

  useEffect(() => {
    setDraftFilters((current) => syncMaterialSelection(current, registeredMaterials));
    setAppliedFilters((current) => syncMaterialSelection(current, registeredMaterials));
  }, [registeredMaterials]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAppliedFilters(draftFilters);
    }, AUTO_APPLY_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [draftFilters]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!guestId) {
        setTotalPlays(0);
        return () => {
          active = false;
        };
      }

      void getPlayLogCount(guestId)
        .then((count) => {
          if (active) {
            setTotalPlays(count);
          }
        })
        .catch(() => {
          if (active) {
            setTotalPlays(0);
          }
        });

      return () => {
        active = false;
      };
    }, [guestId]),
  );

  function setPlace(place: SearchFilters["place"]) {
    setDraftFilters((current) => ({ ...current, place }));
  }

  function setMinutes(minutes: SearchFilters["minutes"]) {
    setDraftFilters((current) => ({ ...current, minutes }));
  }

  function toggleMaterial(material: MaterialSlug) {
    setDraftFilters((current) => ({
      ...current,
      materials: current.materials.includes(material)
        ? current.materials.filter((item) => item !== material)
        : [...current.materials, material],
    }));
  }

  function applyFilters(nextFilters = draftFilters, scrollToResults = false) {
    setAppliedFilters(nextFilters);

    if (scrollToResults) {
      scrollRef.current?.scrollTo({ y: Math.max(resultsAnchorY - 16, 0), animated: true });
    }
  }

  function resetMaterialFilters() {
    const nextFilters = {
      ...draftFilters,
      materials: registeredMaterials,
    };

    setDraftFilters((current) => ({
      ...current,
      materials: registeredMaterials,
    }));

    applyFilters(nextFilters);
  }

  const recommendation =
    childAgeMonths === null
      ? { results: [], usedFallback: false, appliedWeights: null }
      : recommend(
          plays,
          {
            childAgeMonths,
            availableMaterials: appliedFilters.materials,
            blockedMaterials: userContext.blockedMaterials,
            availableMinutes: appliedFilters.minutes,
            place: appliedFilters.place,
            devGaps: userContext.devGaps,
            userFeedback: userContext.userFeedback,
          },
          { totalPlays },
        );

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.filterPanel}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>오늘의 놀이 찾기</Text>
          <Text style={styles.title}>
            {childName ? `${childName}에게 맞춘` : "지금 바로 가능한"} 추천을 골라보세요.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>장소</Text>
          <View style={styles.optionRow}>
            {PLACE_OPTIONS.map((option) => (
              <ChipButton
                key={option.value}
                active={draftFilters.place === option.value}
                label={option.label}
                onPress={() => setPlace(option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>가능 시간</Text>
          <View style={styles.optionRow}>
            {TIME_OPTIONS.map((option) => (
              <ChipButton
                key={option.value}
                active={draftFilters.minutes === option.value}
                label={option.label}
                onPress={() => setMinutes(option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오늘 사용할 재료</Text>
          <View style={styles.materialRow}>
            {registeredMaterials.map((material) => (
              <ChipButton
                key={material}
                active={draftFilters.materials.includes(material)}
                label={MATERIAL_DISPLAY_NAMES[material]}
                onPress={() => toggleMaterial(material)}
                compact
              />
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => applyFilters(draftFilters, true)}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.primaryButtonText}>놀이 찾기</Text>
        </Pressable>
      </View>

      <View onLayout={(event) => setResultsAnchorY(event.nativeEvent.layout.y)} style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>추천 결과</Text>
        <Text style={styles.resultsMeta}>
          {appliedFilters.place === "indoor" ? "실내" : "실외"} · {appliedFilters.minutes}분 · 재료{" "}
          {appliedFilters.materials.length}개 기준
        </Text>
      </View>

      {childAgeMonths !== null && childAgeMonths <= 5 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            이 월령대는 준비된 놀이가 적을 수 있어요. 비슷한 감각·교감 놀이까지 함께 넓혀서
            보여드릴게요.
          </Text>
        </View>
      ) : null}

      {recommendation.results.length > 0 ? (
        recommendation.results.map((play, index) => (
          <Pressable
            key={play.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/(main)/play/[id]",
                params: {
                  id: play.id,
                  fallback: recommendation.usedFallback ? "1" : "0",
                },
              })
            }
            style={({ pressed }) => [
              styles.card,
              index === 0 && styles.cardTopRank,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.rankLabel}>{index + 1}순위</Text>
              {recommendation.usedFallback ? (
                <View style={styles.fallbackBadge}>
                  <Text style={styles.fallbackBadgeText}>재료 대체</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.playName}>{play.name}</Text>
            <Text style={styles.meta}>
              {play.durationMin}-{play.durationMax}분 ·{" "}
              {play.place === "indoor" ? "실내" : play.place === "outdoor" ? "실외" : "어디서나"}
            </Text>
            <View style={styles.tagRow}>
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
          </Pressable>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>조건에 맞는 놀이가 없어요</Text>
          <Text style={styles.emptyBody}>
            오늘 사용할 재료를 조금 더 넓혀보거나 실내·실외 조건을 바꿔서 다시 찾아보세요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={resetMaterialFilters}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>재료 조건 완화해서 찾기</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

type ChipButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
  compact?: boolean;
};

function ChipButton({ active, label, onPress, compact = false }: ChipButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 18,
    backgroundColor: APP_COLORS.background,
  },
  filterPanel: {
    gap: 18,
    padding: 20,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.cardLifted,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    color: APP_COLORS.accent,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: APP_FONTS.mono,
    fontWeight: "700",
  },
  title: {
    color: APP_COLORS.ink,
    fontSize: 28,
    lineHeight: 36,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
  },
  materialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  chipCompact: {
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: APP_COLORS.card,
    borderColor: APP_COLORS.accent,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipText: {
    color: APP_COLORS.muted,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  chipTextActive: {
    color: APP_COLORS.ink,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: APP_COLORS.accent,
    ...APP_SHADOWS.card,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  resultsHeader: {
    gap: 4,
    marginTop: 4,
  },
  resultsTitle: {
    color: APP_COLORS.ink,
    fontSize: 22,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  resultsMeta: {
    color: APP_COLORS.muted,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
  },
  notice: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.card,
  },
  noticeText: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  card: {
    gap: 10,
    padding: 20,
    borderRadius: 22,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.card,
  },
  cardTopRank: {
    borderWidth: 2,
    borderColor: APP_COLORS.accent,
    ...APP_SHADOWS.cardLifted,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rankLabel: {
    color: APP_COLORS.accent,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: APP_FONTS.mono,
    fontWeight: "700",
  },
  fallbackBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: APP_COLORS.card,
  },
  fallbackBadgeText: {
    color: APP_COLORS.ink,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  playName: {
    color: APP_COLORS.ink,
    fontSize: 20,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  meta: {
    color: APP_COLORS.muted,
    fontSize: 14,
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
  emptyState: {
    gap: 12,
    padding: 22,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.card,
  },
  emptyTitle: {
    color: APP_COLORS.ink,
    fontSize: 20,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  emptyBody: {
    color: APP_COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: APP_COLORS.card,
  },
  secondaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonText: {
    color: APP_COLORS.ink,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
});
