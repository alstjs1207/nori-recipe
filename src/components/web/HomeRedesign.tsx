import { WebPage } from "./NoriUI";
import { Link } from "expo-router";
import { useState } from "react";
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
  age,
  onSaveMaterials,
}: {
  featured: Play | null;
  recommendations: Play[];
  otherPlays: Play[];
  selectedMaterials: MaterialSlug[];
  completedDates: Map<string, string>;
  allCompleted: boolean;
  age: number;
  onSaveMaterials: (materials: MaterialSlug[]) => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
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
  return (
    <WebPage>
      <div className="nori-page home-page">
        <header className="page-heading">
          <p className="page-kicker">집에 있는 재료로, 함께 자라는 시간</p>
          <h1>
            오늘의 놀이 발견
            <span className="heading-flower">
              <Icon name="flower" />
            </span>
          </h1>
          <p className="desktop-only">
            아이와 함께할 작은 즐거움을 찾아보세요.
          </p>
        </header>
        <button
          className="home-material-summary"
          type="button"
          onClick={() => setPickerOpen(true)}
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
            변경
            <Icon name="chevron" size={16} />
          </span>
        </button>
        {favorites.error ? (
          <p className="error-text" role="alert">
            {favorites.error}
          </p>
        ) : null}
        {allCompleted ? (
          <div className="home-celebration" role="status">
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${i * 5}%`,
                    animationDelay: `${(i % 5) * 0.12}s`,
                    background: ["#796BFF", "#FF9F99", "#FFD27D", "#70CDB3"][
                      i % 4
                    ],
                  }}
                />
              ))}
            </div>
            <Icon name="spark" size={28} />
            <div>
              <h2>오늘의 놀이를 모두 완료했어요</h2>
              <p>
                함께한 시간을 차곡차곡 쌓았어요. 재료를 바꾸면 새로운 놀이를
                추천해드려요.
              </p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setPickerOpen(true)}
            >
              새 추천 받기
            </button>
          </div>
        ) : null}
        <div className="home-layout">
          <section ref={featuredImpressionRef} className="home-featured" aria-label="오늘의 추천 놀이">
            {featured ? (
              <Link
                className="featured-card"
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
                <img
                  src={`/media/plays/${featured.id}.webp`}
                  alt=""
                  fetchPriority="high"
                />
                <span className="featured-category">
                  {getPlayCategoryLabel(featured)}
                  <NewPlayBadge createdAt={featured.createdAt} />
                </span>
                {completedDates.has(featured.id) ? (
                  <span className="completed-badge">
                    <Icon name="check" size={14} /> 완료
                  </span>
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
                    params: { situation: situation.value },
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
          <section className="home-together">
            <div className="section-heading">
              <h2>함께 추천하는 놀이</h2>
              <span className="section-note">
                {recommendations.length}개 중 {companions.length}개
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
              추천 3개는 완료할 때까지 그대로 만나볼 수 있어요.
            </p>
          </section>
        </div>
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
        {pickerOpen ? (
          <MaterialPicker
            selected={selectedMaterials}
            onSave={onSaveMaterials}
            onClose={() => setPickerOpen(false)}
          />
        ) : null}
      </div>
    </WebPage>
  );
}
