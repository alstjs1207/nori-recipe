import test from "node:test";
import assert from "node:assert/strict";
import { recommendNextHomeRound, replacePendingHomeRecommendations } from "./homeRoundRecommendation";
import { loadLivePlays } from "@/data/content";
import { getConditionalIntentCandidates } from "./intentRecommendation";
import type { FilterInput, Play } from "@/types";
const template = loadLivePlays()[0];
function play(id: string, materials: Play['materials']['required'] = ["paper"]): Play { return { ...template, id, name: id, status: "live", ageMin: 12, ageMax: 48, durationMin: 5, durationMax: 10, materials: { required: materials, optional: [], substitutes: [] } }; }
const ctx: FilterInput = { childAgeMonths: 24, availableMaterials: ["water"], blockedMaterials: [], availableMinutes: 999, place: "any" };
const stats = { totalPlays: 2 };
for (const count of [0, 1, 2, 3, 4]) {
    test(`next round with ${count} alternatives repeats only the missing slots`, () => {
        const previous = [play("a", ["water"]), play("b", ["water"]), play("c", ["water"])];
        // Lower material fit must not let the just-completed round win again.
        const alternatives = Array.from({ length: count }, (_, i) => play(`new-${i}`));
        const result = recommendNextHomeRound([...previous, ...alternatives], ctx, { totalPlays: 3, recentCompletedPlayIds: ["a", "b", "c"] }, ["a", "b", "c"]);
        assert.equal(result.length, 3);
        assert.equal(new Set(result).size, 3);
        assert.equal(result.filter(id => id.startsWith("new-")).length, Math.min(count, 3));
    });
}
test("next round never fills unavailable alternatives or repeats by relaxing safety conditions", () => {
    const blocked = { ...ctx, blockedMaterials: ["balloon" as const] };
    const available = [play("a"), { ...play("b"), status: "archived" as const }, play("c", ["balloon"]), { ...play("future"), ageMin: 36 }, { ...play("old"), ageMax: 18 }, { ...play("draft"), status: "archived" as const }, play("blocked", ["balloon"])];
    assert.deepEqual(recommendNextHomeRound(available, blocked, stats, ["a", "b", "c"]), ["a"]);
});
test("alternative and repeat pools together allow at most one confirmed upper-age play", () => {
    const filter: FilterInput = { ...ctx, childAgeMonths: 33, availableMaterials: ["scissors", "paper", "glue", "cardboard", "crayon"], intentReadiness: { adultSupervision: true, productsAgeAppropriate: true, noMouthing: true, scissorSnipping: true } };
    const future = getConditionalIntentCandidates(loadLivePlays(), filter);
    assert.ok(future.length >= 2);
    const available = [future[0], future[1], play("a"), play("b"), play("alternative")];
    const previous = [future[0].id, "a", "b"];
    const result = recommendNextHomeRound(available, filter, stats, previous);
    assert.equal(result.length, 3);
    assert.ok(result.includes("alternative"));
    assert.ok(result.includes(future[1].id));
    assert.ok(!result.includes(future[0].id));
    assert.equal(available.filter(p => result.includes(p.id) && p.ageMin > 33).length, 1);
    const unconfirmed = recommendNextHomeRound(available, { ...filter, intentReadiness: undefined }, stats, previous);
    assert.deepEqual(new Set(unconfirmed), new Set(["alternative", "a", "b"]));
});
test("neither alternatives nor repeats bypass location and time restrictions", () => {
    const available = [play("a"), play("b"), play("c"), play("alternative")].map(p => ({ ...p, place: "indoor" as const }));
    for (const filter of [{ ...ctx, place: "outdoor" as const }, { ...ctx, availableMinutes: 1 }]) {
        assert.deepEqual(recommendNextHomeRound(available, filter, stats, ["a", "b", "c"]), []);
    }
});
test("A/B remain in their slots while C is replaced by D, even when the fixed plays do not use new materials", () => {
    const result = replacePendingHomeRecommendations([play("a"), play("b"), play("c"), play("d", ["water"])], ctx, stats, ["a", "b", "c"], new Set(["a", "b"]));
    assert.deepEqual(result, ["a", "b", "d"]);
});
test("one completed ID cannot occupy a pending candidate slot", () => {
    const result = replacePendingHomeRecommendations([play("a", ["water"]), play("b"), play("c"), play("d", ["water"])], ctx, stats, ["a", "b", "c"], new Set(["a"]));
    assert.equal(result[0], "a");
    assert.equal(result.length, 3);
    assert.equal(new Set(result).size, 3);
    assert.ok(result.includes("d"));
});
test("eligible alternatives may remain but unsafe/unpublished/age-ineligible candidates never fill a missing slot", () => {
    const available = [play("a"), play("b"), { ...play("c"), status: "archived" as const }, { ...play("d"), ageMin: 36 }, play("blocked", ["balloon"])];
    const filter = { ...ctx, blockedMaterials: ["balloon" as const] };
    assert.deepEqual(replacePendingHomeRecommendations(available, filter, stats, ["a", "b", "c"], new Set(["a"])), ["a", "b"]);
    assert.deepEqual(replacePendingHomeRecommendations(available.filter(p => p.id !== "b"), filter, stats, ["a", "b", "c"], new Set(["a"])), ["a"]);
});
