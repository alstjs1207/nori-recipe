import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { inspectRecommendation } from "../recommendation-model";
import { recommend } from "../../../src/engine/recommend";
import { pickFeaturedPlay } from "../../../src/engine/materialFit";
import type { FilterInput, Play } from "../../../src/types";

const plays = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../data/plays.json"), "utf8")).plays as Play[];
const ready = { adultSupervision: true, productsAgeAppropriate: true, noMouthing: true, scissorSnipping: true, tapeSurfaceSafe: true, washablePaint: true };
const base: FilterInput = { childAgeMonths: 33, availableMaterials: ["scissors", "paper", "glue"], blockedMaterials: [], place: "any", availableMinutes: 999 };

test("Studio observation preserves actual engine results and input content across material/age/history combinations", () => {
  const before = JSON.stringify(plays);
  let cases = 0;
  for (const age of [0, 12, 25, 32, 33, 34, 35, 36, 39, 48]) {
    for (const materials of [[], ["scissors", "paper", "glue"], ["tape", "animal_toy"], ["paint", "paper", "tape"], ["transparent_cup", "straw", "rubber_band"], ["scissors", "paper", "paint"]] as FilterInput["availableMaterials"][]) {
      for (const confirmation of [undefined, ready]) for (const history of [0, 20]) {
        const ctx = { ...base, childAgeMonths: age, availableMaterials: materials, intentReadiness: confirmation };
        const stats = { totalPlays: history, recentCompletedPlayIds: ["play_192"] };
        const result = recommend(plays, ctx, stats), view = inspectRecommendation(plays, ctx, stats);
        assert.deepEqual(view.results, result.results);
        assert.equal(view.usedFallback, result.usedFallback);
        assert.deepEqual(view.featured, pickFeaturedPlay(result.results, materials, age));
        assert.equal(view.rows.filter((r) => r.selected).length, result.results.length);
        assert.ok(view.rows.filter((r) => r.selected).every((r) => r.reason.length > 0));
        cases++;
      }
    }
  }
  assert.equal(cases, 240);
  assert.equal(JSON.stringify(plays), before);
});

test("readiness, missing supplies, ambiguity, age and exclusion traces agree with conditional eligibility", () => {
  const unconfirmed = inspectRecommendation(plays, base), allowed = inspectRecommendation(plays, { ...base, intentReadiness: ready });
  assert.ok(unconfirmed.conditional.some((p) => p.id === "play_192"));
  assert.ok(!unconfirmed.results.some((p) => p.ageMin > 33));
  assert.equal(allowed.featured?.id, "play_192");
  assert.equal(allowed.rows.find((r) => r.play.id === "play_192")?.conditionalAllowed, true);
  for (const ctx of [
    { ...base, childAgeMonths: 32 }, { ...base, availableMaterials: ["scissors", "paper"] as FilterInput["availableMaterials"] },
    { ...base, blockedMaterials: ["glue"] as FilterInput["blockedMaterials"] }, { ...base, availableMinutes: 1 }, { ...base, place: "outdoor" as const },
  ]) {
    const view = inspectRecommendation(plays, { ...ctx, intentReadiness: ready });
    assert.ok(!view.conditional.some((p) => p.id === "play_192"));
    assert.equal(view.rows.find((r) => r.play.id === "play_192")?.conditionalAllowed, false);
  }
  const ambiguous = inspectRecommendation(plays, { ...base, availableMaterials: ["scissors", "paper", "paint"], intentReadiness: ready });
  assert.equal(ambiguous.intent, null);
  assert.deepEqual(ambiguous.results, ambiguous.baseline);
  const modified = structuredClone(plays);
  modified.find((p) => p.id === "play_192")!.name += " 변경";
  assert.ok(!inspectRecommendation(modified, { ...base, intentReadiness: ready }).conditional.some((p) => p.id === "play_192"));
});
