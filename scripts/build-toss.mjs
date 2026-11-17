import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prepareWebAssets } from "./prepare-web-assets.mjs";
import { withWebImageManifest } from "./web/play-images.mjs";
import { withWebMaterialManifest } from "./web/material-images.mjs";
import { tossAppName, tossExportEnvironment, tossHtml, tossImageEnvironment } from "./toss/config.mjs";
import { checkTossDirectory } from "./toss/check.mjs";
import { publishTossBuild } from "./toss/output.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
function expoExport({ root, dist, env }) {
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/expo/bin/cli"), "export", "--clear", "--platform", "web", "--output-dir", dist], { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Toss Expo export failed");
}
function packageApp({ root, work, env }) {
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/@apps-in-toss/web-framework/bin/ait.js"), "build"], { cwd: work, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Toss SDK packaging failed");
}

export async function buildToss({ root = project, env = process.env, fetchImpl = globalThis.fetch, prepare = prepareWebAssets, exportApp = expoExport, packageBundle = packageApp } = {}) {
  const appName = tossAppName(env), exportEnv = tossExportEnvironment(env);
  return publishTossBuild(root, appName, async work => {
    const dist = path.join(work, "dist-toss");
    const assets = await prepare({ root, env: tossImageEnvironment(root, env), fetchImpl });
    if (!assets.playImageManifest.storage || !assets.materialImageManifest.storage) throw new Error("Toss requires verified public image manifests");
    await withWebImageManifest(root, assets.playImageManifest, () => withWebMaterialManifest(root, assets.materialImageManifest, () => exportApp({ root, dist, env: exportEnv })));
    const html = tossHtml(await fs.readFile(path.join(dist, "index.html"), "utf8"));
    await fs.writeFile(path.join(dist, "index.html"), html);
    for (const name of ["pwa.js", "sw.js", "offline.html", "manifest.webmanifest", "og", "intro", "media/plays", "media/thumbs", "media/materials"]) await fs.rm(path.join(dist, name), { recursive: true, force: true });
    // Static route files avoid relying on the host's SPA fallback.
    const routes = ["start", "search", "favorites", "record", "mypage", "settings", "history", ...assets.plays.flatMap(play => [`play/${play.id}`, `feedback/${play.id}`])];
    for (const route of routes) {
      await fs.mkdir(path.join(dist, route), { recursive: true });
      await fs.writeFile(path.join(dist, route, "index.html"), html);
    }
    const checked = await checkTossDirectory(dist);
    // Minimal SDK packaging staging area, never a repository clone.
    await fs.copyFile(path.join(root, "package.json"), path.join(work, "package.json"));
    await fs.copyFile(path.join(root, "apps-in-toss.config.ts"), path.join(work, "apps-in-toss.config.ts"));
    await fs.symlink(path.join(root, "node_modules"), path.join(work, "node_modules"), "dir");
    await packageBundle({ root, work, env: exportEnv });
    const artifact = await fs.readFile(path.join(work, `${appName}.ait`));
    if (!artifact.length) throw new Error("Empty Toss SDK artifact");
    const release = path.join(work, "release");
    await fs.mkdir(release);
    await sharp(path.join(root, "public/nori-icon.svg")).resize(600, 600).flatten({ background: "#FAFAFE" }).png().toFile(path.join(release, "logo-600.png"));
    const report = { appName, sdk: "3.10.0", target: "toss", ...checked,
      artifact: `${appName}.ait`, artifactBytes: artifact.length, sha256: createHash("sha256").update(artifact).digest("hex"),
      publicPlays: assets.plays.length, images: assets.report, login: false, payments: false, ads: false,
      consoleUploadVerified: false, tossDeviceVerified: false, productionReleased: false };
    await fs.writeFile(path.join(release, "build-report.json"), JSON.stringify(report, null, 2) + "\n");
    await fs.writeFile(path.join(release, "app-info.json"), JSON.stringify({ appName, displayName: "노리 레시피", subtitle: "우리 집 재료로 찾는 오늘의 육아 놀이", supportEmail: "alstjs1207@naver.com", description: "0~48개월 아이를 돌보는 성인 보호자를 위한 놀이 추천 서비스예요. 아이 월령과 집에 있는 재료로 놀이를 찾고, 준비물·진행 방법·안전 안내를 확인해요. 해보고 싶은 놀이는 저장하고, 함께한 놀이는 반응과 메모로 남길 수 있어요. 회원가입·결제·광고 없이 이용하며 기록은 현재 토스앱의 기기에 저장돼요.", keyFeatures: [{ title: "재료로 놀이 찾기", scheme: `intoss://${appName}/search` }, { title: "저장한 놀이", scheme: `intoss://${appName}/favorites` }, { title: "함께한 놀이 기록", scheme: `intoss://${appName}/record` }], privacyPath: "/settings?privacy=1", logo: "logo-600.png" }, null, 2) + "\n");
    return report;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildToss().then(report => console.info(`Toss ready: ${report.artifact} (${report.artifactBytes} bytes), ${report.publicPlays} plays. Web dist unchanged.`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
