import assert from "node:assert/strict";
import test from "node:test";
import { createTossRuntime, playDeepLink, type TossBridge } from "./toss-runtime";
import { tossBackAction } from "./navigation";

function fixture() {
  const values = new Map<string, string>();
  const calls: unknown[] = [];
  let user = "user-A";
  let fail = false;
  const bridge: TossBridge = {
    storage: {
      async getItem(key) { return values.get(key) ?? null; },
      async setItem(key, value) { if (fail) throw new Error("storage offline"); values.set(key, value); },
      async removeItem(key) { if (fail) throw new Error("storage offline"); values.delete(key); },
    },
    async identify() { calls.push("identify"); if (fail) throw new Error("bridge unavailable"); return { type: "HASH", hash: user }; },
    async createLink(options) { calls.push(options); if (fail) throw new Error("share failed"); return `https://toss.im/share?deep_link_value=${encodeURIComponent(options.path)}`; },
    async share(options) { calls.push(options); }, async copy(text) { calls.push(text); }, async close() {}, async openExternal(url) { calls.push(url); },
    async configureNavigation() { calls.push("navigation"); },
    onNavigation(event) { calls.push(event); return () => calls.push(`off:${event}`); },
    getInsets: () => ({ top: 0, left: 0, right: 0, bottom: 34 }),
    onInsets() { return () => calls.push("off:insets"); },
  };
  return { bridge, values, calls, user: (value: string) => { user = value; }, fail: (value: boolean) => { fail = value; } };
}

test("토스 초기화는 중복 식별을 합치고 기존 형식의 키·guestId·기록을 재접속 후 복원한다", async () => {
  const f = fixture(), runtime = createTossRuntime(f.bridge, "nori-recipe");
  await Promise.all([runtime.initialize(), runtime.initialize(), runtime.storage.getItem("guest-id")]);
  assert.equal(f.calls.filter(value => value === "identify").length, 1);
  await runtime.storage.setItem("guest-id", "existing-local-guest");
  await runtime.storage.setItem("logs", JSON.stringify([{ memo: "private", deletedAt: "2026-11-17" }]));
  const reopened = createTossRuntime(f.bridge, "nori-recipe");
  assert.equal(await reopened.storage.getItem("guest-id"), "existing-local-guest");
  assert.deepEqual(JSON.parse((await reopened.storage.getItem("logs"))!), [{ memo: "private", deletedAt: "2026-11-17" }]);
  assert.ok([...f.values.keys()].every(key => key.startsWith("nori-recipe/toss/v1/user-A/")));
});

test("다른 토스 사용자의 기록을 읽거나 초기화하지 않고 계정 변경 후 기존 상태의 쓰기도 막는다", async () => {
  const f = fixture(), first = createTossRuntime(f.bridge, "nori-recipe");
  f.values.set("nori-recipe/guest-id", "web-original");
  await first.storage.setItem("logs", "A-record");
  f.user("user-B");
  assert.equal(await first.checkIdentity?.(), false);
  await assert.rejects(first.storage.setItem("logs", "A-state-in-B"), /사용자가 바뀌/);
  const second = createTossRuntime(f.bridge, "nori-recipe");
  assert.equal(await second.storage.getItem("logs"), null);
  await second.storage.setItem("logs", "B-record");
  await second.storage.removeItem("logs");
  assert.equal(f.values.get("nori-recipe/toss/v1/user-A/logs"), "A-record");
  assert.equal(f.values.get("nori-recipe/guest-id"), "web-original");
});

test("식별·저장·삭제 실패는 성공으로 바꾸지 않고 사용자 재시도로 회복한다", async () => {
  const f = fixture(), runtime = createTossRuntime(f.bridge, "nori-recipe");
  f.fail(true);
  await assert.rejects(runtime.initialize(), /bridge unavailable/);
  await assert.rejects(runtime.storage.getItem("logs"), /bridge unavailable/);
  assert.equal(f.values.size, 0);
  f.fail(false); await runtime.initialize();
  await runtime.storage.setItem("logs", "keep");
  f.fail(true);
  await assert.rejects(runtime.storage.setItem("logs", "drop"), /storage offline/);
  await assert.rejects(runtime.storage.removeItem("logs"), /storage offline/);
  assert.equal(f.values.get("nori-recipe/toss/v1/user-A/logs"), "keep");
});

test("빈 식별키나 오류 응답은 익명 대체 프로필로 시작하지 않는다", async () => {
  const f = fixture();
  for (const result of [{ type: "HASH", hash: " " }, { type: "ERROR", hash: "x" }]) {
    const runtime = createTossRuntime({ ...f.bridge, identify: async () => result }, "nori-recipe");
    await assert.rejects(runtime.initialize(), /사용자 정보를 확인/);
  }
});

test("공유는 정식 토스 놀이 경로만 사용하며 query·다른 URL·개인정보를 허용하지 않는다", async () => {
  const f = fixture(), runtime = createTossRuntime(f.bridge, "nori-recipe");
  const link = await runtime.createPlayLink?.("play_001");
  assert.deepEqual(f.calls[0], { path: "intoss://nori-recipe/play/play_001" });
  assert.ok(link?.startsWith("https://toss.im/"));
  for (const id of ["play_001?materials=cup", "https://example.com", "../play_001", "아이이름", "play_001#memo"]) {
    assert.throws(() => playDeepLink("nori-recipe", id));
  }
  f.fail(true);
  await assert.rejects(runtime.createPlayLink!("play_001"), /share failed/);
});

test("뒤로가기는 대화상자·이전 화면·홈·최초 종료를 구분하며 SDK 구독을 해제한다", () => {
  assert.equal(tossBackAction("/", false, true), "dialog");
  assert.equal(tossBackAction("/", true, false), "close");
  assert.equal(tossBackAction("/start", false, false), "close");
  assert.equal(tossBackAction("/play/play_001", false, false), "home");
  assert.equal(tossBackAction("/search", true, false), "back");
  const f = fixture(), runtime = createTossRuntime(f.bridge, "nori-recipe");
  const stop = runtime.navigation!(() => {}, () => {}, () => {});
  let bottom = 0;
  const stopInsets = runtime.safeArea!(value => { bottom = value.bottom; });
  assert.equal(bottom, 34);
  stop(); stopInsets();
  assert.ok(f.calls.includes("off:backEvent"));
  assert.ok(f.calls.includes("off:homeEvent"));
  assert.ok(f.calls.includes("off:insets"));
});
