import { type ComponentProps, useCallback, useMemo, useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { fadeInUp, layoutTransition } from "@/animations/motion";
import { MotionPressable } from "@/components/motion/MotionPressable";
import { DEV_AREA_LABELS, DEV_AREA_SLUGS, DEV_AREA_THEME, type DevArea } from "@/constants/devAreas";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getDevAreaStats, getPlayLogs } from "@/db/queries";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import type { DevAreaStat, Play, PlayLogRecord } from "@/types";

type HistoryData = {
  logs: PlayLogRecord[];
  stats: DevAreaStat[];
};

type LoadState = "idle" | "loading" | "ready" | "error";
type AgeFilter = "all" | 1 | 2 | 3 | 4;

type CoverageRow = {
  devArea: DevArea;
  count: number;
  strength: number;
};

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const AGE_FILTERS: Array<{ label: string; value: AgeFilter }> = [
  { label: "전체", value: "all" },
  { label: "1세", value: 1 },
  { label: "2세", value: 2 },
  { label: "3세", value: 3 },
  { label: "4세", value: 4 },
];

const THUMBNAIL_BACKGROUNDS = [
  "#FFF2BF",
  "#E4F8F1",
  "#EFE7FF",
  "#FFE7E3",
  "#E5F5FE",
];

const DEV_AREA_ICONS: Record<DevArea, MaterialCommunityIconName> = {
  fine_motor: "hand-front-right",
  gross_motor: "run-fast",
  cognitive: "lightbulb-on",
  language: "chat-processing-outline",
  emotional: "heart-outline",
  social: "account-group",
  sensory: "eye-outline",
};

function formatLogDate(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);

  return `${year}.${month}.${day} (${weekday})`;
}

function isSameMonth(value: string, referenceDate: Date): boolean {
  const date = new Date(value);

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
}

function buildCoverageRows(stats: DevAreaStat[]): CoverageRow[] {
  const maxCount = Math.max(0, ...stats.map((item) => item.total));
  const statMap = new Map(stats.map((item) => [item.devArea, item.total]));

  return DEV_AREA_SLUGS.map((devArea) => {
    const count = statMap.get(devArea) ?? 0;

    return {
      devArea,
      count,
      strength: maxCount > 0 ? count / maxCount : 0,
    };
  });
}

function getLackingArea(rows: CoverageRow[]): DevArea | null {
  const sorted = [...rows].sort((left, right) => left.count - right.count);
  return sorted[0]?.devArea ?? null;
}

function getPlayAgeYear(play: Play | undefined): AgeFilter | null {
  if (!play) {
    return null;
  }

  const midpointMonths = (play.ageMin + play.ageMax) / 2;
  const ageYear = Math.floor(midpointMonths / 12);

  return Math.max(1, Math.min(4, ageYear)) as AgeFilter;
}

function formatPlayAge(play: Play | undefined): string {
  const ageYear = getPlayAgeYear(play);

  return ageYear === null ? "연령 정보 없음" : `${ageYear}세`;
}

function getMoodIcon(value: number | null): MaterialCommunityIconName {
  if (!value) {
    return "emoticon-outline";
  }

  if (value >= 5) {
    return "emoticon-excited-outline";
  }

  if (value >= 4) {
    return "emoticon-happy-outline";
  }

  if (value >= 3) {
    return "emoticon-neutral-outline";
  }

  return "emoticon-sad-outline";
}

function getMoodColor(value: number | null): string {
  if (!value) {
    return APP_COLORS.muted;
  }

  if (value >= 5) {
    return APP_COLORS.coral;
  }

  if (value >= 4) {
    return "#B38A18";
  }

  if (value >= 3) {
    return "#45A27E";
  }

  return "#8B8D95";
}

function getMoodTone(value: number | null): string {
  if (!value) {
    return APP_COLORS.lineSoft;
  }

  if (value >= 5) {
    return "#FFD9E5";
  }

  if (value >= 4) {
    return APP_COLORS.mustardSoft;
  }

  if (value >= 3) {
    return APP_COLORS.sageSoft;
  }

  return APP_COLORS.lineSoft;
}

function getLogPreview(log: PlayLogRecord): string {
  if (log.memo) {
    return log.memo;
  }

  if (log.childReaction.length > 0) {
    return log.childReaction.join(" · ");
  }

  return "짧은 기록이 없어요.";
}

function CoverageWheel({ rows, total }: { rows: CoverageRow[]; total: number }) {
  const step = 360 / rows.length;

  return (
    <View style={styles.coverageWheel}>
      {rows.map((row, index) => {
        const theme = DEV_AREA_THEME[row.devArea];
        const strength = row.count === 0 ? 0.45 : 0.58 + row.strength * 0.42;

        return (
          <View
            key={row.devArea}
            style={[
              styles.coveragePetal,
              {
                backgroundColor: theme.backgroundColor,
                borderColor: theme.accentColor,
                opacity: row.count === 0 ? 0.36 : 1,
                transform: [
                  { rotate: `${index * step}deg` },
                  { translateY: -58 },
                  { scaleY: strength },
                ],
              },
            ]}
          />
        );
      })}
      <View style={styles.coverageCenter}>
        <Text style={styles.coverageCenterValue}>{total}</Text>
        <Text style={styles.coverageCenterLabel}>기록</Text>
      </View>
    </View>
  );
}

function PlayThumbnailSlot({ index, play }: { index: number; play: Play | undefined }) {
  const devArea = play?.devAreas[0];
  const theme = devArea ? DEV_AREA_THEME[devArea] : null;
  const backgroundColor = theme?.backgroundColor ?? THUMBNAIL_BACKGROUNDS[index % THUMBNAIL_BACKGROUNDS.length];
  const accentColor = theme?.accentColor ?? "rgba(255,255,255,0.72)";
  const iconName = devArea ? DEV_AREA_ICONS[devArea] : "clipboard-check-outline";
  const iconColor = theme?.textColor ?? APP_COLORS.accentText;

  return (
    <View style={[styles.thumbnailSlot, { backgroundColor }]}>
      <View style={[styles.thumbnailShapeLarge, { backgroundColor: accentColor }]} />
      <View style={styles.thumbnailShapeSmall} />
      <MaterialCommunityIcons
        name={iconName}
        size={32}
        color={iconColor}
        style={styles.thumbnailIcon}
      />
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const guestId = useSessionStore((state) => state.guestId);
  const plays = usePlaysStore((state) => state.plays);
  const [historyData, setHistoryData] = useState<HistoryData>({
    logs: [],
    stats: [],
  });
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedAgeFilter, setSelectedAgeFilter] = useState<AgeFilter>("all");
  const playMap = useMemo(() => new Map(plays.map((play) => [play.id, play])), [plays]);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const referenceMonthDate = useMemo(
    () => new Date(currentYear, currentMonth - 1, 1),
    [currentMonth, currentYear],
  );
  const monthLogs = useMemo(
    () => historyData.logs.filter((log) => isSameMonth(log.completedAt, referenceMonthDate)),
    [historyData.logs, referenceMonthDate],
  );
  const coverageRows = useMemo(() => buildCoverageRows(historyData.stats), [historyData.stats]);
  const lackingArea = getLackingArea(coverageRows);
  const filteredLogs = useMemo(
    () =>
      historyData.logs.filter((log) => {
        if (selectedAgeFilter === "all") {
          return true;
        }

        const play = playMap.get(log.playId);
        return getPlayAgeYear(play) === selectedAgeFilter;
      }),
    [historyData.logs, playMap, selectedAgeFilter],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!guestId) {
        setHistoryData({ logs: [], stats: [] });
        setStatus("ready");
        setError(null);
        return () => {
          active = false;
        };
      }

      setStatus("loading");
      setError(null);

      void Promise.all([
        getPlayLogs(guestId, 60),
        getDevAreaStats(guestId, currentYear, currentMonth),
      ])
        .then(([logs, stats]) => {
          if (!active) {
            return;
          }

          setHistoryData({ logs, stats });
          setStatus("ready");
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setStatus("error");
          setError("기록을 불러오지 못했습니다.");
        });

      return () => {
        active = false;
      };
    }, [currentMonth, currentYear, guestId]),
  );

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
        <Text style={styles.pageTitle}>놀이 기록</Text>
        <Text style={styles.pageSubtitle}>아이와 함께한 놀이를 한눈에 돌아봐요.</Text>
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp(40)}
        layout={reduceMotion ? undefined : layoutTransition}
        style={styles.coverageCard}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionTitle}>발달 영역 커버리지</Text>
            <Text style={styles.sectionDescription}>
              {monthLogs.length > 0 && lackingArea
                ? `${currentMonth}월에는 ${DEV_AREA_LABELS[lackingArea]} 놀이를 조금 더 채워볼 수 있어요.`
                : "기록이 쌓이면 영역별 놀이 균형을 볼 수 있어요."}
            </Text>
          </View>
          <View style={styles.monthBadge}>
            <Text style={styles.monthBadgeText}>{currentMonth}월</Text>
          </View>
        </View>

        <CoverageWheel rows={coverageRows} total={monthLogs.length} />

        <View style={styles.coverageLegend}>
          {coverageRows.map((row) => {
            const theme = DEV_AREA_THEME[row.devArea];

            return (
              <View key={row.devArea} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.accentColor }]} />
                <Text style={styles.legendLabel}>{DEV_AREA_LABELS[row.devArea]}</Text>
                <Text style={styles.legendValue}>{row.count}회</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? undefined : fadeInUp(90)}
        layout={reduceMotion ? undefined : layoutTransition}
        style={styles.sectionCard}
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionTitle}>완료한 놀이</Text>
            <Text style={styles.sectionDescription}>저장한 기록을 나이별로 빠르게 찾아볼 수 있어요.</Text>
          </View>
          {status === "loading" ? <Text style={styles.sectionMeta}>불러오는 중...</Text> : null}
        </View>

        <View style={styles.filterRow}>
          {AGE_FILTERS.map((filter) => {
            const active = selectedAgeFilter === filter.value;

            return (
              <MotionPressable
                key={filter.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedAgeFilter(filter.value)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && styles.filterChipPressed,
                ]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
              </MotionPressable>
            );
          })}
        </View>

        {status === "error" ? <Text style={styles.emptyBody}>{error}</Text> : null}

        {status !== "error" && historyData.logs.length === 0 ? (
          <Text style={styles.emptyBody}>아직 저장된 놀이 기록이 없어요.</Text>
        ) : null}

        {status !== "error" && historyData.logs.length > 0 && filteredLogs.length === 0 ? (
          <Text style={styles.emptyBody}>선택한 나이의 기록이 아직 없어요.</Text>
        ) : null}

        <View style={styles.logList}>
          {filteredLogs.map((log, index) => {
            const play = playMap.get(log.playId);

            return (
              <MotionPressable
                key={log.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/(main)/play/[id]",
                    params: { id: log.playId },
                  })
                }
                style={({ pressed }) => [styles.logCard, pressed && styles.logCardPressed]}
              >
                <PlayThumbnailSlot index={index} play={play} />
                <View style={styles.logContent}>
                  <Text style={styles.logTitle} numberOfLines={2}>
                    {play?.name ?? log.playId}
                  </Text>
                  <View style={styles.logMetaRow}>
                    <Text style={styles.ageBadge}>{formatPlayAge(play)}</Text>
                    <Text style={styles.logDate}>{formatLogDate(log.completedAt)}</Text>
                  </View>
                  <Text style={styles.logPreview} numberOfLines={1}>
                    {getLogPreview(log)}
                  </Text>
                </View>
                <View style={[styles.moodBadge, { backgroundColor: getMoodTone(log.starRating) }]}>
                  <MaterialCommunityIcons
                    name={getMoodIcon(log.starRating)}
                    size={26}
                    color={getMoodColor(log.starRating)}
                  />
                </View>
              </MotionPressable>
            );
          })}
        </View>
      </Animated.View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: APP_COLORS.background,
  },
  header: {
    gap: 5,
  },
  pageTitle: {
    color: APP_COLORS.ink,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  pageSubtitle: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  coverageCard: {
    gap: 18,
    padding: 20,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  sectionCard: {
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionTitleGroup: {
    flex: 1,
    gap: 6,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  sectionDescription: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  sectionMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  monthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: APP_COLORS.mustardSoft,
  },
  monthBadgeText: {
    color: APP_COLORS.accentText,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  coverageWheel: {
    position: "relative",
    width: 220,
    height: 220,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.lineSoft,
  },
  coveragePetal: {
    position: "absolute",
    left: 88,
    top: 66,
    width: 44,
    height: 88,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
  },
  coverageCenter: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.control,
  },
  coverageCenterValue: {
    color: APP_COLORS.ink,
    fontSize: 24,
    lineHeight: 27,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  coverageCenterLabel: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  coverageLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  legendItem: {
    minWidth: "31%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.lineSoft,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendLabel: {
    flex: 1,
    color: APP_COLORS.ink,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  legendValue: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  filterChipActive: {
    backgroundColor: APP_COLORS.accent,
    borderColor: APP_COLORS.accent,
  },
  filterChipPressed: {
    opacity: 0.88,
  },
  filterChipText: {
    color: APP_COLORS.ink,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: APP_COLORS.accentText,
    fontWeight: "700",
  },
  logList: {
    gap: 8,
  },
  logCard: {
    minHeight: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.lineSoft,
  },
  logCardPressed: {
    opacity: 0.88,
  },
  thumbnailSlot: {
    width: 68,
    height: 68,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(34,34,34,0.04)",
  },
  thumbnailShapeLarge: {
    position: "absolute",
    right: -18,
    bottom: -20,
    width: 68,
    height: 68,
    borderRadius: 999,
    opacity: 0.58,
  },
  thumbnailShapeSmall: {
    position: "absolute",
    left: 12,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.58)",
  },
  thumbnailIcon: {
    position: "absolute",
    left: 18,
    top: 18,
  },
  logContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  logTitle: {
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  logMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  ageBadge: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
    color: APP_COLORS.accentText,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  logDate: {
    flexShrink: 1,
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  logPreview: {
    color: APP_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: APP_FONTS.body,
  },
  moodBadge: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  emptyBody: {
    color: APP_COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
});
