import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildWeb, webExportEnvironment } from "../scripts/build-web.mjs";
import { publishWebBuild } from "../scripts/web/build-output.mjs";
import { publicImageInput } from "../scripts/web/play-images.mjs";
import { verifyPublicImageAssets } from "../scripts/web/public-image-assets.mjs";
import { contentHash } from "../scripts/review/review-core.mjs";
import { TRANSFORM } from "../scripts/play-image-storage/manifest.mjs";
import { sha256 } from "../scripts/play-image-storage/files.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
function put(root, relative, value) { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); }
function tree(root, prefix = "") {
  return Object.fromEntries(fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? Object.entries(tree(root, name)) : [[name, sha256(fs.readFileSync(path.join(root, name)))]];
  }));
}
async function fixture(t, wholeApp = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nori-public-build-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // A sparse fixture, never a clone/worktree: no .git, credentials or play JPEGs.
  for (const file of ["package.json", "app.json", "tsconfig.json", "babel.config.js", "metro.config.js"]) fs.copyFileSync(path.join(project, file), path.join(root, file));
  if (wholeApp) {
    for (const directory of ["app", "src"]) fs.cpSync(path.join(project, directory), path.join(root, directory), { recursive: true });
    // Only already-public assets and dependencies are shared, never images/plays.
    fs.appendFileSync(path.join(root, "metro.config.js"), `\nmodule.exports.watchFolders = [${JSON.stringify(project)}];\n`);
  } else {
    for (const file of ["materialImageSources.ts", "playImageWebManifest.json", "playImageVersions.json"]) put(root, `src/constants/${file}`, fs.readFileSync(path.join(project, "src/constants", file)));
  }
  fs.mkdirSync(path.join(root, "public"));
  for (const entry of fs.readdirSync(path.join(project, "public"), { withFileTypes: true })) {
    if (entry.isFile() || entry.name === "og") fs.cpSync(path.join(project, "public", entry.name), path.join(root, "public", entry.name), { recursive: true });
  }
  fs.symlinkSync(path.join(project, "assets"), path.join(root, "assets"), "dir");
  fs.symlinkSync(path.join(project, "node_modules"), path.join(root, "node_modules"), "dir");
  fs.mkdirSync(path.join(root, "images"));
  for (const entry of fs.readdirSync(path.join(project, "images"), { withFileTypes: true })) {
    if (entry.name !== "plays") fs.symlinkSync(path.join(project, "images", entry.name), path.join(root, "images", entry.name), entry.isDirectory() ? "dir" : "file");
  }
  const bundle = json(path.join(project, "data/plays.json"));
  const registry = json(path.join(project, "data/materials.json"));
  const sample = bundle.plays.find((play) => play.id === "play_013");
  if (!wholeApp) bundle.plays = ["live", "live", "draft", "archived"].map((status, i) => ({ ...sample, id: `play_${301 + i}`, name: `build fixture ${i}`, status, ...(i === 1 ? { imageStatus: "review" } : {}) }));
  put(root, "data/plays.json", JSON.stringify(bundle)); put(root, "data/materials.json", JSON.stringify(registry));
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#ffaa88" } }).webp().toBuffer();
  const sourceHash = sha256("approved synthetic fixture source"), assetHash = sha256(bytes);
  const version = sha256(JSON.stringify([TRANSFORM, sourceHash, assetHash, assetHash]));
  const entries = {};
  for (const play of bundle.plays) {
    entries[play.id] = { sourceHash, contentHash: contentHash(play, registry), version,
      detail: { path: `${play.id}/${version}/detail.webp`, sha256: assetHash, bytes: bytes.length },
      thumbnail: { path: `${play.id}/${version}/thumbnail.webp`, sha256: assetHash, bytes: bytes.length } };
    if (play.status === "live" && play.imageStatus !== "review") for (const kind of ["detail", "thumbnail"]) put(root, `objects/public-fixture/${entries[play.id][kind].path}`, bytes);
  }
  const candidate = { schemaVersion: 1, bucket: "public-fixture", entries, secret: "fixture-secret-never-publish" };
  const manifestFile = path.join(root, "public-candidate.json");
  const save = () => fs.writeFileSync(manifestFile, JSON.stringify(candidate)); save();
  put(root, "dist/index.html", "last known good deployment"); put(root, "dist/keep.txt", "preserve me on failure");
  put(root, ".env", 'PLAY_IMAGE_STORAGE_SERVICE_ROLE_KEY=fixture-secret-never-publish\n');
  const env = { PATH: process.env.PATH, ...Object.fromEntries(Object.entries(process.env).filter(([key]) => ["HOME", "TMPDIR", "SystemRoot"].includes(key))),
    PLAY_IMAGE_PUBLIC_MANIFEST: manifestFile, PLAY_IMAGE_PUBLIC_ORIGIN: "https://storage.fixture.invalid", PLAY_IMAGE_PUBLIC_BUCKET: "public-fixture", PLAY_IMAGE_PUBLIC_ASSET_DIR: path.join(root, "objects"),
    PUBLIC_ORIGIN: "https://fixture.example.test", EXPO_PUBLIC_GA_ENABLED: "false", EXPO_NO_TELEMETRY: "1" };
  return { root, bundle, registry, candidate, save, bytes, env, before: tree(path.join(root, "dist")),
    originalSnapshot: fs.readFileSync(path.join(root, "src/constants/playImageWebManifest.json")),
    assetFile: (id, kind = "detail") => path.join(root, "objects/public-fixture", candidate.entries[id][kind].path) };
}
function fakeExport({ root, dist, env }) {
  assert.equal(env.PLAY_IMAGE_STORAGE_SERVICE_ROLE_KEY, undefined);
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(env.EXPO_NO_DOTENV, "1");
  fs.cpSync(path.join(root, "public"), dist, { recursive: true });
  put(dist, "index.html", '<html><head><title>fixture</title><link href="/web.css" /></head><body>fixture</body></html>');
  put(dist, "web.css", "body{}"); put(dist, "entry.js", "window.fixture=true;");
  return { status: 0, stdout: "", stderr: "" };
}
function unchanged(f) {
  assert.deepEqual(tree(path.join(f.root, "dist")), f.before);
  assert.deepEqual(fs.readFileSync(path.join(f.root, "src/constants/playImageWebManifest.json")), f.originalSnapshot);
  assert.equal(fs.existsSync(path.join(f.root, "generated/play-image-storage/web-output.lock")), false);
  if (fs.existsSync(path.join(f.root, "generated"))) assert.ok(fs.readdirSync(path.join(f.root, "generated")).every((name) => !name.startsWith("web-build-")));
}

test("공개 자산만으로 빌드하며 놀이 원본·관리자 키 없이 검증 완료 출력만 교체한다", async (t) => {
  const f = await fixture(t);
  put(f.root, "public/media/plays/play_301.webp", "stale local output");
  put(f.root, "public/media/thumbs/play_304.webp", "old private image");
  const report = await buildWeb({ root: f.root, env: f.env, exportApp: fakeExport, fetchImpl: () => { throw Error("network forbidden"); } });
  assert.equal(report.imageMode, "public"); assert.equal(report.verifiedPublicAssets, 2); assert.equal(report.originalMB, 0);
  assert.equal(fs.existsSync(path.join(f.root, "images/plays")), false);
  assert.equal(fs.existsSync(path.join(f.root, "dist/media/plays")), false);
  assert.equal(fs.existsSync(path.join(f.root, "dist/media/thumbs")), false);
  assert.equal(fs.readFileSync(path.join(f.root, "public/media/plays/play_301.webp"), "utf8"), "stale local output");
  const html = fs.readFileSync(path.join(f.root, "dist/play/play_301/index.html"), "utf8");
  assert.match(html, /https:\/\/storage.fixture.invalid\/storage\/v1\/object\/public\/public-fixture/);
  assert.doesNotMatch(html, /fixture-secret|original.jpeg/);
  assert.deepEqual(fs.readFileSync(path.join(f.root, "src/constants/playImageWebManifest.json")), f.originalSnapshot);
});

test("필수 후보·파일 누락과 해시 오류는 export 전에 중단하고 마지막 출력을 보존한다", async (t) => {
  for (const reason of ["manifest-missing", "file-missing", "hash-mismatch"]) {
    const f = await fixture(t); let exported = false;
    if (reason === "manifest-missing") { delete f.candidate.entries.play_301; f.save(); }
    else if (reason === "file-missing") fs.unlinkSync(f.assetFile("play_301", "thumbnail"));
    else fs.writeFileSync(f.assetFile("play_301"), Buffer.alloc(f.bytes.length, 1));
    await assert.rejects(buildWeb({ root: f.root, env: f.env, exportApp: () => { exported = true; throw Error(); } }), /missing|integrity/);
    assert.equal(exported, false); unchanged(f);
  }
});

test("맞는 해시라도 손상 WebP·크기 초과와 심볼릭 링크는 빌드 입력에서 거부한다", async (t) => {
  for (const reason of ["invalid-WebP", "symlink"]) {
    const f = await fixture(t);
    if (reason === "invalid-WebP") {
      const entry = f.candidate.entries.play_301, bytes = Buffer.from("not WebP");
      entry.detail.sha256 = sha256(bytes); entry.detail.bytes = bytes.length;
      entry.version = sha256(JSON.stringify([TRANSFORM, entry.sourceHash, entry.detail.sha256, entry.thumbnail.sha256]));
      for (const kind of ["detail", "thumbnail"]) entry[kind].path = `play_301/${entry.version}/${kind}.webp`;
      put(f.root, `objects/public-fixture/${entry.detail.path}`, bytes); f.save();
    } else { const file = f.assetFile("play_301"); fs.unlinkSync(file); fs.symlinkSync(path.join(f.root, ".env"), file); }
    await assert.rejects(buildWeb({ root: f.root, env: f.env, exportApp: fakeExport }), /invalid WebP|unsafe/); unchanged(f);
  }
  const f = await fixture(t), input = publicImageInput({ plays: f.bundle.plays, registry: f.registry, env: f.env });
  input.assets[0].bytes = 16 * 1024 * 1024 + 1;
  await assert.rejects(verifyPublicImageAssets(input), /size exceeds limit/);
});

test("공개 GET은 익명·정확한 공개 경로만 쓰며 오류·손상·redirect·opaque는 거부한다", async (t) => {
  const f = await fixture(t), env = { ...f.env, PLAY_IMAGE_PUBLIC_ASSET_DIR: "" };
  const input = publicImageInput({ plays: f.bundle.plays, registry: f.registry, env });
  const requests = [];
  const result = await verifyPublicImageAssets(input, { fetchImpl: async (url, options) => {
    assert.match(url, /^https:\/\/storage.fixture.invalid\/storage\/v1\/object\/public\/public-fixture\/play_301\/[a-f0-9]{64}\/(detail|thumbnail).webp$/);
    assert.equal(options.method, "GET"); assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, { Accept: "image/webp" }); requests.push(url);
    return new Response(f.bytes, { headers: { "content-type": "image/webp" } });
  } });
  assert.equal(result.verifiedPublicAssets, 2); assert.equal(requests.length, 2);
  for (const status of [404, 503]) {
    await assert.rejects(verifyPublicImageAssets(input, { fetchImpl: async () => new Response("fixture-secret", { status }) }), /download failed/);
  }
  for (const property of ["redirected", "type"]) await assert.rejects(verifyPublicImageAssets(input, { fetchImpl: async () => {
    const response = new Response(f.bytes, { headers: { "content-type": "image/webp" } });
    Object.defineProperty(response, property, { value: property === "type" ? "opaque" : true }); return response;
  } }), /download failed/);
  await assert.rejects(verifyPublicImageAssets(input, { fetchImpl: async () => { throw Error("fixture-secret"); } }), (error) => error.message.includes("download failed") && !error.message.includes("fixture-secret"));
});

test("export 실패·후처리 실패·출력 교체 실패에서도 기존 배포와 소스 스냅샷을 보존한다", async (t) => {
  const f = await fixture(t);
  await assert.rejects(buildWeb({ root: f.root, env: f.env, exportApp: (options) => { fakeExport(options); return { status: 1, stdout: "fixture export failed", stderr: "" }; } }), /export failed/); unchanged(f);
  await assert.rejects(buildWeb({ root: f.root, env: f.env, exportApp: (options) => { fakeExport(options); fs.unlinkSync(path.join(options.dist, "web.css")); return { status: 0, stdout: "" }; } })); unchanged(f);
  await assert.rejects(publishWebBuild(f.root, async (next) => { put(next, "index.html", "next"); }, { rename: async (from, to) => {
    if (from.endsWith("/next")) throw Error("fixture promote failed"); await fsp.rename(from, to);
  } }), /promote failed/); unchanged(f);
  const error = await publishWebBuild(f.root, async (next) => { put(next, "index.html", "next"); }, { rename: async (from, to) => {
    if (from.endsWith("/next") || from.endsWith("/previous")) throw Error("fixture rollback unavailable");
    await fsp.rename(from, to);
  } }).catch((error) => error);
  assert.match(error.message, /Previous web output retained at /);
  const retained = error.message.split("retained at ")[1];
  assert.deepEqual(tree(retained), f.before);
});

test("웹 export 환경은 관리자 값과 dotenv를 필요로 하지 않는다", () => {
  const inherited = { PATH: "/fixture", PLAY_IMAGE_STORAGE_SERVICE_ROLE_KEY: "secret", SUPABASE_SERVICE_ROLE_KEY: "secret", EXPO_PUBLIC_SUPABASE_KEY: "secret", PLAY_IMAGE_PUBLIC_ASSET_DIR: "/fixture/assets", EXPO_PUBLIC_GA_ENABLED: "false" };
  const env = webExportEnvironment(inherited, true);
  for (const key of Object.keys(inherited).filter((key) => /SUPABASE|PLAY_IMAGE/.test(key))) assert.equal(env[key], undefined);
  assert.equal(env.EXPO_NO_DOTENV, "1"); assert.equal(env.EXPO_PUBLIC_GA_ENABLED, "false"); assert.equal(inherited.SUPABASE_SERVICE_ROLE_KEY, "secret");
});

test("깨끗한 소스 fixture의 실제 앱 Expo export는 놀이 JPEG·관리자 키 없이 성공한다", { timeout: 120_000 }, async (t) => {
  const f = await fixture(t, true);
  assert.equal(fs.existsSync(path.join(f.root, ".git")), false); assert.equal(fs.existsSync(path.join(f.root, "images/plays")), false);
  assert.ok(Object.keys(f.env).every((key) => !/SERVICE_ROLE|SUPABASE/.test(key)));
  const report = await buildWeb({ root: f.root, env: f.env, fetchImpl: () => { throw Error("network forbidden"); } });
  assert.equal(report.verifiedPublicAssets, f.bundle.plays.filter((play) => play.status === "live" && play.imageStatus !== "review").length * 2); assert.equal(report.originalMB, 0);
  const jsRoot = path.join(f.root, "dist/_expo/static/js");
  const scripts = [];
  function collect(directory) { for (const item of fs.readdirSync(directory, { withFileTypes: true })) { const file = path.join(directory, item.name); if (item.isDirectory()) collect(file); else if (file.endsWith(".js")) scripts.push(fs.readFileSync(file, "utf8")); } }
  collect(jsRoot);
  assert.ok(scripts.some((script) => script.includes("storage.fixture.invalid")));
  assert.ok(scripts.every((script) => !script.includes("fixture-secret-never-publish")));
  assert.deepEqual(fs.readFileSync(path.join(f.root, "src/constants/playImageWebManifest.json")), f.originalSnapshot);
  assert.equal(fs.existsSync(path.join(f.root, "images/plays")), false);
  assert.equal(fs.existsSync(path.join(f.root, "dist/media/plays")), false);
});
