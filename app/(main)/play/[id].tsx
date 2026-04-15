import { useEffect, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEV_AREA_LABELS, DEV_AREA_THEME } from "@/constants/devAreas";
import { MATERIAL_DISPLAY_NAMES, type MaterialSlug } from "@/constants/materials";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { isFavorite, toggleFavorite } from "@/db/queries";
import type { Play, PlaySource } from "@/types";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";

type YoutubePreview =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; title: string; thumbnailUrl: string | null };

const PLACE_LABELS: Record<Play["place"], string> = {
  indoor: "실내",
  outdoor: "실외",
  any: "어디서나",
};

const SOURCE_LABELS: Record<PlaySource["type"], string> = {
  youtube: "유튜브",
  instagram: "인스타그램",
  naver_blog: "블로그",
  chaisplay: "차이의 놀이",
  tistory: "티스토리",
  brunch: "브런치",
  manual: "에디터 정리",
};

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function isYoutubeSource(source: PlaySource): boolean {
  return source.type === "youtube" && typeof source.url === "string" && source.url.length > 0;
}

function formatDuration(play: Play): string {
  if (play.durationMin === play.durationMax) {
    return `${play.durationMin}분`;
  }

  return `${play.durationMin}-${play.durationMax}분`;
}

function formatAgeRange(play: Play): string {
  return `${play.ageMin}-${play.ageMax}개월`;
}

function getSourceTitle(play: Play, preview: YoutubePreview): string {
  if (preview.status === "ready") {
    return preview.title;
  }

  return isYoutubeSource(play.source)
    ? "유튜브에서 보기"
    : `${SOURCE_LABELS[play.source.type]} 열기`;
}

function getSourceDescription(play: Play, preview: YoutubePreview): string {
  if (preview.status === "loading") {
    return "영상 정보를 불러오는 중이에요.";
  }

  if (preview.status === "error") {
    return "미리보기를 불러오지 못해도 링크는 바로 열 수 있어요.";
  }

  return "앱을 벗어나 원문 링크를 열어요.";
}

type ChecklistItemProps = {
  checked: boolean;
  label: string;
  missing: boolean;
  onPress: () => void;
  trailingLabel?: string;
};

function ChecklistItem({
  checked,
  label,
  missing,
  onPress,
  trailingLabel,
}: ChecklistItemProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <View style={styles.checkBody}>
        <Text style={styles.checkLabel}>{label}</Text>
        {trailingLabel ? <Text style={styles.trailingLabel}>{trailingLabel}</Text> : null}
      </View>
      {missing ? <View style={styles.missingDot} /> : null}
    </Pressable>
  );
}

type StepRowProps = {
  completed: boolean;
  index: number;
  text: string;
  onPress: () => void;
};

function StepRow({ completed, index, text, onPress }: StepRowProps) {
  return (
    <View style={styles.stepRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.stepBadge,
          completed && styles.stepBadgeCompleted,
          pressed && styles.stepBadgePressed,
        ]}
      >
        <Text style={[styles.stepBadgeText, completed && styles.stepBadgeTextCompleted]}>
          {completed ? "✓" : index + 1}
        </Text>
      </Pressable>
      <Text style={[styles.stepText, completed && styles.stepTextCompleted]}>{text}</Text>
    </View>
  );
}

export default function PlayDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; fallback?: string }>();
  const playId = readParam(params.id);
  const isFallbackRecommendation = readParam(params.fallback) === "1";
  const guestId = useSessionStore((state) => state.guestId);
  const ownedMaterials = useSessionStore((state) => state.userContext.ownedMaterials);
  const play = usePlaysStore((state) =>
    state.plays.find((item) => item.id === playId),
  );
  const [checkedMaterials, setCheckedMaterials] = useState<MaterialSlug[]>([]);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [youtubePreview, setYoutubePreview] = useState<YoutubePreview>({ status: "idle" });

  useEffect(() => {
    if (!guestId || !playId) {
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

  useEffect(() => {
    if (!play || !isYoutubeSource(play.source) || !play.source.url) {
      setYoutubePreview({ status: "idle" });
      return;
    }

    let active = true;

    setYoutubePreview({ status: "loading" });

    void fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(play.source.url)}&format=json`,
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("oEmbed request failed");
        }

        const payload = (await response.json()) as {
          title?: unknown;
          thumbnail_url?: unknown;
        };

        if (!active) {
          return;
        }

        setYoutubePreview({
          status: "ready",
          title:
            typeof payload.title === "string" && payload.title.length > 0
              ? payload.title
              : "유튜브에서 보기",
          thumbnailUrl:
            typeof payload.thumbnail_url === "string" && payload.thumbnail_url.length > 0
              ? payload.thumbnail_url
              : null,
        });
      })
      .catch(() => {
        if (active) {
          setYoutubePreview({ status: "error" });
        }
      });

    return () => {
      active = false;
    };
  }, [play]);

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

  async function handleOpenSource() {
    if (!play?.source.url) {
      return;
    }

    try {
      await Linking.openURL(play.source.url);
    } catch {
      // Opening an external app can fail offline or when the OS blocks the scheme.
    }
  }

  function toggleMaterial(material: MaterialSlug) {
    setCheckedMaterials((current) =>
      current.includes(material)
        ? current.filter((item) => item !== material)
        : [...current, material],
    );
  }

  function toggleStep(index: number) {
    setCompletedSteps((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
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

  const ownedMaterialsSet = new Set(ownedMaterials);
  const allMaterials = play
    ? [
        ...play.materials.required.map((material) => ({ material, optional: false })),
        ...play.materials.optional.map((material) => ({ material, optional: true })),
      ]
    : [];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "놀이 상세",
          headerStyle: { backgroundColor: APP_COLORS.surface },
          headerTintColor: APP_COLORS.ink,
          headerShadowVisible: false,
          headerRight: play
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                  onPress={handleToggleFavorite}
                  style={({ pressed }) => [
                    styles.favoriteButton,
                    pressed && styles.favoriteButtonPressed,
                  ]}
                >
                  <Text style={styles.favoriteButtonText}>{favorite ? "♥" : "♡"}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: play ? 132 + Math.max(insets.bottom, 16) : 32 },
          ]}
        >
          {play ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.title}>{play.name}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{formatAgeRange(play)}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{PLACE_LABELS[play.place]}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>{formatDuration(play)}</Text>
                  </View>
                </View>
                <View style={styles.metaStatsRow}>
                  <Text style={styles.metaStat}>준비 {play.prepTime}분</Text>
                  <Text style={styles.metaStat}>난이도 {play.difficulty}/3</Text>
                </View>
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
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>준비물</Text>
                  {isFallbackRecommendation ? (
                    <Text style={styles.sectionMeta}>빨간 점은 아직 없는 재료예요.</Text>
                  ) : null}
                </View>
                {allMaterials.length > 0 ? (
                  <>
                    {allMaterials.map(({ material, optional }) => (
                      <ChecklistItem
                        key={`${material}-${optional ? "optional" : "required"}`}
                        checked={checkedMaterials.includes(material)}
                        label={MATERIAL_DISPLAY_NAMES[material]}
                        missing={isFallbackRecommendation && !ownedMaterialsSet.has(material)}
                        onPress={() => toggleMaterial(material)}
                        trailingLabel={optional ? "선택 재료" : undefined}
                      />
                    ))}
                    {play.materials.substitutes.length > 0 ? (
                      <Text style={styles.inlineNote}>
                        대체 재료:{" "}
                        {play.materials.substitutes
                          .map((material) => MATERIAL_DISPLAY_NAMES[material])
                          .join(", ")}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.emptyBody}>준비물이 없는 놀이예요.</Text>
                )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>놀이 방법</Text>
                <View style={styles.stepList}>
                  {play.steps.map((step, index) => (
                    <StepRow
                      key={`${play.id}-step-${index}`}
                      completed={completedSteps.includes(index)}
                      index={index}
                      text={step}
                      onPress={() => toggleStep(index)}
                    />
                  ))}
                </View>
                {play.tip ? (
                  <View style={styles.tipCard}>
                    <Text style={styles.tipLabel}>팁</Text>
                    <Text style={styles.tipText}>{play.tip}</Text>
                  </View>
                ) : null}
              </View>

              {play.safetyNotes.length > 0 ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>안전 메모</Text>
                  <View style={styles.noteList}>
                    {play.safetyNotes.map((note, index) => (
                      <View key={`${play.id}-safety-${index}`} style={styles.noteRow}>
                        <View style={styles.noteBullet} />
                        <Text style={styles.noteText}>{note}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {play.educationalEffects.length > 0 ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>기대 효과</Text>
                  <View style={styles.noteList}>
                    {play.educationalEffects.map((effect, index) => (
                      <View key={`${play.id}-effect-${index}`} style={styles.noteRow}>
                        <View style={styles.noteBullet} />
                        <Text style={styles.noteText}>{effect}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {play.source.url ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    {play.source.type === "youtube" ? "참고 영상" : "참고 링크"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleOpenSource}
                    style={({ pressed }) => [
                      styles.sourceCard,
                      pressed && styles.sourceCardPressed,
                    ]}
                  >
                    {youtubePreview.status === "ready" && youtubePreview.thumbnailUrl ? (
                      <Image
                        source={{ uri: youtubePreview.thumbnailUrl }}
                        style={styles.sourceThumbnail}
                      />
                    ) : null}
                    <View style={styles.sourceBody}>
                      <View style={styles.sourceBadge}>
                        <Text style={styles.sourceBadgeText}>
                          {SOURCE_LABELS[play.source.type]}
                        </Text>
                      </View>
                      <Text style={styles.sourceTitle}>
                        {getSourceTitle(play, youtubePreview)}
                      </Text>
                      <Text style={styles.sourceDescription}>
                        {getSourceDescription(play, youtubePreview)}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.title}>놀이를 찾지 못했어요</Text>
              <Text style={styles.emptyBody}>
                선택한 카드가 현재 번들 목록에 없는 상태입니다. 홈으로 돌아가 다시 선택해 주세요.
              </Text>
            </View>
          )}
        </ScrollView>

        {play ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              accessibilityRole="button"
              onPress={moveToFeedback}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>놀이 완료!</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
    backgroundColor: APP_COLORS.background,
  },
  favoriteButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  favoriteButtonPressed: {
    opacity: 0.88,
  },
  favoriteButtonText: {
    color: APP_COLORS.accent,
    fontSize: 18,
    lineHeight: 18,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  heroCard: {
    gap: 14,
    padding: 22,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.cardLifted,
  },
  title: {
    color: APP_COLORS.ink,
    fontSize: 26,
    lineHeight: 34,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: APP_COLORS.background,
  },
  metaChipText: {
    color: APP_COLORS.ink,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  metaStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaStat: {
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
  sectionCard: {
    gap: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.card,
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 19,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  sectionMeta: {
    color: "#b85046",
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  checkRowPressed: {
    opacity: 0.9,
  },
  checkbox: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.background,
  },
  checkboxChecked: {
    backgroundColor: "#dae8ca",
    borderColor: "#6c8d49",
  },
  checkboxMark: {
    color: "#355511",
    fontSize: 14,
    lineHeight: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  checkBody: {
    flex: 1,
    gap: 2,
  },
  checkLabel: {
    color: APP_COLORS.ink,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  trailingLabel: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
  },
  missingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#cf564a",
  },
  inlineNote: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  stepList: {
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.background,
  },
  stepBadgeCompleted: {
    backgroundColor: "#dae8ca",
    borderColor: "#6c8d49",
  },
  stepBadgePressed: {
    opacity: 0.88,
  },
  stepBadgeText: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  stepBadgeTextCompleted: {
    color: "#355511",
  },
  stepText: {
    flex: 1,
    color: APP_COLORS.ink,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: APP_FONTS.body,
  },
  stepTextCompleted: {
    color: APP_COLORS.muted,
  },
  tipCard: {
    gap: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: APP_COLORS.card,
  },
  tipLabel: {
    color: APP_COLORS.accent,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontFamily: APP_FONTS.mono,
    fontWeight: "700",
  },
  tipText: {
    color: APP_COLORS.ink,
    fontSize: 14,
    lineHeight: 21,
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
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
  noteText: {
    flex: 1,
    color: APP_COLORS.ink,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  sourceCard: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: APP_COLORS.background,
  },
  sourceCardPressed: {
    opacity: 0.88,
  },
  sourceThumbnail: {
    width: 120,
    height: 72,
    borderRadius: 14,
    backgroundColor: APP_COLORS.line,
  },
  sourceBody: {
    flex: 1,
    gap: 8,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: APP_COLORS.card,
  },
  sourceBadgeText: {
    color: APP_COLORS.ink,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  sourceTitle: {
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  sourceDescription: {
    color: APP_COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  emptyBody: {
    color: APP_COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  footer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: APP_COLORS.background,
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.line,
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
});
