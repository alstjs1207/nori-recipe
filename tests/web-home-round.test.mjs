import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const project = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(project, "package.json"));
const { build } = createRequire(require.resolve("tsx"))("esbuild");
const ids = ["play_013", "play_016", "play_107"];
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nori-home-round-db-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const values = new Map();
  const key = `__homeRound${crypto.randomUUID()}`;
  let failKey = null;
  globalThis[key] = { storage: {
    async getItem(name) { return values.get(name) ?? null; },
    async setItem(name, value) { if (name === failKey) { failKey = null; throw new Error("storage failed"); } values.set(name, value); },
    async removeItem(name) { values.delete(name); },
  } };
  t.after(() => { delete globalThis[key]; });
  const outfile = path.join(directory, "round.mjs");
  await build({ stdin: { contents: `export {useHomeRecommendationStore as store} from ${JSON.stringify(path.join(project, "src/store/homeRecommendationStore.ts"))};export * from ${JSON.stringify(path.join(project, "src/db/queries.ts"))};export {useSessionStore as session} from ${JSON.stringify(path.join(project, "src/store/sessionStore.ts"))};export {usePlaysStore as plays} from ${JSON.stringify(path.join(project, "src/store/playsStore.ts"))};export {getHomeRoundRecords} from ${JSON.stringify(path.join(project, "src/store/homeRecommendationRound.ts"))};`, resolveDir: project }, outfile, bundle: true, platform: "node", format: "esm", plugins: [{ name: "local-web-db", setup(api) {
    api.onResolve({ filter: /^(?:@\/platform\/runtime|@\/db|react-native|expo-crypto)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    api.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents:
      args.path === "@/platform/runtime" ? `export const appRuntime={storage:globalThis[${JSON.stringify(key)}].storage};`
        : args.path === "react-native" ? 'export const Platform={OS:"web"};'
        : args.path === "expo-crypto" ? 'export {randomUUID} from "node:crypto";'
        : 'export async function initializeDatabase(){throw new Error("web must not load SQLite")}', loader: "ts", resolveDir: project }));
    api.onResolve({ filter: /^zustand$/ }, () => ({ path: require.resolve("zustand"), external: true }));
  } }] });
  const app = await import(pathToFileURL(outfile).href);
  await app.store.getState().hydrate("guest", { ids: [], key: null, records: [] });
  await app.store.getState().pin("guest", app.store.getState().round.id, ids, "materials");
  const completed = async () => {
    const round = app.store.getState().round;
    return app.getHomeRoundRecords(round, "guest", await app.getPlayLogsByIds("guest", round.records.map(record => record.id)));
  };
  return { ...app, completed, values, fail: name => { failKey = name; }, save: play => app.recordPlayFeedbackWithRecord("guest", play, 4, [], null) };
}

test("actual feedback DB keeps lifetime history while the same three plays start a fresh round", async t => {
  const f = await fixture(t);
  await f.save(ids[0]); await f.save(ids[1]);
  assert.equal((await f.completed()).length, 2);
  const oldRound = f.store.getState().round;
  await f.store.getState().hydrate("guest", { ids: [], key: null, records: [] });
  assert.deepEqual(f.store.getState().round, oldRound);
  assert.equal((await f.completed()).length, 2);
  await f.save(ids[2]); await f.save(ids[2]);
  assert.equal((await f.completed()).length, 3);
  assert.equal(await f.getPlayLogCount("guest"), 4);
  await f.store.getState().restart("guest");
  await f.store.getState().pin("guest", f.store.getState().round.id, ids, "materials");
  assert.equal((await f.completed()).length, 0);
  for (const play of ids) await f.save(play);
  assert.equal((await f.completed()).length, 3);
  assert.equal(await f.getPlayLogCount("guest"), 7);
  assert.equal((await f.getPlayLogsByIds("other", f.store.getState().round.records.map(record => record.id))).length, 0);
});

test("round-reference failure blocks the DB write; activity failure never produces a phantom stamp", async t => {
  const f = await fixture(t);
  f.fail("nori-recipe/home-recommendation-round-v1");
  await assert.rejects(f.save(ids[0]), /storage failed/);
  assert.equal(await f.getPlayLogCount("guest"), 0);
  assert.equal((await f.completed()).length, 0);
  f.fail("nori-recipe/web-db/play-logs");
  await assert.rejects(f.save(ids[0]), /storage failed/);
  assert.equal(await f.getPlayLogCount("guest"), 0);
  assert.equal((await f.completed()).length, 0);
  await f.save(ids[0]);
  assert.equal((await f.completed()).length, 1);
  await f.save("play_024"); // A record outside the pinned recommendations.
  assert.equal(await f.getPlayLogCount("guest"), 2);
  assert.equal((await f.completed()).length, 1);
  assert.deepEqual(f.store.getState().round.ids, ids);
  await f.resetUserActivity("guest");
  assert.equal(await f.getPlayLogCount("guest"), 0);
  assert.equal((await f.completed()).length, 0);
});

test("real material saves handle 0/1/2/3 completions and keep final A/B/D bundles across restarts", async t => {
  const f = await fixture(t);
  await f.plays.getState().loadPlays();
  const now = new Date();
  const context = {...await f.getUserContext("guest"), childBirthMonth: now.getFullYear()*12+now.getMonth()-33};
  f.session.setState({guestId:"guest",userContext:context,todayMaterials:["paper"]});
  await f.session.getState().setTodayMaterials(["paper","crayon"]);
  const initial = f.store.getState().round;
  assert.equal(initial.ids.length,3); assert.equal((await f.completed()).length,0);
  await f.save(initial.ids[0]);
  await f.session.getState().setTodayMaterials(["water","cup","spoon","bowl"]);
  assert.equal(f.store.getState().round.id,initial.id);
  assert.equal(f.store.getState().round.ids[0],initial.ids[0]);
  assert.equal((await f.completed()).length,1);
  await f.save(f.store.getState().round.ids[1]);
  const second = f.store.getState().round;
  await f.session.getState().setTodayMaterials(["block","ball"]);
  const third = f.store.getState().round;
  assert.deepEqual(third.ids.slice(0,2),second.ids.slice(0,2));
  assert.equal(new Set(third.ids).size,3); assert.equal((await f.completed()).length,2);
  assert.equal((await f.getCompletedPlayBundles("guest")).length,0);
  await f.save(third.ids[2]);
  const bundles = await f.getCompletedPlayBundles("guest");
  assert.equal(bundles.length,1); assert.deepEqual(bundles[0].ids,third.ids);
  await f.save(third.ids[2]); assert.deepEqual(await f.getCompletedPlayBundles("guest"),bundles);
  await f.session.getState().setTodayMaterials(["block","ball"]);
  assert.notEqual(f.store.getState().round.id,third.id); assert.equal((await f.completed()).length,0);
  assert.deepEqual(await f.getCompletedPlayBundles("guest"),bundles);
  for(const id of f.store.getState().round.ids) await f.save(id);
  assert.equal((await f.getCompletedPlayBundles("guest")).length,2);
  assert.equal((await f.getCompletedPlayBundles("other")).length,0);
  await f.resetUserActivity("guest"); assert.deepEqual(await f.getCompletedPlayBundles("guest"),[]);
});

test("failed third writes cannot create albums; failed edits preserve materials and progress",async t=>{
  const f=await fixture(t); await f.plays.getState().loadPlays();
  const now=new Date();
  f.session.setState({guestId:"guest",userContext:{...await f.getUserContext("guest"),childBirthMonth:now.getFullYear()*12+now.getMonth()-33},todayMaterials:["paper"]});
  await f.save(ids[0]); await f.save(ids[1]);
  f.fail("nori-recipe/web-db/play-logs"); await assert.rejects(f.save(ids[2]));
  assert.deepEqual(await f.getCompletedPlayBundles("guest"),[]);
  const before=f.store.getState().round;
  f.fail("nori-recipe/home-recommendation-round-v1");
  await assert.rejects(f.session.getState().setTodayMaterials(["water"]));
  assert.equal(f.store.getState().round,before); assert.deepEqual(f.session.getState().todayMaterials,["paper"]);
  assert.equal((await f.completed()).length,2);
  await f.save(ids[2]); assert.equal((await f.getCompletedPlayBundles("guest")).length,1);
});

for (const count of [0, 1, 2, 3]) {
  test(`completed-round material save uses ${count} alternatives and preserves lifetime records`, async t => {
    const f = await fixture(t);
    await f.plays.getState().loadPlays();
    const template = f.plays.getState().plays[0];
    const candidates = [...ids, ...Array.from({ length: count }, (_, i) => `alternative_${i}`)].map(id => ({
      ...template, id, name: id, status: "live", ageMin: 12, ageMax: 48,
      durationMin: 5, durationMax: 10, materials: { required: ["water"], optional: [], substitutes: [] },
    }));
    f.plays.setState({ plays: candidates });
    const now = new Date();
    f.session.setState({ guestId: "guest", userContext: { ...await f.getUserContext("guest"), childBirthMonth: now.getFullYear() * 12 + now.getMonth() - 24 }, todayMaterials: ["water"] });
    for (const id of ids) await f.save(id);
    const before = f.store.getState().round;
    const bundles = await f.getCompletedPlayBundles("guest");
    if (count === 3) {
      f.fail("nori-recipe/home-recommendation-round-v1");
      await assert.rejects(f.session.getState().setTodayMaterials(["water"]));
      assert.deepEqual(f.store.getState().round, before);
      assert.equal((await f.completed()).length, 3);
    }
    await f.session.getState().setTodayMaterials(["water"]);
    const next = f.store.getState().round;
    assert.notEqual(next.id, before.id);
    assert.equal(next.ids.length, 3);
    assert.equal(next.ids.filter(id => !ids.includes(id)).length, count);
    assert.equal(new Set(next.ids).size, 3);
    assert.equal((await f.completed()).length, 0);
    assert.deepEqual(await f.getCompletedPlayBundles("guest"), bundles);
    assert.equal(await f.getPlayLogCount("guest"), 3);
  });
}

test("reopening uses atomic round materials including null instead of stale legacy keys",async t=>{
 const f=await fixture(t); await f.plays.getState().loadPlays();
 const now=new Date(); const context={...await f.getUserContext("guest"),childBirthMonth:now.getFullYear()*12+now.getMonth()-33,ownedMaterials:["paper","crayon"]};
 await f.upsertUserContext("guest",context);
 f.session.setState({guestId:"guest",userContext:context,todayMaterials:["water"]});
 f.values.set("nori-recipe/guest-id","guest"); f.values.set("nori-recipe/today-materials",JSON.stringify(["water"]));
 await f.session.getState().setTodayMaterials(null);
 const before=f.store.getState().round;
 f.session.setState({status:"idle",todayMaterials:["water"]}); f.store.setState({round:null});
 await f.session.getState().initSession();
 assert.equal(f.session.getState().todayMaterials,null);
 assert.deepEqual(f.store.getState().round.ids,before.ids);
 assert.deepEqual(f.store.getState().round.records,before.records);
});
