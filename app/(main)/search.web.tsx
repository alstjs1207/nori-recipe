import { WebPage } from "@/components/web/NoriUI";
import { NewPlayBadge } from "@/components/NewPlayBadge";
import { WebSelect } from "@/components/web/WebSelect";
import { Link, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rememberPlayEntry, trackAnalytics } from "@/analytics/analytics";
import { useWebAnalytics } from "@/components/web/WebAnalytics";
import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { searchPlays } from "@/play/search";
import {
  PLAY_CATEGORIES,
  formatAge,
  formatDuration,
  formatPreparation,
  type PlayCategory,
  type PlaySituation,
} from "@/play/presentation";
import { getAgeMonthsFromBirthMonth } from "@/onboarding/utils";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  BookmarkButton,
  EmptyState,
  Icon,
  PageFooter,
  useSelectedMaterials,
  useWebFavorites,
} from "@/components/web/NoriUI";
import type { PlayPlace } from "@/types";

const SITUATION_LABELS: Record<PlaySituation, string> = {
  quiet: "집에서 조용히",
  active: "에너지 발산",
  "no-materials": "필수 준비물 없이",
  bedtime: "잠들기 전",
};
function readSituation(
  value: string | string[] | undefined,
): PlaySituation | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate in SITUATION_LABELS
    ? (candidate as PlaySituation)
    : null;
}
function readPlace(value: string | string[] | undefined): PlayPlace | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "indoor" ||
    candidate === "outdoor" ||
    candidate === "any"
    ? candidate
    : null;
}

export default function SearchWebScreen() {
  const params = useLocalSearchParams<{ situation?: string; place?: string }>();
  const plays = usePlaysStore((state) => state.plays);
  const context = useSessionStore((state) => state.userContext);
  const profileAge =
    context.childBirthMonth === null
      ? null
      : getAgeMonthsFromBirthMonth(context.childBirthMonth);
  const materials = useSelectedMaterials();
  const favorites = useWebFavorites();
  const { consent } = useWebAnalytics();
  const [age, setAge] = useState<number | null>(profileAge);
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [category, setCategory] = useState<PlayCategory>("all");
  const [situation, setSituation] = useState<PlaySituation | null>(
    readSituation(params.situation),
  );
  const [place, setPlace] = useState<PlayPlace | null>(readPlace(params.place));
  const [readyOnly, setReadyOnly] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sort, setSort] = useState("recommended");
  useEffect(() => {
    setAge(profileAge);
  }, [profileAge]);
  useEffect(() => {
    setSituation(readSituation(params.situation));
    setPlace(readPlace(params.place));
  }, [params.situation, params.place]);
  const options = {
    ageMonths: age,
    place,
    query,
    durationMax: duration,
    category,
    situation,
    availableMaterials: materials,
    readyOnly,
    blockedMaterials: context.blockedMaterials,
    limit: Number.MAX_SAFE_INTEGER,
  };
  const results = useMemo(() => {
    const filtered = searchPlays(plays, options);
    return filtered.sort((left, right) => {
      if (sort === "shortest")
        return (
          left.durationMax - right.durationMax || left.prepTime - right.prepTime
        );
      if (sort === "preparation")
        return (
          left.prepTime - right.prepTime || left.durationMax - right.durationMax
        );
      const missing = (play: typeof left) =>
        play.materials.required.filter(
          (material) => !materials.includes(material),
        ).length;
      return missing(left) - missing(right) || left.prepTime - right.prepTime;
    });
  }, [
    plays,
    age,
    place,
    query,
    duration,
    category,
    situation,
    materials,
    readyOnly,
    context.blockedMaterials,
    sort,
  ]);
  const noMaterialsCount = searchPlays(plays, {
    ...options,
    situation: "no-materials",
  }).length;
  const extraCount =
    Number(readyOnly) + Number(place !== null && place !== "any");
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => trackAnalytics({ name: "search_results", params: {
      result_count: results.length, has_query: Number(query.trim().length > 0), category,
    } }), 600);
    return () => clearTimeout(timer);
  }, [query, age, duration, category, situation, place, readyOnly, sort, results.length, consent]));
  function reset() {
    setQuery("");
    setAge(profileAge);
    setDuration(null);
    setCategory("all");
    setSituation(null);
    setPlace(null);
    setReadyOnly(false);
    setMoreOpen(false);
  }
  return (
    <WebPage>
      <div className="nori-page search-page">
        <header className="page-heading">
          <p className="page-kicker">아이에게 맞는 작은 즐거움</p>
          <h1>어떤 놀이를 찾나요?</h1>
          <p className="desktop-only">
            놀이 이름이나 집에 있는 재료로 찾아보세요.
          </p>
        </header>
        <div className="search-controls">
          <div className="nori-search-input">
            <Icon name="search" size={24} />
            <label className="sr-only" htmlFor="play-search">
              놀이 이름이나 재료 검색
            </label>
            <input
              id="play-search"
              type="search"
              placeholder="놀이 이름이나 재료 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="search-filter-row">
            <label className="select-control">
              <span className="sr-only">놀이 추천 월령</span>
              <WebSelect
                aria-label="놀이 추천 월령"
                value={age ?? "all"}
                onChange={(event) =>
                  setAge(
                    event.target.value === "all"
                      ? null
                      : Number(event.target.value),
                  )
                }
              >
                <option value="all">전체 월령</option>
                {Array.from({ length: 49 }, (_, month) => (
                  <option key={month} value={month}>
                    {month}개월
                  </option>
                ))}
              </WebSelect>
            </label>
            <label className="select-control">
              <span className="sr-only">놀이 시간</span>
              <WebSelect
                aria-label="놀이 시간"
                value={duration ?? "all"}
                onChange={(event) =>
                  setDuration(
                    event.target.value === "all"
                      ? null
                      : Number(event.target.value),
                  )
                }
              >
                <option value="all">전체 시간</option>
                {[10, 20, 30, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes}분 이하
                  </option>
                ))}
              </WebSelect>
            </label>
            <button
              className={`icon-button filter-toggle ${moreOpen || extraCount ? "is-active" : ""}`}
              type="button"
              aria-label="추가 필터"
              aria-expanded={moreOpen}
              aria-controls="additional-filters"
              onClick={() => setMoreOpen(!moreOpen)}
            >
              <Icon name="sliders" />
              {extraCount ? (
                <span className="filter-count">{extraCount}</span>
              ) : null}
            </button>
          </div>
          {moreOpen ? (
            <div className="additional-filters" id="additional-filters">
              <fieldset>
                <legend>놀이 장소</legend>
                <div className="filter-pills">
                  {[
                    { value: "all", label: "어디서나" },
                    { value: "indoor", label: "실내" },
                    { value: "outdoor", label: "야외" },
                  ].map((item) => (
                    <label key={item.value}>
                      <input
                        type="radio"
                        name="place"
                        checked={(place ?? "all") === item.value}
                        onChange={() =>
                          setPlace(
                            item.value === "all"
                              ? null
                              : (item.value as PlayPlace),
                          )
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="ready-filter">
                <input
                  type="checkbox"
                  checked={readyOnly}
                  onChange={(event) => setReadyOnly(event.target.checked)}
                />
                <span>우리 집 재료로 가능한 놀이만</span>
              </label>
              <p>
                필수 재료가 모두 있는 놀이예요. 선택 재료는 없어도 괜찮아요.
              </p>
            </div>
          ) : null}
        </div>
        <div className="category-tabs" role="group" aria-label="놀이 분류">
          {PLAY_CATEGORIES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={category === item.value}
              className={category === item.value ? "is-active" : ""}
              onClick={() => setCategory(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {situation !== "no-materials" && noMaterialsCount > 0 ? (
          <button
            className="no-materials-banner"
            type="button"
            onClick={() => setSituation("no-materials")}
          >
            <Icon name="spark" size={31} />
            <span>
              <strong>재료가 없어도 괜찮아요</strong>
              <span>필수 준비물 없이 시작하는 놀이 {noMaterialsCount}개</span>
            </span>
            <Icon name="chevron" size={20} />
          </button>
        ) : null}
        {situation || readyOnly || (place && place !== "any") ? (
          <div className="active-filters">
            {situation ? (
              <button type="button" onClick={() => setSituation(null)}>
                {SITUATION_LABELS[situation]}
                <Icon name="close" size={14} />
              </button>
            ) : null}
            {readyOnly ? (
              <button type="button" onClick={() => setReadyOnly(false)}>
                우리 집 재료로 가능
                <Icon name="close" size={14} />
              </button>
            ) : null}
            {place && place !== "any" ? (
              <button type="button" onClick={() => setPlace(null)}>
                {place === "indoor" ? "실내" : "야외"}
                <Icon name="close" size={14} />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="search-result-heading">
          <p aria-live="polite">
            {age === null ? "찾은 놀이" : `${age}개월 아이에게 맞는 놀이`}{" "}
            <strong>{results.length}</strong>
          </p>
          <label>
            <span className="sr-only">놀이 정렬</span>
            <WebSelect
              variant="quiet"
              aria-label="놀이 정렬"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recommended">맞춤순</option>
              <option value="shortest">짧은 놀이순</option>
              <option value="preparation">준비 시간순</option>
            </WebSelect>
          </label>
        </div>
        {favorites.error ? (
          <p className="error-text" role="alert">
            {favorites.error}
          </p>
        ) : null}
        {results.length ? (
          <div className="search-results">
            {results.map((play) => (
              <article className="search-result" key={play.id}>
                <Link href={`/play/${play.id}`} className="search-result-link" onPress={() => rememberPlayEntry(play.id, "search")}>
                  <img
                    src={`/media/thumbs/${play.id}.webp`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="search-result-copy">
                    <h2>
                      {play.name} <NewPlayBadge createdAt={play.createdAt} />
                    </h2>
                    <span className="preparation-badge">
                      {play.materials.required.length === 0
                        ? "필수 준비물 없이"
                        : `필수 준비물 ${play.materials.required.length}개`}
                    </span>
                    <p>
                      {formatDuration(play)} · {formatAge(play)}
                    </p>
                    <div className="result-tags">
                      <span>
                        {DEV_AREA_LABELS[play.devAreas[0] ?? "cognitive"]}
                      </span>
                      <span className="prep-tag">
                        {formatPreparation(play)}
                      </span>
                    </div>
                  </div>
                </Link>
                <BookmarkButton
                  play={play}
                  saved={favorites.ids.has(play.id)}
                  busy={favorites.busyId === play.id}
                  onToggle={(id) => {
                    void favorites.toggle(id);
                  }}
                />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="조건에 맞는 놀이가 아직 없어요">
            <p>검색어를 짧게 바꾸거나 시간과 재료 조건을 줄여보세요.</p>
            <div className="empty-actions">
              <button className="primary-button" type="button" onClick={reset}>
                검색 조건 초기화
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  reset();
                  setAge(null);
                }}
              >
                전체 월령 둘러보기
              </button>
            </div>
          </EmptyState>
        )}
        <PageFooter />
      </div>
    </WebPage>
  );
}
