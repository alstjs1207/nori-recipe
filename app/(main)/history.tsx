import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEV_AREA_LABELS, DEV_AREA_SLUGS, DEV_AREA_THEME, type DevArea } from "@/constants/devAreas";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getDevAreaStats, getFavorites, getPlayLogs } from "@/db/queries";
import type { DevAreaStat, FavoriteRecord, PlayLogRecord } from "@/types";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";

type HistoryData = {
  logs: PlayLogRecord[];
  stats: DevAreaStat[];
  favorites: FavoriteRecord[];
};

type LoadState = "idle" | "loading" | "ready" | "error";

function formatLogDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function isSameMonth(value: string, referenceDate: Date): boolean {
  const date = new Date(value);

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
}

function buildCoverageRows(stats: DevAreaStat[]) {
  const total = stats.reduce((sum, item) => sum + item.total, 0);
  const statMap = new Map(stats.map((item) => [item.devArea, item.total]));

  return DEV_AREA_SLUGS.map((devArea) => {
    const count = statMap.get(devArea) ?? 0;

    return {
      devArea,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}

function getLackingArea(rows: ReturnType<typeof buildCoverageRows>): DevArea | null {
  const sorted = [...rows].sort((left, right) => left.count - right.count);
  return sorted[0]?.devArea ?? null;
}

function renderStars(value: number | null): string {
  if (!value) {
    return "평가 없음";
  }

  return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const guestId = useSessionStore((state) => state.guestId);
  const plays = usePlaysStore((state) => state.plays);
  const [historyData, setHistoryData] = useState<HistoryData>({
    logs: [],
    stats: [],
    favorites: [],
  });
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const playMap = new Map(plays.map((play) => [play.id, play]));
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const referenceMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const monthLogs = historyData.logs.filter((log) =>
    isSameMonth(log.completedAt, referenceMonthDate),
  );
  const coverageRows = buildCoverageRows(historyData.stats);
  const lackingArea = getLackingArea(coverageRows);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!guestId) {
        setHistoryData({ logs: [], stats: [], favorites: [] });
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
        getFavorites(guestId, 8),
      ])
        .then(([logs, stats, favorites]) => {
          if (!active) {
            return;
          }

          setHistoryData({ logs, stats, favorites });
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
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.summaryCard}>
        <Text style={styles.eyebrow}>이번 달 요약</Text>
        <Text style={styles.title}>{monthLogs.length}번 놀았어요.</Text>
        <Text style={styles.body}>
          {monthLogs.length > 0 && lackingArea
            ? `${DEV_AREA_LABELS[lackingArea]} 영역을 더 채워볼까요?`
            : "첫 기록을 남기면 발달 영역 커버리지가 여기서 보입니다."}
        </Text>

        <View style={styles.countRow}>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeLabel}>총 놀이 횟수</Text>
            <Text style={styles.countBadgeValue}>{monthLogs.length}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeLabel}>즐겨찾기</Text>
            <Text style={styles.countBadgeValue}>{historyData.favorites.length}</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>발달 영역 커버리지</Text>
          <View style={styles.chartList}>
            {coverageRows.map((row) => (
              <View key={row.devArea} style={styles.chartRow}>
                <View style={styles.chartMeta}>
                  <Text style={styles.chartLabel}>{DEV_AREA_LABELS[row.devArea]}</Text>
                  <Text style={styles.chartValue}>{row.percent}%</Text>
                </View>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartFill,
                      {
                        width: `${row.percent}%`,
                        backgroundColor: DEV_AREA_THEME[row.devArea].textColor,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert(
            "Coming Soon",
            "계정 기반 발달 리포트와 소셜 로그인 연동은 Phase 2에서 연결됩니다.",
          )
        }
        style={({ pressed }) => [styles.bannerCard, pressed && styles.bannerCardPressed]}
      >
        <Text style={styles.bannerEyebrow}>발달 리포트 맛보기</Text>
        <Text style={styles.bannerTitle}>
          이번 달 {monthLogs.length}번 놀았어요. 3개월 트렌드와 맞춤 추천은 계정을 만들면 볼 수
          있어요 →
        </Text>
        <Text style={styles.bannerBody}>Phase 1에서는 계정 만들기 버튼을 눌러 Coming Soon 안내를 확인할 수 있어요.</Text>
      </Pressable>

      {historyData.favorites.length > 0 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>즐겨찾기</Text>
          <View style={styles.favoriteRow}>
            {historyData.favorites.map((favorite) => {
              const play = playMap.get(favorite.playId);

              return (
                <Pressable
                  key={favorite.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/(main)/play/[id]",
                      params: { id: favorite.playId },
                    })
                  }
                  style={({ pressed }) => [
                    styles.favoriteChip,
                    pressed && styles.favoriteChipPressed,
                  ]}
                >
                  <Text style={styles.favoriteChipText}>{play?.name ?? favorite.playId}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>완료한 놀이</Text>
          {status === "loading" ? <Text style={styles.sectionMeta}>불러오는 중...</Text> : null}
        </View>

        {status === "error" ? <Text style={styles.emptyBody}>{error}</Text> : null}

        {status !== "error" && historyData.logs.length === 0 ? (
          <Text style={styles.emptyBody}>아직 저장된 놀이 기록이 없어요.</Text>
        ) : null}

        {historyData.logs.map((log) => {
          const play = playMap.get(log.playId);

          return (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={styles.logBody}>
                  <Text style={styles.logTitle}>{play?.name ?? log.playId}</Text>
                  <Text style={styles.logDate}>{formatLogDate(log.completedAt)}</Text>
                </View>
                <Text style={styles.logStars}>{renderStars(log.starRating)}</Text>
              </View>
              {log.childReaction.length > 0 ? (
                <Text style={styles.logReaction}>{log.childReaction.join(" · ")}</Text>
              ) : null}
              {log.memo ? <Text style={styles.logMemo}>{log.memo}</Text> : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
    backgroundColor: APP_COLORS.background,
  },
  summaryCard: {
    gap: 14,
    padding: 22,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.cardLifted,
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
    fontSize: 26,
    lineHeight: 34,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  body: {
    color: APP_COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  countRow: {
    flexDirection: "row",
    gap: 12,
  },
  countBadge: {
    flex: 1,
    gap: 6,
    padding: 16,
    borderRadius: 20,
    backgroundColor: APP_COLORS.background,
  },
  countBadgeLabel: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  countBadgeValue: {
    color: APP_COLORS.ink,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  chartCard: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: APP_COLORS.background,
  },
  chartTitle: {
    color: APP_COLORS.ink,
    fontSize: 16,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  chartList: {
    gap: 10,
  },
  chartRow: {
    gap: 6,
  },
  chartMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartLabel: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  chartValue: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  chartTrack: {
    overflow: "hidden",
    height: 10,
    borderRadius: 999,
    backgroundColor: APP_COLORS.line,
  },
  chartFill: {
    height: "100%",
    borderRadius: 999,
  },
  bannerCard: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#f4ead8",
    ...APP_SHADOWS.card,
  },
  bannerCardPressed: {
    opacity: 0.9,
  },
  bannerEyebrow: {
    color: "#8f5722",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: APP_FONTS.mono,
    fontWeight: "700",
  },
  bannerTitle: {
    color: APP_COLORS.ink,
    fontSize: 21,
    lineHeight: 30,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  bannerBody: {
    color: "#71573e",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  sectionCard: {
    gap: 14,
    padding: 20,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.card,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 19,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  sectionMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  favoriteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  favoriteChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  favoriteChipPressed: {
    opacity: 0.88,
  },
  favoriteChipText: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  emptyBody: {
    color: APP_COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  logCard: {
    gap: 8,
    padding: 16,
    borderRadius: 20,
    backgroundColor: APP_COLORS.background,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  logBody: {
    flex: 1,
    gap: 4,
  },
  logTitle: {
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  logDate: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  logStars: {
    color: "#c17a07",
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  logReaction: {
    color: APP_COLORS.ink,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  logMemo: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
});
