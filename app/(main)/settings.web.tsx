import { WebPage } from "@/components/web/NoriUI";
import { WebSelect } from "@/components/web/WebSelect";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { MATERIAL_DISPLAY_NAMES } from "@/constants/materials";
import { resetUserActivity } from "@/db/queries";
import {
  getAgeMonthsFromBirthMonth,
  getBirthMonthOptions,
} from "@/onboarding/utils";
import { useSessionStore } from "@/store/sessionStore";
import {
  Icon,
  PageFooter,
  useSelectedMaterials,
} from "@/components/web/NoriUI";
import { MaterialPicker } from "@/components/web/MaterialPicker";

export default function SettingsWebScreen() {
  const profile = useSessionStore((state) => state.userContext);
  const guestId = useSessionStore((state) => state.guestId);
  const initialName = useSessionStore((state) => state.childName);
  const upsert = useSessionStore((state) => state.upsertUserContext);
  const updateProfile = useSessionStore(
    (state) => state.updateOnboardingProfile,
  );
  const setTodayMaterials = useSessionStore((state) => state.setTodayMaterials);
  const resetLocalData = useSessionStore((state) => state.resetLocalData);
  const clearPins = useSessionStore(
    (state) => state.clearPinnedHomeRecommendations,
  );
  const materials = useSelectedMaterials();
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState<number | null>(
    profile.childBirthMonth === null
      ? null
      : Math.min(48, getAgeMonthsFromBirthMonth(profile.childBirthMonth)),
  );
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState<"activity" | "all" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const current = useSessionStore.getState();
      setName(current.childName);
      setAge(
        current.userContext.childBirthMonth === null
          ? null
          : Math.min(
              48,
              getAgeMonthsFromBirthMonth(current.userContext.childBirthMonth),
            ),
      );
      setConfirm(null);
      setPicker(false);
      setError(null);
      setNotice(null);
    }, []),
  );
  async function saveProfile() {
    if (saving || age === null) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const option = getBirthMonthOptions().find(
        (item) => item.ageMonths === age,
      );
      if (!option) return;
      await upsert({
        ...useSessionStore.getState().userContext,
        childBirthMonth: option.monthIndex,
      });
      await updateProfile({ childName: name.trim() });
      await useSessionStore.getState().completeOnboarding();
      setNotice("아이의 설정을 저장했어요.");
    } catch {
      setError("설정을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }
  async function reset() {
    if (!guestId || saving || !confirm) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (confirm === "all") {
        await resetLocalData();
        router.replace("/start");
      } else {
        const context = await resetUserActivity(guestId);
        useSessionStore.setState({ userContext: context });
        await clearPins();
        setNotice("놀이 기록과 저장한 놀이를 비웠어요.");
      }
      setConfirm(null);
    } catch {
      setError("초기화하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <WebPage>
      <div className="nori-page settings-page">
        <header className="page-heading">
          <p className="page-kicker">우리 가족에게 맞게</p>
          <h1>아이와 우리 집 설정</h1>
          <p>월령과 재료를 바꾸면 추천도 함께 맞춰져요.</p>
        </header>
        {notice ? (
          <p className="status-text" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <form
          className="settings-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <h2>아이의 이야기</h2>
          <label className="settings-field">
            아이의 이름{" "}
            <input
              value={name}
              maxLength={20}
              placeholder="편하게 부르는 이름을 알려주세요"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="settings-field">
            아이의 월령
            <WebSelect
              variant="form"
              className="age-select"
              aria-label="아이 월령 설정"
              value={age ?? ""}
              onChange={(event) =>
                setAge(
                  event.target.value === "" ? null : Number(event.target.value),
                )
              }
            >
              <option value="">월령을 선택해 주세요</option>
              {Array.from({ length: 49 }, (_, month) => (
                <option key={month} value={month}>
                  {month}개월
                </option>
              ))}
            </WebSelect>
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={age === null || saving}
          >
            {saving ? "저장 중…" : "아이 설정 저장"}
            <Icon name="check" size={18} />
          </button>
        </form>
        <section className="settings-panel">
          <h2>우리 집 재료</h2>
          <div className="settings-materials">
            {materials.length ? (
              materials.map((material) => (
                <span key={material}>{MATERIAL_DISPLAY_NAMES[material]}</span>
              ))
            ) : (
              <p>선택한 재료가 없어요.</p>
            )}
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setPicker(true)}
          >
            재료 변경하기
            <Icon name="sliders" size={18} />
          </button>
        </section>
        <section className="settings-panel">
          <h2>이용 안내</h2>
          <details>
            <summary>기록은 어디에 저장되나요?</summary>
            <p>
              설정, 저장한 놀이, 놀이 기록은 현재 브라우저에 보관돼요. 다른
              기기나 브라우저와 자동으로 공유되지 않으며, 브라우저 데이터를
              지우면 함께 삭제될 수 있어요.
            </p>
          </details>
          <details>
            <summary>홈 화면에서 바로 열고 싶어요</summary>
            <p>
              iPhone은 Safari의 공유 메뉴에서 ‘홈 화면에 추가’를, Android는
              브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.
              한 번 본 놀이와 이미지는 오프라인에서도 볼 수 있어요.
            </p>
          </details>
          <details>
            <summary>아이에게 맞는 놀이인가요?</summary>
            <p>
              월령은 놀이를 고르는 참고 기준이에요. 아이마다 발달과 관심이
              다르니 아이의 반응을 살피며 시간을 조절해 주세요. 놀이 전 준비물과
              안전 안내를 확인하고 보호자가 가까이에서 함께해 주세요.
            </p>
          </details>
        </section>
        <section className="settings-panel">
          <h2>기록 관리</h2>
          <button
            className="settings-reset-button"
            type="button"
            disabled={saving}
            onClick={() =>
              setConfirm(confirm === "activity" ? null : "activity")
            }
          >
            놀이 기록과 저장한 놀이 비우기
            <Icon name="chevron" size={17} />
          </button>
          <button
            className="settings-reset-button"
            type="button"
            disabled={saving}
            onClick={() => setConfirm(confirm === "all" ? null : "all")}
          >
            모든 설정과 기록 초기화
            <Icon name="chevron" size={17} />
          </button>
          {confirm ? (
            <div className="settings-confirmation">
              <p>
                {confirm === "all"
                  ? "아이 설정, 재료, 저장한 놀이와 기록을 모두 지워요."
                  : "놀이 기록과 저장한 놀이를 지워요. 아이 설정과 재료는 그대로 남아요."}
                <br />
                삭제한 기록은 되돌릴 수 없어요.
              </p>
              <div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirm(null)}
                >
                  취소
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void reset();
                  }}
                >
                  {saving ? "처리 중…" : "지우기"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
        <PageFooter />
        {picker ? (
          <MaterialPicker
            selected={materials}
            onClose={() => setPicker(false)}
            onSave={async (selected) => {
              await upsert({
                ...useSessionStore.getState().userContext,
                ownedMaterials: selected,
              });
              await setTodayMaterials(selected);
              setNotice("우리 집 재료를 저장했어요.");
            }}
          />
        ) : null}
      </div>
    </WebPage>
  );
}
