import assert from "node:assert/strict";
import test from "node:test";
import { createAnalyticsClient, type AnalyticsTransport } from "./client";
import { createFeedbackCollector, type FeedbackAnalyticsRecord } from "./feedback";
import { ANALYTICS_REACTION_PARAMS, getAnalyticsPage, sanitizeAnalyticsEvent, type AnalyticsEvent, type AnalyticsParams } from "./policy";
import { CHILD_REACTION_PARSE_OPTIONS } from "@/constants/feedback";

const record: FeedbackAnalyticsRecord = { id: "local-record", playId: "play_200", starRating: 4, childReaction: ["집중했어요", "도움이 필요했어요"] };
function fixture(options: { preview?: boolean; load?: () => Promise<AnalyticsTransport | null> } = {}) {
  const events: { name: string; params: AnalyticsParams }[] = [];
  const state = { online: true, storage: true, profileActive: true, receipts: new Set<string>() };
  const client = createAnalyticsClient({
    config: { measurementId: "G-ABC1234567", origin: "https://nori.example.com" }, preview: options.preview,
    origin: () => "https://nori.example.com", online: () => state.online, referrer: () => "",
    readConsent: () => null, writeConsent: () => {}, clearCookies: () => {},
    load: options.load ?? (async () => ({ send: (name, params) => { events.push({ name, params }); }, disable: () => {} })),
  });
  const makeCollector = () => createFeedbackCollector({
    client, active: () => client.enabled && client.getConsent() === "granted" && state.online && state.profileActive,
    readReceipt: (id) => state.receipts.has(id), writeReceipt: (id) => { state.receipts.add(id); },
    storageAvailable: () => state.storage, exclusive: async (work) => { await work(); },
  });
  client.trackPage(getAnalyticsPage("/settings"));
  return { client, state, events, makeCollector, collector: makeCollector(), feedback: () => events.filter((event) => event.name.startsWith("play_feedback_")) };
}

test("현재·이전 선택형 반응을 각각 0/1로 전송하고 복수 선택도 평가 한 건으로 유지한다", () => {
  for (const reaction of CHILD_REACTION_PARSE_OPTIONS) {
    const params = sanitizeAnalyticsEvent({ name: "play_feedback_imported", params: { play_id: "play_200", rating: 5, reactions: [reaction, reaction] } });
    assert.equal(params?.rating, 5);
    assert.equal(params?.rating_value, 5);
    assert.equal(params?.reaction_count, 1);
    for (const other of CHILD_REACTION_PARSE_OPTIONS) assert.equal(params?.[ANALYTICS_REACTION_PARAMS[other]], Number(reaction === other));
  }
  const empty = sanitizeAnalyticsEvent({ name: "play_feedback_saved", params: { play_id: "play_200", rating: 1, reactions: [] } });
  assert.equal(empty?.reaction_count, 0);
  for (const key of Object.values(ANALYTICS_REACTION_PARAMS)) assert.equal(empty?.[key], 0);
});

test("잘못된 별점·반응은 거부하고 원문·개인 식별값은 제거한다", () => {
  for (const rating of [0, 6, -1, 2.5, NaN, Infinity, "4", null]) {
    assert.equal(sanitizeAnalyticsEvent({ name: "play_feedback_saved", params: { play_id: "play_200", rating, reactions: [] } } as AnalyticsEvent), null);
  }
  for (const reactions of [["private name"], "집중했어요", null, ["toString"]]) {
    assert.equal(sanitizeAnalyticsEvent({ name: "play_feedback_imported", params: { play_id: "play_200", rating: 3, reactions } } as AnalyticsEvent), null);
  }
  const safe = sanitizeAnalyticsEvent({ name: "play_feedback_imported", params: { play_id: "play_200", rating: 3, reactions: [], memo: "private", guestId: "private", recordId: "private", completedAt: "private" } } as AnalyticsEvent);
  assert(!JSON.stringify(safe).includes("private"));
});

test("동의 전·거부·Preview·오프라인·다른 프로필·저장소 불가에서는 소급 전송과 표시가 없다", async () => {
  for (const scenario of ["unknown", "denied", "preview", "offline", "profile", "storage"]) {
    const f = fixture({ preview: scenario === "preview" });
    if (scenario !== "unknown") f.client.setConsent(scenario === "denied" ? "denied" : "granted");
    if (scenario === "offline") f.state.online = false;
    if (scenario === "profile") f.state.profileActive = false;
    if (scenario === "storage") f.state.storage = false;
    await f.collector.collect([record], "play_feedback_imported");
    assert.equal(f.feedback().length, 0, scenario);
    assert.equal(f.state.receipts.size, 0, scenario);
  }
});

test("새 기록을 수집한 뒤 소급 수집·동시 요청·재접속에도 같은 기록을 다시 보내지 않는다", async () => {
  const f = fixture();
  f.client.setConsent("granted");
  await Promise.all([
    f.collector.collect([record], "play_feedback_saved"),
    f.collector.collect([record], "play_feedback_imported"),
  ]);
  await f.makeCollector().collect([record], "play_feedback_imported");
  assert.equal(f.feedback().length, 1);
  assert.equal(f.feedback()[0].name, "play_feedback_saved");
  assert.equal(f.feedback()[0].params.reaction_focused, 1);
  assert.equal(f.feedback()[0].params.reaction_needs_help, 1);
  assert(!JSON.stringify(f.feedback()).includes(record.id));
});

test("여러 탭이 같은 전송 표시와 잠금을 사용하면 동시에 소급 요청해도 한 번만 보낸다", async () => {
  const f = fixture();
  f.client.setConsent("granted");
  let lock = Promise.resolve();
  const makeTab = () => createFeedbackCollector({
    client: f.client, active: () => true, storageAvailable: () => true,
    readReceipt: (id) => f.state.receipts.has(id), writeReceipt: (id) => { f.state.receipts.add(id); },
    exclusive: (work) => { lock = lock.then(work); return lock; },
  });
  await Promise.all([makeTab().collect([record], "play_feedback_imported"), makeTab().collect([record], "play_feedback_imported")]);
  assert.equal(f.feedback().length, 1);
});

test("소급 수집은 20개보다 많은 기록도 전송하고 같은 놀이의 서로 다른 평가는 보존한다", async () => {
  const f = fixture();
  f.client.setConsent("granted");
  const records = Array.from({ length: 25 }, (_, i) => ({ ...record, id: `record-${i}` }));
  await f.collector.collect(records, "play_feedback_imported");
  assert.equal(f.feedback().length, 25);
  assert(f.feedback().every((event) => event.name === "play_feedback_imported"));
  assert.equal(f.state.receipts.size, 25);
});

test("차단·실패한 전송은 표시하지 않고 다음 시도에 소급 수집한다", async () => {
  let blocked = true;
  const events: string[] = [];
  const f = fixture({ load: async () => blocked ? null : { send: (name) => { events.push(name); }, disable: () => {} } });
  f.client.setConsent("granted");
  await f.collector.collect([record], "play_feedback_saved");
  assert.equal(f.state.receipts.size, 0);
  blocked = false;
  await f.collector.collect([record], "play_feedback_imported");
  assert.deepEqual(events, ["play_feedback_imported"]);
  assert.equal(f.state.receipts.size, 1);
});

test("태그를 기다리는 중 철회하면 소급 전송과 전송 표시를 남기지 않는다", async () => {
  let resolve!: (transport: AnalyticsTransport) => void;
  let loaded!: () => void;
  const started = new Promise<void>((done) => { loaded = done; });
  const f = fixture({ load: () => { loaded(); return new Promise((done) => { resolve = done; }); } });
  f.client.setConsent("granted");
  const pending = f.collector.collect([record], "play_feedback_imported");
  await started;
  f.client.setConsent("denied");
  const events: string[] = [];
  resolve({ send: (name) => { events.push(name); }, disable: () => {} });
  await pending;
  assert.deepEqual(events, []);
  assert.equal(f.state.receipts.size, 0);
});
