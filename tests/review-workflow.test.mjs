import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareReview } from "../scripts/prepare-play-review.mjs";
import { buildCatalog } from "../scripts/build-play-catalog.mjs";
import { applyApproval, contentHash, createManifest, readJson, sha256 } from "../scripts/review/review-core.mjs";
import { reviewDefaults } from "../scripts/review/review-history.mjs";
import sharp from "sharp";
import { imagePreparation, saveGeneratedImage } from "../scripts/prepare-review-images.mjs";
import { discoverBatches } from "../tools/local-review/service.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nori-html-workflow-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ["data", "images/plays", "images/material", "src/constants", "scripts/review"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const registry = { categories: { 주방: ["cup", "new_cup", "unrelated"] },
    displayNames: { cup: "컵", new_cup: "새 컵", unrelated: "다른 재료" }, reviewPending: ["new_cup", "unrelated"] };
  const sample = readJson(path.join(project, "data/plays.json")).plays.find((p) => p.id === "play_013");
  const plays = ["play_301", "play_302", "play_303"].map((id, index) => ({
    ...structuredClone(sample), id, name: "수집 놀이 " + index, status: index === 2 ? "live" : "draft",
    imageStatus: index === 2 ? undefined : "review", materials: { required: [index === 1 ? "new_cup" : "cup"], optional: [], substitutes: [] },
  }));
  const bundle = { version: "1", updatedAt: "2026-10-15", plays, importedFiles: [] };
  for (const [file, value] of [["plays.json", bundle], ["materials.json", registry]]) fs.writeFileSync(path.join(root, "data", file), JSON.stringify(value, null, 2) + "\n");
  fs.writeFileSync(path.join(root, "src/constants/playImages.ts"), "const PLAY_IMAGE_SOURCES: Record<string, ImageSourcePropType> = {\n};\n");
  fs.writeFileSync(path.join(root, "src/constants/materialImageSources.ts"), 'export const MATERIAL_IMAGES = {\n  new_cup: require("../../images/material/new_cup.jpeg"),\n};\n');
  fs.writeFileSync(path.join(root, "images/material/new_cup.jpeg"), Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]));
  for (const p of plays) fs.writeFileSync(path.join(root, "images/plays", p.id + ".jpeg"), Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]));
  fs.mkdirSync(path.join(root, "results/image-generation"), { recursive: true });
  for (const p of plays) fs.writeFileSync(path.join(root, "results/image-generation", p.id + ".json"), JSON.stringify({
    schemaVersion: 1, id: p.id, generator: "image_gen", contentHash: contentHash(p, registry),
    imageHash: sha256(fs.readFileSync(path.join(root, "images/plays", p.id + ".jpeg"))),
  }));
  for (const file of ["review.css", "review-client.js", "material-review-client.js"]) fs.copyFileSync(path.join(project, "scripts/review", file), path.join(root, "scripts/review", file));
  const source = { meta: { materialProposals: [{ slug: "new_cup", originalNames: ["특수 컵"], purpose: "돌리기", reason: "구조가 다름", similar: ["cup"] }] }, activities: [] };
  fs.writeFileSync(path.join(root, "source.json"), JSON.stringify(source));
  return { root, bundle, registry };
}

test("prepare creates a reusable draft review with only relevant material proposals and no master changes", (t) => {
  const { root } = fixture(t);
  const before = ["plays.json", "materials.json"].map((file) => fs.readFileSync(path.join(root, "data", file)));
  const result = prepareReview(root, { ids: ["play_301", "play_302"], sourcePath: "source.json" });
  const batch = readJson(result.batchPath);
  assert.deepEqual(batch.playIds, ["play_301", "play_302"]);
  assert.deepEqual(batch.materialProposals.map((m) => m.slug), ["new_cup"]);
  assert.deepEqual(batch.materialProposals[0].usages.map((u) => u.id), ["play_302"]);
  assert.equal(fs.existsSync(result.review), true);
  assert.equal(fs.existsSync(result.catalog), true);
  const html = fs.readFileSync(result.review, "utf8");
  assert.ok(html.includes("pnpm review:prepare --batch data/review-batches/" + batch.batchId + ".json"));
  assert.ok(html.includes("pnpm review:apply /path/to/검수결과.json --batch data/review-batches/" + batch.batchId + ".json"));
  for (let i = 0; i < before.length; i++) assert.deepEqual(fs.readFileSync(path.join(root, "data", ["plays.json", "materials.json"][i])), before[i]);
  const previous = fs.readFileSync(result.batchPath, "utf8");
  assert.equal(prepareReview(root, { ids: ["play_301", "play_302"], sourcePath: "source.json" }).reused, true);
  assert.equal(fs.readFileSync(result.batchPath, "utf8"), previous);
  const wrong = () => prepareReview(root, { ids: ["play_301"], batchId: batch.batchId, sourcePath: "source.json" });
  assert.throws(wrong, /대상이 다릅니다/);
  assert.equal(fs.readFileSync(result.batchPath, "utf8"), previous);
});

test("invalid selection or an unsafe output is rejected before preparing files", (t) => {
  const { root } = fixture(t);
  assert.throws(() => prepareReview(root, { ids: ["play_999"] }), /찾을 수 없습니다/);
  assert.throws(() => prepareReview(root, { ids: ["play_301", "play_301"] }), /중복 없이/);
  assert.equal(fs.existsSync(path.join(root, "data/review-batches")), false);
  const bad = { schemaVersion: 1, batchId: "unsafe", title: "검수", playIds: ["play_301"], reviewOutput: "../outside.html" };
  fs.writeFileSync(path.join(root, "data/batch.json"), JSON.stringify(bad));
  assert.throws(() => prepareReview(root, { batchPath: "data/batch.json" }), /results/);
  assert.equal(fs.existsSync(path.join(root, "results/play-catalog.html")), false);
});

test("new collections wait for every generated image, then appear together without publishing drafts", async (t) => {
  const { root } = fixture(t), ids = ["play_301", "play_302"];
  for (const id of ids) fs.rmSync(path.join(root, "images/plays", id + ".jpeg"));
  const before = fs.readFileSync(path.join(root, "data/plays.json"));
  assert.deepEqual(imagePreparation(root, ids).map((entry) => entry.state), ["missing", "missing"]);
  assert.throws(() => prepareReview(root, { ids }), /대표 이미지 생성·저장 완료/);
  assert.equal(fs.existsSync(path.join(root, "data/review-batches")), false);
  // A raster fixture stands in for the image tool output; no live generation in tests.
  const input = path.join(root, "generated.png"), promptPath = "prompt.txt";
  await sharp({ create: { width: 512, height: 512, channels: 4, background: "#fffaf0" } }).png().toFile(input);
  fs.writeFileSync(path.join(root, promptPath), "A test prompt for the selected play.");
  const plan = imagePreparation(root, ids);
  const first = await saveGeneratedImage(root, { id: ids[0], file: input, expectedContentHash: plan[0].contentHash, promptPath });
  assert.equal(first.state, "ready");
  assert.equal((await sharp(path.join(root, first.imagePath)).metadata()).format, "jpeg");
  assert.deepEqual(imagePreparation(root, ids).map((entry) => entry.state), ["ready", "missing"]);
  assert.throws(() => prepareReview(root, { ids }), /play_302/);
  assert.equal(fs.existsSync(path.join(root, "data/review-batches")), false);
  assert.equal(discoverBatches(root).length, 0);
  await saveGeneratedImage(root, { id: ids[1], file: input, expectedContentHash: plan[1].contentHash, promptPath });
  const prepared = prepareReview(root, { ids });
  assert.equal(prepared.imagesReady, 2);
  assert.deepEqual(readJson(prepared.batchPath).playIds, ids);
  assert.deepEqual(discoverBatches(root).map(({ batch }) => batch.playIds), [ids]);
  assert.deepEqual(fs.readFileSync(path.join(root, "data/plays.json")), before);
  assert.equal(fs.readFileSync(path.join(root, "src/constants/playImages.ts"), "utf8").includes("play_301:"), false);
});

test("untracked, stale or corrupted images cannot publish a new collection", (t) => {
  const { root, bundle } = fixture(t), ids = ["play_301"];
  fs.rmSync(path.join(root, "results/image-generation/play_301.json"));
  assert.equal(imagePreparation(root, ids)[0].state, "untracked");
  assert.throws(() => prepareReview(root, { ids }), /untracked/);
  const p = bundle.plays[0];
  fs.writeFileSync(path.join(root, "results/image-generation/play_301.json"), JSON.stringify({ schemaVersion: 1, id: p.id,
    generator: "image_gen", contentHash: "old", imageHash: sha256(fs.readFileSync(path.join(root, "images/plays/play_301.jpeg"))) }));
  assert.equal(imagePreparation(root, ids)[0].state, "stale");
  assert.throws(() => prepareReview(root, { ids }), /stale/);
  fs.writeFileSync(path.join(root, "images/plays/play_301.jpeg"), "not a JPEG");
  assert.equal(imagePreparation(root, ids)[0].state, "missing");
  assert.throws(() => prepareReview(root, { ids }), /missing/);
  assert.equal(fs.existsSync(path.join(root, "data/review-batches")), false);
});

test("image saves reject changed content, registered plays and unreadable raster data without overwriting", async (t) => {
  const { root } = fixture(t);
  fs.writeFileSync(path.join(root, "prompt.txt"), "Test prompt");
  fs.writeFileSync(path.join(root, "bad.png"), "invalid raster");
  const before = fs.readFileSync(path.join(root, "images/plays/play_301.jpeg"));
  const hash = imagePreparation(root, ["play_301"])[0].contentHash;
  const save = (extra) => saveGeneratedImage(root, { id: "play_301", file: "bad.png", promptPath: "prompt.txt", expectedContentHash: hash, ...extra });
  await assert.rejects(save({ expectedContentHash: "old" }), /내용이 바뀌었습니다/);
  await assert.rejects(save({}), /기존 이미지/);
  await assert.rejects(save({ replace: true }), /unsupported|corrupt|format/i);
  await assert.rejects(save({ id: "play_303" }), /검수 대기 초안/);
  assert.deepEqual(fs.readFileSync(path.join(root, "images/plays/play_301.jpeg")), before);
  const bundle = readJson(path.join(root, "data/plays.json"));
  bundle.plays[0].steps[0] = "수정된 놀이 방법";
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(bundle));
  assert.equal(imagePreparation(root, ["play_301"])[0].state, "stale");
  await assert.rejects(save({ replace: true }), /내용이 바뀌었습니다/);
});

test("requested replacement preserves the original and invalidates prior image review hashes", async (t) => {
  const { root, bundle, registry } = fixture(t), id = "play_301";
  const batch = { schemaVersion: 1, batchId: "existing", playIds: [id] };
  const old = createManifest(root, batch, bundle, registry).entries[0];
  const original = fs.readFileSync(path.join(root, "images/plays", id + ".jpeg"));
  fs.writeFileSync(path.join(root, "prompt.txt"), "Updated scene prompt");
  await sharp({ create: { width: 512, height: 512, channels: 3, background: "#eeeeee" } }).png().toFile(path.join(root, "output.png"));
  await saveGeneratedImage(root, { id, file: "output.png", promptPath: "prompt.txt", expectedContentHash: old.contentHash, replace: true });
  assert.notEqual(createManifest(root, batch, bundle, registry).entries[0].imageHash, old.imageHash);
  const backups = fs.readdirSync(path.join(root, "results/image-generation/originals"));
  assert.equal(backups.length, 1);
  assert.deepEqual(fs.readFileSync(path.join(root, "results/image-generation/originals", backups[0])), original);
  assert.equal(imagePreparation(root, [id])[0].state, "ready");
});

test("thumbnail and non-square outputs are rejected before writing images or receipts", async (t) => {
  const { root } = fixture(t), id = "play_301";
  fs.rmSync(path.join(root, "images/plays", id + ".jpeg"));
  fs.rmSync(path.join(root, "results/image-generation", id + ".json"));
  fs.writeFileSync(path.join(root, "prompt.txt"), "Test prompt");
  for (const [width, height] of [[128, 128], [1024, 512]]) {
    await sharp({ create: { width, height, channels: 3, background: "#eeeeee" } }).png().toFile(path.join(root, "output.png"));
    await assert.rejects(saveGeneratedImage(root, { id, file: "output.png", promptPath: "prompt.txt",
      expectedContentHash: imagePreparation(root, [id])[0].contentHash }), /정사각형/);
    assert.equal(fs.existsSync(path.join(root, "images/plays", id + ".jpeg")), false);
    assert.equal(fs.existsSync(path.join(root, "results/image-generation", id + ".json")), false);
  }
});

test("existing batches remain inspectable when an image goes missing", (t) => {
  const { root } = fixture(t), prepared = prepareReview(root, { ids: ["play_301"] });
  fs.rmSync(path.join(root, "images/plays/play_301.jpeg"));
  const refreshed = prepareReview(root, { batchPath: prepared.batchPath });
  assert.equal(refreshed.imagesReady, 0);
  assert.match(fs.readFileSync(refreshed.review, "utf8"), /대표 이미지 생성 대기/);
});

test("catalog includes registered, draft and archived contents without making them live", (t) => {
  const { root, bundle } = fixture(t);
  bundle.plays[0].name = '<img src=x onerror="alert(1)">';
  bundle.plays[2].status = "archived";
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(bundle));
  const before = fs.readFileSync(path.join(root, "data/plays.json"));
  const result = buildCatalog(root);
  assert.deepEqual(result.statuses, { live: 0, draft: 2, archived: 1 });
  assert.equal(result.materials, 3);
  assert.equal(result.pendingMaterials, 2);
  const html = fs.readFileSync(result.output, "utf8");
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=/);
  assert.match(html, /id="play_303"/);
  assert.match(html, /특수|새 컵/);
  assert.deepEqual(fs.readFileSync(path.join(root, "data/plays.json")), before);
});

test("current held decisions survive publication while stale decisions and automatic approvals do not", (t) => {
  const { root, bundle, registry } = fixture(t);
  bundle.plays[1].materials.required = ["cup"];
  fs.writeFileSync(path.join(root, "data/plays.json"), JSON.stringify(bundle));
  const batch = { schemaVersion: 1, batchId: "history", title: "검수", playIds: ["play_301", "play_302"], entries: [] };
  const manifest = createManifest(root, batch, bundle, registry);
  const results = { schemaVersion: 2, batchId: batch.batchId, batchHash: manifest.batchHash, materialRecords: [],
    records: manifest.entries.map((entry, i) => ({ ...entry, decision: i ? "held" : "approved", comment: i ? "추후 재검토" : "",
      contentReviewed: true, imageReviewed: true })) };
  applyApproval(root, batch, results, { write: true });
  const current = createManifest(root, batch, readJson(path.join(root, "data/plays.json")), registry);
  const defaults = reviewDefaults(root, current);
  assert.deepEqual(defaults.map((r) => [r.id, r.decision]), [["play_302", "held"]]);
  assert.equal(defaults[0].comment, "추후 재검토");
  const changed = readJson(path.join(root, "data/plays.json"));
  changed.plays[1].steps[0] = "본문을 수정했습니다.";
  const next = createManifest(root, batch, changed, registry);
  assert.deepEqual(reviewDefaults(root, next), []);
});
