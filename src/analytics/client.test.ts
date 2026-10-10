import assert from "node:assert/strict";
import test from "node:test";
import { createAnalyticsClient, type AnalyticsEnvironment, type AnalyticsTransport } from "./client";
import { ANALYTICS_CONSENT_VERSION, getAnalyticsPage, parseAnalyticsConfig, sanitizeAnalyticsEvent, sanitizeReferrer, type AnalyticsEvent, type AnalyticsParams } from "./policy";

const config = { measurementId: "G-ABC1234567", origin: "https://nori.example.com" };
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture(overrides: Partial<AnalyticsEnvironment> = {}) {
  let stored: string | null = null;
  const state = { online: true, loads: 0, disabled: 0, cleared: 0, events: [] as { name: string; params: AnalyticsParams }[] };
  const transport: AnalyticsTransport = { send: (name, params) => state.events.push({ name, params }), disable: () => { state.disabled += 1; } };
  const client = createAnalyticsClient({
    config, origin: () => config.origin, online: () => state.online,
    readConsent: () => stored, writeConsent: (value) => { stored = value; },
    referrer: () => "https://search.example.com/profile/child-name?q=private#memo",
    load: async () => { state.loads += 1; return transport; }, clearCookies: () => { state.cleared += 1; },
    ...overrides,
  });
  return { client, state, transport, stored: () => stored };
}

test("운영 HTTPS 도메인과 올바른 측정 ID가 있을 때만 설정을 허용한다", () => {
  assert.deepEqual(parseAnalyticsConfig(config.measurementId, config.origin), config);
  for (const origin of ["http://nori.example.com", "https://localhost", "https://127.0.0.1", "https://nori.test", "https://nori.example.com/path", "https://nori.example.com?name=child", "https://user:pass@nori.example.com"]) {
    assert.equal(parseAnalyticsConfig(config.measurementId, origin), null);
  }
  for (const id of [undefined, "", "UA-12345-1", "G-<script>", "G-short"]) assert.equal(parseAnalyticsConfig(id, config.origin), null);
  for (const origin of ["http://127.0.0.1:4173", "https://preview.example.com"]) assert.equal(fixture({ origin: () => origin }).client.enabled, false);
});

test("동의 전·거부·미설정 상태에서는 태그 로드와 모든 이벤트 전송이 없다", async () => {
  for (const consent of ["unknown", "denied"] as const) {
    const { client, state } = fixture();
    client.setConsent(consent);
    client.trackPage(getAnalyticsPage("/play/play_200?materials=bead&childName=private"));
    assert.equal(await client.track({ name: "favorite_add", params: { play_id: "play_200" } }), false);
    await flush();
    assert.equal(state.loads, 0);
    assert.deepEqual(state.events, []);
  }
  const { client, state } = fixture({ config: null });
  client.setConsent("granted");
  client.trackPage(getAnalyticsPage("/"));
  await flush();
  assert.equal(client.getConsent(), "unknown");
  assert.equal(state.loads, 0);
});

test("동의 후 페이지를 한 번씩 측정하고 같은 URL의 시작·추천 화면도 구분한다", async () => {
  const { client, state } = fixture();
  client.setConsent("granted");
  client.trackPage(getAnalyticsPage("/"));
  client.trackPage(getAnalyticsPage("/"));
  client.trackPage(getAnalyticsPage("/", true));
  client.trackPage(getAnalyticsPage("/play/play_200?materials=bead&memo=private#child"));
  client.trackPage(getAnalyticsPage("/", true));
  await flush();
  assert.equal(state.loads, 1);
  assert.deepEqual(state.events.map((event) => event.params.screen_name), ["welcome", "home", "play", "home"]);
  assert.equal(state.events[0].params.page_referrer, "https://search.example.com/");
  assert.equal(state.events[2].params.page_location, `${config.origin}/play/play_200`);
  assert.equal(state.events[3].params.page_referrer, `${config.origin}/play/play_200`);
  assert(!JSON.stringify(state.events).includes("private"));
});

test("개인 입력값·임의 식별값·검색어를 전달해도 허용된 행동 항목만 전송한다", async () => {
  const { client, state } = fixture();
  client.setConsent("granted");
  client.trackPage({ path: "/settings?name=private", screen: "settings", title: "private child name" });
  const event = { name: "play_feedback_saved", params: { play_id: "play_200", memo: "private memo", childName: "private name", birthMonth: 24000, guestId: "private-id", user_id: "private-id" } } as AnalyticsEvent;
  assert.equal(await client.track(event), true);
  assert.deepEqual(state.events.at(-1)?.params, {
    page_location: `${config.origin}/settings`, page_referrer: "https://search.example.com/", page_title: "설정 · 노리 레시피", screen_name: "settings", play_id: "play_200",
  });
  assert.deepEqual(sanitizeAnalyticsEvent({ name: "search_results", params: { result_count: 0, has_query: 1, category: "all", search_term: "private" } } as AnalyticsEvent), { result_count: 0, has_query: 1, category: "all" });
  assert.equal(sanitizeAnalyticsEvent({ name: "favorite_add", params: { play_id: "private" } }), null);
  assert.equal(sanitizeAnalyticsEvent({ name: "search_results", params: { result_count: Infinity, has_query: 1, category: "all" } }), null);
  assert.equal(sanitizeAnalyticsEvent({ name: "unknown", params: {} } as unknown as AnalyticsEvent), null);
  assert.equal(sanitizeReferrer("javascript:alert(1)", config.origin), "");
  assert.equal(getAnalyticsPage("/profile/private-name").path, "/not-found");
});

test("태그 로드 중 철회하면 이전 동의의 페이지·행동 이벤트를 버린다", async () => {
  let resolve!: (transport: AnalyticsTransport) => void;
  const pending = new Promise<AnalyticsTransport>((done) => { resolve = done; });
  const { client, state, transport } = fixture({ load: () => pending });
  client.setConsent("granted");
  client.trackPage(getAnalyticsPage("/play/play_200"));
  const action = client.track({ name: "favorite_add", params: { play_id: "play_200" } });
  client.setConsent("denied");
  resolve(transport);
  assert.equal(await action, false);
  await flush();
  assert.equal(state.events.length, 0);
  assert.equal(state.cleared, 1);
  client.setConsent("granted");
  client.trackPage(getAnalyticsPage("/search"));
  await flush();
  assert.deepEqual(state.events.map((event) => event.params.screen_name), ["search"]);
});

test("오프라인·태그 차단은 놀이 동작을 막지 않고 과거 행동을 재전송하지 않는다", async () => {
  const { client, state } = fixture();
  client.setConsent("granted");
  state.online = false;
  client.trackPage(getAnalyticsPage("/play/play_200"));
  assert.equal(await client.track({ name: "play_feedback_saved", params: { play_id: "play_200" } }), false);
  assert.equal(state.loads, 0);
  state.online = true;
  client.trackPage(getAnalyticsPage("/search"));
  await flush();
  assert.deepEqual(state.events.map((event) => event.name), ["page_view"]);
  const blocked = fixture({ load: async () => { throw new Error("blocked"); } });
  blocked.client.setConsent("granted");
  blocked.client.trackPage(getAnalyticsPage("/"));
  assert.equal(await blocked.client.track({ name: "tutorial_complete" }), false);
});

test("같은 운영 도메인·측정 ID·방침 버전의 선택만 복원하고 초기화 시 철회한다", async () => {
  const record = { version: ANALYTICS_CONSENT_VERSION, scope: `${config.measurementId}@${config.origin}`, value: "granted" };
  assert.equal(fixture({ readConsent: () => JSON.stringify(record) }).client.getConsent(), "granted");
  for (const stored of ["{broken", JSON.stringify({ ...record, version: 0 }), JSON.stringify({ ...record, scope: "other" }), JSON.stringify({ ...record, value: "yes" })]) {
    assert.equal(fixture({ readConsent: () => stored }).client.getConsent(), "unknown");
  }
  const { client, state, stored } = fixture();
  client.setConsent("granted");
  client.trackPage(getAnalyticsPage("/"));
  await flush();
  client.setConsent("unknown");
  assert.equal(client.getConsent(), "unknown");
  assert.equal(stored(), null);
  assert.equal(state.disabled, 1);
  assert.equal(state.cleared, 1);
  assert.equal(await client.track({ name: "tutorial_complete" }), false);
});
