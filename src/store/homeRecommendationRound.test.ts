import assert from "node:assert/strict";
import test from "node:test";
import { createHomeRecommendationStore, getCompletedHomeBundles, getHomeRoundRecords, HOME_ROUND_STORAGE_KEY, parseHomeRound } from "./homeRecommendationRound";
import { createHomeCompletionCelebration } from "@/engine/homeCompletion";

const ids = ["a", "b", "c"];
const oldLogs = ids.map((playId, i) => ({ id: `old-${i}`, playId, guestId: "guest", completedAt: "2026-11-18T10:00:00.000Z" }));
function fixture() {
  const data = new Map<string, string>();
  let fail = false;
  let next = 0;
  const storage = {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { if (fail) throw new Error("storage full"); data.set(key, value); },
  };
  const make = () => createHomeRecommendationStore(storage, () => `round-${++next}`);
  return { data, make, store: make(), fail: (value: boolean) => { fail = value; } };
}
const empty = { ids: [], key: null, records: [] };

test("legacy 2/3 migrates once and survives next-day reload without using a date key", async () => {
  const f = fixture();
  await f.store.getState().hydrate("guest", { ids, key: "materials", records: oldLogs.slice(0, 2) });
  const round = f.store.getState().round!;
  assert.equal(getHomeRoundRecords(round, "guest", oldLogs).length, 2);
  const reloaded = f.make();
  await reloaded.getState().hydrate("guest", empty);
  assert.deepEqual(reloaded.getState().round, round);
  assert.equal(getHomeRoundRecords(reloaded.getState().round, "guest", oldLogs).length, 2);
});

test("same materials and identical play IDs start 0/3 in each explicitly restarted round", async () => {
  const f = fixture();
  await f.store.getState().hydrate("guest", { ids, key: "materials", records: oldLogs });
  const before = f.store.getState().round!;
  await f.store.getState().restart("guest");
  const restarted = f.store.getState().round!;
  await f.store.getState().pin("guest", restarted.id, ids, "materials");
  assert.notEqual(restarted.id, before.id);
  assert.deepEqual(f.store.getState().round?.ids, ids);
  assert.equal(getHomeRoundRecords(f.store.getState().round, "guest", oldLogs).length, 0);
  assert.equal(oldLogs.length, 3); // Historical records are never mutated.
  const reloaded = f.make();
  await reloaded.getState().hydrate("guest", { ids, key: "materials", records: oldLogs });
  assert.equal(getHomeRoundRecords(reloaded.getState().round, "guest", oldLogs).length, 0);
});

test("two rounds of repeated plays each celebrate once; duplicate feedback stays one completed play", async () => {
  const f = fixture();
  const history = [...oldLogs];
  const celebration = createHomeCompletionCelebration();
  await f.store.getState().hydrate("guest", empty);
  for (let iteration = 0; iteration < 2; iteration++) {
    if (iteration) await f.store.getState().restart("guest");
    const id = f.store.getState().round!.id;
    await f.store.getState().pin("guest", id, ids, "same-materials");
    for (const [index, playId] of ids.entries()) {
      // Intentionally identical timestamps: record identity defines the round.
      const record = { ...oldLogs[index], id: `${iteration}-${playId}` };
      await f.store.getState().stage("guest", id, record);
      history.unshift(record);
      const completed = getHomeRoundRecords(f.store.getState().round, "guest", history);
      celebration.saved("guest", record, ids, id);
      assert.equal(new Set(completed.map(item => item.playId)).size, index + 1);
      assert.equal(celebration.consume("guest", ids, completed, id), index === 2);
      assert.equal(celebration.consume("guest", ids, completed, id), false);
    }
    const repeat = { ...oldLogs[2], id: `repeat-${iteration}` };
    history.unshift(repeat); // Repeated successful feedback need not be assigned again.
    const completed = getHomeRoundRecords(f.store.getState().round, "guest", history);
    celebration.saved("guest", repeat, ids, id);
    assert.equal(celebration.consume("guest", ids, completed, id), false);
    assert.equal(new Set(completed.map(record => record.playId)).size, 3);
  }
  assert.equal(history.length, 11);
});

test("failed activity write, unrelated history, deleted rows and foreign guests cannot create stamps", async () => {
  const f = fixture(); await f.store.getState().hydrate("guest", empty);
  const id = f.store.getState().round!.id;
  await f.store.getState().pin("guest", id, ids, "key");
  const pending = { id: "pending", playId: "a", guestId: "guest" };
  await f.store.getState().stage("guest", id, pending);
  const round = f.store.getState().round!;
  assert.deepEqual(getHomeRoundRecords(round, "guest", oldLogs), []);
  assert.deepEqual(getHomeRoundRecords(round, "guest", [{ ...pending, guestId: "other" }]), []);
  assert.deepEqual(getHomeRoundRecords(round, "other", [pending]), []);
  assert.deepEqual(getHomeRoundRecords(round, "guest", [{ ...pending, playId: "b" }]), []);
  assert.deepEqual(getHomeRoundRecords(round, "guest", []), []); // DB excludes tombstones.
  const restored = f.make(); await restored.getState().hydrate("guest", empty);
  assert.deepEqual(getHomeRoundRecords(restored.getState().round, "guest", [pending]), [pending]);
});

test("storage failure preserves the last durable round and the queue remains usable", async () => {
  const f = fixture(); await f.store.getState().hydrate("guest", { ids, key: "key", records: oldLogs.slice(0, 2) });
  const before = f.store.getState().round!;
  const durable = f.data.get(HOME_ROUND_STORAGE_KEY);
  f.fail(true);
  await assert.rejects(f.store.getState().restart("guest"), /storage full/);
  await assert.rejects(f.store.getState().stage("guest", before.id, { id: "new", playId: "c" }), /storage full/);
  assert.equal(f.store.getState().round, before);
  assert.equal(f.data.get(HOME_ROUND_STORAGE_KEY), durable);
  f.fail(false);
  await f.store.getState().restart("guest");
  assert.notEqual(f.store.getState().round?.id, before.id);
});

test("stale pin/save operations cannot resurrect a previous round after reset", async () => {
  const f = fixture(); await f.store.getState().hydrate("guest", { ids, key: "key", records: oldLogs });
  const before = f.store.getState().round!;
  await Promise.all([
    f.store.getState().restart("guest"),
    f.store.getState().pin("guest", before.id, ids, "stale"),
    f.store.getState().stage("guest", before.id, { id: "late-save", playId: "a" }),
  ]);
  assert.deepEqual(f.store.getState().round?.ids, []);
  assert.deepEqual(f.store.getState().round?.records, []);
});

test("ineligible-content repair retains progress for retained IDs but never imports replacement history", async () => {
  const f = fixture(); await f.store.getState().hydrate("guest", { ids, key: "key", records: oldLogs.slice(0, 2) });
  const id = f.store.getState().round!.id;
  await f.store.getState().pin("guest", id, ["a", "c", "d"], "updated-age-or-content");
  const round = f.store.getState().round!;
  assert.equal(round.id, id);
  assert.deepEqual(getHomeRoundRecords(round, "guest", [...oldLogs, { ...oldLogs[2], id: "old-d", playId: "d" }]).map(log => log.playId), ["a"]);
});

test("corrupt/foreign round data does not leak and an empty persisted new round overrides legacy history", async () => {
  const f = fixture();
  assert.equal(parseHomeRound("broken", "guest"), null);
  await f.store.getState().hydrate("guest", { ids, key: "key", records: oldLogs });
  assert.equal(parseHomeRound(f.data.get(HOME_ROUND_STORAGE_KEY)!, "other"), null);
  const other = f.make(); await other.getState().hydrate("other", empty);
  assert.deepEqual(other.getState().round?.records, []);
  assert.equal(other.getState().round?.guestId, "other");
});

test("material edits preserve completed slots, reject stale same-round pins and commit context atomically", async () => {
  const f = fixture(); await f.store.getState().hydrate("guest", { ids, key: "paper", records: oldLogs.slice(0,2) });
  const before = f.store.getState().round!;
  const change = () => f.store.getState().edit("guest", async () => ({ ids: ["a","b","d"], key: "water", records: oldLogs.slice(0,2), context: { materials: ["water"], confirmation: null }, startNew: false }));
  f.fail(true); await assert.rejects(change(), /storage full/); assert.equal(f.store.getState().round, before);
  f.fail(false); await change();
  const after = f.store.getState().round!;
  assert.equal(after.id, before.id); assert.deepEqual(after.ids, ["a","b","d"]); assert.equal(after.revision, 1);
  assert.deepEqual(after.context?.materials, ["water"]);
  await f.store.getState().pin("guest", before.id, ids, "stale", 0);
  assert.equal(f.store.getState().round, after);
  const reload = f.make(); await reload.getState().hydrate("guest", empty);
  assert.deepEqual(reload.getState().round?.context, after.context);
  assert.equal(getHomeRoundRecords(reload.getState().round,"guest",oldLogs).length, 2);
});

test("queued material edits retain the newest context and completed references", async () => {
  const f=fixture(); await f.store.getState().hydrate("guest",{ids,key:"paper",records:oldLogs.slice(0,1)});
  const edit=(key: string)=>f.store.getState().edit("guest", async round=>({ids:["a",key,"c"],key,records:round.records,context:{materials:["water"],confirmation:null},startNew:false}));
  await Promise.all([edit("first"),edit("latest")]);
  assert.equal(f.store.getState().round?.key,"latest"); assert.equal(f.store.getState().round?.revision,2);
  assert.deepEqual(f.store.getState().round?.records,oldLogs.slice(0,1).map(({id,playId})=>({id,playId})));
});

test("bundles use exact final IDs and final completion date, survive next rounds, and exclude staged or deleted activity",async()=>{
 const f=fixture(); await f.store.getState().hydrate("guest",{ids,key:"key",records:oldLogs.slice(0,2)});
 const previous=f.store.getState().round!;
 await f.store.getState().edit("guest",async()=>({ids:["a","b","d"],key:"water",records:previous.records,context:{materials:["water"],confirmation:null},startNew:false}));
 const d={...oldLogs[2],id:"new-d",playId:"d",completedAt:"2026-11-21T10:00:00.000Z"};
 await f.store.getState().stage("guest",previous.id,d);
 assert.deepEqual(getCompletedHomeBundles(f.store.getState().round,"guest",oldLogs),[]);
 const history=[...oldLogs,d];
 const bundles=getCompletedHomeBundles(f.store.getState().round,"guest",history);
 assert.deepEqual(bundles,[{id:previous.id,ids:["a","b","d"],completedAt:d.completedAt}]);
 await f.store.getState().restart("guest");
 assert.deepEqual(getCompletedHomeBundles(f.store.getState().round,"guest",history),bundles);
 assert.deepEqual(getCompletedHomeBundles(f.store.getState().round,"other",history),[]);
 assert.deepEqual(getCompletedHomeBundles(f.store.getState().round,"guest",history.filter(r=>r.playId!=="a")),[]);
 const reload=f.make(); await reload.getState().hydrate("guest",empty);
 assert.deepEqual(getCompletedHomeBundles(reload.getState().round,"guest",history),bundles);
});
