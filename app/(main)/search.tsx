import { ContentImage as Image } from "@/components/web/ContentImage";
import { NewPlayBadge } from "@/components/NewPlayBadge";
import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { getPlayThumbnailSource } from "@/constants/playImages";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getAgeMonthsFromBirthMonth } from "@/onboarding/utils";
import { searchPlays } from "@/play/search";
import { DEFAULT_SEARCH_SORT, SEARCH_SORT_OPTIONS, type SearchSort } from "@/play/searchSort";
import { useNewPlayTime } from "@/hooks/useNewPlayTime";
import { PLAY_CATEGORIES, readPlayCategory, type PlayCategory, type PlayType } from "@/play/presentation";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import type { PlayPlace } from "@/types";

function formatDuration(min: number, max: number): string {
  return min === max ? `${min}분` : `${min}-${max}분`;
}

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function readPlaceParam(value: string | string[] | undefined): PlayPlace | null {
  const place = readParam(value);

  return place === "indoor" || place === "outdoor" || place === "any" ? place : null;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ label?: string | string[]; place?: string | string[]; category?: string | string[]; reset?: string }>();
  const plays = usePlaysStore((state) => state.plays);
  const now = useNewPlayTime(plays);
  const context = useSessionStore((state) => state.userContext);
  const childBirthMonth = context.childBirthMonth;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlayCategory>(readPlayCategory(params.category));
  const [playType, setPlayType] = useState<PlayType>("all");
  const [sort, setSort] = useState<SearchSort>(DEFAULT_SEARCH_SORT);
  useEffect(() => {
    setCategory(readPlayCategory(params.category));
  }, [params.category]);
  useEffect(() => {
    if (params.reset !== "1") return;
    setQuery("");
    setPlayType("all");
    setSort(DEFAULT_SEARCH_SORT);
    router.setParams({ reset: undefined, place: undefined, label: undefined });
  }, [params.reset]);
  function selectCategory(value: PlayCategory) {
    setCategory(value);
    router.setParams({ category: value === "all" ? undefined : value });
  }
  const selectedPlace = readPlaceParam(params.place);
  const selectedPlaceLabel = readParam(params.label);
  const selectedAgeMonths =
    childBirthMonth === null ? null : getAgeMonthsFromBirthMonth(childBirthMonth);
  const selectedAgeLabel = selectedAgeMonths === null ? "아이" : `${selectedAgeMonths}개월 아이`;

  const results = useMemo(() => {
    return searchPlays(plays, {
      ageMonths: selectedAgeMonths,
      place: selectedPlace,
      query,
      category,
      playType,
      sort,
      availableMaterials: context.ownedMaterials,
      now: new Date(now),
    });
  }, [plays, query, category, playType, sort, now, context.ownedMaterials, selectedAgeMonths, selectedPlace]);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 18 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>검색</Text>
        <Text style={styles.subtitle}>
          {selectedPlaceLabel
            ? `${selectedPlaceLabel}에 맞는 ${selectedAgeLabel} 놀이를 찾아보세요.`
            : `${selectedAgeLabel}에게 맞는 놀이, 재료, 상황으로 찾아보세요.`}
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          placeholder="예: 물감, 집콕, 소근육"
          placeholderTextColor="#A0A0A0"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>발달 영역</Text>
        <View style={styles.categoryRow}>
          {PLAY_CATEGORIES.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected: category === item.value }}
              onPress={() => selectCategory(item.value)}
              style={[styles.categoryChip, category === item.value && styles.categoryChipSelected]}
            >
              <Text style={[styles.categoryLabel, category === item.value && styles.categoryLabelSelected]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.typeFilterRow}>
          <Text style={styles.filterLabel}>놀이 유형</Text>
          {([{ value: "all", label: "전체 유형" }, { value: "art", label: "미술 놀이" }] as const).map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected: playType === item.value }}
              onPress={() => setPlayType(item.value)}
              style={[styles.typeChip, playType === item.value && styles.categoryChipSelected]}
            >
              <Text style={[styles.categoryLabel, playType === item.value && styles.categoryLabelSelected]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.typeFilterRow}>
        <Text style={styles.filterLabel}>정렬</Text>
        {SEARCH_SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: sort === option.value }}
            onPress={() => setSort(option.value)}
            style={[styles.typeChip, sort === option.value && styles.categoryChipSelected]}
          >
            <Text style={[styles.categoryLabel, sort === option.value && styles.categoryLabelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>{selectedPlaceLabel ?? "놀이 목록"}</Text>
        <Text style={styles.sectionMeta}>{results.length}개</Text>
      </View>

      <View style={styles.resultList}>
        {results.map((play, index) => {
          const imageSource = getPlayThumbnailSource(play.id);

          return (
            <Pressable
              key={play.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/(main)/play/[id]",
                  params: { id: play.id },
                })
              }
              style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.thumbnail,
                  index % 3 === 0
                    ? styles.thumbnailYellow
                    : index % 3 === 1
                      ? styles.thumbnailMint
                      : styles.thumbnailPurple,
                ]}
              >
                {imageSource ? (
                  <Image
                    accessibilityIgnoresInvertColors
                    resizeMode="cover"
                    source={imageSource}
                    style={styles.thumbnailImage}
                  />
                ) : (
                  <View style={styles.thumbnailLayer} />
                )}
              </View>
              <View style={styles.resultBody}>
                <View style={styles.resultHeading}>
                  <Text style={styles.resultTitle}>{play.name}</Text>
                  <NewPlayBadge createdAt={play.createdAt} />
                </View>
                <Text style={styles.resultMeta}>
                  {play.ageMin}-{play.ageMax}개월 · {formatDuration(play.durationMin, play.durationMax)}
                </Text>
                <View style={styles.resultTags}>
                  {play.devAreas.map((area) => (
                    <Text key={area} style={[styles.resultTag, area === category && styles.categoryLabelSelected]}>
                      #{DEV_AREA_LABELS[area]}
                    </Text>
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: APP_COLORS.background,
  },
  header: {
    gap: 5,
  },
  title: {
    color: APP_COLORS.ink,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  subtitle: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  searchBox: {
    minHeight: 60,
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
  searchInput: {
    flex: 1,
    color: APP_COLORS.ink,
    fontSize: 16,
    fontFamily: APP_FONTS.body,
  },
  filters: {
    gap: 10,
  },
  filterLabel: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexBasis: "22%",
    flexGrow: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  categoryChipSelected: {
    borderColor: APP_COLORS.accentText,
    backgroundColor: APP_COLORS.mustardSoft,
  },
  categoryLabel: {
    fontSize: 13,
    color: APP_COLORS.muted,
    fontFamily: APP_FONTS.body,
  },
  categoryLabelSelected: {
    color: APP_COLORS.accentText,
    fontWeight: "700",
  },
  typeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  typeChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  resultTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 21,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  sectionMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  resultList: {
    gap: 12,
  },
  resultCard: {
    flexDirection: "row",
    gap: 14,
    padding: 12,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  pressed: {
    opacity: 0.88,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 20,
    overflow: "hidden",
  },
  thumbnailYellow: {
    backgroundColor: "#FFF2BF",
  },
  thumbnailMint: {
    backgroundColor: "#DDF8EF",
  },
  thumbnailPurple: {
    backgroundColor: "#EEE7FF",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailLayer: {
    position: "absolute",
    right: -18,
    bottom: -22,
    width: 70,
    height: 70,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  resultBody: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  resultTitle: {
    flex: 1,
    color: APP_COLORS.ink,
    fontSize: 17,
    lineHeight: 23,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  resultHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  resultTag: {
    color: "#D5A900",
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
});
