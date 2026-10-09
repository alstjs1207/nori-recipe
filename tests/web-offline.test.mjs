import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createServiceWorker } from "../scripts/web/service-worker.mjs";

function worker(version = "test") {
  const stores = new Map();
  const listeners = new Map();
  const httpCache = new Map();
  let online = true;
  let status = 200;
  let claimed = false;
  let skipped = false;
  const key = (request) => new URL(typeof request === "string" ? request : request.url, "http://localhost").href;
  class Cache {
    entries = new Map();
    async addAll(paths) {
      for (const path of paths) {
        const cached = path.cache === "reload" ? undefined : httpCache.get(key(path));
        await this.put(path, new Response(cached ?? `shell:${new URL(key(path)).pathname}`));
      }
    }
    async put(request, response) { this.entries.set(key(request), response.clone()); }
    async match(request) { return this.entries.get(key(request))?.clone(); }
    async keys() { return [...this.entries.keys()]; }
    async delete(request) { return this.entries.delete(key(request)); }
  }
  const caches = {
    async open(name) { if (!stores.has(name)) stores.set(name, new Cache()); return stores.get(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = { location: { origin: "http://localhost" }, addEventListener: (name, callback) => listeners.set(name, callback), clients: { async claim() { claimed = true; } }, skipWaiting: () => { skipped = true; } };
  vm.runInNewContext(createServiceWorker(version, ["/index.html", "/offline.html", "/entry.js", "/web.css"]), { self, caches, URL, Request, Response, fetch: async (request) => { if (!online) throw new Error("offline"); return new Response(`network:${request.url}`, { status }); } });
  return {
    caches, stores, setOnline: (value) => { online = value; }, setStatus: (value) => { status = value; }, claimed: () => claimed, skipped: () => skipped,
    seedHttpCache: (url, body) => { httpCache.set(key(url), body); },
    async lifecycle(name) { const promises = []; listeners.get(name)({ waitUntil: (promise) => promises.push(promise) }); await Promise.all(promises); },
    message(data) { listeners.get("message")({ data }); },
    async fetch(url, options = {}) {
      let result;
      listeners.get("fetch")({ request: { url: new URL(url, "http://localhost").href, method: "GET", mode: "cors", destination: "", ...options }, respondWith: (promise) => { result = promise; } });
      return result;
    },
  };
}

test("새 버전 설치는 HTTP 캐시에 남은 이전 스타일 대신 새 스타일을 저장한다", async () => {
  const app = worker("new");
  app.seedHttpCache("/web.css", "old styles");
  await app.lifecycle("install");
  app.setOnline(false);
  assert.equal(await (await app.fetch("/web.css", { destination: "style" })).text(), "shell:/web.css");
});

test("오프라인에서 기존 상세 HTML, 처음 여는 놀이의 앱 셸, 방문한 이미지를 제공한다", async () => {
  const app = worker();
  await app.lifecycle("install");
  await app.lifecycle("activate");
  await app.fetch("/play/play_001", { mode: "navigate" });
  await app.fetch("/media/plays/play_001.webp", { destination: "image" });
  app.setOnline(false);
  assert.match(await (await app.fetch("/play/play_001", { mode: "navigate" })).text(), /network:.*play_001/);
  assert.equal(await (await app.fetch("/play/play_002", { mode: "navigate" })).text(), "shell:/index.html");
  assert.match(await (await app.fetch("/media/plays/play_001.webp", { destination: "image" })).text(), /network:.*webp/);
  assert.equal((await app.fetch("/media/plays/unseen.webp", { destination: "image" })).type, "error");
});

test("서버 장애 시 캐시로 돌아가고 잘못된 놀이의 404는 그대로 유지한다", async () => {
  const app = worker();
  await app.lifecycle("install");
  app.setStatus(503);
  assert.equal(await (await app.fetch("/play/play_001", { mode: "navigate" })).text(), "shell:/index.html");
  app.setStatus(404);
  assert.equal((await app.fetch("/play/play_999", { mode: "navigate" })).status, 404);
});

test("오래된 앱 캐시만 지우며 새 버전은 사용자 요청 뒤 적용한다", async () => {
  const app = worker("new");
  await app.caches.open("nori-web-old-shell");
  await app.caches.open("nori-web-old-media");
  await app.caches.open("another-app-cache");
  await app.lifecycle("install");
  assert.equal(app.skipped(), false);
  app.message({ type: "SKIP_WAITING" });
  assert.equal(app.skipped(), true);
  await app.lifecycle("activate");
  assert.equal(app.claimed(), true);
  assert.deepEqual(await app.caches.keys(), ["another-app-cache", "nori-web-new-shell"]);
});

test("이미지 캐시는 최대 80개이며 외부 서비스와 쓰기 요청을 가로채지 않는다", async () => {
  const app = worker();
  await app.lifecycle("install");
  for (let index = 0; index < 90; index++) await app.fetch(`/media/thumbs/play_${index}.webp`, { destination: "image" });
  const cache = await app.caches.open("nori-web-test-media");
  assert.equal((await cache.keys()).length, 80);
  assert.equal(await cache.match("/media/thumbs/play_0.webp"), undefined);
  assert.equal(await app.fetch("https://example.com/event"), undefined);
  assert.equal(await app.fetch("/anything", { method: "POST" }), undefined);
  assert.equal(await app.fetch("/sw.js", { destination: "script" }), undefined);
});

test("기존 기본 아이콘 캐시가 있어도 새 주소의 재료 그림을 받고 오프라인에서도 유지한다", async () => {
  const app = worker("old");
  await app.lifecycle("install");
  const cache = await app.caches.open("nori-web-old-media");
  await cache.put("/media/materials/paper_plate.webp", new Response("old brand icon"));
  const updatedUrl = "/media/materials/paper_plate.webp?v=new-image";
  assert.match(await (await app.fetch(updatedUrl, { destination: "image" })).text(), /network:.*v=new-image/);
  app.setOnline(false);
  assert.match(await (await app.fetch(updatedUrl, { destination: "image" })).text(), /network:.*v=new-image/);
  assert.equal(await (await cache.match("/media/materials/paper_plate.webp")).text(), "old brand icon");
});
