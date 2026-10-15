import fs from "node:fs";
import crypto from "node:crypto";
export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
export const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
export const koreanDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
