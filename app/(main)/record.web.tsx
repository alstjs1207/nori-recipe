import { WebPage } from "@/components/web/NoriUI";
import { WebSelect } from "@/components/web/WebSelect";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { DEV_AREA_LABELS, DEV_AREA_SLUGS } from "@/constants/devAreas";
import { getPlayLogs } from "@/db/queries";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaysStore } from "@/store/playsStore";
import { EmptyState, Icon, PageFooter } from "@/components/web/NoriUI";
import type { PlayLogRecord } from "@/types";

function monthKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export default function RecordWebScreen() {
  const guestId = useSessionStore((state) => state.guestId);
  const plays = usePlaysStore((state) => state.plays);
  const [logs, setLogs] = useState<PlayLogRecord[]>([]);
  const [month, setMonth] = useState(monthKey(new Date().toISOString()));
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (guestId)
        void getPlayLogs(guestId, 10000)
          .then((records) => {
            if (active) {
              setLogs(records);
              setError(null);
            }
          })
          .catch(() => {
            if (active)
              setError("기록을 불러오지 못했어요. 다시 방문해 주세요.");
          });
      return () => {
        active = false;
      };
    }, [guestId]),
  );
  const months = [
    ...new Set([
      monthKey(new Date().toISOString()),
      ...logs.map((log) => monthKey(log.completedAt)),
    ]),
  ]
    .sort()
    .reverse();
  const filtered =
    month === "all"
      ? logs
      : logs.filter((log) => monthKey(log.completedAt) === month);
  const playMap = new Map(plays.map((play) => [play.id, play]));
  const areas = DEV_AREA_SLUGS.map((area) => ({
    area,
    count: filtered.filter((log) =>
      playMap.get(log.playId)?.devAreas.includes(area),
    ).length,
  }));
  const days = new Set(
    filtered.map((log) =>
      new Date(log.completedAt).toLocaleDateString("ko-KR"),
    ),
  ).size;
  return (
    <WebPage>
      <div className="nori-page">
        <header className="page-heading">
          <p className="page-kicker">함께한 시간의 작은 발자국</p>
          <h1>우리의 놀이 기록</h1>
          <p>아이의 반응과 즐거웠던 순간을 다시 만나보세요.</p>
        </header>
        <div className="record-period">
          <label>
            <span className="sr-only">기록 기간</span>
            <WebSelect
              aria-label="기록 기간"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {months.map((key) => (
                <option key={key} value={key}>
                  {key.replace("-", "년 ")}월
                </option>
              ))}
              <option value="all">전체 기록</option>
            </WebSelect>
          </label>
          <span>{filtered.length}개의 순간</span>
        </div>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        {filtered.length ? (
          <>
            <div className="record-summary-grid">
              <div className="record-summary">
                <Icon name="flower" />
                <strong>
                  {filtered.length}
                  <span>번</span>
                </strong>
                <p>함께 놀이했어요</p>
              </div>
              <div className="record-summary">
                <Icon name="clock" />
                <strong>
                  {days}
                  <span>일</span>
                </strong>
                <p>시간을 나눴어요</p>
              </div>
              <div className="record-summary">
                <Icon name="leaf" />
                <strong>
                  {areas.filter((item) => item.count > 0).length}
                  <span>가지</span>
                </strong>
                <p>발달 영역을 경험했어요</p>
              </div>
            </div>
            <div className="record-layout">
              <section className="record-area-panel">
                <h2>이런 놀이를 함께했어요</h2>
                <p>놀이에 담긴 발달 영역이에요.</p>
                <div className="area-bars">
                  {areas.map(({ area, count }) => (
                    <div key={area}>
                      <span>{DEV_AREA_LABELS[area]}</span>
                      <span className="area-bar">
                        <i
                          style={{
                            width: `${filtered.length ? (count / filtered.length) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <strong>{count}회</strong>
                    </div>
                  ))}
                </div>
                <p className="panel-note">
                  한 놀이에 여러 발달 영역이 담길 수 있어요.
                </p>
              </section>
              <section className="record-list">
                <h2>함께한 순간들</h2>
                {filtered.map((log) => {
                  const play = playMap.get(log.playId);
                  return (
                    <article className="record-entry" key={log.id}>
                      <Link
                        href={`/play/${log.playId}`}
                        className="record-entry-heading"
                      >
                        <img
                          src={play ? `/media/thumbs/${log.playId}.webp` : "/nori-icon.svg"}
                          alt=""
                          loading="lazy"
                        />
                        <div>
                          <time dateTime={log.completedAt}>
                            {new Date(log.completedAt).toLocaleDateString(
                              "ko-KR",
                              {
                                month: "long",
                                day: "numeric",
                                weekday: "short",
                              },
                            )}
                          </time>
                          <h3>{play?.name ?? "함께한 놀이"}</h3>
                          <p
                            className="record-stars"
                            aria-label={`즐거움 ${log.starRating ?? 0}점`}
                          >
                            {"★".repeat(log.starRating ?? 0)}
                            <span>{"☆".repeat(5 - (log.starRating ?? 0))}</span>
                          </p>
                        </div>
                        <Icon name="chevron" size={18} />
                      </Link>
                      {log.childReaction.length ? (
                        <div className="reaction-tags">
                          {log.childReaction.map((reaction) => (
                            <span key={reaction}>{reaction}</span>
                          ))}
                        </div>
                      ) : null}
                      {log.memo ? (
                        <p className="record-memo">{log.memo}</p>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            </div>
          </>
        ) : (
          <EmptyState title="함께한 순간을 기다리고 있어요">
            <p>
              놀이 상세에서 ‘이 놀이 해봤어요’를 눌러
              <br />
              아이의 반응을 남겨보세요.
            </p>
            <Link className="primary-button" href="/search">
              오늘의 놀이 찾아보기
              <Icon name="arrow" size={18} />
            </Link>
          </EmptyState>
        )}
        <PageFooter />
      </div>
    </WebPage>
  );
}
