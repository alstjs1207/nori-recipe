import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { tossAdSettings, tossAppName, tossExportEnvironment, tossHtml, tossImageEnvironment } from "../scripts/toss/config.mjs";
import { checkTossDirectory } from "../scripts/toss/check.mjs";
import { publishTossBuild } from "../scripts/toss/output.mjs";

const project = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "nori-toss-test-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const put = async (name, value) => { await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), value); };
  return { root, put };
}

test("토스 export는 기밀·Vercel·분석·개발 mock 환경을 전달하지 않는다", () => {
  const env = tossExportEnvironment({ PATH: "/bin", HOME: "/user", TOSS_APP_NAME: "nori-recipe", SECRET: "never", SUPABASE_SERVICE_ROLE_KEY: "never", TOSS_DEVTOOLS: "1", EXPO_PUBLIC_GA_ENABLED: "true", VERCEL_URL: "web.example.com", PLAY_IMAGE_PUBLIC_MANIFEST: "private-path" });
  assert.equal(env.EXPO_PUBLIC_APP_TARGET, "toss");
  assert.equal(env.EXPO_NO_DOTENV, "1");
  assert.equal(env.TOSS_DEVTOOLS, "");
  assert.equal(env.EXPO_PUBLIC_GA_ENABLED, "false");
  assert.equal(env.EXPO_PUBLIC_TOSS_APP_NAME, "nori-recipe");
  for (const key of ["SECRET", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_URL", "PLAY_IMAGE_PUBLIC_MANIFEST"]) assert.equal(env[key], undefined);
  assert.throws(() => tossAppName({ TOSS_APP_NAME: "../other" }));
  const images = tossImageEnvironment(project, {});
  assert.ok(path.isAbsolute(images.PLAY_IMAGE_PUBLIC_MANIFEST));
  assert.equal(images.PLAY_IMAGE_PUBLIC_BUCKET, "play-assets");
  assert.throws(() => tossImageEnvironment(project, { PLAY_IMAGE_PUBLIC_ORIGIN: "http://example.com" }), /HTTPS/);
});

test("토스 HTML에서 PWA·웹 공유 메타데이터를 제거하고 일반 원본을 보존한다", async () => {
  const html = await fs.readFile(path.join(project, "public/index.html"), "utf8");
  const output = tossHtml(html);
  assert.match(html, /pwa\.js/);
  assert.doesNotMatch(output, /pwa\.js|rel="manifest"|apple-touch-icon/);
  assert.match(output, /user-scalable=no/);
  assert.match(output, /data-nori-target="toss"/);
  assert.equal((output.match(/href="\/toss.css"/g) ?? []).length, 1);
});

test("Metro는 토스 프로덕션·개발 모의 SDK·웹·네이티브 해석을 분리한다", () => {
  const saved = { target: process.env.EXPO_PUBLIC_APP_TARGET, dev: process.env.TOSS_DEVTOOLS };
  try {
    const config = require("../metro.config.js");
    const fallback = { type: "sourceFile", filePath: "original" };
    const context = { resolveRequest: () => fallback };
    delete process.env.EXPO_PUBLIC_APP_TARGET;
    assert.equal(config.resolver.resolveRequest(context, "@/platform/runtime", "web"), fallback);
    process.env.EXPO_PUBLIC_APP_TARGET = "toss";
    assert.match(config.resolver.resolveRequest(context, "@/platform/runtime", "web").filePath, /runtime\.toss\.ts$/);
    assert.equal(config.resolver.resolveRequest(context, "@/platform/runtime", "ios"), fallback);
    assert.equal(config.resolver.resolveRequest(context, "@apps-in-toss/web-framework", "web"), fallback);
    process.env.TOSS_DEVTOOLS = "1";
    assert.match(config.resolver.resolveRequest(context, "@apps-in-toss/web-framework", "web").filePath, /devtools.*mock.*3x/);
    assert.match(config.resolver.resolveRequest(context, "@/platform/devtools", "web").filePath, /devtools\.preview\.ts$/);
  } finally {
    if (saved.target === undefined) delete process.env.EXPO_PUBLIC_APP_TARGET; else process.env.EXPO_PUBLIC_APP_TARGET = saved.target;
    if (saved.dev === undefined) delete process.env.TOSS_DEVTOOLS; else process.env.TOSS_DEVTOOLS = saved.dev;
  }
});

test("번들 검사는 잘못된 런타임·모의 SDK·소스맵·기밀·PWA·용량 초과를 거부한다", async t => {
  const f = await fixture(t);
  await f.put("index.html", tossHtml('<head><meta name="viewport" content="width=device-width"></head><body></body>'));
  await f.put("toss.css", "body{}");
  await f.put("entry.js", 'window.storagePrefix="nori-recipe/toss/v1/";');
  assert.equal((await checkTossDirectory(f.root)).files, 3);
  for (const [name, value] of [["pwa.js", "pwa"], [".env", "private"], ["source.map", "map"], ["debug.js", "__aitDevtoolsState__"], ["secret.js", "sb_secret_should_not_ship"]]) {
    await f.put(name, value);
    await assert.rejects(checkTossDirectory(f.root), /Private|Debug/);
    await fs.unlink(path.join(f.root, name));
  }
  await f.put("entry.js", "ordinary-web-runtime");
  await assert.rejects(checkTossDirectory(f.root), /runtime is missing/);
  const large = await fs.open(path.join(f.root, "large.bin"), "w");
  await large.truncate(100_000_001); await large.close();
  await assert.rejects(checkTossDirectory(f.root), /exceeds 100MB/);
});

test("토스 빌드 교체 실패는 웹·직전 토스 export·SDK 번들·보고서를 모두 보존한다", async t => {
  const f = await fixture(t);
  for (const name of ["dist/index.html", "dist-toss/index.html", "nori-recipe.ait", "generated/toss-release/build-report.json"]) await f.put(name, `previous:${name}`);
  const render = async work => {
    await fs.mkdir(path.join(work, "dist-toss")); await fs.writeFile(path.join(work, "dist-toss/index.html"), "new");
    await fs.writeFile(path.join(work, "nori-recipe.ait"), "new artifact");
    await fs.mkdir(path.join(work, "release")); await fs.writeFile(path.join(work, "release/build-report.json"), "new report");
    return "built";
  };
  await assert.rejects(publishTossBuild(f.root, "nori-recipe", render, { rename: async (source, target) => {
    if (source.endsWith("nori-recipe.ait") && !source.startsWith(f.root + "/nori-recipe.ait") && target === path.join(f.root, "nori-recipe.ait")) throw new Error("artifact promote failed");
    return fs.rename(source, target);
  } }), /artifact promote failed/);
  for (const name of ["dist/index.html", "dist-toss/index.html", "nori-recipe.ait", "generated/toss-release/build-report.json"]) assert.equal(await fs.readFile(path.join(f.root, name), "utf8"), `previous:${name}`);
  assert.equal(await publishTossBuild(f.root, "nori-recipe", render), "built");
  assert.equal(await fs.readFile(path.join(f.root, "dist/index.html"), "utf8"), "previous:dist/index.html");
  assert.equal(await fs.readFile(path.join(f.root, "dist-toss/index.html"), "utf8"), "new");
  assert.ok(!(await fs.readdir(path.join(f.root, "generated"))).some(name => name.startsWith("toss-build-")));
});


test("광고 테스트·운영·비활성 모드를 분리하고 개발 환경에는 테스트 ID만 전달한다", async () => {
  assert.equal(tossAdSettings({ TOSS_AD_MODE: "production" }).adGroupId, "ait.v2.live.b6af39a4123a41ae");
  assert.equal(tossAdSettings({}).adGroupId, "ait-ad-test-interstitial-id");
  assert.equal(tossExportEnvironment({ TOSS_COMPLETION_AD_GROUP_ID: "ait.live.secret" }).EXPO_PUBLIC_TOSS_COMPLETION_AD_GROUP_ID, "ait-ad-test-interstitial-id");
  assert.equal(tossAdSettings({ TOSS_AD_MODE: "disabled" }).adGroupId, "");
  assert.throws(() => tossAdSettings({ TOSS_AD_MODE: "production", TOSS_COMPLETION_AD_GROUP_ID: "" }), /console-issued/);
  assert.throws(() => tossAdSettings({ TOSS_AD_MODE: "production", TOSS_COMPLETION_AD_GROUP_ID: "ait-ad-test-interstitial-id" }), /console-issued/);
  assert.throws(() => tossAdSettings({ TOSS_AD_MODE: "other" }), /Invalid/);
  assert.equal(tossExportEnvironment({ TOSS_AD_MODE: "production", TOSS_COMPLETION_AD_GROUP_ID: "ait.live.example" }).EXPO_PUBLIC_TOSS_COMPLETION_AD_GROUP_ID, "ait.live.example");
  const dev = await fs.readFile(path.join(project, "scripts/dev-toss.mjs"), "utf8");
  assert.match(dev, /TOSS_AD_MODE: "test"/);
});
