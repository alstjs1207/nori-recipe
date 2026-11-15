import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export { sha256, canonical } from "../review/review-shared.mjs";

export const codes = new Set(["INVALID_INPUT", "UNSAFE_PATH", "MISSING", "CORRUPT_IMAGE", "INTEGRITY", "REVIEW_REQUIRED", "SOURCE_CHANGED", "CONFLICT", "TRANSFER_FAILED", "LOCKED", "FAILED"]);
export function fail(code) { throw Object.assign(new Error(code), { code }); }
export const errorCode = (error) => codes.has(error?.code) ? error.code : "FAILED";

// Refuse symlinks, including existing parent directories of a not-yet-created file.
export function safePath(root, relative) {
  if (typeof relative !== "string" || !relative || relative.includes("\\") || path.isAbsolute(relative) ||
      relative.split("/").some((part) => !part || part === "." || part === "..")) fail("UNSAFE_PATH");
  let target = fs.realpathSync(root);
  for (const part of relative.split("/")) {
    target = path.join(target, part);
    try { if (fs.lstatSync(target).isSymbolicLink()) fail("UNSAFE_PATH"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return target;
}

export function readOptional(file) {
  try { return fs.readFileSync(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export function writeJson(root, relative, value) {
  const file = safePath(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}

// Atomic create, never rename over an existing original/object, even in a race.
export function createFile(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
    try { fs.linkSync(temporary, file); return true; }
    catch (error) { if (error.code !== "EEXIST") throw error; return false; }
  } finally { fs.rmSync(temporary, { force: true }); }
}

export async function locked(root, relative, action) {
  const file = safePath(root, relative + ".lock");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let fd;
  try { fd = fs.openSync(file, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") fail("LOCKED"); throw error; }
  try { return await action(); }
  finally { fs.closeSync(fd); fs.unlinkSync(file); }
}
