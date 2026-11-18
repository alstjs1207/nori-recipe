import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { prepareWebAssets } from "./prepare-web-assets.mjs";
import { createServiceWorker } from "./web/service-worker.mjs";
import { resolvePublicOrigin, withSiteMetadata, withPlayMetadata, withPublicOrigin } from "./web/html.mjs";
import { writeIntroPage } from "./web/intro.mjs";
import { withWebMaterialManifest } from "./web/material-images.mjs";
import { withWebImageManifest } from "./web/play-images.mjs";
import { publishWebBuild } from "./web/build-output.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}

export function webExportEnvironment(inherited, publicMode) {
  const env = { ...inherited, CI: "1", EXPO_NO_TELEMETRY: "1" };
  for (const key of Object.keys(env)) {
    if ((key.startsWith("PLAY_IMAGE_") || key.startsWith("MATERIAL_IMAGE_")) || key.includes("SUPABASE") || key.includes("SERVICE_ROLE")) delete env[key];
  }
  if (publicMode) env.EXPO_NO_DOTENV = "1";
  return env;
}

function expoExport({ root, dist, env }) {
  return spawnSync(process.execPath, [path.join(root, "node_modules/expo/bin/cli"), "export", "--clear", "--platform", "web", "--output-dir", dist],
    { cwd: root, encoding: "utf8", env, maxBuffer: 8 * 1024 * 1024 });
}

export async function buildWeb({ root = project, env = process.env, fetchImpl = globalThis.fetch, exportApp = expoExport } = {}) {
  const publicOrigin = resolvePublicOrigin(env);
  const preview = env.VERCEL_ENV === "preview";
  const analyticsEnv = {
    EXPO_PUBLIC_APP_TARGET: "web",
    EXPO_PUBLIC_TOSS_APP_NAME: "",
    TOSS_DEVTOOLS: "",
    EXPO_PUBLIC_ANALYTICS_PREVIEW: String(preview),
    ...(preview ? {
      EXPO_PUBLIC_GA_ENABLED: "false",
      EXPO_PUBLIC_GA_MEASUREMENT_ID: "",
      EXPO_PUBLIC_ANALYTICS_ORIGIN: "",
    } : {}),
  };
  if (!preview && env.EXPO_PUBLIC_GA_ENABLED === "true") {
    const id = env.EXPO_PUBLIC_GA_MEASUREMENT_ID;
    const rawOrigin = env.EXPO_PUBLIC_ANALYTICS_ORIGIN;
    const origin = rawOrigin ? new URL(rawOrigin) : null;
    if (!id || !/^G-[A-Z0-9]{6,20}$/.test(id) || !origin || origin.protocol !== "https:" ||
      origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      !origin.hostname.includes(".") || /^[\d.]+$/.test(origin.hostname) || /(?:^|\.)(?:localhost|local|test|invalid)$/.test(origin.hostname)) {
      throw new Error("GA4 activation requires a valid EXPO_PUBLIC_GA_MEASUREMENT_ID and a production HTTPS EXPO_PUBLIC_ANALYTICS_ORIGIN.");
    }
  }
  return publishWebBuild(root, async (dist) => {
    const { plays, report, playImageVersions, playImageManifest, materialImageManifest } = await prepareWebAssets({ root, env, fetchImpl });
    // Exported public settings must reflect this build, not a previous environment.
    const result = await withWebImageManifest(root, playImageManifest, () => withWebMaterialManifest(root, materialImageManifest, () => exportApp({ root, dist, env: webExportEnvironment({ ...env, ...analyticsEnv }, Boolean(playImageManifest.storage || materialImageManifest.storage)) })));
    if (result.status !== 0) throw new Error(result.error?.message ?? `${result.stdout}\n${result.stderr}`);
    console.info(result.stdout.split("\n").filter((line) => /Bundled|_expo\/static\/js|Exported:/.test(line)).join("\n"));
    if (playImageManifest.storage) {
      // Legacy public/media from an earlier local build is not a verified input.
      await Promise.all(["plays", "thumbs"].map((directory) => fs.rm(path.join(dist, "media", directory), { recursive: true, force: true })));
    }
    if (materialImageManifest.storage) await fs.rm(path.join(dist, "media/materials"), { recursive: true, force: true });
    const stylesheet = await fs.readFile(path.join(dist, "web.css"));
    const styleVersion = crypto.createHash("sha256").update(stylesheet).digest("hex").slice(0, 12);
    const styleName = `web.${styleVersion}.css`;
    await fs.writeFile(path.join(dist, styleName), stylesheet);
    const exportedHtml = await fs.readFile(path.join(dist, "index.html"), "utf8");
    if (!exportedHtml.includes('href="/web.css"')) throw new Error("Exported HTML is missing the web stylesheet link.");
    // A waiting update leaves the previous worker active. Its cached /web.css
    // must not style the new JavaScript served by network-first navigation.
    const html = withPublicOrigin(withSiteMetadata(exportedHtml.replace('href="/web.css"', `href="/${styleName}"`)), publicOrigin);
    await fs.writeFile(path.join(dist, "index.html"), html);
    for (const play of plays) {
      const directory = path.join(dist, "play", play.id);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, "index.html"), withPublicOrigin(withPlayMetadata(html, play, playImageManifest), publicOrigin));
    }
    // Service introduction page (/intro): numbers come from the same live plays and material registry as this build.
    const registry = JSON.parse(await fs.readFile(path.join(root, "data/materials.json"), "utf8"));
    const materialImageVersions = JSON.parse(await fs.readFile(path.join(root, "src/constants/materialImageVersions.json"), "utf8"));
    const intro = await writeIntroPage({ root, dist, plays, registry, playImageVersions, playImageManifest, materialImageManifest, materialImageVersions, publicOrigin });
    const assets = (await filesIn(dist)).filter((file) => /\.(js|css|ttf|woff2?)$/.test(file)).map((file) => `/${path.relative(dist, file).split(path.sep).join("/")}`);
    const precache = [...new Set(["/", "/index.html", "/offline.html", "/nori-icon.svg", "/completion-stamp-v1.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", ...assets])];
    // Code, styles, content and media changes all invalidate the previous cache.
    const digest = crypto.createHash("sha256");
    for (const file of (await filesIn(dist)).sort()) {
      digest.update(path.relative(dist, file));
      digest.update(await fs.readFile(file));
    }
    const version = digest.digest("hex").slice(0, 12);
    await fs.writeFile(path.join(dist, "sw.js"), createServiceWorker(version, precache, playImageManifest.storage, materialImageManifest.storage));
    await fs.writeFile(path.join(dist, "build-report.json"), JSON.stringify({ ...report, version, playLinks: plays.length, precacheFiles: precache.length }, null, 2));
    console.info(`PWA ready: ${plays.length} public play links, ${precache.length} shell assets, cache ${version}`);
    console.info(`Intro page: /intro with ${intro.data.playCount} plays, ${intro.data.materialCount} materials, ${Object.keys(intro.screens).length} screens`);
    return { ...report, version };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildWeb().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
