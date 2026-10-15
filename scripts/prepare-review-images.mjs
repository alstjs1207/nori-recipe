import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { contentHash, imageInfo, readJson, sha256 } from "./review/review-core.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const receiptPath = (root, id) => path.join(root, "results/image-generation", id + ".json");

function selected(root, ids) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some((id) => !/^play_\d{3,}$/.test(id))) {
    throw new Error("실제 놀이 ID를 중복 없이 지정하세요.");
  }
  const bundle = readJson(path.join(root, "data/plays.json"));
  const registry = readJson(path.join(root, "data/materials.json"));
  return ids.map((id) => {
    const play = bundle.plays.find((p) => p.id === id);
    if (!play) throw new Error("등록된 초안을 찾을 수 없습니다: " + id);
    return { play, hash: contentHash(play, registry) };
  });
}

// Receipts describe generated files, never a human approval or publication decision.
export function imagePreparation(root, ids) {
  return selected(root, ids).map(({ play, hash }) => {
    let image, receipt;
    try { image = imageInfo(root, play.id); } catch { image = { hash: null }; }
    try { receipt = readJson(receiptPath(root, play.id)); } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const ready = Boolean(image.hash && receipt?.schemaVersion === 1 && receipt.id === play.id &&
      receipt.generator === "image_gen" && receipt.contentHash === hash && receipt.imageHash === image.hash);
    return { id: play.id, name: play.name, contentHash: hash,
      state: ready ? "ready" : !image.hash ? "missing" : receipt ? "stale" : "untracked",
      imagePath: "images/plays/" + play.id + ".jpeg",
      promptPath: "generated/play-image-prompts/" + play.id + ".txt" };
  });
}

export function requirePreparedImages(root, ids) {
  const pending = imagePreparation(root, ids).filter((entry) => entry.state !== "ready");
  if (pending.length) throw new Error("대표 이미지 생성·저장 완료 후 새 검수 배치를 만들 수 있습니다: " +
    pending.map((entry) => entry.id + " (" + entry.state + ")").join(", ") +
    "\npnpm review:images --ids <ID목록>으로 확인하고 generate-play-images 스킬의 실제 생성·review:image 저장 단계를 완료하세요.");
}

function atomicWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try { fs.writeFileSync(temporary, bytes, { flag: "wx" }); fs.renameSync(temporary, file); }
  finally { fs.rmSync(temporary, { force: true }); }
}

export async function saveGeneratedImage(root, { id, file, expectedContentHash, promptPath, replace = false } = {}) {
  const [{ play, hash }] = selected(root, [id]);
  if (play.status !== "draft" || play.imageStatus !== "review") throw new Error(id + ": 검수 대기 초안에만 이미지를 저장할 수 있습니다.");
  if (expectedContentHash !== hash) throw new Error(id + ": 생성 시작 후 내용이 바뀌었습니다. 최신 내용으로 이미지를 생성하세요.");
  if (!file || !promptPath) throw new Error("실제 생성 결과 --file과 사용한 프롬프트 --prompt가 필요합니다.");
  const prompt = fs.readFileSync(path.resolve(root, promptPath), "utf8");
  if (!prompt.trim()) throw new Error("프롬프트 파일이 비어 있습니다.");
  const destination = path.join(root, "images/plays", id + ".jpeg");
  const previous = fs.existsSync(destination) ? fs.readFileSync(destination) : null;
  if (previous && !replace) throw new Error(id + ": 기존 이미지가 있습니다. 해당 이미지 수정 요청이면 --replace를 명시하세요.");
  const input = fs.readFileSync(path.resolve(root, file));
  const metadata = await sharp(input, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < 512 ||
      Math.abs(metadata.width / metadata.height - 1) > 0.02 || (metadata.pages ?? 1) !== 1) {
    throw new Error("대표 이미지는 한 장의 정사각형 이미지이며 가로·세로가 각각 512px 이상이어야 합니다.");
  }
  const bytes = await sharp(input, { failOn: "error" }).rotate().flatten({ background: "#fffaf0" })
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  // Re-read after decoding: collection work and human review can run concurrently.
  const [current] = selected(root, [id]);
  if (current.hash !== hash || current.play.status !== "draft" || current.play.imageStatus !== "review") {
    throw new Error(id + ": 저장 중 내용 또는 등록 상태가 바뀌었습니다. 최신 상태를 확인하세요.");
  }
  const currentBytes = fs.existsSync(destination) ? fs.readFileSync(destination) : null;
  if ((currentBytes && sha256(currentBytes)) !== (previous && sha256(previous))) throw new Error(id + ": 저장 중 이미지가 바뀌었습니다.");
  if (previous) {
    const backup = path.join(root, "results/image-generation/originals", id + "-" + sha256(previous) + ".jpeg");
    if (!fs.existsSync(backup)) atomicWrite(backup, previous);
  }
  if (previous) atomicWrite(destination, bytes);
  else { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes, { flag: "wx" }); }
  const receipt = { schemaVersion: 1, id, generator: "image_gen", generatedAt: new Date().toISOString(),
    contentHash: hash, imageHash: sha256(bytes), promptHash: sha256(prompt), imagePath: "images/plays/" + id + ".jpeg" };
  atomicWrite(receiptPath(root, id), JSON.stringify(receipt, null, 2) + "\n");
  return { ...receipt, state: "ready" };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const [mode, ...args] = process.argv.slice(2), options = {};
    const flags = { "--ids": "ids", "--id": "id", "--file": "file", "--content-hash": "expectedContentHash", "--prompt": "promptPath" };
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--replace") { options.replace = true; continue; }
      const key = flags[args[i]], value = args[++i];
      if (!key || !value || value.startsWith("--")) throw new Error("잘못된 이미지 준비 옵션입니다.");
      options[key] = key === "ids" ? value.split(",").map((id) => id.trim()) : value;
    }
    if (mode === "plan") {
      const entries = imagePreparation(project, options.ids);
      console.info(JSON.stringify({ ready: entries.filter((e) => e.state === "ready").length, total: entries.length, entries }, null, 2));
    } else if (mode === "save") console.info(JSON.stringify(await saveGeneratedImage(project, options), null, 2));
    else throw new Error("사용법: pnpm review:images --ids play_218,play_219\n저장: pnpm review:image --id play_218 --file <생성파일> --content-hash <계획의해시> --prompt <프롬프트파일>");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
