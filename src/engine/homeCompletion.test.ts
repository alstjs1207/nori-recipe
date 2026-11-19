import assert from "node:assert/strict";
import test from "node:test";
import { createHomeCompletionCelebration } from "./homeCompletion";

const ids = ["a", "b", "c"];
const records = ids.map((playId, index) => ({ id: `record-${index}`, playId }));

test("third distinct recommendation save celebrates once, including after home remount", () => {
  const celebration = createHomeCompletionCelebration();
  celebration.saved("guest", records[2], ids, "round");
  assert.equal(celebration.consume("guest", ids, records, "round"), true);
  // Search, another tab, back, or a fresh mounted home all share the consumed event.
  assert.equal(celebration.consume("guest", ids, records, "round"), false);
  assert.equal(createHomeCompletionCelebration().consume("guest", ids, records, "round"), false);
});

test("first and second saves do not celebrate; the third still does", () => {
  const celebration = createHomeCompletionCelebration();
  records.forEach((record, index) => {
    celebration.saved("guest", record, ids, "round");
    assert.equal(celebration.consume("guest", ids, records.slice(0, index + 1), "round"), index === 2);
  });
});

test("existing completed history and repeated feedback do not replay confetti", () => {
  const celebration = createHomeCompletionCelebration();
  assert.equal(celebration.consume("guest", ids, records, "round"), false);
  const repeat = { id: "repeat", playId: "c" };
  celebration.saved("guest", repeat, ids, "round");
  assert.equal(celebration.consume("guest", ids, [...records, repeat], "round"), false);
});

test("new recommendation set can celebrate its own third completion", () => {
  const celebration = createHomeCompletionCelebration();
  celebration.saved("guest", records[2], ids, "round");
  assert.equal(celebration.consume("guest", ids, records, "round"), true);
  const next = { id: "record-d", playId: "d" };
  const nextIds = ["a", "b", "d"];
  celebration.saved("guest", next, nextIds, "round");
  assert.equal(celebration.consume("guest", nextIds, [...records, next], "round"), true);
});

test("unrelated save, changed set, different guest, incomplete load and invalid sets consume without celebration", () => {
  const cases = [
    { saved: { id: "other", playId: "other" }, currentIds: ids, currentRecords: [...records, { id: "other", playId: "other" }], guest: "guest" },
    { saved: records[2], currentIds: ["a", "b", "d"], currentRecords: records, guest: "guest" },
    { saved: records[2], currentIds: ids, currentRecords: records, guest: "other-guest" },
    { saved: records[2], currentIds: ids, currentRecords: records.slice(0, 2), guest: "guest" },
    { saved: records[2], currentIds: ids, currentRecords: [], guest: "guest" },
    { saved: records[2], currentIds: ["a", "b"], currentRecords: records, guest: "guest" },
    { saved: records[2], currentIds: ["a", "c", "c"], currentRecords: records, guest: "guest" },
  ];
  for (const item of cases) {
    const celebration = createHomeCompletionCelebration();
    celebration.saved("guest", item.saved, ids, "round");
    assert.equal(celebration.consume(item.guest, item.currentIds, item.currentRecords, "round"), false);
    assert.equal(celebration.consume("guest", ids, records, "round"), false);
  }
});


test("a late save cannot celebrate a new round with identical recommendation IDs", () => {
  const celebration = createHomeCompletionCelebration();
  celebration.saved("guest", records[2], ids, "old-round");
  assert.equal(celebration.consume("guest", ids, records, "new-round"), false);
});
