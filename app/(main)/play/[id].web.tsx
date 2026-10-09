import { WebPage } from "@/components/web/NoriUI";
import { NewPlayBadge } from "@/components/NewPlayBadge";
import {
  Link,
  router,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { getMaterialImageUrl } from "@/constants/materialImageUrls";
import {
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_SLUGS,
  type MaterialSlug,
} from "@/constants/materials";
import { getLatestPlayLog } from "@/db/queries";
import {
  formatAge,
  formatDuration,
  formatPreparation,
  getPlayCategoryLabel,
  getMaterialStatus,
} from "@/play/presentation";
import { getPlaySafetyNotes } from "@/play/safety";
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
import {
  PlayShareButton,
  PlayWebActionsProvider,
} from "@/components/web/PlayWebActions";

const tabs = [
  { id: "methods", label: "놀이 방법" },
  { id: "development", label: "발달 포인트" },
  { id: "safety", label: "안전 팁" },
] as const;
type TabId = (typeof tabs)[number]["id"];

export default function PlayDetailWebScreen() {
  const params = useLocalSearchParams<{ id?: string; materials?: string }>();
  const play = usePlaysStore((state) =>
    state.plays.find((item) => item.id === params.id),
  );
  const guestId = useSessionStore((state) => state.guestId);
  const profileMaterials = useSelectedMaterials();
  const materials =
    params.materials === undefined
      ? profileMaterials
      : params.materials
          .split(",")
          .filter((material): material is MaterialSlug =>
            MATERIAL_SLUGS.includes(material as MaterialSlug),
          );
  const favorites = useWebFavorites();
  const [tab, setTab] = useState<TabId>("methods");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    setTab("methods");
    setCompletedAt(null);
  }, [params.id]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (guestId && play)
        void getLatestPlayLog(guestId, play.id)
          .then((log) => {
            if (active) setCompletedAt(log?.completedAt ?? null);
          })
          .catch(() => {
            if (active) setCompletedAt(null);
          });
      return () => {
        active = false;
      };
    }, [guestId, play?.id]),
  );
  function back() {
    if (router.canGoBack()) router.back();
    else router.replace("/(main)");
  }
  function navigateTabs(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  }
  if (!play)
    return (
      <WebPage>
        <div className="nori-page">
          <EmptyState title="놀이를 찾을 수 없어요">
            <p>다른 놀이를 찾아볼까요?</p>
            <Link className="primary-button" href="/search">
              놀이 탐색하기
            </Link>
          </EmptyState>
        </div>
      </WebPage>
    );
  const safety = getPlaySafetyNotes(play);
  const status = getMaterialStatus(play, materials);
  const allMaterials = [
    ...play.materials.required.map((slug) => ({ slug, optional: false })),
    ...play.materials.optional.map((slug) => ({ slug, optional: true })),
  ];
  return (
    <PlayWebActionsProvider play={play}>
      <WebPage className="detail-scroll" key={play.id}>
        <article className="nori-page detail-page">
          <div className="detail-overview">
            <div className="detail-art">
              <img
                src={`/media/plays/${play.id}.webp`}
                alt={`${play.name} 놀이 일러스트`}
                fetchPriority="high"
              />
              <div className="detail-art-controls">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="뒤로 가기"
                  onClick={back}
                >
                  <Icon name="back" />
                </button>
                <BookmarkButton
                  play={play}
                  saved={favorites.ids.has(play.id)}
                  busy={favorites.busyId === play.id}
                  onToggle={(id) => {
                    void favorites.toggle(id);
                  }}
                />
              </div>
            </div>
            <header className="detail-heading">
              <div className="play-card-labels">
                <span className="eyebrow">{getPlayCategoryLabel(play)}</span>
                <NewPlayBadge createdAt={play.createdAt} />
              </div>
              <h1>{play.name}</h1>
              <p className="detail-intro">
                {play.educationalEffects[0] ??
                  "아이의 속도에 맞춰, 함께 놀이해요."}
              </p>
              <dl className="detail-metadata">
                <div>
                  <dt>
                    <Icon name="child" size={20} />
                    <span className="sr-only">대상 월령</span>
                  </dt>
                  <dd>{formatAge(play)}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="clock" size={20} />
                    <span className="sr-only">놀이 시간</span>
                  </dt>
                  <dd>{formatDuration(play)}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="timer" size={20} />
                    <span className="sr-only">준비 시간</span>
                  </dt>
                  <dd>{formatPreparation(play)}</dd>
                </div>
              </dl>
              <div className="detail-heading-actions">
                <PlayShareButton />
                {completedAt ? (
                  <span className="detail-completed">
                    <Icon name="check" size={15} />
                    {new Date(completedAt).toLocaleDateString("ko-KR", {
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    함께한 놀이
                  </span>
                ) : (
                  <span
                    className={`material-status ${status.ready ? "is-ready" : ""}`}
                  >
                    {status.label}
                  </span>
                )}
              </div>
              {favorites.error ? (
                <p className="error-text" role="alert">
                  {favorites.error}
                </p>
              ) : null}
            </header>
          </div>
          <div className="detail-content-layout">
            <aside className="detail-preparation">
              <div className="section-heading">
                <h2>이것만 준비해요</h2>
                <span className="section-note">{formatPreparation(play)}</span>
              </div>
              <p className="material-legend">
                <span className="owned-dot">
                  <Icon name="check" size={12} />
                </span>
                우리 집에 있는 재료 · 선택 재료는 없어도 괜찮아요
              </p>
              {allMaterials.length ? (
                <div className="detail-material-grid">
                  {allMaterials.map(({ slug, optional }) => (
                    <div
                      className={`detail-material ${optional ? "is-optional" : ""}`}
                      key={slug}
                    >
                      <div className="detail-material-image">
                        <img
                          src={getMaterialImageUrl(slug)}
                          alt=""
                          loading="lazy"
                        />
                        {materials.includes(slug) ? (
                          <span
                            className="material-owned"
                            aria-label="우리 집에 있는 재료"
                          >
                            <Icon name="check" size={14} />
                          </span>
                        ) : null}
                      </div>
                      <strong>{MATERIAL_DISPLAY_NAMES[slug]}</strong>
                      <span>
                        {optional ? "선택" : "필수"}
                        {!materials.includes(slug) && !optional
                          ? " · 준비 필요"
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-materials-note">
                  <Icon name="spark" size={27} />
                  <div>
                    <strong>준비물 없이 함께해요</strong>
                    <p>편안한 공간과 보호자의 관심이면 충분해요.</p>
                  </div>
                </div>
              )}
              <div className="essential-safety">
                <Icon name="spark" size={18} />
                <div>
                  <strong>시작 전에 확인해 주세요</strong>
                  <p>{safety[0]}</p>
                </div>
              </div>
              <p className="safety-reminder">
                보호자가 곁에서 아이의 반응을 살펴주세요.
              </p>
            </aside>
            <div className="detail-guide">
              <div
                className="detail-tabs"
                role="tablist"
                aria-label="놀이 안내"
              >
                {tabs.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    id={`tab-${item.id}`}
                    aria-controls={`panel-${item.id}`}
                    aria-selected={tab === item.id}
                    tabIndex={tab === item.id ? 0 : -1}
                    ref={(element) => {
                      tabRefs.current[index] = element;
                    }}
                    onClick={() => setTab(item.id)}
                    onKeyDown={(event) => navigateTabs(event, index)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <section
                className="detail-tab-panel"
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
                tabIndex={0}
              >
                {tab === "methods" ? (
                  <>
                    <h2>이렇게 놀아요</h2>
                    <ol className="play-steps">
                      {play.steps.map((step, index) => (
                        <li key={index}>
                          <span className="step-number" aria-hidden="true">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ol>
                    <div className="parenting-tip">
                      <Icon name="leaf" size={27} />
                      <p>
                        {play.tip ??
                          "정답을 알려주기보다 아이가 시도하는 과정을 함께 응원해 주세요."}
                      </p>
                    </div>
                  </>
                ) : null}
                {tab === "development" ? (
                  <>
                    <h2>놀이 속에서 자라요</h2>
                    <div className="development-tags">
                      {play.devAreas.map((area) => (
                        <span key={area}>{DEV_AREA_LABELS[area]}</span>
                      ))}
                    </div>
                    <ul className="detail-notes">
                      {play.educationalEffects.map((effect) => (
                        <li key={effect}>{effect}</li>
                      ))}
                    </ul>
                    <p className="panel-note">
                      아이마다 관심과 발달 속도가 달라요. 즐기는 만큼 천천히
                      함께해 주세요.
                    </p>
                  </>
                ) : null}
                {tab === "safety" ? (
                  <>
                    <h2>안전하게 함께해요</h2>
                    <ul className="detail-notes safety-notes">
                      {safety.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
              <section className="optional-record">
                <span className="record-icon">
                  <Icon name="chart" size={26} />
                </span>
                <div>
                  <h2>
                    {completedAt
                      ? "오늘도 함께했다면"
                      : "함께한 순간을 남겨볼까요?"}
                  </h2>
                  <p>아이의 반응을 짧게 남겨두세요. 기록은 선택이에요.</p>
                </div>
                <Link
                  className="secondary-button"
                  href={`/feedback/${play.id}`}
                >
                  이 놀이 해봤어요
                  <Icon name="arrow" size={18} />
                </Link>
              </section>
            </div>
          </div>
          <PageFooter />
        </article>
      </WebPage>
    </PlayWebActionsProvider>
  );
}
