import { CompletionStamp } from "./CompletionStamp";
import { CompletionConfetti } from "./CompletionConfetti";
import { PlayImage } from "@/components/web/PlayImage.web";
import { WebPage } from "./NoriUI";
import { getPlayImageUrl } from "@/constants/playImageUrls";
import { AppLink as Link } from "@/navigation/AppLink";

import { useState, type ReactNode } from "react";
import { useNextRoundStart } from "./NextRoundStart";
import {
  MATERIAL_DISPLAY_NAMES,
  type MaterialSlug,
} from "@/constants/materials";
import {
  formatAge,
  formatDuration,
  formatPreparation,
  getPlayCategoryLabel,
  getMaterialStatus,
} from "@/play/presentation";
import type { Play } from "@/types";
import {
  Icon,
  PageFooter,
  PlayCard,
  useWebFavorites,
  EmptyState,
} from "./NoriUI";
import { MaterialPicker } from "./MaterialPicker";
import { NewPlayBadge } from "@/components/NewPlayBadge";
import { rememberPlayEntry, trackAnalytics } from "@/analytics/analytics";
import { isNewPlay } from "@/play/newPlay";
import { useRecommendationImpression } from "./WebAnalytics";
import { getMaterialRecommendationNotice } from "@/engine/materialFit";
import { getConditionalRecommendationNotice } from "@/engine/intentRecommendation";

const situations = [
  { value: "quiet", label: "집에서 조용히", icon: "home", tone: "purple" },
  { value: "active", label: "에너지 발산", icon: "run", tone: "blue" },
  {
    value: "no-materials",
    label: "준비물 없이 바로",
    icon: "spark",
    tone: "peach",
  },
  { value: "bedtime", label: "잠들기 전", icon: "moon", tone: "mint" },
] as const;

export function HomeRedesign({
  featured,
  recommendations,
  otherPlays,
  selectedMaterials,
  completedDates,
  allCompleted,
  celebrateCompletion,
  age,
  onSaveMaterials,
  onStartNextRound,
  intentOptions,
  recommendationError,
  onRetryRecommendations,
}: {
  featured: Play | null;
  recommendations: Play[];
  otherPlays: Play[];
  selectedMaterials: MaterialSlug[];
  completedDates: Map<string, string>;
  allCompleted: boolean;
  celebrateCompletion: boolean;
  age: number;
  onSaveMaterials: (materials: MaterialSlug[]) => Promise<void>;
  onStartNextRound: () => Promise<void>;
  intentOptions?: ReactNode;
  recommendationError?: string | null;
  onRetryRecommendations?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const nextRound = useNextRoundStart();
  const { starting } = nextRound;
  const favorites = useWebFavorites();
  const featuredImpressionRef = useRecommendationImpression<HTMLElement>(featured ?? undefined, 1);
  const summary = selectedMaterials.length
    ? selectedMaterials
        .slice(0, 3)
        .map((material) => MATERIAL_DISPLAY_NAMES[material])
        .join(" · ")
    : "선택한 재료가 없어요";
  const companions = recommendations.filter((play) => play.id !== featured?.id);
  const status = featured
    ? getMaterialStatus(featured, selectedMaterials)
    : null;
  const materialNotice = getMaterialRecommendationNotice(recommendations, selectedMaterials);
  const conditionalNotice = getConditionalRecommendationNotice(recommendations, selectedMaterials, age);
  const completedCount = recommendations.filter(play => completedDates.has(play.id)).length;
  const challengeTitles = ["놀이 3개, 함께해봐요", "첫 놀이를 함께했어요", "남은 한 놀이도 함께해요", "세 가지 놀이 완성!"];
  return (
    <WebPage>
      <CompletionConfetti active={celebrateCompletion && allCompleted} />
      <div className="nori-page home-page">
        <header className="page-heading">
          <p className="page-kicker">집에 있는 재료로, 함께 자라는 시간</p>
          <h1>
            오늘의 놀이 발견
            <span className="heading-flower">
              <Icon name="flower" />
            </span>
          </h1>
          <p className="home-age-summary">
            {age}개월 아이에게 맞춘 놀이를 만나보세요.
          </p>
        </header>
        <section className="home-challenge" aria-label="이번 놀이 도전">
          <div className="home-challenge-heading">
            <div><p><Icon name="spark" size={14} /> 이번 놀이 도전</p><h2>{challengeTitles[completedCount]}</h2></div>
            <strong aria-label={`3개 중 ${completedCount}개 완료`}>{completedCount}<span> / 3</span></strong>
          </div>
          <div className="home-challenge-track" aria-hidden="true">{[0, 1, 2].map(index => <span key={index} className={index < completedCount ? "is-completed" : ""} />)}</div>
          {allCompleted ? <Link href="/record" className="home-challenge-record">완성한 놀이 보기 <Icon name="arrow" size={14} /></Link> : null}
        </section>
        {allCompleted ? <section className="home-next-round" aria-label="다음 놀이 시작">
          <button type="button" className="primary-button" disabled={starting} onClick={() => { setStartError(null); void nextRound.run(onStartNextRound).catch(() => setStartError("다음 놀이를 준비하지 못했어요. 다시 시도해 주세요.")); }}>
            {starting ? "다음 놀이 준비 중…" : "다음 놀이 3개 시작"}<Icon name="arrow" size={18} />
          </button>
          {startError ? <p className="error-text" role="alert">{startError}</p> : null}
        </section> : null}
        <button
          className="home-material-summary"
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={starting}
        >
          <span className="summary-icon">
            <Icon name="sliders" size={20} />
          </span>
          <span>
            <strong>우리 집 재료</strong>
            <span className="summary-materials">
              {summary}
              {selectedMaterials.length > 3
                ? ` 외 ${selectedMaterials.length - 3}개`
                : ""}
            </span>
          </span>
          <span className="summary-edit">
            재료 바꾸기
            <Icon name="chevron" size={16} />
          </span>
        </button>
        <p className="recommendation-material-note"><Icon name="info" size={14} /><span>{allCompleted ? "다음 놀이를 시작해도 완성한 묶음은 기록에 남아요." : completedCount ? `재료를 바꿔도 완료한 ${completedCount}개는 그대로 이어가요.` : "재료를 바꾸면 놀이 3개를 다시 추천해요."}</span></p>
        {materialNotice ? (
          <p className="recommendation-material-note" role="status">
            <Icon name="info" size={14} />
            <span>{materialNotice}</span>
          </p>
        ) : null}
        {intentOptions}
        {recommendationError ? (
          <p className="error-text" role="alert">
            {recommendationError}{" "}
            <button type="button" className="text-button" onClick={onRetryRecommendations}>다시 시도</button>
          </p>
        ) : null}
        {conditionalNotice ? (
          <div className="recommendation-care-note" role="status">
            <Icon name="person" size={16} />
            <div>
              <strong>함께 도와주세요</strong>
              <p>{conditionalNotice}</p>
            </div>
          </div>
        ) : null}
        {favorites.error ? (
          <p className="error-text" role="alert">
            {favorites.error}
          </p>
        ) : null}
        <section className="home-recommendations" aria-labelledby="home-recommendations-title">
          <div className="section-heading recommendation-heading">
            <h2 id="home-recommendations-title">우리 집 재료로 추천하는 놀이 {recommendations.length}개</h2>
          </div>
          <div className="home-layout">
            <section ref={featuredImpressionRef} className="home-featured" aria-label="오늘의 추천 놀이">
              {featured ? (
                <Link
                  className={`featured-card ${completedDates.has(featured.id) ? "is-completed" : ""}`}
                  onPress={() => {
                    rememberPlayEntry(featured.id, "home_recommendation");
                    trackAnalytics({ name: "recommendation_click", params: { play_id: featured.id, position: 1, is_new: Number(isNewPlay(featured.createdAt)) } });
                  }}
                  href={{
                    pathname: "/play/[id]",
                    params: {
                      id: featured.id,
                      materials: selectedMaterials.join(","),
                    },
                  }}
                >
                  <PlayImage
                    src={getPlayImageUrl(featured.id)}
                    alt=""
                    fetchPriority="high"
                  />
                  <span className="featured-category">
                    {getPlayCategoryLabel(featured)}
                    <NewPlayBadge createdAt={featured.createdAt} />
                  </span>
                  {completedDates.has(featured.id) ? (
                    <CompletionStamp />
                  ) : null}
                  <div className="featured-copy">
                    <p>오늘의 추천 놀이</p>
                    <h2>{featured.name}</h2>
                    <div className="featured-meta">
                      {formatDuration(featured)}
                      <span>·</span>
                      {formatPreparation(featured)}
                    </div>
                    <span className="featured-age">
                      {formatAge(featured)} · {status?.label}
                    </span>
                  </div>
                  <span className="featured-arrow">
                    <Icon name="arrow" size={28} />
                  </span>
                </Link>
              ) : (
                <EmptyState title="추천할 놀이를 찾고 있어요">
                  <p>우리 집 재료와 아이의 월령을 확인해 주세요.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPickerOpen(true)}
                  >
                    재료 선택하기
                  </button>
                </EmptyState>
              )}
            </section>
            <section className="home-together">
              <div className="section-heading">
                <h2>함께 추천하는 놀이</h2>
                <span className="section-note">
                  나머지 {companions.length}개
                </span>
              </div>
              <div className="recommendation-grid">
                {companions.map((play, index) => (
                  <PlayCard
                    key={play.id}
                    play={play}
                    entryPoint="home_recommendation"
                    recommendationPosition={index + 2}
                    materials={selectedMaterials}
                    saved={favorites.ids.has(play.id)}
                    onToggle={(id) => {
                      void favorites.toggle(id);
                    }}
                    completedAt={completedDates.get(play.id)}
                  />
                ))}
              </div>
              <p className="recommendation-note">
                재료를 바꾸면 완료한 놀이는 유지하고 남은 놀이만 다시 추천해요.
              </p>
            </section>
          </div>
        </section>
        <section className="home-situations">
          <div className="section-heading">
            <h2>지금 우리에게 필요한 놀이</h2>
          </div>
          <div className="situation-grid">
            {situations.map((situation) => (
              <Link
                key={situation.value}
                href={{
                  pathname: "/search",
                  params: { situation: situation.value, reset: "1" },
                }}
                className={`situation-tile tone-${situation.tone}`}
              >
                <Icon name={situation.icon} size={28} />
                <span>{situation.label}</span>
                <Icon name="chevron" size={16} />
              </Link>
            ))}
          </div>
        </section>
        <section className="home-discover">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{age}개월 아이와 함께</span>
              <h2>가볍게 시작하는 다른 놀이</h2>
            </div>
            <Link href="/search" className="section-link">
              더보기
              <Icon name="chevron" size={16} />
            </Link>
          </div>
          <div className="discovery-grid">
            {otherPlays.slice(0, 4).map((play) => (
              <PlayCard
                compact
                entryPoint="home_discover"
                key={play.id}
                play={play}
                saved={favorites.ids.has(play.id)}
                onToggle={(id) => {
                  void favorites.toggle(id);
                }}
                materials={selectedMaterials}
                completedAt={completedDates.get(play.id)}
              />
            ))}
          </div>
        </section>
        <PageFooter />
        {nextRound.notice}
        {pickerOpen ? (
          <MaterialPicker
            selected={selectedMaterials}
            onSave={onSaveMaterials}
            startNextRound={(materials) => nextRound.run(() => onSaveMaterials(materials))}
            onClose={() => setPickerOpen(false)}
            completedCount={completedCount}
          />
        ) : null}
      </div>
    </WebPage>
  );
}
