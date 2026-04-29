import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { usePlaysStore } from "@/store/playsStore";

function formatDuration(min: number, max: number): string {
  return min === max ? `${min}분` : `${min}-${max}분`;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const plays = usePlaysStore((state) => state.plays);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
      return plays.slice(0, 24);
    }

    return plays
      .filter((play) => {
        const target = [play.name, ...play.tags, ...play.steps].join(" ").toLowerCase();
        return target.includes(normalizedQuery);
      })
      .slice(0, 30);
  }, [plays, query]);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 18 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>검색</Text>
        <Text style={styles.subtitle}>놀이, 재료, 상황으로 찾아보세요.</Text>
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

      <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>놀이 목록</Text>
        <Text style={styles.sectionMeta}>{results.length}개</Text>
      </View>

      <View style={styles.resultList}>
        {results.map((play, index) => (
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
              <View style={styles.thumbnailLayer} />
            </View>
            <View style={styles.resultBody}>
              <Text style={styles.resultTitle}>{play.name}</Text>
              <Text style={styles.resultMeta}>
                {play.ageMin}-{play.ageMax}개월 · {formatDuration(play.durationMin, play.durationMax)}
              </Text>
              <Text style={styles.resultTag}>
                #{DEV_AREA_LABELS[play.devAreas[0] ?? "cognitive"]}
              </Text>
            </View>
          </Pressable>
        ))}
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
    color: APP_COLORS.ink,
    fontSize: 17,
    lineHeight: 23,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
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
