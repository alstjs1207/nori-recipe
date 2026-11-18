import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareWebAssets } from "./prepare-web-assets.mjs";
import { withWebImageManifest } from "./web/play-images.mjs";
import { withWebMaterialManifest } from "./web/material-images.mjs";
import { tossExportEnvironment, tossImageEnvironment, tossHtml } from "./toss/config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const assets = await prepareWebAssets({ root, env: tossImageEnvironment(root) });
const htmlFile = path.join(root, "public/index.html");
const originalHtml = await fs.readFile(htmlFile);
try {
await fs.writeFile(htmlFile, tossHtml(originalHtml.toString("utf8")));
await withWebImageManifest(root, assets.playImageManifest, () => withWebMaterialManifest(root, assets.materialImageManifest, () => new Promise((resolve, reject) => {
  const env = { ...tossExportEnvironment({ ...process.env, TOSS_AD_MODE: "test" }), CI: "false", NODE_ENV: "development", TOSS_DEVTOOLS: "1" };
  console.info("Toss Devtools: mock SDK only; production artifacts never include mocks. Stop before running another build.");
  const child = spawn(process.execPath, [path.join(root, "node_modules/expo/bin/cli"), "start", "--web", "--clear", "--port", process.env.PORT || "4189"], { cwd: root, env, stdio: "inherit" });
  const stop = () => child.kill("SIGTERM");
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  child.on("error", reject);
  child.on("exit", code => { process.off("SIGINT", stop); process.off("SIGTERM", stop); code === 0 || code === null ? resolve() : reject(new Error(`Expo exited: ${code}`)); });
})));
} finally { await fs.writeFile(htmlFile, originalHtml); }
