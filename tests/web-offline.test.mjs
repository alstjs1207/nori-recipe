import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createServiceWorker } from "../scripts/web/service-worker.mjs";

const STORAGE = { origin: "https://storage.fixture.invalid", bucket: "public-fixture" };
const storageUrl = (id = "play_301", version = "a".repeat(64), kind = "detail") => `${STORAGE.origin}/storage/v1/object/public/${STORAGE.bucket}/${id}/${version}/${kind}.webp`;

function corsResponse(body, { status = 200, type = "cors", contentType = "image/webp", redirected = false } = {}) {
  const response = new Response(body, { status, headers: { "content-type": contentType } });
  Object.defineProperties(response, { type: { value: type }, redirected: { value: redirected },
    clone: { value: () => corsResponse(body, { status, type, contentType, redirected }) } });
  return response;
}

function worker(version = "test", storage = null, materialStorage = null) {
  const stores = new Map();
  const listeners = new Map();
  const httpCache = new Map();
  let online = true;
  let status = 200;
  let remoteOptions = {};
  const fetched = [];
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
  vm.runInNewContext(createServiceWorker(version, ["/index.html", "/offline.html", "/entry.js", "/web.css"], storage, materialStorage), { self, caches, URL, Request, Response, fetch: async (request) => {
    fetched.push(request.url);
    if (!online) throw new Error("offline");
    return new URL(request.url).origin === STORAGE.origin ? corsResponse(`network:${request.url}`, { status, ...remoteOptions }) : new Response(`network:${request.url}`, { status });
  } });
  return {
    caches, stores, setOnline: (value) => { online = value; }, setStatus: (value) => { status = value; }, claimed: () => claimed, skipped: () => skipped,
    fetched, setRemote: (value) => { remoteOptions = value; },
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

test("허용한 Storage CORS 이미지는 방문 후 오프라인에서 표시하고 미방문 이미지는 기본 표시한다", async () => {
  const app = worker("storage", STORAGE);
  await app.lifecycle("install");
  const request = { destination: "image", mode: "cors", credentials: "same-origin" };
  assert.match(await (await app.fetch(storageUrl(), request)).text(), /network:/);
  app.setOnline(false);
  assert.equal(await (await app.fetch("/nori-icon.svg", { destination: "image" })).text(), "shell:/nori-icon.svg");
  assert.match(await (await app.fetch(storageUrl(), request)).text(), /network:/);
  assert.equal(await (await app.fetch(storageUrl("play_302"), request)).text(), "shell:/nori-icon.svg");
  const cache = await app.caches.open("nori-web-storage-media");
  assert.equal((await cache.keys()).length, 1);
});

test("Storage 404·5xx·opaque·비이미지·redirect 응답은 캐시하지 않고 기본 표시 후 재시도한다", async () => {
  for (const options of [{ status: 404 }, { status: 503 }, { type: "opaque" }, { type: "opaqueredirect" }, { contentType: "text/html" }, { redirected: true }]) {
    const app = worker("errors", STORAGE);
    await app.lifecycle("install"); app.setRemote(options);
    const request = { destination: "image" };
    assert.equal(await (await app.fetch(storageUrl(), request)).text(), "shell:/nori-icon.svg");
    const cache = await app.caches.open("nori-web-errors-media");
    assert.equal((await cache.keys()).length, 0);
    app.setRemote({});
    assert.match(await (await app.fetch(storageUrl(), request)).text(), /network:/);
    assert.equal((await cache.keys()).length, 1);
  }
});

test("Storage origin·버킷·객체 경로·요청 모드를 정확히 제한한다", async () => {
  const app = worker("allowlist", STORAGE);
  await app.lifecycle("install");
  for (const url of [
    storageUrl().replace(STORAGE.origin, "https://other.fixture.invalid"),
    storageUrl().replace("public-fixture", "private-fixture"),
    storageUrl().replace("/object/public/", "/object/authenticated/"),
    storageUrl().replace("detail.webp", "original.jpeg"),
    storageUrl() + "?token=not-allowed",
    storageUrl().replace("/play_301/", "/other/"),
  ]) assert.equal(await app.fetch(url, { destination: "image" }), undefined, url);
  for (const options of [{ mode: "no-cors" }, { method: "POST" }, { credentials: "include" }, { destination: "script" }]) {
    assert.equal(await app.fetch(storageUrl(), { destination: "image", ...options }), undefined);
  }
  assert.deepEqual(app.fetched, []);
  const sameOrigin = worker("same-origin", { origin: "http://localhost", bucket: "public-fixture" });
  assert.equal(await sameOrigin.fetch("/storage/v1/object/authenticated/private-fixture/play_301/original.jpeg", { destination: "image" }), undefined);
});

test("동시 요청에서도 로컬+Storage 이미지 합계 80개를 유지하고 버전 경로를 별도 캐시한다", async () => {
  const app = worker("bounded", STORAGE);
  await app.lifecycle("install");
  await app.fetch(storageUrl(), { destination: "image" });
  const next = storageUrl("play_301", "b".repeat(64));
  assert.match(await (await app.fetch(next, { destination: "image" })).text(), /bbbb/);
  await Promise.all(Array.from({ length: 90 }, (_, i) => app.fetch(i % 2 ? storageUrl(`play_${400 + i}`) : `/media/thumbs/play_${400 + i}.webp`, { destination: "image" })));
  const cache = await app.caches.open("nori-web-bounded-media");
  assert.equal((await cache.keys()).length, 80);
  assert.equal(await cache.match(storageUrl()), undefined);
  assert.equal(app.skipped(), false);
  app.message({ type: "SKIP_WAITING" });
  assert.equal(app.skipped(), true);
});

test("이전 워커가 활성 상태여도 새 HTML의 해시 스타일은 이전 CSS와 섞이지 않는다", async () => {
  const app = worker("old");
  await app.lifecycle("install");
  const cache = await app.caches.open("nori-web-old-shell");
  await cache.put("/web.css", new Response("old layout styles"));
  await app.fetch("/", { mode: "navigate" });
  const stylesheet = "/web.123456abcdef.css";
  assert.match(await (await app.fetch(stylesheet, { destination: "style" })).text(), /network:.*web\.123456abcdef\.css/);
  assert.equal(app.skipped(), false);
  app.setOnline(false);
  assert.match(await (await app.fetch(stylesheet, { destination: "style" })).text(), /network:.*web\.123456abcdef\.css/);
  assert.equal(await (await cache.match("/web.css")).text(), "old layout styles");
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

test("온라인 설치 직후 앱을 한 번도 열지 않아도 첫 오프라인 기본 화면·설정 셸을 제공한다", async () => {
  const app = worker("first-offline", STORAGE);
  await app.lifecycle("install"); await app.lifecycle("activate");
  assert.deepEqual(app.fetched, []);
  app.setOnline(false);
  for (const route of ["/", "/start", "/settings", "/mypage"]) {
    assert.equal(await (await app.fetch(route, { mode: "navigate" })).text(), "shell:/index.html");
  }
  for (const [file, destination] of [["/entry.js", "script"], ["/web.css", "style"], ["/nori-icon.svg", "image"]]) {
    assert.equal(await (await app.fetch(file, { destination })).text(), `shell:${file}`);
  }
  assert.equal(await (await app.fetch(storageUrl(), { destination: "image" })).text(), "shell:/nori-icon.svg");
  assert.equal((await app.caches.open("nori-web-first-offline-media")).entries.size, 0);
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

test("이전 놀이 그림이 캐시에 있어도 새 버전 상세·썸네일을 받고 오프라인에서 유지한다", async () => {
  const app = worker("old");
  await app.lifecycle("install");
  const cache = await app.caches.open("nori-web-old-media");
  for (const kind of ["plays", "thumbs"]) {
    const previous = `/media/${kind}/play_006.webp`;
    await cache.put(previous, new Response("old small-cap scene"));
    const updated = `${previous}?v=large-lid-scene`;
    assert.match(await (await app.fetch(updated, { destination: "image" })).text(), /network:.*v=large-lid-scene/);
    app.setOnline(false);
    assert.match(await (await app.fetch(updated, { destination: "image" })).text(), /network:.*v=large-lid-scene/);
    assert.equal(await (await cache.match(previous)).text(), "old small-cap scene");
    app.setOnline(true);
  }
});


const MATERIAL_STORAGE={...STORAGE,bucket:"material-fixture"};
const materialUrl=(slug="paper",version="b".repeat(64))=>`${STORAGE.origin}/storage/v1/object/public/material-fixture/materials/${slug}/${version}/icon.webp`;
test("재료 CORS·오프라인·에러·정확한 경로와 놀이/로컬 합계80개를 유지한다",async()=>{
  const app=worker("materials",STORAGE,MATERIAL_STORAGE);await app.lifecycle("install");const request={destination:"image",credentials:"same-origin"};
  assert.match(await(await app.fetch(materialUrl(),request)).text(),/network:/);app.setOnline(false);
  assert.match(await(await app.fetch(materialUrl(),request)).text(),/network:/);assert.equal(await(await app.fetch(materialUrl("unvisited"),request)).text(),"shell:/nori-icon.svg");app.setOnline(true);
  for(const url of [materialUrl()+"?token=secret",materialUrl().replace("/public/","/authenticated/"),materialUrl().replace("icon.webp","original.jpeg"),materialUrl().replace("/paper/","/play_001/x/"),materialUrl().replace("/paper/","/Paper/"),materialUrl().replace(STORAGE.origin,"https://other.invalid")])assert.equal(await app.fetch(url,request),undefined);
  for(const opts of [{status:404},{type:"opaque"},{redirected:true},{contentType:"text/html"}]){app.setRemote(opts);assert.equal(await(await app.fetch(materialUrl("failed"),request)).text(),"shell:/nori-icon.svg");}
  app.setRemote({});await Promise.all(Array.from({length:90},(_,i)=>app.fetch(i%3===0?materialUrl("material_"+i):i%3===1?storageUrl("play_"+(400+i)):`/media/local-${i}.webp`,request)));
  const cache=await app.caches.open("nori-web-materials-media");assert.equal((await cache.keys()).length,80);app.message({type:"SKIP_WAITING"});assert.equal(app.skipped(),true);
});
