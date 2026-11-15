import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentHash } from "../scripts/review/review-core.mjs";
import { TRANSFORM } from "../scripts/play-image-storage/manifest.mjs";
import { sha256 } from "../scripts/play-image-storage/files.mjs";
import { webPlayImages, withWebImageManifest } from "../scripts/web/play-images.mjs";
import { withPlayMetadata, withPublicOrigin, resolvePublicOrigin } from "../scripts/web/html.mjs";
import { collectIntroData, renderIntroPage, INTRO_SCREENS } from "../scripts/web/intro.mjs";
import { DEFAULT_PLAY_IMAGE, DEFAULT_PLAY_SHARE_IMAGE, localWebImages, playImageUrl, visibleWebImages } from "../src/constants/playImageManifest.ts";

const project = fileURLToPath(new URL("../", import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nori-web-images-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = readJson(path.join(project, "data/materials.json"));
  const sample = readJson(path.join(project, "data/plays.json")).plays.find((play) => play.id === "play_013");
  const plays = ["live", "draft", "archived", "live"].map((status, i) => ({ ...sample, id: `play_${301 + i}`, status, ...(i === 3 ? { imageStatus: "review" } : {}) }));
  const sourceHash = sha256("source"), detailHash = sha256("detail"), thumbnailHash = sha256("thumbnail");
  const version = sha256(JSON.stringify([TRANSFORM, sourceHash, detailHash, thumbnailHash]));
  const entries = Object.fromEntries(plays.map((play) => [play.id, { sourceHash, contentHash: contentHash(play, registry), version,
    detail: { path: `${play.id}/${version}/detail.webp`, sha256: detailHash, bytes: 6 },
    thumbnail: { path: `${play.id}/${version}/thumbnail.webp`, sha256: thumbnailHash, bytes: 9 } }]));
  const candidate = { schemaVersion: 1, bucket: "public-fixture", entries, secret: "never-embed-admin-fixture" };
  const file = path.join(root, "public.json");
  const save = () => fs.writeFileSync(file, JSON.stringify(candidate)); save();
  const env = { PLAY_IMAGE_PUBLIC_MANIFEST: file, PLAY_IMAGE_PUBLIC_ORIGIN: "https://storage.fixture.invalid", PLAY_IMAGE_PUBLIC_BUCKET: candidate.bucket };
  const build = (customEnv = env) => webPlayImages({ root, plays, registry, versions: {}, env: customEnv });
  return { root, plays, registry, candidate, save, env, build };
}

test("웹·공유·소개 페이지는 동일한 공개 매니페스트 버전을 사용하고 비공개·잘못된 ID는 제외한다", (t) => {
  const f = fixture(t), manifest = f.build();
  const detail = playImageUrl(manifest, "play_301"), thumbnail = playImageUrl(manifest, "play_301", "thumbnail");
  assert.match(detail, /^https:\/\/storage\.fixture\.invalid\/storage\/v1\/object\/public\/public-fixture\/play_301\/[a-f0-9]{64}\/detail.webp$/);
  assert.equal(thumbnail.replace("thumbnail.webp", "detail.webp"), detail);
  assert.deepEqual(Object.keys(manifest.entries), ["play_301"]);
  for (const id of ["play_302", "play_303", "play_304", "play_999", "../play_301", "__proto__"]) assert.equal(playImageUrl(manifest, id), DEFAULT_PLAY_IMAGE);
  assert.equal(playImageUrl(visibleWebImages(manifest, [{ id: "play_301", status: "draft" }], {}), "play_301"), DEFAULT_PLAY_IMAGE);
  const data = collectIntroData({ plays: f.plays, registry: f.registry });
  const screens = Object.fromEntries(Object.entries(INTRO_SCREENS).map(([key, value]) => [key, { src: `/fixture/${key}.webp`, alt: value.alt }]));
  const intro = renderIntroPage({ data, screens, playImageManifest: manifest });
  assert.ok(intro.includes(thumbnail));
  assert.ok(intro.includes("img.crossOrigin = 'anonymous'"));
  assert.doesNotMatch(JSON.stringify(manifest), /never-embed-admin-fixture|sourceHash|contentHash|original|service_role/);
  const metadata = withPlayMetadata("<head><title>fixture</title></head>", f.plays[0], manifest);
  assert.ok(metadata.includes(`property="og:image" content="${detail}"`));
});

test("Preview/Production canonical은 배포 origin을 따르고 Storage OG URL은 치환하지 않는다", (t) => {
  const f = fixture(t), manifest = f.build(), image = playImageUrl(manifest, "play_301");
  for (const [VERCEL_ENV, origin] of [["preview", "https://preview.fixture.vercel.app"], ["production", "https://www.nori-recipe.com"]]) {
    const publicOrigin = resolvePublicOrigin({ VERCEL: "1", VERCEL_ENV, VERCEL_URL: "preview.fixture.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "www.nori-recipe.com" });
    const html = withPublicOrigin(withPlayMetadata("<head></head>", f.plays[0], manifest), publicOrigin);
    assert.ok(html.includes(`href="${origin}/play/play_301"`));
    assert.ok(html.includes(`content="${image}"`));
    const fallback = withPublicOrigin(withPlayMetadata("<head></head>", f.plays[3], manifest), publicOrigin);
    assert.ok(fallback.includes(`content="${origin}${DEFAULT_PLAY_SHARE_IMAGE}"`));
    assert.doesNotMatch(html, /__NORI_ORIGIN__/);
  }
});

test("버전 교체는 상세·썸네일·OG에 함께 반영되고 필수 후보 누락은 빌드를 거부한다", (t) => {
  const f = fixture(t), previous = f.build();
  const entry = f.candidate.entries.play_301;
  entry.detail.sha256 = sha256("replacement-detail");
  entry.version = sha256(JSON.stringify([TRANSFORM, entry.sourceHash, entry.detail.sha256, entry.thumbnail.sha256]));
  entry.detail.path = `play_301/${entry.version}/detail.webp`; entry.thumbnail.path = `play_301/${entry.version}/thumbnail.webp`; f.save();
  const next = f.build();
  assert.notEqual(playImageUrl(next, "play_301"), playImageUrl(previous, "play_301"));
  assert.ok(withPlayMetadata("<head></head>", f.plays[0], next).includes(playImageUrl(next, "play_301")));
  delete f.candidate.entries.play_301; f.save();
  assert.throws(() => f.build(), /missing required public image/);
});

test("관리용/손상 매니페스트, 잘못된 origin/버킷, stale 내용은 거부하고 비공개 원본은 읽지 않는다", (t) => {
  const f = fixture(t);
  for (const origin of ["http://external.fixture.invalid", "https://user:pass@storage.fixture.invalid", "https://storage.fixture.invalid/path", "https://storage.fixture.invalid?token=x"]) {
    assert.throws(() => f.build({ ...f.env, PLAY_IMAGE_PUBLIC_ORIGIN: origin }));
  }
  assert.throws(() => f.build({ ...f.env, PLAY_IMAGE_PUBLIC_BUCKET: "private-fixture" }));
  assert.throws(() => f.build({ PLAY_IMAGE_PUBLIC_ORIGIN: f.env.PLAY_IMAGE_PUBLIC_ORIGIN }));
  f.candidate.entries.play_301.contentHash = "0".repeat(64); f.save(); assert.throws(() => f.build(), /stale public image content/);
  f.candidate.entries.play_301.contentHash = contentHash(f.plays[0], f.registry); f.save();
  fs.mkdirSync(path.join(f.root, "images/plays"), { recursive: true }); fs.writeFileSync(path.join(f.root, "images/plays/play_301.jpeg"), "different source");
  assert.ok(f.build().entries.play_301);
  fs.unlinkSync(path.join(f.root, "images/plays/play_301.jpeg"));
  f.candidate.entries.play_301.detail.path = "../private/original.jpeg"; f.save(); assert.throws(() => f.build());
  fs.writeFileSync(f.env.PLAY_IMAGE_PUBLIC_MANIFEST, '{"admin-secret":');
  assert.throws(() => f.build(), (error) => error.message === "Invalid public image manifest");
});

test("Expo export는 동일 공개 스냅샷을 받고 성공·실패 모두 소스 JSON을 복원한다", async (t) => {
  const f = fixture(t), manifest = f.build();
  const file = path.join(f.root, "src/constants/playImageWebManifest.json");
  fs.mkdirSync(path.dirname(file), { recursive: true }); const before = '{"schemaVersion":1,"storage":null,"entries":{}}\n'; fs.writeFileSync(file, before);
  await withWebImageManifest(f.root, manifest, async () => assert.deepEqual(readJson(file), manifest));
  assert.equal(fs.readFileSync(file, "utf8"), before);
  await assert.rejects(withWebImageManifest(f.root, manifest, () => { throw Error("export failed"); }), /export failed/);
  assert.equal(fs.readFileSync(file, "utf8"), before);
});

test("미설정 빌드는 기존 로컬 버전 주소와 검토 기본 표시를 유지한다", (t) => {
  const f = fixture(t), versions = { play_301: "123456abcdef" };
  const manifest = webPlayImages({ root: f.root, plays: f.plays, registry: f.registry, versions, env: {} });
  assert.deepEqual(manifest, localWebImages(f.plays, versions));
  assert.equal(playImageUrl(manifest, "play_301"), "/media/plays/play_301.webp?v=123456abcdef");
  assert.equal(playImageUrl(manifest, "play_304"), DEFAULT_PLAY_IMAGE);
});

test("공유 크롤러 형태의 HTTP 요청은 JavaScript 없이 정적 OG와 공개 이미지를 읽고 비공개 ID는 노출하지 않는다", async (t) => {
  const { createWebServer } = await import("../scripts/serve-web.mjs");
  const { default: sharp } = await import("sharp");
  const f = fixture(t), output = path.join(f.root, "output"); fs.mkdirSync(output);
  const server = createWebServer({ directory: output });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  f.env.PLAY_IMAGE_PUBLIC_ORIGIN = origin;
  const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#aabbcc" } }).webp().toBuffer();
  const entry = f.candidate.entries.play_301;
  entry.detail.sha256 = entry.thumbnail.sha256 = sha256(image);
  entry.detail.bytes = entry.thumbnail.bytes = image.length;
  entry.version = sha256(JSON.stringify([TRANSFORM, entry.sourceHash, entry.detail.sha256, entry.thumbnail.sha256]));
  for (const kind of ["detail", "thumbnail"]) entry[kind].path = `play_301/${entry.version}/${kind}.webp`;
  f.save(); const manifest = f.build();
  fs.writeFileSync(path.join(output, "index.html"), '<html><head><title>app shell</title></head></html>');
  for (const play of f.plays.filter((p) => p.status === "live")) {
    const directory = path.join(output, "play", play.id); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), withPublicOrigin(withPlayMetadata('<html><head><title>app</title></head><body></body></html>', play, manifest), origin));
  }
  const object = path.join(output, "storage/v1/object/public/public-fixture", entry.detail.path);
  fs.mkdirSync(path.dirname(object), { recursive: true }); fs.writeFileSync(object, image);
  for (const agent of ["facebookexternalhit/1.1", "Twitterbot/1.0"]) {
    const headers = { "User-Agent": agent };
    const response = await fetch(`${origin}/play/play_301`, { headers }); assert.equal(response.status, 200);
    const html = await response.text();
    const url = html.match(/property="og:image" content="([^"]+)"/)[1];
    assert.equal(url, manifest.entries.play_301.detail);
    assert.ok(html.includes(`rel="canonical" href="${origin}/play/play_301"`));
    const asset = await fetch(url, { headers, credentials: "omit", redirect: "error" }); assert.equal(asset.status, 200);
    const bytes = Buffer.from(await asset.arrayBuffer()); assert.equal(sha256(bytes), entry.detail.sha256);
    assert.equal((await sharp(bytes).metadata()).format, "webp");
    for (const id of ["play_302", "play_303", "play_999"]) assert.equal((await fetch(`${origin}/play/${id}`, { headers })).status, 404);
    const review = await (await fetch(`${origin}/play/play_304`, { headers })).text();
    assert.ok(review.includes(`${origin}${DEFAULT_PLAY_SHARE_IMAGE}`));
    assert.ok(!review.includes("/storage/v1/object/"));
  }
});
