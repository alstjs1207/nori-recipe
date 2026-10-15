import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readJson, sha256 } from "./review/review-shared.mjs";
import { materialDefinitionHash, materialImageInfo, materialImageMapping, materialSourcesPath } from "./review/material-images.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const receiptFile = (root, slug) => path.join(root, "results/image-generation/materials", slug + ".json");
function registryAt(root) { return readJson(path.join(root, "data/materials.json")); }
function receiptAt(root, slug) {
  try { return readJson(receiptFile(root, slug)); }
  catch (error) { if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; return null; }
}
export function collectionMaterialSlugs(root, ids) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some((id) => !/^play_\d{3,}$/.test(id))) throw new Error("실제 놀이 ID를 중복 없이 지정하세요.");
  const bundle = readJson(path.join(root, "data/plays.json")), registry = registryAt(root);
  const used = ids.flatMap((id) => {
    const play = bundle.plays.find((p) => p.id === id);
    if (!play) throw new Error("등록된 초안을 찾을 수 없습니다: " + id);
    return [...play.materials.required, ...play.materials.optional];
  });
  return [...new Set(used)].filter((slug) => (registry.reviewPending ?? []).includes(slug)).sort();
}
export function materialImagePreparation(root, slugs) {
  const registry = registryAt(root);
  return [...new Set(slugs)].map((slug) => {
    const definitionHash = materialDefinitionHash(registry, slug), image = materialImageInfo(root, slug), receipt = receiptAt(root, slug);
    const ready = receipt?.schemaVersion === 1 && receipt.slug === slug && receipt.generator === "image_gen" &&
      receipt.definitionHash === definitionHash && receipt.imageHash === image.hash;
    return { slug, name: registry.displayNames[slug], definitionHash, imagePath: image.path,
      state: !image.hash ? "missing" : receipt && !ready ? "stale" : !image.mapped ? "unlinked" : receipt ? "ready" : "existing",
      promptPath: "generated/material-image-prompts/" + slug + ".txt" };
  });
}
export function requireMaterialImages(root, ids) {
  const entries = materialImagePreparation(root, collectionMaterialSlugs(root, ids));
  const pending = entries.filter((entry) => !["ready", "existing"].includes(entry.state));
  if (pending.length) throw new Error("새 재료 이미지 생성·연결 완료 후 새 검수 배치를 만들 수 있습니다: " +
    pending.map((e) => e.slug + " (" + e.state + ")").join(", ") + "\npnpm review:material-images --ids <ID목록>과 generate-material-images 스킬을 실행하세요.");
  return entries;
}
function atomicWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + "." + crypto.randomUUID() + ".tmp";
  try { fs.writeFileSync(temp, bytes, { flag: "wx" }); fs.renameSync(temp, file); }
  finally { fs.rmSync(temp, { force: true }); }
}
export async function saveMaterialImage(root, { slug, file, expectedDefinitionHash, promptPath, replace = false, link = false } = {}) {
  const registry = registryAt(root), definitionHash = materialDefinitionHash(registry, slug);
  const bundle = readJson(path.join(root, "data/plays.json"));
  if (!(registry.reviewPending ?? []).includes(slug) || bundle.plays.some((p) => p.status === "live" &&
      [...p.materials.required, ...p.materials.optional].includes(slug))) throw new Error(slug + ": 미승인 새 재료에만 이미지를 준비할 수 있습니다.");
  if (definitionHash !== expectedDefinitionHash) throw new Error(slug + ": 재료 정의가 바뀌었습니다. 최신 정의로 생성하세요.");
  const mappingFile = path.join(root, materialSourcesPath), source = fs.readFileSync(mappingFile, "utf8");
  const beforeImage = materialImageInfo(root, slug), destination = path.join(root, "images/material", slug + ".jpeg");
  const previous = fs.existsSync(destination) ? fs.readFileSync(destination) : null;
  if (link) {
    if (!beforeImage.hash) throw new Error(slug + ": 연결할 실제 이미지가 없습니다.");
    atomicWrite(mappingFile, materialImageMapping(source, slug, beforeImage.path));
    return { slug, state: materialImagePreparation(root, [slug])[0].state, imagePath: beforeImage.path };
  }
  if ((beforeImage.hash || previous) && !replace) throw new Error(slug + ": 기존 이미지는 재사용하세요. 요청받은 교체에만 --replace를 사용하세요.");
  if (!file || !promptPath) throw new Error("실제 생성 결과 --file과 프롬프트 --prompt가 필요합니다.");
  const prompt = fs.readFileSync(path.resolve(root, promptPath), "utf8");
  if (!prompt.trim()) throw new Error("프롬프트 파일이 비어 있습니다.");
  const input = fs.readFileSync(path.resolve(root, file)), metadata = await sharp(input, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < 512 ||
      Math.abs(metadata.width / metadata.height - 1) > 0.02 || (metadata.pages ?? 1) !== 1) throw new Error("재료 이미지는 512px 이상의 정사각형 한 장이어야 합니다.");
  const bytes = await sharp(input, { failOn: "error" }).rotate().flatten({ background: "#ffffff" })
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  const current = registryAt(root), currentBundle = readJson(path.join(root, "data/plays.json"));
  if (materialDefinitionHash(current, slug) !== definitionHash || !(current.reviewPending ?? []).includes(slug) ||
      currentBundle.plays.some((p) => p.status === "live" && [...p.materials.required, ...p.materials.optional].includes(slug)) ||
      fs.readFileSync(mappingFile, "utf8") !== source || materialImageInfo(root, slug).hash !== beforeImage.hash ||
      (fs.existsSync(destination) ? sha256(fs.readFileSync(destination)) : null) !== (previous ? sha256(previous) : null)) {
    throw new Error(slug + ": 저장 중 재료·이미지·연결 상태가 바뀌었습니다. 최신 상태를 확인하세요.");
  }
  const imagePath = "images/material/" + slug + ".jpeg", mapping = materialImageMapping(source, slug, imagePath);
  if (previous) atomicWrite(path.join(root, "results/image-generation/materials/originals", slug + "-" + sha256(previous) + ".jpeg"), previous);
  const oldReceipt = fs.existsSync(receiptFile(root, slug)) ? fs.readFileSync(receiptFile(root, slug)) : null;
  const receipt = { schemaVersion: 1, slug, generator: "image_gen", generatedAt: new Date().toISOString(), definitionHash,
    imageHash: sha256(bytes), promptHash: sha256(prompt), imagePath };
  let imageWritten = false, receiptWritten = false;
  try {
    if (previous) atomicWrite(destination, bytes);
    else { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes, { flag: "wx" }); }
    imageWritten = true;
    atomicWrite(receiptFile(root, slug), JSON.stringify(receipt, null, 2) + "\n");
    receiptWritten = true;
    atomicWrite(mappingFile, mapping);
  } catch (error) {
    if (imageWritten) { if (previous) atomicWrite(destination, previous); else fs.rmSync(destination, { force: true }); }
    if (receiptWritten) { if (oldReceipt) atomicWrite(receiptFile(root, slug), oldReceipt); else fs.rmSync(receiptFile(root, slug), { force: true }); }
    throw error;
  }
  return { ...receipt, state: "ready" };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const [mode, ...args] = process.argv.slice(2), options = {}, flags = {
      "--ids": "ids", "--slug": "slug", "--file": "file", "--definition-hash": "expectedDefinitionHash", "--prompt": "promptPath" };
    for (let i = 0; i < args.length; i++) {
      if (["--replace", "--link"].includes(args[i])) { options[args[i].slice(2)] = true; continue; }
      const key = flags[args[i]], value = args[++i];
      if (!key || !value || value.startsWith("--")) throw new Error("잘못된 재료 이미지 옵션입니다.");
      options[key] = key === "ids" ? value.split(",").map((id) => id.trim()) : value;
    }
    if (mode === "plan") {
      const entries = materialImagePreparation(project, collectionMaterialSlugs(project, options.ids));
      console.info(JSON.stringify({ ready: entries.filter((e) => ["ready", "existing"].includes(e.state)).length, total: entries.length, entries }, null, 2));
    } else if (mode === "save") console.info(JSON.stringify(await saveMaterialImage(project, options), null, 2));
    else throw new Error("사용법: pnpm review:material-images --ids <놀이ID목록> 또는 pnpm review:material-image --slug <slug> --file <결과> --definition-hash <해시> --prompt <프롬프트>");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
