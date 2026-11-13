import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { DEV_AREAS, INTRO_PATH, INTRO_SCREENS, QUICK_PREP_MINUTES, collectIntroData, renderIntroPage, writeIntroPage } from "../scripts/web/intro.mjs";
import { createWebServer } from "../scripts/serve-web.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
const bundle = await readJson("data/plays.json");
const registry = await readJson("data/materials.json");
const live = bundle.plays.filter((play) => play.status === "live");

function screensFor() {
  return Object.fromEntries(Object.entries(INTRO_SCREENS).map(([key, screen]) => [key, { src: `${INTRO_PATH}/media/${screen.file}`, alt: screen.alt }]));
}

test("소개 페이지 숫자는 공개 놀이·재료 데이터에서 계산한다", () => {
  const data = collectIntroData({ plays: bundle.plays, registry });
  const pending = new Set(registry.reviewPending);
  assert.equal(data.playCount, live.length);
  assert.equal(data.quickPrepCount, live.filter((play) => play.prepTime <= QUICK_PREP_MINUTES).length);
  assert.equal(data.materialCount, Object.values(registry.categories).flat().filter((slug) => !pending.has(slug)).length);
  assert.equal(data.ageMin, Math.min(...live.map((play) => play.ageMin)));
  assert.equal(data.ageMax, Math.max(...live.map((play) => play.ageMax)));
  assert.ok(data.materialSlugs.every((slug) => !pending.has(slug)));
  assert.ok(data.plays.every((play) => live.some((source) => source.id === play.id)));

  // 데이터가 바뀌면 숫자도 함께 바뀐다(하드코딩 방지).
  const subset = collectIntroData({ plays: [...live.slice(0, 3), { ...live[3], status: "draft" }], registry });
  assert.equal(subset.playCount, 3);
  assert.equal(subset.plays.length, 3);
  const html = renderIntroPage({ data: subset, screens: screensFor() });
  assert.match(html, /<strong>3개<\/strong><span>함께할 놀이/);
});

test("발달영역 표시명은 앱 상수와 같은 순서·이름을 사용한다", async () => {
  const source = await fs.readFile(path.join(root, "src/constants/devAreas.ts"), "utf8");
  const labels = source.slice(source.indexOf("DEV_AREA_LABELS"));
  const appAreas = [...labels.matchAll(/^\s+(\w+): "([^"]+)",$/gm)].slice(0, DEV_AREAS.length).map(([, slug, label]) => ({ slug, label }));
  assert.deepEqual(DEV_AREAS.map(({ slug, label }) => ({ slug, label })), appAreas);
});

test("소개 페이지는 노리 레시피 브랜드·공개 링크만 쓰고 분석 스크립트를 넣지 않는다", () => {
  const data = collectIntroData({ plays: bundle.plays, registry });
  const html = renderIntroPage({ data, screens: screensFor() });
  assert.match(html, /<title>노리 레시피 · /);
  assert.doesNotMatch(html, /놀이 레시피/);
  assert.doesNotMatch(html, /gtag|googletagmanager|google-analytics|serviceWorker\.register/);
  assert.match(html, /<link rel="canonical" href="__NORI_ORIGIN__\/intro" \/>/);
  const embedded = JSON.parse(html.match(/<script type="application\/json" id="intro-data">([^<]*)<\/script>/)[1]);
  const liveIds = new Set(live.map((play) => play.id));
  assert.ok(embedded.plays.length > 0 && embedded.plays.every((play) => liveIds.has(play.id)));
  const reviewIds = new Set(live.filter((play) => play.imageStatus === "review").map((play) => play.id));
  assert.ok(embedded.plays.filter((play) => reviewIds.has(play.id)).every((play) => !play.thumb.includes("/media/thumbs/")));
  for (const key of Object.keys(INTRO_SCREENS)) assert.ok(html.includes(`${INTRO_PATH}/media/${INTRO_SCREENS[key].file}`), key);
});

test("빌드는 실제 화면 캡처를 해시 WebP로 만들고 운영 주소를 채운다", async () => {
  const dist = await fs.mkdtemp(path.join(os.tmpdir(), "nori-intro-"));
  try {
    const { html } = await writeIntroPage({ root, dist, plays: live, registry, publicOrigin: "https://example.test" });
    const written = await fs.readFile(path.join(dist, "intro/index.html"), "utf8");
    assert.match(written, /href="https:\/\/example\.test\/intro"/);
    assert.doesNotMatch(written, /__NORI_ORIGIN__/);
    assert.ok(html.includes("__NORI_ORIGIN__"));
    const sources = [...written.matchAll(/src="(\/intro\/media\/[^"]+)"/g)].map(([, src]) => src);
    assert.equal(new Set(sources).size, Object.keys(INTRO_SCREENS).length);
    for (const src of sources) {
      assert.match(src, /\/intro\/media\/[a-z-]+\.[0-9a-f]{12}\.webp$/);
      await fs.access(path.join(dist, src));
    }
  } finally {
    await fs.rm(dist, { recursive: true, force: true });
  }
});

test("/intro는 로컬 서버와 Vercel에서 정적 소개 페이지로 제공된다", async () => {
  const vercel = await readJson("vercel.json");
  assert.ok(vercel.rewrites.some((rule) => rule.source === "/intro" && rule.destination === "/intro/index.html"));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nori-intro-serve-"));
  await fs.mkdir(path.join(directory, "intro"), { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), "<html>app shell</html>");
  await fs.writeFile(path.join(directory, "intro/index.html"), '<html><link rel="canonical" href="__NORI_ORIGIN__/intro" />intro</html>');
  const server = createWebServer({ directory });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const body = await new Promise((resolve, reject) => {
      http.get({ hostname: "127.0.0.1", port, path: "/intro" }, (response) => {
        let text = "";
        response.on("data", (chunk) => { text += chunk; });
        response.on("end", () => resolve({ status: response.statusCode, text }));
      }).on("error", reject);
    });
    assert.equal(body.status, 200);
    assert.match(body.text, new RegExp(`http://127.0.0.1:${port}/intro`));
    assert.doesNotMatch(body.text, /app shell/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
