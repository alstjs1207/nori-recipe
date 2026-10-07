import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
sharp.concurrency(2);

export async function prepareWebAssets() {
  let bundle;
  try { bundle = JSON.parse(await fs.readFile(path.join(root, "data/plays.json"), "utf8")); }
  catch { throw new Error("data/plays.json이 필요합니다. 저장소의 놀이 데이터와 images/plays를 확인해 주세요."); }
  const plays = bundle.plays.filter((play) => play.status === "live");
  const output = path.join(root, "public/media");
  await Promise.all(["plays", "thumbs", "materials"].map((dir) => fs.mkdir(path.join(output, dir), { recursive: true })));
  let originalBytes = 0;
  let detailBytes = 0;
  let thumbnailBytes = 0;
  const tasks = plays.map((play) => async () => {
    const source = path.join(root, "images/plays", `${play.id}.jpeg`);
    const sourceBytes = (await fs.stat(source)).size;
    originalBytes += sourceBytes;
    const detail = await sharp(source).rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(output, "plays", `${play.id}.webp`));
    const thumbnail = await sharp(source).rotate().resize({ width: 320, height: 320, fit: "cover", withoutEnlargement: true }).webp({ quality: 66 }).toFile(path.join(output, "thumbs", `${play.id}.webp`));
    detailBytes += detail.size;
    thumbnailBytes += thumbnail.size;
  });
  const sourceFile = path.join(root, "src/constants/materialImageSources.ts");
  const materialSource = await fs.readFile(sourceFile, "utf8");
  for (const [, slug, relative] of materialSource.matchAll(/^\s+(\w+): require\("([^"]+)"\),?$/gm)) {
    tasks.push(async () => {
      await sharp(path.resolve(path.dirname(sourceFile), relative)).rotate().resize(192, 192, { fit: "inside", withoutEnlargement: true }).webp({ quality: 65 }).toFile(path.join(output, "materials", `${slug}.webp`));
    });
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (cursor < tasks.length) { const task = tasks[cursor++]; await task(); } }));
  const icons = path.join(root, "public/icons");
  await fs.mkdir(icons, { recursive: true });
  const icon = path.join(root, "assets/icon.png");
  await Promise.all([192, 512].map((size) => sharp(icon).resize(size, size).png().toFile(path.join(icons, `icon-${size}.png`))));
  await sharp(icon).resize(180, 180).png().toFile(path.join(icons, "apple-touch-icon.png"));
  await sharp(icon).resize(384, 384).extend({ top: 64, bottom: 64, left: 64, right: 64, background: "#FFFDF8" }).png().toFile(path.join(icons, "maskable-512.png"));
  const report = { plays: plays.length, originalMB: +(originalBytes / 1e6).toFixed(2), detailMB: +(detailBytes / 1e6).toFixed(2), thumbnailMB: +(thumbnailBytes / 1e6).toFixed(2) };
  console.info("Web images:", JSON.stringify(report));
  return { plays, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  prepareWebAssets().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
