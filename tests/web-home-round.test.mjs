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
  await build({ stdin: { contents: `export {useHomeRecommendationStore as store} from ${JSON.stringify(path.join(project, "src/store/homeRecommendationStore.ts"))};export * from ${JSON.stringify(path.join(project, "src/db/queries.ts"))};export {getHomeRoundRecords} from ${JSON.stringify(path.join(project, "src/store/homeRecommendationRound.ts"))};`, resolveDir: project }, outfile, bundle: true, platform: "node", format: "esm", plugins: [{ name: "local-web-db", setup(api) {
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
