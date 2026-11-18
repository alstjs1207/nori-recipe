import test from "node:test";
import assert from "node:assert/strict";
import { useFeedbackDraftStore as store } from "./feedbackDraftStore";
const key = (guest: string, play: string) => JSON.stringify([guest, play]);

test("unsaved feedback survives A → B → A without leaking between plays or guests", () => {
  store.setState({ drafts: {} });
  store.getState().update("guest-a", "play-a", { rating: 4, reactions: ["집중했어요"], memo: "남겨둘 초안" });
  const a = store.getState().drafts[key("guest-a", "play-a")];
  store.getState().update("guest-a", "play-b", { rating: 2, memo: "다른 놀이" });
  store.getState().update("guest-b", "play-a", { rating: 5 });
  assert.equal(store.getState().drafts[key("guest-a", "play-a")], a);
  assert.equal(store.getState().drafts[key("guest-b", "play-a")].memo, "");
  store.getState().saved("guest-a", "play-b", store.getState().drafts[key("guest-a", "play-b")]);
  assert.equal(store.getState().drafts[key("guest-a", "play-b")], undefined);
  assert.equal(store.getState().drafts[key("guest-a", "play-a")], a);
});

test("save completion clears only its submitted revision, retaining edits made during the write", () => {
  store.setState({ drafts: {} });
  store.getState().update("g", "p", { rating: 3, memo: "첫 입력" });
  const submitted = store.getState().drafts[key("g", "p")];
  store.getState().update("g", "p", { memo: "저장 중 새 입력" });
  store.getState().saved("g", "p", submitted);
  assert.equal(store.getState().drafts[key("g", "p")].memo, "저장 중 새 입력");
  const latest = store.getState().drafts[key("g", "p")];
  store.getState().saved("g", "p", latest);
  assert.equal(store.getState().drafts[key("g", "p")], undefined);
});

test("explicit full guest reset clears that guest only", () => {
  store.setState({ drafts: {} });
  store.getState().update("a", "p", { memo: "a" });
  store.getState().update("b", "p", { memo: "b" });
  store.getState().clearGuest("a");
  assert.equal(store.getState().drafts[key("a", "p")], undefined);
  assert.equal(store.getState().drafts[key("b", "p")].memo, "b");
});
