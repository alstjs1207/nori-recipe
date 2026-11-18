import test from "node:test";
import assert from "node:assert/strict";
import { createCompletionAd, type FullScreenAdBridge } from "./completion-ad";

const ids = ["play_001", "play_002", "play_003"];
const logs = ids.map((playId, index) => ({ id: `log-${index}`, playId }));
function fixture({ supported = true, visible = true } = {}) {
  const loads: Parameters<FullScreenAdBridge["load"]>[0][] = [];
  const shows: Parameters<FullScreenAdBridge["show"]>[0][] = [];
  let offLoads = 0, offShows = 0;
  const ad = createCompletionAd({
    isSupported: () => supported,
    load(params) { loads.push(params); return () => { offLoads++; }; },
    show(params) { shows.push(params); return () => { offShows++; }; },
  }, "test-group", () => visible);
  const stop = ad.start();
  const loaded = () => loads.at(-1)?.onEvent({ type: "loaded" });
  return { ad, loads, shows, stop, loaded, cleanups: () => ({ offLoads, offShows }) };
}

test("새 기록으로 추천 세 번째 놀이를 완료할 때만 같은 그룹의 광고를 한 번 표시한다", () => {
  const f = fixture(); f.loaded();
  f.ad.home(ids, logs); // Past records / ordinary home entry.
  for (let i = 0; i < 2; i++) {
    f.ad.saved(logs[i]); f.ad.home(ids, logs.slice(0, i + 1));
  }
  assert.equal(f.shows.length, 0);
  f.ad.saved(logs[2]); f.ad.home(ids, logs);
  f.ad.home(ids, logs);
  assert.equal(f.shows.length, 1);
  assert.deepEqual(f.shows[0].options, f.loads[0].options);
  assert.deepEqual(Object.keys(f.shows[0].options), ["adGroupId"]);
  f.shows[0].onEvent({ type: "dismissed" }); f.loaded();
  f.ad.saved({ id: "repeat", playId: ids[2] });
  f.ad.home(ids, [...logs, { id: "repeat", playId: ids[2] }]);
  assert.equal(f.shows.length, 1);
  assert.equal(f.loads.length, 2);
  f.stop();
});

test("부족·중복 추천, 추천 외 완료, 저장되지 않은 기록은 광고를 표시하지 않는다", () => {
  for (const recommendationIds of [ids.slice(0, 2), [ids[0], ids[0], ids[2]], [ids[0], ids[1], "play_004"]]) {
    const f = fixture(); f.loaded(); f.ad.saved(logs[2]); f.ad.home(recommendationIds, logs);
    assert.equal(f.shows.length, 0); f.stop();
  }
  const f = fixture(); f.loaded(); f.ad.saved({ id: "unsaved", playId: ids[2] }); f.ad.home(ids, logs);
  assert.equal(f.shows.length, 0); f.stop();
});

test("로드 전 완료·로드 실패·미지원·숨긴 화면에서는 건너뛰고 늦게 광고를 띄우지 않는다", () => {
  for (const config of [{}, { supported: false }, { visible: false }]) {
    const f = fixture(config);
    f.ad.saved(logs[2]); f.ad.home(ids, logs);
    f.loaded(); f.ad.home(ids, logs);
    assert.equal(f.shows.length, 0); f.stop();
  }
  const f = fixture(); f.loads[0].onError(new Error("no fill"));
  f.loaded(); f.ad.saved(logs[2]); f.ad.home(ids, logs);
  assert.equal(f.shows.length, 0); f.stop();
});

test("노출 실패와 예외를 삼키며 자동 재시도나 중복 노출을 하지 않는다", () => {
  for (const failure of ["event", "error"]) {
    const f = fixture(); f.loaded(); f.ad.saved(logs[2]); f.ad.home(ids, logs);
    if (failure === "event") f.shows[0].onEvent({ type: "failedToShow" });
    else f.shows[0].onError(new Error("offline"));
    f.ad.home(ids, logs);
    assert.equal(f.shows.length, 1); assert.equal(f.loads.length, 1); f.stop();
  }
  const ad = createCompletionAd({ isSupported() { throw new Error("bridge"); }, load() { throw new Error(); }, show() { throw new Error(); } }, "group", () => true);
  assert.doesNotThrow(() => { const stop = ad.start(); ad.saved(logs[2]); ad.home(ids, logs); stop(); });
});

test("화면 종료는 구독과 대기 중 완료를 제거한다", () => {
  const f = fixture(); f.ad.saved(logs[2]); f.stop(); f.loaded(); f.ad.home(ids, logs);
  assert.equal(f.shows.length, 0);
  assert.ok(f.cleanups().offLoads > 0);
  const shown = fixture(); shown.loaded(); shown.ad.saved(logs[2]); shown.ad.home(ids, logs); shown.stop();
  shown.shows[0].onEvent({ type: "dismissed" });
  assert.equal(shown.loads.length, 1); assert.equal(shown.cleanups().offShows, 1);
});

test("동기 콜백에서도 SDK 구독을 해제하고 다음 광고를 순차 로드한다", () => {
  let loads = 0, offLoads = 0, offShows = 0;
  const ad = createCompletionAd({
    isSupported: () => true,
    load(params) { loads++; params.onEvent({ type: "loaded" }); return () => { offLoads++; }; },
    show(params) { params.onEvent({ type: "dismissed" }); return () => { offShows++; }; },
  }, "group", () => true);
  const stop = ad.start(); ad.saved(logs[2]); ad.home(ids, logs);
  assert.equal(loads, 2); assert.equal(offShows, 1); assert.equal(offLoads, 2); stop();
});
