import { WebPage } from "@/components/web/NoriUI";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  CHILD_REACTION_OPTIONS,
  type ChildReactionOption,
} from "@/constants/feedback";
import { recordPlayFeedback } from "@/db/queries";
import { useSessionStore } from "@/store/sessionStore";
import { usePlaysStore } from "@/store/playsStore";
import { EmptyState, Icon, PageFooter } from "@/components/web/NoriUI";

const ratings = [
  { emoji: "😕", label: "많이 아쉬웠어요" },
  { emoji: "😐", label: "조금 아쉬웠어요" },
  { emoji: "🙂", label: "보통이었어요" },
  { emoji: "😊", label: "즐거워했어요" },
  { emoji: "😆", label: "아주 즐거워했어요" },
];
export default function FeedbackWebScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const play = usePlaysStore((state) =>
    state.plays.find((item) => item.id === id),
  );
  const guestId = useSessionStore((state) => state.guestId);
  const [rating, setRating] = useState(0);
  const [reactions, setReactions] = useState<ChildReactionOption[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRating(0);
    setReactions([]);
    setMemo("");
    setError(null);
  }, [id]);
  async function save() {
    if (!guestId || !play || saving) return;
    if (!rating) {
      setError("놀이가 얼마나 즐거웠는지 골라주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const context = await recordPlayFeedback(
        guestId,
        play.id,
        rating,
        reactions,
        memo.trim() || null,
      );
      useSessionStore.setState({ userContext: context });
      router.replace({
        pathname: "/(main)",
        params: { completedPlayId: play.id },
      });
    } catch {
      setError("기록을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <WebPage>
      <div className="nori-page feedback-page">
        <button
          className="text-button feedback-back"
          type="button"
          disabled={saving}
          onClick={() =>
            router.canGoBack() ? router.back() : router.replace("/(main)")
          }
        >
          <Icon name="back" size={18} />
          놀이로 돌아가기
        </button>
        {play ? (
          <>
            <header className="page-heading">
              <p className="page-kicker">짧게 남겨도 충분해요</p>
              <h1>함께한 순간 남기기</h1>
            </header>
            <div className="feedback-play">
              <img src={`/media/thumbs/${play.id}.webp`} alt="" />
              <div>
                <time dateTime={new Date().toISOString()}>
                  {new Date().toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <h2>{play.name}</h2>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <fieldset className="feedback-rating">
                <legend>
                  아이에게 어떤 시간이었나요? <span>필수</span>
                </legend>
                <div className="rating-options">
                  {ratings.map((item, index) => (
                    <label
                      key={item.label}
                      className={rating === index + 1 ? "is-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="rating"
                        value={index + 1}
                        checked={rating === index + 1}
                        onChange={() => {
                          setRating(index + 1);
                          setError(null);
                        }}
                      />
                      <span className="rating-emoji" aria-hidden="true">
                        {item.emoji}
                      </span>
                      <span>{index + 1}점</span>
                      <span className="sr-only">{item.label}</span>
                    </label>
                  ))}
                </div>
                {rating ? (
                  <p className="rating-label">{ratings[rating - 1].label}</p>
                ) : null}
              </fieldset>
              <fieldset className="feedback-reactions">
                <legend>
                  기억에 남는 아이의 반응 <span>선택</span>
                </legend>
                <div>
                  {CHILD_REACTION_OPTIONS.map((reaction) => (
                    <label
                      className={
                        reactions.includes(reaction) ? "is-selected" : ""
                      }
                      key={reaction}
                    >
                      <input
                        type="checkbox"
                        checked={reactions.includes(reaction)}
                        onChange={() =>
                          setReactions((current) =>
                            current.includes(reaction)
                              ? current.filter((item) => item !== reaction)
                              : [...current, reaction],
                          )
                        }
                      />
                      <span>{reaction}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="feedback-memo" htmlFor="play-memo">
                <strong>
                  기억하고 싶은 한마디 <span>선택</span>
                </strong>
                <textarea
                  id="play-memo"
                  placeholder="아이가 좋아했던 순간을 남겨보세요."
                  value={memo}
                  maxLength={100}
                  rows={3}
                  onChange={(event) => setMemo(event.target.value)}
                />
                <span>{memo.length}/100</span>
              </label>
              {error ? (
                <p className="error-text" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "저장 중…" : "놀이 기록 저장"}
                <Icon name="check" size={20} />
              </button>
              <p className="local-data-note">기록은 이 브라우저에 저장돼요.</p>
            </form>
          </>
        ) : (
          <EmptyState title="놀이를 찾을 수 없어요">
            <Link className="primary-button" href="/search">
              다른 놀이 찾기
            </Link>
          </EmptyState>
        )}
        <PageFooter />
      </div>
    </WebPage>
  );
}
