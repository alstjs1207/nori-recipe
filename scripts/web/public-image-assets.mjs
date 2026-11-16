import fs from "node:fs";
import sharp from "sharp";
import { safePath, sha256 } from "../play-image-storage/files.mjs";

const LIMIT = 16 * 1024 * 1024;
const assetError = (asset, reason) => new Error(`${asset.id}/${asset.kind}: public image ${reason}`);

async function download(asset, fetchImpl) {
  try {
    const response = await fetchImpl(asset.url, { method: "GET", credentials: "omit", mode: "cors", redirect: "error",
      cache: "no-store", headers: { Accept: "image/webp" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok || response.redirected || ["opaque", "opaqueredirect", "error"].includes(response.type) ||
        !/^image\/webp(?:;|$)/i.test(response.headers.get("content-type") || "")) throw assetError(asset, "download failed");
    const reader = response.body?.getReader();
    if (!reader) throw assetError(asset, "download failed");
    const chunks = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > asset.bytes) { await reader.cancel(); throw assetError(asset, "size mismatch"); }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } catch { throw assetError(asset, "download failed"); }
}

// This path only reads public assets. No original mapping, Git baseline or
// administrator client is needed. A supplied asset directory disables network IO.
export async function verifyPublicImageAssets(input, { fetchImpl = globalThis.fetch } = {}) {
  let directory = null;
  if (input.directory) {
    try { directory = fs.realpathSync(input.directory); if (!fs.statSync(directory).isDirectory()) throw Error(); }
    catch { throw new Error("Public image asset directory unavailable"); }
  }
  const report = { imageMode: "public", verifiedPublicAssets: 0, detailBytes: 0, thumbnailBytes: 0, iconBytes: 0 };
  for (const asset of input.assets) {
    if (asset.bytes > LIMIT) throw assetError(asset, "size exceeds limit");
    let bytes;
    if (directory) {
      let file, stat;
      try { file = safePath(directory, `${asset.bucket}/${asset.path}`); stat = fs.statSync(file); }
      catch { throw assetError(asset, "missing or unsafe file"); }
      if (!stat.isFile() || stat.size !== asset.bytes) throw assetError(asset, "integrity mismatch");
      try { bytes = fs.readFileSync(file); }
      catch { throw assetError(asset, "file read failed"); }
    } else bytes = await download(asset, fetchImpl);
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw assetError(asset, "integrity mismatch");
    try {
      const max = asset.kind === "detail" ? 960 : asset.kind === "icon" ? 192 : 320;
      const image = sharp(bytes, { failOn: "warning", limitInputPixels: max * max });
      const metadata = await image.metadata();
      if (metadata.format !== "webp" || !metadata.width || !metadata.height || metadata.width > max || metadata.height > max || (metadata.pages ?? 1) !== 1) throw Error();
      await image.raw().toBuffer();
    } catch { throw assetError(asset, "invalid WebP"); }
    report.verifiedPublicAssets++;
    report[`${asset.kind}Bytes`] += bytes.length;
  }
  return report;
}
