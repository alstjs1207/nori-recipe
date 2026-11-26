import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { AD_SHOWN_AT_KEY, AD_COOLDOWN_MS, AD_REQUEST_TIMEOUT_MS, AD_CLOSE_TIMEOUT_MS, createRecommendationAd, type FullScreenAdBridge } from "./completion-ad";

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const now = Date.parse("2026-11-24T23:59:00+09:00");
function clock(t: TestContext) { t.mock.timers.enable({ apis: ["setTimeout", "Date"], now }); }
async function fixture(t: TestContext, { supported = true, visible = true, values = new Map<string, string>(), readFails = false, writeFails = false, throws = false, synchronous = false } = {}) {
  const loads: Parameters<FullScreenAdBridge["load"]>[0][] = [];
  const shows: Parameters<FullScreenAdBridge["show"]>[0][] = [];
  let offLoads = 0, offShows = 0;
  const ad = createRecommendationAd({
    isSupported() { return supported; },
    load(params) { loads.push(params); if (synchronous) params.onEvent({ type: "loaded" }); return () => { offLoads++; }; },
    show(params) { shows.push(params); if (throws) throw Error("bridge"); if (synchronous) { params.onEvent({ type: "show" }); params.onEvent({ type: "dismissed" }); } return () => { offShows++; }; },
  }, "test-group", () => visible, {
    async getItem(key) { if (readFails) throw Error("read"); return values.get(key) ?? null; },
    async setItem(key, value) { if (writeFails) throw Error("write"); values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  });
  const stop = ad.start(); t.after(stop);
  await flush();
  const loaded = () => loads.at(-1)?.onEvent({ type: "loaded" });
  const event = (type: string) => shows.at(-1)?.onEvent({ type });
  return { ad, loads, shows, stop, loaded, event, values, cleanups: () => ({ offLoads, offShows }) };
}

test("사전 로드·홈 재진입에는 광고 없이 명시적 다음 시작에서만 표시하고 닫힌 뒤 진행한다", async t => {
  clock(t);
  const f = await fixture(t); f.loaded();
  assert.equal(f.shows.length, 0);
  let proceeded = false;
  const result = f.ad.beforeNext();
  void result.then(() => { proceeded = true; });
  assert.equal(f.ad.beforeNext(), result); // Repeated clicks share one operation.
  await flush(); assert.equal(proceeded, false);
  assert.deepEqual(f.shows[0].options, { adGroupId: "test-group" });
  assert.deepEqual(f.shows[0].options, f.loads[0].options);
  f.event("requested"); f.event("impression"); await flush();
  assert.equal(f.values.has(AD_SHOWN_AT_KEY), false);
  f.event("show"); await flush();
  assert.equal(f.values.get(AD_SHOWN_AT_KEY), String(now));
  assert.equal(proceeded, false);
  f.event("dismissed"); assert.equal(await result, true);
  assert.equal(proceeded, true);
  assert.equal(f.cleanups().offShows, 1);
});

test("실제 표시부터 24시간: 자정·재접속·여러 시작에도 추가 광고 없이 정확한 경계에서 재개한다", async t => {
  clock(t);
  const values = new Map<string, string>();
  const f = await fixture(t, { values }); f.loaded();
  const result = f.ad.beforeNext();
  t.mock.timers.tick(2000); // Request time must not be used.
  f.event("show"); const shownAt = Date.now(); await flush();
  t.mock.timers.tick(1000); f.event("show"); f.event("dismissed"); await result;
  assert.equal(values.get(AD_SHOWN_AT_KEY), String(shownAt));
  f.loaded(); t.mock.timers.tick(60 * 1000);
  assert.equal(await f.ad.beforeNext(), true); assert.equal(f.shows.length, 1);
  f.stop();
  const resumed = await fixture(t, { values }); resumed.loaded();
  for (let i = 0; i < 3; i++) assert.equal(await resumed.ad.beforeNext(), true);
  assert.equal(resumed.shows.length, 0);
  t.mock.timers.tick(shownAt + AD_COOLDOWN_MS - Date.now() - 1);
  assert.equal(resumed.ad.getSnapshot(), false);
  t.mock.timers.tick(1);
  assert.equal(resumed.ad.getSnapshot(), true);
  const next = resumed.ad.beforeNext(); resumed.event("dismissed"); await next;
  assert.equal(resumed.shows.length, 1);
});

test("미준비·로드 실패·미지원·숨김은 즉시 진행하고 늦은 loaded로 광고를 띄우지 않는다", async t => {
  clock(t);
  for (const options of [{}, { supported: false }, { visible: false }]) {
    const f = await fixture(t, options);
    assert.equal(await f.ad.beforeNext(), true);
    f.loaded(); await flush();
    assert.equal(f.shows.length, 0);
  }
  const f = await fixture(t); f.loads[0].onError(Error("no fill"));
  assert.equal(await f.ad.beforeNext(), true); f.loaded();
  assert.equal(f.shows.length, 0); assert.equal(f.values.size, 0);
});

test("노출 실패·예외·show 누락은 진행을 막지 않고 24시간을 소비하지 않는다", async t => {
  clock(t);
  for (const failure of ["event", "error", "throw", "timeout"]) {
    const f = await fixture(t, { throws: failure === "throw" }); f.loaded();
    const result = f.ad.beforeNext();
    if (failure === "event") f.event("failedToShow");
    if (failure === "error") f.shows[0].onError(Error("offline"));
    if (failure === "timeout") t.mock.timers.tick(AD_REQUEST_TIMEOUT_MS);
    assert.equal(await result, true); await flush();
    assert.equal(f.values.size, 0); assert.equal(f.ad.getSnapshot(), true);
    f.event("show"); f.event("dismissed"); f.loaded(); await flush();
    assert.equal(f.shows.length, 1); assert.equal(f.values.size, 0);
  }
});

test("dismissed 누락에도 복귀 신호 또는 60초 안전장치로 한 번만 진행한다", async t => {
  clock(t);
  for (const recovery of ["focus", "timeout"]) {
    const f = await fixture(t); f.loaded();
    const result = f.ad.beforeNext(); f.event("show");
    let done = false; void result.then(() => { done = true; });
    f.ad.resume(); await flush(); assert.equal(done, false); // Unrelated focus.
    if (recovery === "focus") { f.ad.background(); f.ad.resume(); }
    else { t.mock.timers.tick(AD_CLOSE_TIMEOUT_MS - 1); await flush(); assert.equal(done, false); t.mock.timers.tick(1); }
    assert.equal(await result, true); f.event("dismissed");
    assert.equal(f.cleanups().offShows, 1);
    assert.equal(f.ad.getSnapshot(), false);
  }
});

test("저장 실패에도 세션의 24시간 제한을 유지하고 읽기 실패·손상 시 추천은 이용할 수 있다", async t => {
  clock(t);
  const f = await fixture(t, { writeFails: true }); f.loaded();
  const result = f.ad.beforeNext(); f.event("show"); f.event("dismissed"); await result; await flush();
  assert.equal(f.ad.getSnapshot(), false); assert.equal(await f.ad.beforeNext(), true);
  assert.equal(f.shows.length, 1);
  for (const options of [{ readFails: true }, { values: new Map([[AD_SHOWN_AT_KEY, "oops"]]) }, { values: new Map([[AD_SHOWN_AT_KEY, ""]]) }]) {
    const broken = await fixture(t, options); broken.loaded();
    assert.equal(await broken.ad.beforeNext(), true); assert.equal(broken.shows.length, 0);
  }
});

test("종료는 대기를 취소하고 늦은 SDK 콜백을 무시하며 동기 콜백도 구독을 정리한다", async t => {
  clock(t);
  const f = await fixture(t); f.loaded();
  const result = f.ad.beforeNext(); f.stop();
  assert.equal(await result, false); f.event("show"); f.event("dismissed"); await flush();
  assert.equal(f.values.size, 0); assert.equal(f.cleanups().offShows, 1);
  const sync = await fixture(t, { synchronous: true });
  assert.equal(await sync.ad.beforeNext(), true);
  assert.equal(sync.cleanups().offShows, 1); assert.equal(sync.cleanups().offLoads, 2);
});

test("시계가 뒤로 가면 추가 광고를 막고 전체 초기화는 해당 사용자의 시각만 삭제한다", async t => {
  clock(t);
  const f = await fixture(t, { values: new Map([[AD_SHOWN_AT_KEY, String(now + 3600000)], ["unrelated", "keep"]]) }); f.loaded();
  assert.equal(f.ad.getSnapshot(), false); assert.equal(await f.ad.beforeNext(), true);
  await f.ad.reset();
  assert.equal(f.values.has(AD_SHOWN_AT_KEY), false); assert.equal(f.values.get("unrelated"), "keep");
  assert.equal(f.ad.getSnapshot(), true);
});
