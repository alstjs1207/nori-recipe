import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentImage as Image } from "@/components/web/ContentImage";
import { useNativeScroll } from "@/navigation/useNativeScroll";
import { appRouter as router } from "@/navigation/router";
import { getPlayImageSource } from "@/constants/playImages";
import { DEV_AREA_LABELS, DEV_AREA_SLUGS } from "@/constants/devAreas";
import { APP_COLORS as C, APP_FONTS } from "@/constants/theme";
import { getPlayLogs, getCompletedPlayBundles } from "@/db/queries";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaysStore } from "@/store/playsStore";
import type { CompletedHomeBundle } from "@/store/homeRecommendationRound";
import type { PlayLogRecord } from "@/types";
function localDate(value: string) { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export default function RecordScreen() {
    const scroll = useNativeScroll();
    const insets = useSafeAreaInsets();
    const guestId = useSessionStore(s => s.guestId);
    const plays = usePlaysStore(s => s.plays);
    const [logs, setLogs] = useState<PlayLogRecord[]>([]);
    const [bundles, setBundles] = useState<CompletedHomeBundle[]>([]);
    const [tab, setTab] = useState<"bundles" | "plays">("bundles");
    const [archive, setArchive] = useState(false);
    const [month, setMonth] = useState("");
    const [limit, setLimit] = useState(8);
    const [retry, setRetry] = useState(0);
    const [expanded, setExpanded] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const load = useCallback(() => {
        let active = true;
        if (!guestId) {
            setLogs([]);
            setBundles([]);
            return () => { active = false; };
        }
        void Promise.all([getPlayLogs(guestId, 10000), getCompletedPlayBundles(guestId)]).then(([l, b]) => { if (active) {
            setLogs(l);
            setBundles(b);
            setError(null);
        } }).catch(() => { if (active)
            setError("기록을 불러오지 못했어요. 다시 시도해 주세요."); });
        return () => { active = false; };
    }, [guestId, retry]);
    useFocusEffect(load);
    const playMap = new Map(plays.map(p => [p.id, p]));
    const areas = DEV_AREA_SLUGS.map(area => ({ area, count: logs.filter(l => playMap.get(l.playId)?.devAreas.includes(area)).length }));
    const months = [...new Set(bundles.map(b => localDate(b.completedAt).slice(0, 7)))].sort().reverse();
    const selectedMonth = months.includes(month) ? month : months[0];
    const visible = archive ? bundles.filter(b => localDate(b.completedAt).startsWith(selectedMonth)) : bundles.slice(0, 3);
    const dates = [...new Set(visible.map(b => localDate(b.completedAt)))];
    const openPlay = (id: string) => router.push({ pathname: "/(main)/play/[id]", params: { id } });
    return <ScrollView {...scroll} contentContainerStyle={[styles.page, { paddingTop: insets.top + 18 }]}>
    {archive ? <Pressable accessibilityRole="button" onPress={() => setArchive(false)} style={styles.button}><Text style={styles.small}>‹ 기록으로 돌아가기</Text></Pressable> : null}
    <View style={styles.heading}><Text style={styles.title}>{archive ? "완성한 놀이 묶음" : "우리의 놀이 기록"}</Text><Text style={styles.muted}>{archive ? `함께 완성한 ${bundles.length}묶음의 추억` : "아이의 반응과 즐거웠던 순간을 다시 만나보세요."}</Text></View>
    {error ? <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={styles.button}><Text accessibilityRole="alert" style={styles.small}>{error} 다시 시도</Text></Pressable> : null}
    {!archive ? <>
      <View><Text style={styles.small}>전체 기록 기준</Text><View style={styles.stats}>{[[logs.length, "번", "함께 놀이했어요"], [new Set(logs.map(l => localDate(l.completedAt))).size, "일", "시간을 나눴어요"], [areas.filter(a => a.count > 0).length, " / 7가지", "발달 영역을 경험했어요"]].map(([n, unit, label]) => <View key={label} style={styles.stat}><Text style={styles.number}>{n}<Text style={styles.small}>{unit}</Text></Text><Text style={styles.small}>{label}</Text></View>)}</View></View>
      <View style={styles.panel}><Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(v => !v)} style={styles.areaHeading}><View style={{ flex: 1 }}><Text style={styles.h2}>이런 놀이를 함께했어요</Text><Text style={styles.small}>놀이에 담긴 7가지 발달 영역이에요.</Text></View><Text style={styles.small}>{expanded ? "접기 ⌃" : "펼치기 ⌄"}</Text></Pressable>{expanded ? <><View style={styles.areaGrid}>{areas.map(({ area, count }) => <Pressable key={area} style={styles.area} accessibilityRole="button" accessibilityLabel={`${DEV_AREA_LABELS[area]} 놀이 찾기, 기록 ${count}회`} onPress={() => router.push({ pathname: "/(main)/search", params: { category: area, reset: "1" } })}><View style={styles.row}><Text style={styles.small}>{DEV_AREA_LABELS[area]}</Text><Text style={styles.small}>{count}회</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${logs.length ? count / logs.length * 100 : 0}%` }]}/></View></Pressable>)}</View><Text style={styles.small}>한 놀이에 여러 발달 영역이 담길 수 있어요.</Text></> : null}</View>
      <View style={styles.tabs}>{([['bundles', `완성한 묶음 ${bundles.length}`], ['plays', `개별 놀이 ${logs.length}`]] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.activeTab]}><Text style={styles.tabLabel}>{label}</Text></Pressable>)}</View>
    </> : <View style={styles.months}><Text style={styles.small}>달성한 달</Text><View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="이전 달 기록" disabled={months.indexOf(selectedMonth) >= months.length - 1} onPress={() => setMonth(months[months.indexOf(selectedMonth) + 1])} style={styles.monthButton}><Text>‹</Text></Pressable><Text style={styles.h2}>{selectedMonth?.replace('-', '년 ')}월</Text><Pressable accessibilityRole="button" accessibilityLabel="다음 달 기록" disabled={months.indexOf(selectedMonth) <= 0} onPress={() => setMonth(months[months.indexOf(selectedMonth) - 1])} style={styles.monthButton}><Text>›</Text></Pressable></View><Text style={styles.small}>이달에 {visible.length}묶음 달성</Text></View>}
    {archive || tab === 'bundles' ? <>
      {!archive ? <View style={styles.row}><Text style={styles.h2}>함께 완성한 놀이</Text><Text style={styles.small}>최근 {Math.min(bundles.length, 3)}묶음</Text></View> : null}
      {dates.map(date => { const d = new Date(`${date}T12:00:00`); const items = visible.filter(b => localDate(b.completedAt) === date); return <View key={date} style={styles.day}><View style={styles.row}><View><Text style={styles.small}>{d.getFullYear()}년</Text><Text style={styles.date}>{d.getMonth() + 1}월 {d.getDate()}일 <Text style={styles.small}>{d.toLocaleDateString("ko-KR", { weekday: "long" })}</Text></Text></View><Text style={styles.badge}>{items.length}묶음 달성</Text></View>{items.map(bundle => <View key={bundle.id} style={styles.bundle}>{bundle.ids.map(id => <Pressable key={id} style={styles.figure} accessibilityRole="button" onPress={() => openPlay(id)}><Image source={getPlayImageSource(id) ?? undefined} resizeMode="cover" style={styles.photo}/><Text style={styles.caption}>{playMap.get(id)?.name ?? "함께한 놀이"}</Text></Pressable>)}</View>)}</View>; })}
      {!bundles.length ? <Text style={styles.empty}>홈에서 놀이 3개를 완성하면{`\n`}여기에 추억 한 묶음이 남아요.</Text> : !archive ? <Pressable accessibilityRole="button" onPress={() => { setArchive(true); setMonth(months[0]); }} style={styles.button}><Text style={styles.tabLabel}>완성한 묶음 전체 보기 ›</Text></Pressable> : null}
    </> : <><View style={styles.row}><Text style={styles.h2}>하나하나 쌓은 놀이</Text><Text style={styles.small}>총 {logs.length}회</Text></View>{logs.slice(0, limit).map(log => <Pressable key={log.id} accessibilityRole="button" onPress={() => openPlay(log.playId)} style={styles.log}><Image source={getPlayImageSource(log.playId) ?? undefined} resizeMode="cover" style={styles.thumb}/><View style={{ flex: 1, gap: 5 }}><Text style={styles.h2}>{playMap.get(log.playId)?.name ?? "함께한 놀이"}</Text><Text style={styles.small}>{new Date(log.completedAt).toLocaleDateString("ko-KR")}</Text><Text style={styles.small}>{"★".repeat(log.starRating ?? 0)} · {log.childReaction.join(" · ")}</Text>{log.memo ? <Text style={styles.small}>{log.memo}</Text> : null}</View></Pressable>)}{logs.length > limit ? <Pressable accessibilityRole="button" onPress={() => setLimit(v => v + 8)} style={styles.button}><Text style={styles.tabLabel}>이전 놀이 기록 더 보기</Text></Pressable> : null}{!logs.length ? <Text style={styles.empty}>아직 함께한 놀이 기록이 없어요.</Text> : null}</>}
  </ScrollView>;
}
const styles = StyleSheet.create({
    page: { paddingHorizontal: 20, paddingBottom: 32, gap: 20, backgroundColor: C.background }, heading: { gap: 7 }, title: { fontFamily: APP_FONTS.heading, fontSize: 26, color: C.ink }, muted: { fontSize: 13, color: C.muted, fontFamily: APP_FONTS.body }, small: { fontSize: 11, lineHeight: 17, color: C.muted, fontFamily: APP_FONTS.body }, h2: { fontSize: 15, color: C.ink, fontFamily: APP_FONTS.heading }, stats: { flexDirection: "row", gap: 10, marginTop: 8 }, stat: { flex: 1, gap: 6 }, number: { fontSize: 25, color: C.ink, fontFamily: APP_FONTS.heading }, panel: { backgroundColor: C.surface, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: C.line, gap: 12 }, areaHeading: { flexDirection: "row", gap: 8, alignItems: "center", minHeight: 44 }, areaGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 4 }, area: { width: "46%", minHeight: 44, justifyContent: "center", gap: 6 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, track: { height: 5, backgroundColor: C.lavenderSoft, borderRadius: 4, overflow: "hidden" }, fill: { height: 5, backgroundColor: C.lavender, borderRadius: 4 }, tabs: { flexDirection: "row", backgroundColor: C.card, padding: 4, borderRadius: 12, gap: 4 }, tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", padding: 7, borderRadius: 9 }, activeTab: { backgroundColor: C.surface }, tabLabel: { fontSize: 13, color: C.ink, fontFamily: APP_FONTS.body }, day: { gap: 11 }, date: { fontFamily: APP_FONTS.heading, fontSize: 25, color: C.ink }, badge: { fontSize: 11, color: C.ink, backgroundColor: C.card, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 15 }, bundle: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }, figure: { flex: 1, minWidth: 0, gap: 8 }, photo: { width: "100%", aspectRatio: 1 / 1.07, borderRadius: 9 }, caption: { fontSize: 12, lineHeight: 18, color: C.ink, fontFamily: APP_FONTS.body }, button: { minHeight: 44, padding: 10, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: C.line, borderRadius: 11, backgroundColor: C.surface }, empty: { textAlign: "center", padding: 24, color: C.muted, fontSize: 13, lineHeight: 21 }, log: { flexDirection: "row", gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }, thumb: { width: 48, height: 48, borderRadius: 9 }, months: { gap: 9 }, monthButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: C.card, borderRadius: 10 }
});
