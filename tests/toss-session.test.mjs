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

test("실제 세션 스토어는 최초 저장소 실패 후 재시도하고 원래 guestId·프로필을 유지한다", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nori-toss-session-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const values = new Map([["nori-recipe/guest-id", "keep-existing-guest"], ["nori-recipe/onboarding-child-name", "별명"], ["nori-recipe/onboarding-complete", "true"]]);
  let failing = true;
  const key = `__tossSessionTest${Date.now()}`;
  globalThis[key] = {
    storage: {
      async getItem(name) { if (failing) throw new Error("storage failed"); return values.get(name) ?? null; },
      async setItem(name, value) { values.set(name, value); }, async removeItem(name) { values.delete(name); },
    },
  };
  t.after(() => { delete globalThis[key]; });
  const outfile = path.join(directory, "session.mjs");
  await build({ entryPoints: [path.join(project, "src/store/sessionStore.ts")], outfile, bundle: true, platform: "node", format: "esm", plugins: [{ name: "isolated-storage", setup(api) {
    api.onResolve({ filter: /^(?:@\/platform\/runtime|@\/db\/queries|@\/analytics\/analytics|expo-crypto)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    api.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
      const contents = args.path === "@/platform/runtime" ? `export const appRuntime={storage:globalThis[${JSON.stringify(key)}].storage};`
        : args.path === "@/db/queries" ? `import { DEFAULT_USER_CONTEXT } from ${JSON.stringify(path.join(project, "src/types/index.ts"))};export async function getUserContext(){return DEFAULT_USER_CONTEXT}export async function upsertUserContext(id,context){return context}export async function deleteAllUserData(){}export async function getLatestPlayLog(){return null}export async function getPlayLogs(){return []}export async function getPlayLogsByIds(){return []}`
        : args.path === "expo-crypto" ? 'export { randomUUID } from "node:crypto";' : 'export function resetAnalyticsConsent(){}';
      return { contents, loader: "ts", resolveDir: project };
    });
    api.onResolve({ filter: /^zustand$/ }, () => ({ path: require.resolve("zustand"), external: true }));
  } }] });
  const { useSessionStore } = await import(pathToFileURL(outfile).href);
  await useSessionStore.getState().initSession();
  assert.equal(useSessionStore.getState().status, "error");
  assert.match(useSessionStore.getState().error, /storage failed/);
  failing = false;
  await useSessionStore.getState().initSession();
  assert.equal(useSessionStore.getState().status, "ready");
  assert.equal(useSessionStore.getState().guestId, "keep-existing-guest");
  assert.equal(useSessionStore.getState().childName, "별명");
  assert.equal(useSessionStore.getState().onboardingCompleted, true);
});
