import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyMaterialReview } from "../scripts/apply-material-review.mjs";
import { applyApproval, createManifest, readJson } from "../scripts/review/review-core.mjs";
const jpeg = Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nori-material-review-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ["data", "src/constants", "images/plays"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const registry = { categories: { 도구: ["cup", "basket", "dropper"] },
    displayNames: { cup: "컵", basket: "바구니", dropper: "스포이드" }, reviewPending: ["basket", "dropper"] };
  const play = (id, slug, status = "draft") => ({ id, name: "놀이 " + id, createdAt: "2026-10-14", ageMin: 24, ageMax: 30,
    place: "indoor", durationMin: 5, durationMax: 10, prepTime: 2, difficulty: 1, devAreas: ["fine_motor"],
    materials: { required: [slug], optional: slug === "basket" ? ["cup"] : [], substitutes: [] },
    steps: ["보호자가 준비합니다.", "아이가 준비물을 조작합니다."], safetyNotes: ["보호자가 곁에서 함께합니다."],
    educationalEffects: ["손 조작을 경험합니다."], tags: [], source: { type: "manual", url: null, instagramAccount: null },
    status, ...(status === "draft" ? { imageStatus: "review" } : {}) });
  const bundle = { version: "1", updatedAt: "2026-10-14", importedFiles: [], plays: [
    play("play_204", "basket"), play("play_205", "dropper"), play("play_013", "cup", "live"),
  ] };
  const batch = { schemaVersion: 1, batchId: "material-test", title: "재료 검수", playIds: ["play_204", "play_205"],
    entries: [], materialProposals: ["basket", "dropper"].map((slug) => ({ slug, purpose: "조작", reason: "원문 재료", similar: ["cup"], usages: [] })),
    appliedMaterialDecisions: {} };
  for (const [file, value] of [["plays.json", bundle], ["materials.json", registry], ["batch.json", batch]]) {
    fs.writeFileSync(path.join(root, "data", file), JSON.stringify(value, null, 2) + "\n");
  }
  fs.writeFileSync(path.join(root, "src/constants/playImages.ts"), "const PLAY_IMAGE_SOURCES: Record<string, ImageSourcePropType> = {\n};\n");
  for (const id of batch.playIds) fs.writeFileSync(path.join(root, "images/plays", id + ".jpeg"), jpeg);
  return { root };
}
function resultsFor(root) {
  const batch = readJson(path.join(root, "data/batch.json"));
  const manifest = createManifest(root, batch, readJson(path.join(root, "data/plays.json")), readJson(path.join(root, "data/materials.json")));
  return { schemaVersion: 2, batchId: batch.batchId, batchHash: manifest.batchHash,
    records: manifest.entries.map((entry) => ({ ...entry, decision: "pending", comment: "", contentReviewed: false, imageReviewed: false })),
    materialRecords: manifest.materialEntries.map((entry) => ({ slug: entry.slug, materialHash: entry.materialHash, state: entry.state,
      decision: entry.appliedDecision?.decision ?? "pending", replacementSlug: entry.appliedDecision?.replacementSlug ?? null,
      comment: entry.appliedDecision?.comment ?? "", confirmed: entry.appliedDecision?.confirmed ?? false })) };
}
test("pending materials block publication; confirmed add releases only the chosen material", (t) => {
  const { root } = fixture(t);
  const results = resultsFor(root), before = readJson(path.join(root, "data/plays.json"));
  const forged = structuredClone(results);
  Object.assign(forged.records[0], { decision: "approved", contentReviewed: true, imageReviewed: true });
  assert.throws(() => applyApproval(root, readJson(path.join(root, "data/batch.json")), forged), /재료 검수/);
  Object.assign(results.materialRecords[0], { decision: "add", confirmed: true });
  Object.assign(results.materialRecords[1], { decision: "held", comment: "추후 검토" });
  assert.equal(applyMaterialReview(root, "data/batch.json", results).wrote, false);
  assert.deepEqual(readJson(path.join(root, "data/materials.json")).reviewPending, ["basket", "dropper"]);
  assert.equal(applyMaterialReview(root, "data/batch.json", results, { write: true }).wrote, true);
  assert.deepEqual(readJson(path.join(root, "data/materials.json")).reviewPending, ["dropper"]);
  assert.deepEqual(readJson(path.join(root, "data/plays.json")), before);
  assert.equal(applyMaterialReview(root, "data/batch.json", results, { write: true }).alreadyApplied, true);
  const approved = resultsFor(root);
  Object.assign(approved.records[0], { decision: "approved", contentReviewed: true, imageReviewed: true });
  const conflicted = structuredClone(approved);
  conflicted.materialRecords[0].decision = "held";
  assert.throws(() => applyApproval(root, readJson(path.join(root, "data/batch.json")), conflicted), /재료 검수/);
  assert.deepEqual(applyApproval(root, readJson(path.join(root, "data/batch.json")), approved).changedIds, ["play_204"]);
});
test("replacement changes only batch drafts, removes overlap and requires method re-review", (t) => {
  const { root } = fixture(t), results = resultsFor(root);
  Object.assign(results.materialRecords[0], { decision: "replace", replacementSlug: "cup", comment: "컵으로 받기 동작과 준비 조건을 수정", confirmed: true });
  const before = readJson(path.join(root, "data/plays.json"));
  const applied = applyMaterialReview(root, "data/batch.json", results, { write: true });
  assert.deepEqual(applied.changedPlayIds, ["play_204"]);
  const after = readJson(path.join(root, "data/plays.json"));
  assert.deepEqual(after.plays[0].materials, { required: ["cup"], optional: [], substitutes: [] });
  assert.equal(after.plays[0].status, "draft");
  assert.deepEqual(after.plays[1], before.plays[1]);
  assert.deepEqual(after.plays[2], before.plays[2]);
  const blocked = resultsFor(root);
  Object.assign(blocked.records[0], { decision: "approved", contentReviewed: true, imageReviewed: true });
  assert.throws(() => applyApproval(root, readJson(path.join(root, "data/batch.json")), blocked), /다시 검수/);
  after.plays[0].steps[0] = "보호자가 큰 컵을 준비하고 잡기 쉬운 크기를 확인합니다.";
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(after, null, 2) + "\n");
  const reviewed = resultsFor(root);
  Object.assign(reviewed.records[0], { decision: "approved", contentReviewed: true, imageReviewed: true });
  assert.deepEqual(applyApproval(root, readJson(path.join(root, "data/batch.json")), reviewed).changedIds, ["play_204"]);
});
test("unconfirmed add and invalid or unapproved replacement reject all writes", (t) => {
  const { root } = fixture(t), results = resultsFor(root);
  const before = fs.readFileSync(path.join(root, "data/materials.json"), "utf8");
  results.materialRecords[0].decision = "add";
  assert.throws(() => applyMaterialReview(root, "data/batch.json", results, { write: true }), /비교를 확인/);
  Object.assign(results.materialRecords[0], { confirmed: true, decision: "replace", replacementSlug: "dropper", comment: "대체" });
  assert.throws(() => applyMaterialReview(root, "data/batch.json", results, { write: true }), /승인된 기존 재료/);
  results.materialRecords[0].replacementSlug = "cup";
  results.materialRecords[0].comment = "";
  assert.throws(() => applyMaterialReview(root, "data/batch.json", results, { write: true }), /대체 이유/);
  assert.equal(fs.readFileSync(path.join(root, "data/materials.json"), "utf8"), before);
});
test("replacement target definition changes invalidate an exported decision", (t) => {
  const { root } = fixture(t), results = resultsFor(root);
  Object.assign(results.materialRecords[0], { decision: "replace", replacementSlug: "cup", confirmed: true, comment: "컵" });
  const registry = readJson(path.join(root, "data/materials.json"));
  registry.displayNames.cup = "변경된 분류";
  fs.writeFileSync(path.join(root, "data/materials.json"), JSON.stringify(registry));
  assert.throws(() => applyMaterialReview(root, "data/batch.json", results, { write: true }), /버전이 다릅니다/);
  assert.equal(readJson(path.join(root, "data/plays.json")).plays[0].materials.required[0], "basket");
});
