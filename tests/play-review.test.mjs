import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyApproval, createManifest, readJson } from "../scripts/review/review-core.mjs";
import { buildReview } from "../scripts/build-play-review.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9]);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nori-review-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ["data", "images/plays", "src/constants", "scripts/review"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const registry = readJson(path.join(project, "data/materials.json"));
  const sample = readJson(path.join(project, "data/plays.json")).plays.find((p) => p.id === "play_013");
  const plays = [204, 205, 13].map((n) => ({ ...structuredClone(sample), id: "play_" + String(n).padStart(3, "0"),
    name: "검수 테스트 " + n, createdAt: "2026-10-14", status: n === 13 ? "live" : "draft",
    ...(n !== 13 ? { imageStatus: "review" } : {}) }));
  const bundle = { version: "1.0.0", updatedAt: "2026-10-14", importedFiles: [], plays };
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(bundle, null, 2));
  fs.writeFileSync(path.join(root, "data/materials.json"), JSON.stringify(registry, null, 2));
  fs.writeFileSync(path.join(root, "src/constants/playImages.ts"), "const PLAY_IMAGE_SOURCES: Record<string, ImageSourcePropType> = {\n};\n");
  for (const id of ["play_204", "play_205"]) fs.writeFileSync(path.join(root, "images/plays", id + ".jpeg"), jpeg);
  for (const file of ["review.css", "review-client.js", "material-review-client.js"]) fs.copyFileSync(path.join(project, "scripts/review", file), path.join(root, "scripts/review", file));
  const batch = { schemaVersion: 1, batchId: "test-review", title: "검수 테스트", playIds: ["play_204", "play_205"] };
  fs.writeFileSync(path.join(root, "data/batch.json"), JSON.stringify(batch));
  const manifest = createManifest(root, batch, bundle, registry);
  const results = { schemaVersion: 2, batchId: batch.batchId, batchHash: manifest.batchHash, materialRecords: [],
    records: manifest.entries.map((entry, i) => ({ ...entry, decision: i === 0 ? "approved" : "held",
      comment: i === 0 ? "" : "다시 검토", contentReviewed: i === 0, imageReviewed: i === 0 })) };
  return { root, batch, bundle, registry, results };
}
const bytes = (root, relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("dry-run writes nothing; only approved item is published and its native mapping is added", (t) => {
  const { root, batch, results, bundle } = fixture(t);
  const before = bytes(root, "data/plays.json");
  assert.equal(applyApproval(root, batch, results).wrote, false);
  assert.equal(bytes(root, "data/plays.json"), before);
  assert.equal(fs.existsSync(path.join(root, "results")), false);
  const applied = applyApproval(root, batch, results, { write: true });
  assert.deepEqual(applied.changedIds, ["play_204"]);
  const after = readJson(path.join(root, "data/plays.json"));
  assert.equal(after.plays[0].status, "live");
  assert.equal(after.plays[0].imageStatus, undefined);
  assert.equal(after.plays[0].createdAt, "2026-10-14");
  assert.deepEqual(after.plays[1], bundle.plays[1]);
  assert.deepEqual(after.plays[2], bundle.plays[2]);
  assert.match(bytes(root, "src/constants/playImages.ts"), /play_204: require/);
  assert.doesNotMatch(bytes(root, "src/constants/playImages.ts"), /play_205: require/);
  assert.equal(fs.existsSync(path.join(applied.backupDirectory, "receipt.json")), true);
  assert.equal(applyApproval(root, batch, results, { write: true }).wrote, false);
  assert.equal(readJson(path.join(root, "data/plays.json")).plays.length, 3);
});

test("missing image, unconfirmed approval and a modification request without opinion are rejected", (t) => {
  const { root, batch, results } = fixture(t);
  const before = bytes(root, "data/plays.json");
  const unchecked = structuredClone(results);
  unchecked.records[0].imageReviewed = false;
  assert.throws(() => applyApproval(root, batch, unchecked, { write: true }), /모두 마쳐야/);
  const withoutComment = structuredClone(results);
  withoutComment.records[1].decision = "changes_requested";
  withoutComment.records[1].comment = "";
  assert.throws(() => applyApproval(root, batch, withoutComment, { write: true }), /의견이 필요/);
  fs.rmSync(path.join(root, "images/plays/play_204.jpeg"));
  assert.throws(() => applyApproval(root, batch, results, { write: true }), /버전이 다릅니다/);
  assert.equal(bytes(root, "data/plays.json"), before);
});

test("an old approval cannot clear a newly reopened image review", (t) => {
  const { root, batch, results } = fixture(t);
  applyApproval(root, batch, results, { write: true });
  const reopened = readJson(path.join(root, "data/plays.json"));
  reopened.plays[0].imageStatus = "review";
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(reopened));
  assert.throws(() => applyApproval(root, batch, results, { write: true }), /버전이 다릅니다/);
  assert.equal(readJson(path.join(root, "data/plays.json")).plays[0].imageStatus, "review");
});

test("changed content, relevant material definition and replacement image invalidate old approval", (t) => {
  const { root, batch, results, bundle, registry } = fixture(t);
  const changed = structuredClone(bundle);
  changed.plays[0].steps[0] = "수정된 준비 단계";
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(changed));
  assert.throws(() => applyApproval(root, batch, results, { write: true }), /버전이 다릅니다/);
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(bundle));
  const materialChanged = structuredClone(registry);
  materialChanged.displayNames.crayon = "다른 재료";
  fs.writeFileSync(path.join(root, "data/materials.json"), JSON.stringify(materialChanged));
  assert.throws(() => applyApproval(root, batch, results, { write: true }), /버전이 다릅니다/);
  fs.writeFileSync(path.join(root, "data/materials.json"), JSON.stringify(registry));
  fs.writeFileSync(path.join(root, "images/plays/play_204.jpeg"), Buffer.concat([jpeg, Buffer.from("new")]));
  assert.throws(() => applyApproval(root, batch, results, { write: true }), /버전이 다릅니다/);
});

test("unknown/duplicate IDs and an archived approval fail without partial writes", (t) => {
  const { root, batch, results, bundle, registry } = fixture(t);
  const before = bytes(root, "data/plays.json");
  const invalid = structuredClone(results);
  invalid.records[1].id = "play_013";
  assert.throws(() => applyApproval(root, batch, invalid, { write: true }), /배치 밖/);
  invalid.records[1].id = invalid.records[0].id;
  assert.throws(() => applyApproval(root, batch, invalid, { write: true }), /중복 ID/);
  assert.equal(bytes(root, "data/plays.json"), before);
  bundle.plays[0].status = "archived";
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(bundle));
  assert.throws(() => applyApproval(root, batch, results, { write: true }), /버전이 다릅니다/);
  const current = createManifest(root, batch, bundle, registry);
  const archivedResults = { ...results, batchHash: current.batchHash,
    records: results.records.map((record, i) => ({ ...record, ...current.entries[i] })) };
  assert.throws(() => applyApproval(root, batch, archivedResults, { write: true }), /보관한 놀이/);
  assert.equal(readJson(path.join(root, "data/plays.json")).plays[0].status, "archived");
});

test("native mapping and final live validation failures prevent the entire write", (t) => {
  const { root, batch, results, bundle, registry } = fixture(t);
  const before = bytes(root, "data/plays.json");
  fs.writeFileSync(path.join(root, "src/constants/playImages.ts"), "unexpected format");
  assert.throws(() => applyApproval(root, batch, results, { write: true }), /매핑 구조/);
  assert.equal(bytes(root, "data/plays.json"), before);
  bundle.plays[0].materials.required = ["flour"];
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(bundle));
  const manifest = createManifest(root, batch, bundle, registry);
  const dangerous = { ...results, batchHash: manifest.batchHash,
    records: results.records.map((record, i) => ({ ...record, ...manifest.entries[i] })) };
  assert.throws(() => applyApproval(root, batch, dangerous, { write: true }), /게시 검증 실패/);
  assert.equal(readJson(path.join(root, "data/plays.json")).plays[0].status, "draft");
});

test("review generator includes only selected IDs, full content and escaped text", (t) => {
  const { root, bundle } = fixture(t);
  bundle.plays[0].name = '<script>alert("x")</script>';
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(bundle));
  const info = buildReview(root, "data/batch.json");
  assert.equal(info.count, 2);
  const html = bytes(root, "results/play-image-audit.html");
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /본문·재료·주의사항 확인/);
  assert.match(html, /검수 결과 JSON 내보내기/);
  assert.doesNotMatch(html, /class="card" id="play_013"/);
  fs.rmSync(path.join(root, "images/plays/play_205.jpeg"));
  buildReview(root, "data/batch.json");
  assert.match(bytes(root, "results/play-image-audit.html"), /대표 이미지 생성 대기/);
});
