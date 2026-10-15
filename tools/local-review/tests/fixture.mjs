import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export function fixture(t, { realImages = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nori-local-review-test-"));
  t?.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ["data/review-batches", "images/plays", "images/material", "src/constants", "scripts/review"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const play = (id, slug, status = "draft") => ({ id, name: "테스트 놀이 " + id, createdAt: "2026-10-14", ageMin: 24, ageMax: 30,
    place: "indoor", durationMin: 5, durationMax: 10, prepTime: 2, difficulty: 1, devAreas: ["fine_motor"],
    materials: { required: [slug], optional: [], substitutes: [] },
    steps: ["보호자가 준비합니다.", "아이가 준비물을 조작합니다."], safetyNotes: ["보호자가 곁에서 함께합니다."],
    educationalEffects: ["손 조작을 경험합니다."], tags: [], source: { type: "manual", url: null, instagramAccount: null },
    status, ...(status === "draft" ? { imageStatus: "review" } : {}) });
  const bundle = { version: "1", updatedAt: "2026-10-14", importedFiles: [], plays: [
    play("play_301", "cup"), play("play_302", "basket"), play("play_303", "dropper"),
    play("play_304", "cup", "live"), play("play_305", "cup", "archived"), play("play_306", "cup"),
  ] };
  const registry = { categories: { 도구: ["cup", "basket", "dropper"] },
    displayNames: { cup: "컵", basket: "바구니", dropper: "스포이드" }, reviewPending: ["basket", "dropper"] };
  const batch = { schemaVersion: 1, batchId: "fixture", title: "로컬 서버 검증용 수집 건", playIds: bundle.plays.map((p) => p.id),
    reviewOutput: "results/reviews/fixture.html", entries: [], materialProposals: ["basket", "dropper"].map((slug) => ({
      slug, purpose: "조작", reason: "원문 재료", similar: ["cup"], usages: [{ id: slug === "basket" ? "play_302" : "play_303", role: "required" }],
    })), appliedMaterialDecisions: {} };
  for (const [relative, value] of [["data/plays.json", bundle], ["data/materials.json", registry], ["data/review-batches/fixture.json", batch]]) write(root, relative, value);
  fs.writeFileSync(path.join(root, "src/constants/playImages.ts"), "const PLAY_IMAGE_SOURCES: Record<string, ImageSourcePropType> = {\n};\n");
  fs.writeFileSync(path.join(root, "src/constants/materialImageSources.ts"), 'const MATERIAL_IMAGE_SOURCES = {\n  basket: require("../../images/material/basket.jpeg"),\n  dropper: require("../../images/material/dropper.jpeg"),\n};\n');
  const jpeg = realImages ? fs.readFileSync(path.join(project, "images/plays/play_013.jpeg")) : Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]);
  for (const play of bundle.plays) fs.writeFileSync(path.join(root, "images/plays", play.id + ".jpeg"), jpeg);
  for (const slug of ["basket", "dropper"]) fs.writeFileSync(path.join(root, "images/material", slug + ".jpeg"), jpeg);
  for (const file of ["review.css", "review-client.js", "material-review-client.js"]) fs.copyFileSync(path.join(project, "scripts/review", file), path.join(root, "scripts/review", file));
  return root;
}
export const read = (root, relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
export function write(root, relative, value) {
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, relative), JSON.stringify(value, null, 2) + "\n");
}
export function approve(results, id) {
  Object.assign(results.records.find((r) => r.id === id), { decision: "approved", contentReviewed: true, imageReviewed: true });
  return results;
}
