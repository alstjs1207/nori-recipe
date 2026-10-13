import assert from "node:assert/strict";
import test from "node:test";

import { loadLivePlays } from "@/data/content";
import { applyFallback } from "@/engine/fallback";
import { softScore } from "@/engine/softScore";
import { DEFAULT_WEIGHTS } from "@/engine/weights";
import { getMaterialStatus, matchesSituation } from "@/play/presentation";
import type { FilterInput, Play } from "@/types";

function livePlay(id: string): Play {
  const play = loadLivePlays().find((item) => item.id === id);
  assert.ok(play, `${id} must remain in the live catalog`);
  return play;
}

function context(availableMaterials: FilterInput["availableMaterials"]): FilterInput {
  return {
    childAgeMonths: 20,
    availableMaterials,
    blockedMaterials: [],
    availableMinutes: 20,
    place: "indoor",
  };
}

test("뚜껑 놀이는 페트병만 있을 때 준비 완료나 완전 재료 일치로 표시하지 않는다", () => {
  const play = livePlay("play_006");
  assert.equal(getMaterialStatus(play, ["bottle"]).ready, false);
  assert.equal(softScore(play, context(["bottle"]), DEFAULT_WEIGHTS).breakdown.material, 0);
  assert.equal(getMaterialStatus(play, ["large_lid_container"]).ready, true);
  assert.equal(softScore(play, context(["large_lid_container"]), DEFAULT_WEIGHTS).breakdown.material, DEFAULT_WEIGHTS.material);
});

test("의자 통로 놀이는 무재료 놀이에 포함하지 않고 의자가 없으면 준비가 필요하다", () => {
  const play = livePlay("play_076");
  assert.equal(matchesSituation(play, "no-materials"), false);
  assert.equal(getMaterialStatus(play, []).ready, false);
  assert.equal(softScore(play, context([]), DEFAULT_WEIGHTS).breakdown.material, 0);
  assert.equal(getMaterialStatus(play, ["chair"]).ready, true);
  assert.ok(play.preparationNotes?.some((note) => note.includes("열린 통로")));
});

test("큰 뚜껑 용기와 의자 없는 추천은 해당 활동을 준비 완료 후보로 묶지 않는다", () => {
  const lids = livePlay("play_006");
  const chairs = livePlay("play_076");
  const others: Play[] = ["a", "b", "c"].map((id) => ({
    ...lids,
    id,
    materials: { required: ["paper"], optional: [], substitutes: [] },
  }));
  const result = applyFallback(context(["paper", "bottle"]), [...others, lids, chairs]);
  assert.equal(result.usedFallback, false);
  assert.deepEqual(result.plays.map((play) => play.id), ["a", "b", "c"]);
});
