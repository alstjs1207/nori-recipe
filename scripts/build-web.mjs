import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { prepareWebAssets } from "./prepare-web-assets.mjs";
import { createServiceWorker } from "./web/service-worker.mjs";
import { withPlayMetadata } from "./web/html.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}

async function build() {
  const { plays, report } = await prepareWebAssets();
  await fs.rm(dist, { recursive: true, force: true });
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/expo/bin/cli"), "export", "--platform", "web", "--output-dir", dist], { cwd: root, encoding: "utf8", env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" }, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.error?.message ?? `${result.stdout}\n${result.stderr}`);
  console.info(result.stdout.split("\n").filter((line) => /Bundled|_expo\/static\/js|Exported:/.test(line)).join("\n"));
  const stylesheet = await fs.readFile(path.join(dist, "web.css"));
  const styleVersion = crypto.createHash("sha256").update(stylesheet).digest("hex").slice(0, 12);
  const styleName = `web.${styleVersion}.css`;
  await fs.writeFile(path.join(dist, styleName), stylesheet);
  const exportedHtml = await fs.readFile(path.join(dist, "index.html"), "utf8");
  if (!exportedHtml.includes('href="/web.css"')) throw new Error("Exported HTML is missing the web stylesheet link.");
  // A waiting update leaves the previous worker active. Its cached /web.css
  // must not style the new JavaScript served by network-first navigation.
  const html = exportedHtml.replace('href="/web.css"', `href="/${styleName}"`);
  await fs.writeFile(path.join(dist, "index.html"), html);
  for (const play of plays) {
    const directory = path.join(dist, "play", play.id);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "index.html"), withPlayMetadata(html, play));
  }
  const assets = (await filesIn(dist)).filter((file) => /\.(js|css|ttf|woff2?)$/.test(file)).map((file) => `/${path.relative(dist, file).split(path.sep).join("/")}`);
  const precache = [...new Set(["/", "/index.html", "/offline.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", ...assets])];
  // Code, styles, content and media changes all invalidate the previous cache.
  const digest = crypto.createHash("sha256");
  for (const file of (await filesIn(dist)).sort()) {
    digest.update(path.relative(dist, file));
    digest.update(await fs.readFile(file));
  }
  const version = digest.digest("hex").slice(0, 12);
  await fs.writeFile(path.join(dist, "sw.js"), createServiceWorker(version, precache));
  await fs.writeFile(path.join(dist, "build-report.json"), JSON.stringify({ ...report, version, playLinks: plays.length, precacheFiles: precache.length }, null, 2));
  console.info(`PWA ready: ${plays.length} public play links, ${precache.length} shell assets, cache ${version}`);
}

build().catch((error) => { console.error(error.message); process.exitCode = 1; });
