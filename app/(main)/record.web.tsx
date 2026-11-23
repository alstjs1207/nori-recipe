import { PlayImage } from "@/components/web/PlayImage.web";
import { WebPage, EmptyState, Icon, PageFooter } from "@/components/web/NoriUI";
import { getPlayImageUrl } from "@/constants/playImageUrls";
import { WebSelect } from "@/components/web/WebSelect";
import { AppLink as Link } from "@/navigation/AppLink";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { DEV_AREA_LABELS, DEV_AREA_SLUGS } from "@/constants/devAreas";
import { getPlayLogs, getCompletedPlayBundles } from "@/db/queries";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaysStore } from "@/store/playsStore";
import type { CompletedHomeBundle } from "@/store/homeRecommendationRound";
import type { PlayLogRecord } from "@/types";
function dateKey(value: string) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export default function RecordWebScreen() {
    const guestId = useSessionStore(state => state.guestId);
    const plays = usePlaysStore(state => state.plays);
    const [logs, setLogs] = useState<PlayLogRecord[]>([]);
    const [bundles, setBundles] = useState<CompletedHomeBundle[]>([]);
    const [tab, setTab] = useState<"bundles" | "plays">("bundles");
    const [archive, setArchive] = useState(false);
    const [month, setMonth] = useState("");
    const [limit, setLimit] = useState(8);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [overviewOpen, setOverviewOpen] = useState(true);
    const [retry, setRetry] = useState(0);
    const load = useCallback(() => {
        let active = true;
        setLoading(true);
        if (!guestId) {
            setLogs([]);
            setBundles([]);
            setLoading(false);
            return () => { active = false; };
        }
        void Promise.all([getPlayLogs(guestId, 10000), getCompletedPlayBundles(guestId)])
            .then(([records, completed]) => { if (active) {
            setLogs(records);
            setBundles(completed);
            setError(null);
        } })
            .catch(() => { if (active)
            setError("기록을 불러오지 못했어요. 다시 시도해 주세요."); })
            .finally(() => { if (active)
            setLoading(false); });
        return () => { active = false; };
    }, [guestId, retry]);
    useFocusEffect(load);
    const playMap = new Map(plays.map(play => [play.id, play]));
    const areas = DEV_AREA_SLUGS.map(area => ({ area, count: logs.filter(log => playMap.get(log.playId)?.devAreas.includes(area)).length }));
    const days = new Set(logs.map(log => dateKey(log.completedAt))).size;
    const months = [...new Set(bundles.map(bundle => dateKey(bundle.completedAt).slice(0, 7)))].sort().reverse();
    const selectedMonth = months.includes(month) ? month : months[0];
    const visibleBundles = archive ? bundles.filter(bundle => dateKey(bundle.completedAt).startsWith(selectedMonth)) : bundles.slice(0, 3);
    const dates = [...new Set(visibleBundles.map(bundle => dateKey(bundle.completedAt)))];
    const renderBundles = () => <div className="completed-bundle-dates">{dates.map(date => {
            const completed = visibleBundles.filter(bundle => dateKey(bundle.completedAt) === date);
            const achieved = new Date(`${date}T12:00:00`);
            return <section className="completed-bundle-day" key={date} aria-label={`${date} 달성 기록`}>
      <div className="completed-date-heading"><div><p>{achieved.getFullYear()}년</p><h3><time dateTime={date}>{achieved.getMonth() + 1}월 {achieved.getDate()}일</time><span>{achieved.toLocaleDateString("ko-KR", { weekday: "long" })}</span></h3></div><span className="completed-date-count">{completed.length}묶음 달성</span></div>
      <div className="completed-day-bundles">{completed.map(bundle => <article className="completed-bundle" key={bundle.id} aria-label="완성한 놀이 3개"><div className="completed-bundle-images">{bundle.ids.map(id => {
                        const play = playMap.get(id);
                        return <Link href={`/play/${id}`} key={id}><figure><PlayImage src={play ? getPlayImageUrl(id, "thumbnail") : "/nori-icon.svg"} alt="" loading="lazy"/><figcaption>{play?.name ?? "함께한 놀이"}</figcaption></figure></Link>;
                    })}</div></article>)}</div>
    </section>;
        })}</div>;
    return <WebPage><div className="nori-page record-page">
    {archive ? <>
      <button className="text-button record-back" type="button" onClick={() => setArchive(false)}><Icon name="back" size={16}/> 기록으로 돌아가기</button>
      <header className="page-heading"><h1>완성한 놀이 묶음</h1><p>함께 완성한 {bundles.length}묶음의 추억</p></header>
    </> : <header className="page-heading"><p className="page-kicker">함께한 시간의 작은 발자국</p><h1>우리의 놀이 기록</h1><p>아이의 반응과 즐거웠던 순간을 다시 만나보세요.</p></header>}
    {error ? <p className="error-text" role="alert">{error} <button className="text-button" type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p> : null}
    {loading && !logs.length ? <p role="status">기록을 불러오고 있어요.</p> : !archive ? <>
      <section className="record-overview" aria-label="전체 놀이 기록 요약"><p className="record-overview-period">전체 기록 기준</p><div className="record-overview-stats"><div><strong>{logs.length}<span>번</span></strong><p>함께 놀이했어요</p></div><div><strong>{days}<span>일</span></strong><p>시간을 나눴어요</p></div><div><strong>{areas.filter(item => item.count > 0).length}<span> / 7가지</span></strong><p>발달 영역을 경험했어요</p></div></div></section>
      <details className="record-development" open={overviewOpen} onToggle={event => setOverviewOpen(event.currentTarget.open)}><summary><span><strong>이런 놀이를 함께했어요</strong><small>놀이에 담긴 7가지 발달 영역이에요.</small></span><span className="record-disclosure">{overviewOpen ? "접기" : "펼치기"}<Icon name="chevron" size={14}/></span></summary><div className="record-development-bars">{areas.map(({ area, count }) => <Link key={area} href={{ pathname: "/search", params: { category: area, reset: "1" } }} aria-label={`${DEV_AREA_LABELS[area]} 놀이 찾기, 기록 ${count}회`} className="record-development-link"><span>{DEV_AREA_LABELS[area]}<strong>{count}회</strong></span><span className="area-bar"><i style={{ width: `${logs.length ? count / logs.length * 100 : 0}%` }}/></span></Link>)}</div><p className="panel-note">한 놀이에 여러 발달 영역이 담길 수 있어요.<br />영역을 누르면 관련 놀이를 찾아볼 수 있어요.</p></details>
      <div className="record-view-switch" role="group" aria-label="놀이 기록 보기"><button type="button" aria-pressed={tab === "bundles"} onClick={() => setTab("bundles")}>완성한 묶음 <span>{bundles.length}</span></button><button type="button" aria-pressed={tab === "plays"} onClick={() => setTab("plays")}>개별 놀이 <span>{logs.length}</span></button></div>
      {tab === "bundles" ? <>
        <div className="section-heading record-section-heading"><h2>함께 완성한 놀이</h2><span>최근 {Math.min(bundles.length, 3)}묶음</span></div>
        {bundles.length ? <>{renderBundles()}<button className="record-all-button" type="button" onClick={() => { setArchive(true); setMonth(months[0]); }}>완성한 묶음 전체 보기 <Icon name="chevron" size={16}/></button></> : <EmptyState title="함께 완성할 놀이를 기다려요"><p>홈에서 놀이 3개를 완성하면<br />여기에 추억 한 묶음이 남아요.</p><Link href="/" className="secondary-button">추천 놀이 만나보기</Link></EmptyState>}
      </> : <section className="record-list"><div className="section-heading record-section-heading"><h2>하나하나 쌓은 놀이</h2><span>총 {logs.length}회</span></div>{logs.slice(0, limit).map(log => {
                    const play = playMap.get(log.playId);
                    return <article className="record-entry" key={log.id}><Link href={`/play/${log.playId}`} className="record-entry-heading"><PlayImage src={play ? getPlayImageUrl(log.playId, "thumbnail") : "/nori-icon.svg"} alt="" loading="lazy"/><div><time dateTime={log.completedAt}>{new Date(log.completedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</time><h3>{play?.name ?? "함께한 놀이"}</h3><p className="record-stars" aria-label={`즐거움 ${log.starRating ?? 0}점`}>{"★".repeat(log.starRating ?? 0)}<span>{"☆".repeat(5 - (log.starRating ?? 0))}</span></p></div><Icon name="chevron" size={18}/></Link>{log.childReaction.length ? <div className="reaction-tags">{log.childReaction.map(reaction => <span key={reaction}>{reaction}</span>)}</div> : null}{log.memo ? <p className="record-memo">{log.memo}</p> : null}</article>;
                })}{!logs.length ? <EmptyState title="함께한 순간을 기다리고 있어요"><p>놀이를 마친 뒤 아이의 반응을 남겨보세요.</p></EmptyState> : null}{logs.length > limit ? <button className="record-all-button" type="button" onClick={() => setLimit(value => value + 8)}>이전 놀이 기록 더 보기 <Icon name="chevron" size={16}/></button> : null}</section>}
    </> : <>
      {months.length ? <div className="record-month-row"><label><span>달성한 달</span><WebSelect aria-label="달성한 달" value={selectedMonth} onChange={event => setMonth(event.target.value)}>{months.map(key => <option value={key} key={key}>{key.slice(0, 4)}년 {Number(key.slice(5))}월</option>)}</WebSelect></label><span>이달에 <strong>{visibleBundles.length}묶음</strong> 달성</span></div> : null}
      {renderBundles()}
    </>}
    <PageFooter />
  </div></WebPage>;
}
