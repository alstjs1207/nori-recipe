import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/pwa.js", import.meta.url), "utf8");
function boot({ existing = false, registerError = false } = {}) {
  const events = [], listeners = new Map(), workerListeners = new Map();
  let ready, registrations = 0;
  const installing = { state: "installing", addEventListener: (k, f) => workerListeners.set(k, f), removeEventListener: (k) => workerListeners.delete(k) };
  const registration = { installing, active: existing ? {} : null, waiting: null, addEventListener: (k, f) => listeners.set(k, f) };
  const serviceWorker = { controller: existing ? {} : null, register: async () => { registrations++; if (registerError) throw Error("offline"); return registration; }, ready: new Promise((resolve) => { ready = resolve; }) };
  const window = { isSecureContext: true, addEventListener: (k, f) => listeners.set(k, f), dispatchEvent: (e) => events.push(e) };
  vm.runInNewContext(source, { window, navigator: { serviceWorker }, document: { querySelector: () => ({}) }, Event, CustomEvent });
  return { events, registration, registrations: () => registrations, start: () => listeners.get("load")(), ready: () => ready(registration),
    state(value) { installing.state = value; workerListeners.get("statechange")?.(); } };
}
const settle = () => new Promise(setImmediate);

test("첫 온라인 준비는 셸 설치가 끝나기 전 완료를 알리지 않는다", async () => {
  const app = boot(), run = app.start(); await settle();
  assert.deepEqual(app.events, []);
  app.ready(); await run;
  assert.deepEqual(app.events.map((e) => e.type), ["nori:offline-ready"]);
});

test("필수 셸 설치가 실패하면 완료 대신 오류를 알리고 대기를 끝낸다", async () => {
  const app = boot(), run = app.start(); await settle(); app.state("redundant"); await run;
  assert.deepEqual(app.events.map((e) => e.type), ["nori:offline-error"]);
});

test("오프라인 재실행의 등록 실패에서도 기존 활성 셸은 이용 가능하다", async () => {
  const app = boot({ existing: true, registerError: true }); await app.start();
  assert.equal(app.registrations(), 1);
  assert.deepEqual(app.events.map((e) => e.type), ["nori:offline-ready"]);
  const fresh = boot({ registerError: true }); await fresh.start();
  assert.deepEqual(fresh.events.map((e) => e.type), ["nori:offline-error"]);
});

test("대기 업데이트는 알리기만 하며 자동 적용하지 않는다", async () => {
  const app = boot({ existing: true });
  let applied = false;
  app.registration.waiting = { postMessage() { applied = true; } };
  app.ready(); await app.start();
  assert.equal(app.events[0].type, "nori:update-ready");
  assert.equal(app.events[0].detail, app.registration.waiting);
  assert.equal(applied, false);
});
