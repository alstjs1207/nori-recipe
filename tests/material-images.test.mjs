import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fixture, read, write } from "../tools/local-review/tests/fixture.mjs";
import { createService, discoverBatches } from "../tools/local-review/service.mjs";
import { collectionMaterialSlugs, materialImagePreparation, saveMaterialImage } from "../scripts/prepare-material-images.mjs";
import { materialDefinitionHash, materialImageInfo } from "../scripts/review/material-images.mjs";
import { prepareReview } from "../scripts/prepare-play-review.mjs";
import { buildReview } from "../scripts/build-play-review.mjs";
import { buildCatalog } from "../scripts/build-play-catalog.mjs";
import { contentHash, createManifest, sha256, validateResults } from "../scripts/review/review-core.mjs";

const mappingFile = "src/constants/materialImageSources.ts";
function pendingCollection(t) {
  const root = fixture(t), ids = ["play_302", "play_303"];
  for (const slug of ["basket", "dropper"]) fs.rmSync(path.join(root, "images/material", slug + ".jpeg"));
  for (const p of read(root, "data/plays.json").plays.filter((p) => ids.includes(p.id))) {
    write(root, "results/image-generation/" + p.id + ".json", { schemaVersion: 1, id: p.id, generator: "image_gen",
      contentHash: contentHash(p, read(root, "data/materials.json")), imageHash: sha256(fs.readFileSync(path.join(root, "images/plays", p.id + ".jpeg"))) });
  }
  return { root, ids };
}
async function output(root, size = [512, 512]) {
  await sharp({ create: { width: size[0], height: size[1], channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(path.join(root, "generated.png"));
  fs.writeFileSync(path.join(root, "prompt.txt"), "A test material icon on white background.");
}
const save = (root, slug, extra = {}) => saveMaterialImage(root, { slug, file: "generated.png", promptPath: "prompt.txt",
  expectedDefinitionHash: materialDefinitionHash(read(root, "data/materials.json"), slug), ...extra });

test("collection planning deduplicates only used pending materials and reuses real existing images", (t) => {
  const root = fixture(t), bundle = read(root, "data/plays.json");
  bundle.plays[1].materials.optional = ["dropper", "cup"];
  write(root, "data/plays.json", bundle);
  assert.deepEqual(collectionMaterialSlugs(root, ["play_301", "play_302", "play_303"]), ["basket", "dropper"]);
  assert.deepEqual(collectionMaterialSlugs(root, ["play_301"]), []);
  const before = fs.readFileSync(path.join(root, mappingFile));
  assert.deepEqual(materialImagePreparation(root, ["basket", "dropper"]).map((e) => e.state), ["existing", "existing"]);
  assert.deepEqual(fs.readFileSync(path.join(root, mappingFile)), before);
  assert.equal(fs.existsSync(path.join(root, "results/image-generation/materials")), false);
  assert.throws(() => collectionMaterialSlugs(root, ["play_999"]), /찾을 수 없습니다/);
});

test("both material images are required before a new collection appears with images in review and catalog", async (t) => {
  const { root, ids } = pendingCollection(t), before = fs.readFileSync(path.join(root, "data/materials.json"));
  assert.throws(() => prepareReview(root, { ids, batchId: "with-material-images" }), /새 재료 이미지/);
  assert.equal(discoverBatches(root).length, 1);
  await output(root);
  await save(root, "basket");
  assert.throws(() => prepareReview(root, { ids, batchId: "with-material-images" }), /dropper/);
  const saved = await save(root, "dropper");
  assert.deepEqual(materialImagePreparation(root, ["basket", "dropper"]).map((e) => e.state), ["ready", "ready"]);
  const metadata = await sharp(path.join(root, saved.imagePath)).metadata();
  assert.equal(metadata.format, "jpeg");
  const pixel = await sharp(path.join(root, saved.imagePath)).raw().toBuffer();
  assert.deepEqual([...pixel.subarray(0, 3)], [255, 255, 255]);
  assert.deepEqual(fs.readFileSync(path.join(root, "data/materials.json")), before);
  assert.deepEqual(read(root, "data/plays.json").plays.filter((p) => ids.includes(p.id)).map((p) => p.status), ["draft", "draft"]);
  const ready = prepareReview(root, { ids, batchId: "with-material-images" });
  assert.equal(read(root, "data/review-batches/with-material-images.json").materialImagesRequired, true);
  assert.equal(discoverBatches(root).length, 2);
  assert.match(fs.readFileSync(ready.review, "utf8"), /images\/material\/basket.jpeg\?v=/);
  assert.match(fs.readFileSync(ready.review, "utf8"), /images\/material\/dropper.jpeg\?v=/);
  assert.match(fs.readFileSync(ready.catalog, "utf8"), /images\/material\/basket.jpeg\?v=/);
});

test("default brand image is missing; an unlinked real file is linked without regenerating it", (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, mappingFile), 'export const MATERIAL_IMAGES = {\n  basket: require("../../assets/icon.png"),\n};\n');
  fs.mkdirSync(path.join(root, "assets"));
  fs.copyFileSync(path.join(root, "images/material/basket.jpeg"), path.join(root, "assets/icon.png"));
  const bytes = fs.readFileSync(path.join(root, "images/material/basket.jpeg"));
  assert.equal(materialImagePreparation(root, ["basket"])[0].state, "unlinked");
  const task = saveMaterialImage(root, { slug: "basket", link: true,
    expectedDefinitionHash: materialDefinitionHash(read(root, "data/materials.json"), "basket") });
  return task.then(() => {
    assert.equal(materialImagePreparation(root, ["basket"])[0].state, "existing");
    assert.deepEqual(fs.readFileSync(path.join(root, "images/material/basket.jpeg")), bytes);
    assert.equal(fs.existsSync(path.join(root, "results/image-generation/materials/basket.json")), false);
    fs.rmSync(path.join(root, "images/material/basket.jpeg"));
    assert.equal(materialImagePreparation(root, ["basket"])[0].state, "missing");
  });
});

test("stale definitions, registered materials, invalid rasters and implicit replacements write nothing", async (t) => {
  const { root } = pendingCollection(t);
  const source = fs.readFileSync(path.join(root, mappingFile));
  await output(root, [256, 256]);
  await assert.rejects(save(root, "basket"), /정사각형/);
  fs.writeFileSync(path.join(root, "generated.png"), "not an image");
  await assert.rejects(save(root, "basket"), /unsupported|format|corrupt/i);
  await assert.rejects(save(root, "basket", { expectedDefinitionHash: "old" }), /정의가 바뀌었습니다/);
  await assert.rejects(save(root, "cup"), /미승인 새 재료/);
  assert.deepEqual(fs.readFileSync(path.join(root, mappingFile)), source);
  assert.equal(fs.existsSync(path.join(root, "images/material/basket.jpeg")), false);
  assert.equal(fs.existsSync(path.join(root, "results/image-generation/materials/basket.json")), false);
  await output(root); await save(root, "basket");
  const original = fs.readFileSync(path.join(root, "images/material/basket.jpeg"));
  await assert.rejects(save(root, "basket"), /기존 이미지는 재사용/);
  assert.deepEqual(fs.readFileSync(path.join(root, "images/material/basket.jpeg")), original);
  const registry = read(root, "data/materials.json"); registry.displayNames.basket = "바뀐 바구니";
  write(root, "data/materials.json", registry);
  assert.equal(materialImagePreparation(root, ["basket"])[0].state, "stale");
});

test("new batch image changes invalidate exports and a missing material image prevents addition", async (t) => {
  const { root, ids } = pendingCollection(t); await output(root); await save(root, "basket"); await save(root, "dropper");
  const ready = prepareReview(root, { ids, batchId: "material-hashes" }), batch = read(root, "data/review-batches/material-hashes.json");
  const service = createService(root), snapshot = service.read(batch.batchId);
  Object.assign(snapshot.results.materialRecords.find((m) => m.slug === "basket"), { decision: "add", confirmed: true });
  const bytes = fs.readFileSync(path.join(root, "images/material/basket.jpeg"));
  await sharp({ create: { width: 512, height: 512, channels: 3, background: "#abcdef" } }).png().toFile(path.join(root, "generated.png"));
  await save(root, "basket", { replace: true });
  const next = service.read(batch.batchId);
  assert.notEqual(snapshot.manifest.batchHash, next.manifest.batchHash);
  assert.throws(() => validateResults(snapshot.results, next.manifest), /버전/);
  assert.equal(fs.readdirSync(path.join(root, "results/image-generation/materials/originals")).length, 1);
  assert.deepEqual(fs.readFileSync(path.join(root, "results/image-generation/materials/originals", "basket-" + sha256(bytes) + ".jpeg")), bytes);
  fs.rmSync(path.join(root, "images/material/basket.jpeg"));
  const missing = service.read(batch.batchId);
  Object.assign(missing.results.materialRecords.find((m) => m.slug === "basket"), { decision: "add", confirmed: true });
  assert.throws(() => validateResults(missing.results, missing.manifest), /실제 재료 이미지/);
  assert.match(buildReview(root, ready.batchPath, "results/review.html", { write: false }).html, /disabled title="재료 이미지 생성이 필요합니다/);
  assert.match(buildCatalog(root, undefined, { write: false }).html, /이미지 준비 중/);
});

test("material approval stages the same image hashes and publishes only the user's selected material", async (t) => {
  const { root, ids } = pendingCollection(t); await output(root); await save(root, "basket"); await save(root, "dropper");
  const ready = prepareReview(root, { ids, batchId: "approve-material-image" });
  const service = createService(root), snapshot = service.read(ready.batchId);
  Object.assign(snapshot.results.materialRecords.find((m) => m.slug === "basket"), { decision: "add", confirmed: true });
  const updated = await service.mutate(ready.batchId, { revision: snapshot.revision, results: snapshot.results }, { type: "material", id: "basket" });
  assert.deepEqual(updated.summary.addedSlugs, ["basket"]);
  assert.deepEqual(read(root, "data/materials.json").reviewPending, ["dropper"]);
  assert.deepEqual(read(root, "data/plays.json").plays.filter((p) => ids.includes(p.id)).map((p) => p.status), ["draft", "draft"]);
  assert.equal(materialImageInfo(root, "basket").hash, snapshot.manifest.materialEntries.find((e) => e.slug === "basket").imageHash);
});
