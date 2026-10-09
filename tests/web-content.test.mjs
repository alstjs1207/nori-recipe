import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { validatePlayBundle } from "../scripts/validate-play-content.mjs";
import { removeUnpublishedImages, writePlayImages, writeMaterialImage } from "../scripts/prepare-web-assets.mjs";

const bundle = JSON.parse(await fs.readFile(new URL("../data/plays.json", import.meta.url), "utf8"));
const registry = JSON.parse(await fs.readFile(new URL("../data/materials.json", import.meta.url), "utf8"));
function fixture(overrides) {
  const play = { ...structuredClone(bundle.plays[0]), source: { type: "manual", url: null, instagramAccount: null }, ...overrides };
  return { ...bundle, plays: [play] };
}

test("현재 카탈로그는 게시 여부를 포함한 콘텐츠 검증을 통과한다", () => {
  assert.deepEqual(validatePlayBundle(bundle, registry), { errors: [], warnings: [] });
});

test("생성일은 실제 날짜로 검증하고 날짜가 없는 기존 놀이도 허용한다", () => {
  for (const createdAt of [undefined, "2026-10-09", "2028-02-29"]) {
    assert.deepEqual(validatePlayBundle(fixture({ createdAt }), registry).errors, []);
  }
  for (const createdAt of [null, "", "2026-02-29", "2026-02-30", "2026-13-01", "2026-10-09T00:00:00Z"]) {
    assert.ok(validatePlayBundle(fixture({ createdAt }), registry).errors.some((error) => error.field === "createdAt"));
  }
});

test("출처 플랫폼 오표기와 검색 URL을 개별 영상 출처로 등록하지 않는다", () => {
  for (const source of [
    { type: "naver_blog", url: "https://sample.tistory.com/1", instagramAccount: null },
    { type: "youtube", url: "https://www.youtube.com/results?search_query=play", instagramAccount: null },
  ]) assert.ok(validatePlayBundle(fixture({ source }), registry).errors.some((error) => error.field === "source.url"));
  assert.deepEqual(validatePlayBundle(fixture({ source: { type: "tistory", url: "https://kidsgrowthlab.com/62", instagramAccount: null } }), registry).errors, []);
});

test("작은 부품과 생가루는 추천에 복귀하지 않고 제외 이력은 보존할 수 있다", () => {
  for (const slug of ["flour", "rice_flour", "bead", "marble", "pom_pom", "play_corn", "slime"]) {
    const materials = { required: [slug], optional: [], substitutes: [] };
    assert.ok(validatePlayBundle(fixture({ ageMin: 18, ageMax: 24, materials }), registry).errors.some((error) => error.field === "materials"));
    assert.deepEqual(validatePlayBundle(fixture({ ageMin: 18, ageMax: 24, status: "archived", materials, educationalEffects: [] }), registry), { errors: [], warnings: [] });
  }
  assert.deepEqual(validatePlayBundle(fixture({ materials: { required: ["soft_food", "bowl"], optional: [], substitutes: [] } }), registry).errors, []);
});

test("0분 놀이와 필수·선택 중복 재료를 거부한다", () => {
  const result = validatePlayBundle(fixture({ durationMin: 0, durationMax: 0, materials: { required: ["cup"], optional: ["cup"], substitutes: [] } }), registry);
  assert.ok(result.errors.some((error) => error.field === "duration"));
  assert.ok(result.errors.some((error) => error.field === "materials"));
});

test("검토 이미지의 웹 상세·썸네일은 원본 JPEG 없이도 브랜드 기본 이미지로 생성한다", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nori-image-review-"));
  try {
    const detailDirectory = path.join(directory, "plays"), thumbnailDirectory = path.join(directory, "thumbs");
    await Promise.all([detailDirectory, thumbnailDirectory].map((dir) => fs.mkdir(dir)));
    const icon = fileURLToPath(new URL("../public/nori-icon.svg", import.meta.url));
    await writePlayImages({ id: "play_051", imageStatus: "review" }, { sourceDirectory: path.join(directory, "missing-originals"), detailDirectory, thumbnailDirectory, icon });
    const detail = await fs.readFile(path.join(detailDirectory, "play_051.webp"));
    const thumb = await fs.readFile(path.join(thumbnailDirectory, "play_051.webp"));
    assert.deepEqual(detail, await sharp(icon).resize(960, 960).webp({ quality: 72 }).toBuffer());
    assert.deepEqual(thumb, await sharp(icon).resize(320, 320).webp({ quality: 66 }).toBuffer());
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("추천에서 제외한 놀이의 오래된 웹 이미지도 게시 출력에서 제거한다", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nori-stale-images-"));
  try {
    for (const name of ["play_001.webp", "play_028.webp", "notes.txt"]) await fs.writeFile(path.join(directory, name), "fixture");
    await removeUnpublishedImages(directory, new Set(["play_001.webp"]));
    assert.deepEqual((await fs.readdir(directory)).sort(), ["notes.txt", "play_001.webp"]);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("기본 아이콘을 실제 재료 이미지로 교체하면 주소 버전이 바뀌고 재빌드에서는 유지된다", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nori-material-version-"));
  try {
    const icon = fileURLToPath(new URL("../public/nori-icon.svg", import.meta.url));
    const plate = fileURLToPath(new URL("../images/material/paper_plate.jpeg", import.meta.url));
    const oldVersion = await writeMaterialImage("paper_plate", { source: icon, directory });
    const newVersion = await writeMaterialImage("paper_plate", { source: plate, directory });
    assert.notEqual(newVersion, oldVersion);
    assert.equal(await writeMaterialImage("paper_plate", { source: plate, directory }), newVersion);
    assert.match(newVersion, /^[a-f0-9]{12}$/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
