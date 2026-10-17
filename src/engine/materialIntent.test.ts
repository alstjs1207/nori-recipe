import assert from "node:assert/strict";
import test from "node:test";
import { loadLivePlays } from "@/data/content";
import { pickTop3 } from "@/engine/diversity";
import { getMaterialFit, getMaterialRecommendationNotice, pickFeaturedPlay } from "@/engine/materialFit";
import { recommend } from "@/engine/recommend";
import { softScore } from "@/engine/softScore";
import { DEFAULT_WEIGHTS } from "@/engine/weights";
import type { ScoredPlay } from "@/engine/types";
import type { FilterInput, Play } from "@/types";

function play(id: string, required: Play["materials"]["required"], overrides: Partial<Play> = {}): Play {
  return {
    ...loadLivePlays()[0], id, name: id, ageMin: 0, ageMax: 48,
    durationMin: 5, durationMax: 10, prepTime: 1, devAreas: ["fine_motor"],
    place: "indoor", materials: { required, optional: [], substitutes: [] }, ...overrides,
  };
}
function context(materials: FilterInput["availableMaterials"]): FilterInput {
  return { childAgeMonths: 33, availableMaterials: materials, blockedMaterials: [], availableMinutes: 999, place: "any" };
}
function scored(p: Play, total = 50): ScoredPlay {
  return { play: p, total, breakdown: { material: 0, dev: 0, popular: 0, time: 0, feedback: 0 } };
}

test("재료 하나를 골라도 부분 일치 도구 놀이가 무재료 3개보다 먼저 나온다", () => {
  const tool = play("tool", ["straw", "paper"]);
  const pool = [play("free-a", []), play("free-b", []), play("free-c", []), tool];
  const result = recommend(pool, context(["straw"]), { totalPlays: 0 });
  assert.equal(result.results.length, 3);
  assert.equal(result.results[0].id, tool.id);
  assert.equal(pickFeaturedPlay(result.results, ["straw"])?.id, tool.id);
});

test("필수 준비물이 모두 있는 선택 재료 놀이가 일치 재료 개수가 많은 미완성 놀이보다 우선한다", () => {
  const ready = play("ready", ["paper"]);
  const partial = play("partial", ["paper", "sticker", "crayon"]);
  const result = recommend([partial, ready, play("free", [])], context(["paper", "sticker"]), { totalPlays: 0 });
  assert.equal(result.results[0].id, ready.id);
  assert.equal(pickFeaturedPlay([partial, ready], ["paper", "sticker"])?.id, ready.id);
});

test("추가 준비물이 적은 놀이를 발달 점수와 영역 다양성보다 우선한다", () => {
  const fewer = play("fewer", ["straw", "paper"]);
  const more = play("more", ["straw", "cup", "tape"], { devAreas: ["language"] });
  const result = pickTop3([scored(more, 100), scored(fewer, 1), scored(play("free", []), 200)], context(["straw"]));
  assert.equal(result[0].id, fewer.id);
  assert.equal(pickFeaturedPlay(result, ["straw"])?.id, fewer.id);
});

test("선택 재료 3개를 모두 쓰지 않아도 그중 하나를 쓰면 관련 놀이로 추천한다", () => {
  const straw = play("straw", ["straw"]);
  const result = recommend([play("free-a", []), play("free-b", []), straw], context(["transparent_cup", "rubber_band", "straw"]), { totalPlays: 0 });
  assert.equal(result.results[0].id, straw.id);
});

test("선택 재료와 무관한 놀이의 선택 준비물은 도구 활용 의도로 계산하지 않는다", () => {
  const cleanup = play("cleanup", ["water", "brush"], { materials: { required: ["water", "brush"], optional: ["cloth"], substitutes: [] } });
  assert.equal(getMaterialFit(cleanup, new Set(["cloth"])).matched, 0);
  assert.equal(pickFeaturedPlay([cleanup, play("free", [])], ["cloth"])?.id, "free");
});

test("최근 완료한 관련 놀이를 무관한 새 놀이로 밀어내지 않는다", () => {
  const tool = play("tool", ["straw"]);
  const result = recommend([tool, play("free-a", []), play("free-b", []), play("free-c", [])], context(["straw"]), { totalPlays: 10, recentCompletedPlayIds: [tool.id] });
  assert.equal(result.results[0].id, tool.id);
});

test("선택 재료가 없으면 무재료 놀이로 3개를 채운다", () => {
  const result = recommend([play("free-a", []), play("free-b", []), play("free-c", []), play("tool", ["straw"])], context([]), { totalPlays: 0 });
  assert.equal(result.results.length, 3);
  assert.ok(result.results.every((p) => p.materials.required.length === 0));
  assert.equal(getMaterialRecommendationNotice(result.results, []), null);
});

test("33개월 도구 후보가 없으면 월령 밖 놀이를 끌어오지 않고 공백을 안내한다", () => {
  const outside = play("too-young", ["transparent_cup"], { ageMin: 24, ageMax: 30 });
  const materials: FilterInput["availableMaterials"] = ["transparent_cup", "rubber_band", "straw"];
  const result = recommend([outside, play("free-a", []), play("free-b", []), play("other", ["paper"])], context(materials), { totalPlays: 0 });
  assert.equal(result.results.length, 3);
  assert.ok(result.results.every((p) => p.id !== outside.id));
  assert.equal(getMaterialRecommendationNotice(result.results, materials), "선택한 재료를 활용하는 놀이가 부족해 다른 놀이를 추천해요.");
});

test("부분 일치 3개를 추천하면 추가 준비물을 숨기지 않고 안내한다", () => {
  const plays = [play("a", ["straw", "paper"]), play("b", ["straw", "cup"]), play("c", ["straw", "tape"])];
  assert.match(getMaterialRecommendationNotice(plays, ["straw"]) ?? "", /추가 준비물/);
});

test("시간 완화로도 금지 재료·월령 밖·비공개 놀이를 되살리지 않는다", () => {
  const blocked = play("blocked", ["straw"], { durationMin: 10, materials: { required: ["straw"], optional: ["tape"], substitutes: [] } });
  const c = { ...context(["straw"]), blockedMaterials: ["tape"] as FilterInput["blockedMaterials"], availableMinutes: 7 };
  const result = recommend([blocked, play("archived", ["straw"], { status: "archived" }), play("outside", ["straw"], { ageMin: 36 }), play("valid", ["straw"], { durationMin: 10 })], c, { totalPlays: 0 });
  assert.deepEqual(result.results.map((p) => p.id), ["valid"]);
});

test("재료 1개 선택도 무재료 점수보다 부분 일치 점수를 높인다", () => {
  const c = context(["straw"]);
  assert.ok(softScore(play("partial", ["straw", "paper"]), c, DEFAULT_WEIGHTS).breakdown.material > softScore(play("free", []), c, DEFAULT_WEIGHTS).breakdown.material);
});
