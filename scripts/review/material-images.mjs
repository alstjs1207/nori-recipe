import fs from "node:fs";
import path from "node:path";
import { canonical, sha256 } from "./review-shared.mjs";

export const materialSourcesPath = "src/constants/materialImageSources.ts";
export function materialDefinitionHash(registry, slug) {
  const category = Object.keys(registry.categories).find((key) => registry.categories[key].includes(slug));
  if (!/^[a-z][a-z0-9_]*$/.test(slug) || !registry.displayNames[slug] || !category) throw new Error("재료의 임시 정의를 찾을 수 없습니다: " + slug);
  return sha256(JSON.stringify(canonical({ slug, name: registry.displayNames[slug], category })));
}

// Review can preview a generated file before a pending material becomes selectable.
export function materialImageInfo(root, slug) {
  if (!/^[a-z][a-z0-9_]*$/.test(slug)) throw new Error("잘못된 재료 slug: " + slug);
  const sourceFile = path.join(root, materialSourcesPath);
  const source = fs.existsSync(sourceFile) ? fs.readFileSync(sourceFile, "utf8") : "";
  const match = [...source.matchAll(/^\s+(\w+): require\("([^"]+)"\),?$/gm)].find((item) => item[1] === slug);
  const mapped = match ? path.resolve(path.dirname(sourceFile), match[2]) : null;
  const canonicalFile = path.join(root, "images/material", slug + ".jpeg");
  const directory = path.join(root, "images/material") + path.sep;
  for (const file of [...new Set([mapped, canonicalFile])]) {
    if (!file || !file.startsWith(directory) || !fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) continue;
    return { path: path.relative(root, file).split(path.sep).join("/"), hash: sha256(bytes), mapped: file === mapped };
  }
  return { path: "images/material/" + slug + ".jpeg", hash: null, mapped: false };
}

export function materialImageMapping(source, slug, imagePath) {
  if (!/^[a-z][a-z0-9_]*$/.test(slug) || !/^images\/material\/[\w.-]+\.jpeg$/.test(imagePath)) throw new Error("잘못된 재료 이미지 매핑입니다.");
  const line = '  ' + slug + ': require("../../' + imagePath + '"),';
  const existing = new RegExp("^\\s+" + slug + ": require\\(\"[^\"]+\"\\),?$", "m");
  if (existing.test(source)) return source.replace(existing, line);
  const end = source.indexOf("\n}");
  if (end < 0 || !/const \w+\s*=\s*\{/.test(source)) throw new Error("재료 이미지 매핑 구조를 확인할 수 없습니다.");
  return source.slice(0, end) + "\n" + line + source.slice(end);
}
