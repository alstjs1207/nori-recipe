import fs from "node:fs";
import { createFile, fail, readOptional, safePath, sha256 } from "../play-image-storage/files.mjs";
import { validBucket } from "../play-image-storage/manifest.mjs";

function objectPath(bucket, object) {
  if (!validBucket(bucket) || typeof object !== "string" || !/^(?:originals\/[a-f0-9]{64}\/original\.jpeg|materials\/[a-z][a-z0-9_]*\/[a-f0-9]{64}\/icon\.webp)$/.test(object)) fail("INVALID_INPUT");
  return `${bucket}/${object}`;
}

// A directory is a test object store only. It does not simulate Storage/RLS permissions.
export function directoryStore(directory) {
  const root = fs.realpathSync(directory);
  return { identity: `directory:${sha256(root)}`,
    async get(bucket, object) { return readOptional(safePath(root, objectPath(bucket, object))); },
    async create(bucket, object, bytes) { return createFile(safePath(root, objectPath(bucket, object)), bytes); } };
}

// No bucket creation, policy changes, overwrite/update or delete API is exposed.
// Wire contract: supabase/storage-js StorageFileApi.upload and BlobDownloadBuilder.
export function supabaseStore({ url, serviceRoleKey, fetchImpl = globalThis.fetch } = {}) {
  let origin;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) fail("INVALID_INPUT");
    origin = parsed.origin;
  } catch { fail("INVALID_INPUT"); }
  if (typeof serviceRoleKey !== "string" || !serviceRoleKey || /\s/.test(serviceRoleKey)) fail("INVALID_INPUT");
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const address = (bucket, object) => `${origin}/storage/v1/object/${objectPath(bucket, object).split("/").map(encodeURIComponent).join("/")}`;
  async function request(target, options) {
    try { return await fetchImpl(target, { ...options, redirect: "error", signal: AbortSignal.timeout(30_000) }); }
    catch { fail("TRANSFER_FAILED"); }
  }
  async function storageCode(response) {
    try { const body = await response.json(); return String(body.statusCode ?? body.code ?? ""); }
    catch { return ""; }
  }
  return { identity: `supabase:${sha256(origin)}`,
    async get(bucket, object) {
      const response = await request(address(bucket, object), { headers });
      if (response.ok) {
        try { return Buffer.from(await response.arrayBuffer()); }
        catch { fail("TRANSFER_FAILED"); }
      }
      if (response.status === 404 || (response.status === 400 && ["404", "NoSuchKey", "not_found"].includes(await storageCode(response)))) return null;
      fail("TRANSFER_FAILED");
    },
    async create(bucket, object, bytes, contentType) {
      const response = await request(address(bucket, object), { method: "POST", body: bytes,
        headers: { ...headers, "Content-Type": contentType, "Cache-Control": contentType === "image/webp" ? "max-age=31536000" : "no-store", "x-upsert": "false" } });
      if (response.ok) return true;
      if (response.status === 409 || (response.status === 400 && ["409", "Duplicate", "ResourceAlreadyExists"].includes(await storageCode(response)))) return false;
      fail("TRANSFER_FAILED");
    } };
}
