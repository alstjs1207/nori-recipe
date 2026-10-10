import { WebPage } from "./NoriUI";
import { WebSelect } from "./WebSelect";
import { useState } from "react";
import { Link, router } from "expo-router";
import {
  getAgeMonthsFromBirthMonth,
  getBirthMonthOptions,
} from "@/onboarding/utils";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import { trackAnalytics } from "@/analytics/analytics";
import {
  Icon,
  PageFooter,
  PlayCard,
  useSelectedMaterials,
  useWebFavorites,
} from "./NoriUI";

export function WebWelcome() {
  const profile = useSessionStore((state) => state.userContext);
  const upsertUserContext = useSessionStore((state) => state.upsertUserContext);
  const completeOnboarding = useSessionStore(
    (state) => state.completeOnboarding,
  );
  const plays = usePlaysStore((state) => state.plays);
  const materials = useSelectedMaterials();
  const favorites = useWebFavorites();
  const [age, setAge] = useState<number | null>(
    profile.childBirthMonth === null
      ? null
      : Math.min(48, getAgeMonthsFromBirthMonth(profile.childBirthMonth)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = ["play_013", "play_081", "play_164"].flatMap((id) =>
    plays.filter((play) => play.id === id),
  );
  async function start() {
    if (age === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      const option = getBirthMonthOptions().find(
        (item) => item.ageMonths === age,
      );
      if (!option) throw new Error("월령을 선택해 주세요.");
      await upsertUserContext({
        ...profile,
        childBirthMonth: option.monthIndex,
      });
      await completeOnboarding();
      trackAnalytics({ name: "tutorial_complete" });
      router.replace("/(main)");
    } catch {
      setError("저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <WebPage>
      <div className="nori-page welcome-page">
        <div className="welcome-layout">
          <div className="welcome-copy">
            <span className="welcome-eyebrow">0–48개월 · 집에 있는 재료로</span>
            <h1>
              아이와의 오늘을,
              <br />
              <em>더 즐겁게.</em>
            </h1>
            <p>
              거창한 준비 없이도 괜찮아요.
              <br />
              아이의 월령과 우리 집 재료에 맞는
              <br className="mobile-only" /> 놀이를 만나보세요.
            </p>
            <div className="welcome-art">
              <img
                src="/media/plays/play_013.webp"
                alt="아이와 함께하는 그림 놀이"
                fetchPriority="high"
              />
              <span>
                <Icon name="leaf" size={22} />
                작은 놀이로 함께 자라요
              </span>
            </div>
          </div>
          <section className="welcome-start">
            <span className="eyebrow">오늘의 첫 놀이</span>
            <h2>우리 아이는 몇 개월인가요?</h2>
            <p>월령을 알려주시면 지금 즐기기 좋은 놀이를 추천해드려요.</p>
            <label htmlFor="child-age">아이의 월령</label>
            <WebSelect
              id="child-age"
              variant="form"
              aria-label="아이 월령"
              value={age ?? ""}
              onChange={(event) =>
                setAge(
                  event.target.value === "" ? null : Number(event.target.value),
                )
              }
              className="age-select"
            >
              <option value="">월령을 선택해 주세요</option>
              {Array.from({ length: 49 }, (_, month) => (
                <option key={month} value={month}>
                  {month}개월
                  {month >= 12 ? ` · 만 ${Math.floor(month / 12)}세` : ""}
                </option>
              ))}
            </WebSelect>
            <button
              className="primary-button"
              disabled={age === null || saving}
              type="button"
              onClick={() => {
                void start();
              }}
            >
              {saving ? "추천 준비 중…" : "맞춤 놀이 만나보기"}
              <Icon name="arrow" size={20} />
            </button>
            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}
            <p className="welcome-note">
              종이, 그릇, 컵, 크레용으로 시작해요.
              <br />
              우리 집 재료는 언제든 바꿀 수 있어요.
            </p>
            <Link className="welcome-browse" href="/search">
              먼저 놀이 둘러보기
              <Icon name="chevron" size={15} />
            </Link>
            <p className="local-data-note">
              회원가입 없이 시작해요.
              <br />
              설정과 기록은 이 브라우저에 저장돼요.
            </p>
          </section>
        </div>
        <section>
          <div className="section-heading">
            <h2>이런 놀이를 만나볼 수 있어요</h2>
          </div>
          <div className="welcome-previews">
            {previews.map((play) => (
              <PlayCard
                entryPoint="welcome"
                key={play.id}
                play={play}
                saved={favorites.ids.has(play.id)}
                onToggle={(id) => {
                  void favorites.toggle(id);
                }}
                materials={materials}
              />
            ))}
          </div>
        </section>
        <PageFooter />
      </div>
    </WebPage>
  );
}
