import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
sharp.concurrency(2);

export async function removeUnpublishedImages(directory, publishedImages) {
  const stale = (await fs.readdir(directory)).filter((name) => /^play_\d+\.webp$/.test(name) && !publishedImages.has(name));
  await Promise.all(stale.map((name) => fs.unlink(path.join(directory, name))));
}

export async function writePlayImages(play, { sourceDirectory, detailDirectory, thumbnailDirectory, icon }) {
  // Cards and share metadata also address these files directly.
  const needsReview = play.imageStatus === "review";
  const source = needsReview ? icon : path.join(sourceDirectory, `${play.id}.jpeg`);
  const sourceBytes = (await fs.stat(source)).size;
  const detail = await sharp(source).rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: !needsReview }).webp({ quality: 72 }).toFile(path.join(detailDirectory, `${play.id}.webp`));
  const thumbnail = await sharp(source).rotate().resize({ width: 320, height: 320, fit: "cover", withoutEnlargement: !needsReview }).webp({ quality: 66 }).toFile(path.join(thumbnailDirectory, `${play.id}.webp`));
  return { sourceBytes, detailBytes: detail.size, thumbnailBytes: thumbnail.size };
}

export async function writeMaterialImage(slug, { source, directory }) {
  const output = path.join(directory, `${slug}.webp`);
  await sharp(source).rotate().resize(192, 192, { fit: "inside", withoutEnlargement: true }).webp({ quality: 65 }).toFile(output);
  return crypto.createHash("sha256").update(await fs.readFile(output)).digest("hex").slice(0, 12);
}

export async function prepareWebAssets() {
  let bundle;
  try { bundle = JSON.parse(await fs.readFile(path.join(root, "data/plays.json"), "utf8")); }
  catch { throw new Error("data/plays.json이 필요합니다. 저장소의 놀이 데이터와 images/plays를 확인해 주세요."); }
  const plays = bundle.plays.filter((play) => play.status === "live");
  const output = path.join(root, "public/media");
  await Promise.all(["plays", "thumbs", "materials"].map((dir) => fs.mkdir(path.join(output, dir), { recursive: true })));
  const publishedImages = new Set(plays.map((play) => `${play.id}.webp`));
  for (const dir of ["plays", "thumbs"]) {
    await removeUnpublishedImages(path.join(output, dir), publishedImages);
  }
  const icon = path.join(root, "public/nori-icon.svg");
  let originalBytes = 0;
  let detailBytes = 0;
  let thumbnailBytes = 0;
  const tasks = plays.map((play) => async () => {
    const sizes = await writePlayImages(play, { sourceDirectory: path.join(root, "images/plays"), detailDirectory: path.join(output, "plays"), thumbnailDirectory: path.join(output, "thumbs"), icon });
    originalBytes += sizes.sourceBytes;
    detailBytes += sizes.detailBytes;
    thumbnailBytes += sizes.thumbnailBytes;
  });
  const sourceFile = path.join(root, "src/constants/materialImageSources.ts");
  const materialSource = await fs.readFile(sourceFile, "utf8");
  const materialImageVersions = {};
  for (const [, slug, relative] of materialSource.matchAll(/^\s+(\w+): require\("([^"]+)"\),?$/gm)) {
    tasks.push(async () => {
      materialImageVersions[slug] = await writeMaterialImage(slug, { source: path.resolve(path.dirname(sourceFile), relative), directory: path.join(output, "materials") });
    });
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (cursor < tasks.length) { const task = tasks[cursor++]; await task(); } }));
  const sortedVersions = Object.fromEntries(Object.entries(materialImageVersions).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(path.join(root, "src/constants/materialImageVersions.json"), JSON.stringify(sortedVersions, null, 2) + "\n");
  const icons = path.join(root, "public/icons");
  await fs.mkdir(icons, { recursive: true });
  await sharp(icon).resize(64, 64).png().toFile(path.join(root, "public/nori-favicon.png"));
  await Promise.all([192, 512].map((size) => sharp(icon).resize(size, size).png().toFile(path.join(icons, `icon-${size}.png`))));
  await sharp(icon).resize(180, 180).png().toFile(path.join(icons, "apple-touch-icon.png"));
  await sharp(icon).resize(384, 384).extend({ top: 64, bottom: 64, left: 64, right: 64, background: "#FAFAFE" }).png().toFile(path.join(icons, "maskable-512.png"));
  const report = { plays: plays.length, reviewImages: plays.filter((play) => play.imageStatus === "review").length, originalMB: +(originalBytes / 1e6).toFixed(2), detailMB: +(detailBytes / 1e6).toFixed(2), thumbnailMB: +(thumbnailBytes / 1e6).toFixed(2) };
  console.info("Web images:", JSON.stringify(report));
  return { plays, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  prepareWebAssets().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
