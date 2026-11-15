import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { main } from "../scripts/migrate-play-images.mjs";
import { imageInfo, createManifest, validateResults } from "../scripts/review/review-core.mjs";
import { sha256, safePath, writeJson } from "../scripts/play-image-storage/files.mjs";
import { planMigration, validatePlan } from "../scripts/play-image-storage/manifest.mjs";
import { migrate, restore, DEFAULT_PUBLIC, DEFAULT_STATE } from "../scripts/play-image-storage/migration.mjs";
import { directoryStore, supabaseStore } from "../scripts/play-image-storage/stores.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const read = (root, name) => fs.readFileSync(path.join(root, name));
const json = (root, name) => JSON.parse(read(root, name));
const put = (root, name, value) => { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), value); };
function snapshot(root, prefix = "") {
  return Object.fromEntries(fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git") return [];
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? Object.entries(snapshot(root, name)) : [[name, sha256(read(root, name))]];
  }));
}

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nori-storage-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const registry = json(project, "data/materials.json");
  const sample = json(project, "data/plays.json").plays.find((play) => play.id === "play_013");
  const plays = ["live", "draft", "archived", "live", "live"].map((status, i) => ({ ...structuredClone(sample),
    id: `play_${301 + i}`, name: `fixture ${i}`, status, ...(i === 3 ? { imageStatus: "review" } : {}) }));
  const bundle = { version: "1.0.0", updatedAt: "2026-11-15", plays };
  put(root, "data/plays.json", JSON.stringify(bundle)); put(root, "data/materials.json", JSON.stringify(registry));
  const bytes = await sharp({ create: { width: 512, height: 512, channels: 3, background: "#ffaa88" } }).jpeg().toBuffer();
  for (const play of plays) put(root, `images/plays/${play.id}.jpeg`, bytes);
  put(root, "src/constants/playImages.ts", "original mappings");
  put(root, "results/local-review/state.json", JSON.stringify({ decisions: ["held", "approved"], comment: "보존할 검수 의견" }));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } });
  git("init", "-q"); git("add", "data", "images", "src");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "-qm", "approved fixture baseline");
  const directory = path.join(root, "objects"); fs.mkdirSync(directory);
  const store = directoryStore(directory);
  const settings = { originalBucket: "private-fixture", publicBucket: "public-fixture" };
  const plan = await planMigration(root, settings);
  const saveBundle = () => put(root, "data/plays.json", JSON.stringify(bundle));
  return { root, bytes, bundle, registry, directory, store, settings, plan, saveBundle };
}

test("deterministic full hashes, versioned paths and dry-run leave sources and store untouched", async (t) => {
  const f = await fixture(t), before = snapshot(f.root);
  assert.deepEqual(await planMigration(f.root, f.settings), f.plan);
  for (const entry of f.plan.entries) {
    assert.equal(entry.original.sha256, imageInfo(f.root, entry.id).hash);
    assert.match(entry.version, /^[a-f0-9]{64}$/);
    assert.match(entry.detail.path, new RegExp(`^${entry.id}/${entry.version}/detail.webp$`));
  }
  const hostile = { identity: "unused", get() { throw Error("must not read store"); }, create() { throw Error("must not write"); } };
  const result = await migrate(f.root, f.plan, hostile);
  assert.ok(result.results.every((entry) => entry.status === "planned"));
  assert.deepEqual(result.publicManifest.entries, {});
  assert.deepEqual(snapshot(f.root), before);
});

test("missing, truncated and non-JPEG sources cannot produce a plan or overwrite any source", async (t) => {
  const f = await fixture(t), target = "images/plays/play_301.jpeg";
  fs.unlinkSync(path.join(f.root, target));
  await assert.rejects(planMigration(f.root, f.settings), /MISSING/);
  for (const bytes of [Buffer.from("not jpeg"), f.bytes.subarray(0, 100)]) {
    put(f.root, target, bytes);
    await assert.rejects(planMigration(f.root, f.settings), /CORRUPT_IMAGE/);
    assert.deepEqual(read(f.root, target), bytes);
  }
  assert.equal(fs.existsSync(path.join(f.root, "generated")), false);
});

test("only baseline-approved live derivatives upload; private originals and approval hashes survive", async (t) => {
  const f = await fixture(t), sources = snapshot(f.root, "images"), data = read(f.root, "data/plays.json"), review = read(f.root, "results/local-review/state.json");
  const result = await migrate(f.root, f.plan, f.store, { write: true });
  assert.ok(result.results.every((entry) => entry.status === "verified"));
  assert.deepEqual(Object.keys(result.publicManifest.entries), ["play_301", "play_305"]);
  for (const entry of f.plan.entries) {
    assert.deepEqual(await f.store.get(f.plan.buckets.original, entry.original.path), f.bytes);
    assert.equal((await f.store.get(f.plan.buckets.public, entry.detail.path)) !== null, ["play_301", "play_305"].includes(entry.id));
    assert.equal(entry.approval?.imageHash ?? null, ["play_301", "play_305"].includes(entry.id) ? sha256(f.bytes) : null);
  }
  const publicJson = JSON.stringify(result.publicManifest);
  assert.doesNotMatch(publicJson, /private-fixture|original\.jpeg|approval|serviceRole|signed|commit/);
  assert.deepEqual(snapshot(f.root, "images"), sources);
  assert.deepEqual(read(f.root, "data/plays.json"), data);
  assert.deepEqual(read(f.root, "results/local-review/state.json"), review);
  const before = snapshot(f.directory);
  let creates = 0;
  const repeat = { ...f.store, async create(...args) { creates++; return f.store.create(...args); } };
  await migrate(f.root, f.plan, repeat, { write: true });
  assert.equal(creates, 0);
  assert.deepEqual(snapshot(f.directory), before);
});

test("partial success is checkpointed, failed IDs do not activate, and replay verifies actual objects", async (t) => {
  const f = await fixture(t);
  const broken = { ...f.store, async create(bucket, object, ...rest) {
    if (object.endsWith("thumbnail.webp")) throw Error("secret-credential must not reach report");
    return f.store.create(bucket, object, ...rest);
  } };
  const partial = await migrate(f.root, f.plan, broken, { write: true });
  assert.equal(partial.results.filter((entry) => entry.status === "failed").length, 2);
  assert.deepEqual(partial.publicManifest.entries, {});
  assert.equal(json(f.root, DEFAULT_STATE).objects[`${f.plan.buckets.original}/${f.plan.entries[0].original.path}`].verified, true);
  assert.doesNotMatch(JSON.stringify(partial), /secret-credential/);
  const created = [];
  await migrate(f.root, f.plan, { ...f.store, async create(bucket, object, ...rest) { created.push(object); return f.store.create(bucket, object, ...rest); } }, { write: true });
  assert.deepEqual(created.map((item) => item.split("/").at(-1)), ["thumbnail.webp", "thumbnail.webp"]);
  assert.equal(Object.keys(json(f.root, DEFAULT_PUBLIC).entries).length, 2);
  // A checkpoint is not evidence that a remote object is still valid.
  const entry = f.plan.entries[0], objectFile = path.join(f.directory, f.plan.buckets.public, entry.detail.path);
  const bad = Buffer.from("corrupt object"); fs.writeFileSync(objectFile, bad);
  const failed = await migrate(f.root, f.plan, f.store, { write: true });
  assert.equal(failed.results[0].code, "INTEGRITY");
  assert.equal(failed.publicManifest.entries.play_301, undefined);
  assert.deepEqual(fs.readFileSync(objectFile), bad);
});

test("a changed original or content cannot reuse a plan or establish its own approval", async (t) => {
  const f = await fixture(t);
  const replacement = await sharp({ create: { width: 512, height: 512, channels: 3, background: "#445566" } }).jpeg().toBuffer();
  put(f.root, "images/plays/play_301.jpeg", replacement);
  await assert.rejects(planMigration(f.root, f.settings), /REVIEW_REQUIRED/);
  const result = await migrate(f.root, f.plan, f.store, { write: true });
  assert.equal(result.results[0].status, "failed");
  assert.equal(await f.store.get(f.plan.buckets.public, f.plan.entries[0].detail.path), null);
  assert.deepEqual(read(f.root, "images/plays/play_301.jpeg"), replacement);
  put(f.root, "images/plays/play_301.jpeg", f.bytes);
  f.bundle.plays[0].tip += " 변경"; f.saveBundle();
  await assert.rejects(planMigration(f.root, f.settings), /REVIEW_REQUIRED/);
});

test("conflicting original objects are never overwritten; verified IDs and prior good candidates survive another ID's failure", async (t) => {
  const f = await fixture(t), entry = f.plan.entries[0];
  const conflict = Buffer.from("different original at the same immutable path");
  put(f.directory, `${f.plan.buckets.original}/${entry.original.path}`, conflict);
  const first = await migrate(f.root, f.plan, f.store, { write: true });
  assert.equal(first.results[0].code, "INTEGRITY");
  assert.equal(first.publicManifest.entries.play_301, undefined);
  assert.ok(first.publicManifest.entries.play_305);
  assert.deepEqual(await f.store.get(f.plan.buckets.original, entry.original.path), conflict);
  const good = first.publicManifest.entries.play_305;
  const failing = { ...f.store, async get() { throw Error("temporary failure"); } };
  const retry = await migrate(f.root, f.plan, failing, { write: true });
  assert.deepEqual(retry.publicManifest.entries.play_305, good);
  assert.deepEqual(read(f.root, "images/plays/play_301.jpeg"), f.bytes);
});

test("a crash after creation retains the object and unverified checkpoint for safe restart", async (t) => {
  const f = await fixture(t), entry = f.plan.entries[0];
  let created = false;
  const broken = { ...f.store, async create(...args) { const result = await f.store.create(...args); created = true; return result; },
    async get(bucket, object) { if (created) throw Error("download interrupted"); return f.store.get(bucket, object); } };
  const report = await migrate(f.root, f.plan, broken, { write: true });
  assert.equal(report.results[0].status, "failed");
  assert.equal(json(f.root, DEFAULT_STATE).objects[`${f.plan.buckets.original}/${entry.original.path}`].verified, false);
  assert.deepEqual(await f.store.get(f.plan.buckets.original, entry.original.path), f.bytes);
  const resumed = await migrate(f.root, f.plan, f.store, { write: true });
  assert.ok(resumed.results.every((item) => item.status === "verified"));
});

test("public projection whitelists fields and state cannot be reused against a different target", async (t) => {
  const f = await fixture(t);
  await migrate(f.root, f.plan, f.store, { write: true });
  const publicManifest = json(f.root, DEFAULT_PUBLIC);
  publicManifest.secret = "sensitive";
  publicManifest.entries.play_301.original = { path: "private-path" };
  publicManifest.entries.play_301.detail.token = "signed-token";
  writeJson(f.root, DEFAULT_PUBLIC, publicManifest);
  const report = await migrate(f.root, f.plan, f.store, { write: true });
  assert.doesNotMatch(JSON.stringify(report.publicManifest), /sensitive|private-path|signed-token/);
  const before = snapshot(f.root, "generated");
  await assert.rejects(migrate(f.root, f.plan, { ...f.store, identity: "different-target" }, { write: true }), /CONFLICT/);
  assert.deepEqual(snapshot(f.root, "generated"), before);
});

test("a lost upload response still leaves a cleanup candidate after concurrent revocation", async (t) => {
  const f = await fixture(t), entry = f.plan.entries[0];
  const uncertain = { ...f.store, async create(bucket, object, ...rest) {
    const result = await f.store.create(bucket, object, ...rest);
    if (object === entry.detail.path) {
      f.bundle.plays[0].status = "draft"; f.saveBundle();
      throw Error("response lost after object creation");
    }
    return result;
  } };
  const result = await migrate(f.root, f.plan, uncertain, { write: true });
  assert.equal(result.results[0].status, "failed");
  assert.equal(result.publicManifest.entries.play_301, undefined);
  assert.ok(result.cleanup.some((item) => item.path === entry.detail.path));
  assert.ok(await f.store.get(f.plan.buckets.public, entry.detail.path));
});

test("status changes during transfer prevent activation and preserve original and completed objects", async (t) => {
  const f = await fixture(t), entry = f.plan.entries[0];
  const changing = { ...f.store, async create(bucket, object, ...rest) {
    const created = await f.store.create(bucket, object, ...rest);
    if (object === entry.detail.path) { f.bundle.plays[0].imageStatus = "review"; f.saveBundle(); }
    return created;
  } };
  const result = await migrate(f.root, f.plan, changing, { write: true });
  assert.equal(result.results[0].status, "failed");
  assert.equal(result.publicManifest.entries[entry.id], undefined);
  assert.equal(await f.store.get(f.plan.buckets.public, entry.thumbnail.path), null);
  assert.ok(await f.store.get(f.plan.buckets.public, entry.detail.path));
  assert.ok(result.cleanup.some((item) => item.path === entry.detail.path));
  assert.deepEqual(read(f.root, "images/plays/play_301.jpeg"), f.bytes);
});

test("draft, archived and review transitions remove public candidates and generate cleanup without deleting objects", async (t) => {
  for (const status of ["draft", "archived", "review"]) {
    const f = await fixture(t), entry = f.plan.entries[0];
    await migrate(f.root, f.plan, f.store, { write: true });
    if (status === "review") f.bundle.plays[0].imageStatus = "review";
    else f.bundle.plays[0].status = status;
    f.saveBundle();
    const nextPlan = await planMigration(f.root, f.settings);
    const result = await migrate(f.root, nextPlan, f.store, { write: true });
    assert.equal(result.publicManifest.entries.play_301, undefined);
    assert.equal(result.cleanup.filter((item) => item.id === "play_301").length, 2);
    assert.ok(await f.store.get(f.plan.buckets.public, entry.detail.path));
    const repeat = await migrate(f.root, nextPlan, f.store, { write: true });
    assert.equal(repeat.cleanup.filter((item) => item.id === "play_301").length, 2);
  }
});

test("download verification restores exact original without changing review results; conflicts and corruption preserve files", async (t) => {
  const f = await fixture(t);
  await migrate(f.root, f.plan, f.store, { write: true });
  const review = read(f.root, "results/local-review/state.json");
  const batch = { schemaVersion: 1, batchId: "restore-fixture", playIds: ["play_301"] };
  const before = createManifest(f.root, batch, f.bundle, f.registry);
  const results = { schemaVersion: 2, batchId: batch.batchId, batchHash: before.batchHash, materialRecords: [],
    records: before.entries.map((entry) => ({ ...entry, decision: "approved", comment: "", contentReviewed: true, imageReviewed: true })) };
  fs.unlinkSync(path.join(f.root, "images/plays/play_301.jpeg"));
  const dry = await restore(f.root, f.plan, f.store, { ids: ["play_301"] });
  assert.equal(dry.results[0].status, "planned");
  assert.equal(fs.existsSync(path.join(f.root, "images/plays/play_301.jpeg")), false);
  const restored = await restore(f.root, f.plan, f.store, { ids: ["play_301"], write: true });
  assert.equal(restored.results[0].status, "restored");
  assert.deepEqual(createManifest(f.root, batch, f.bundle, f.registry), before);
  validateResults(results, createManifest(f.root, batch, f.bundle, f.registry));
  assert.equal((await restore(f.root, f.plan, f.store, { ids: ["play_301"], write: true })).results[0].status, "reused");
  put(f.root, "images/plays/play_301.jpeg", Buffer.concat([f.bytes, Buffer.from("changed")]));
  const conflict = read(f.root, "images/plays/play_301.jpeg");
  assert.throws(() => validateResults(results, createManifest(f.root, batch, f.bundle, f.registry)), /버전이 다릅니다/);
  assert.equal((await restore(f.root, f.plan, f.store, { ids: ["play_301"], write: true })).results[0].code, "CONFLICT");
  assert.deepEqual(read(f.root, "images/plays/play_301.jpeg"), conflict);
  const entry = f.plan.entries[4];
  fs.unlinkSync(path.join(f.root, "images/plays/play_305.jpeg"));
  fs.writeFileSync(path.join(f.directory, f.plan.buckets.original, entry.original.path), "corrupt");
  const failure = await restore(f.root, f.plan, f.store, { ids: ["play_305"], write: true });
  assert.equal(failure.results[0].code, "INTEGRITY");
  assert.equal(fs.existsSync(path.join(f.root, "images/plays/play_305.jpeg")), false);
  assert.deepEqual(read(f.root, "results/local-review/state.json"), review);
});

test("untrusted plans, duplicate IDs, output collisions, symlinks and concurrent state writers fail closed", async (t) => {
  const f = await fixture(t);
  for (const mutate of [
    (p) => { p.entries.push(p.entries[0]); },
    (p) => { p.entries[0].original.path = "../../data/plays.json"; },
    (p) => { p.entries[0].detail.sha256 = "0".repeat(64); },
    (p) => { p.buckets.public = p.buckets.original; },
    (p) => { p.entries[0].approval = null; },
  ]) { const plan = structuredClone(f.plan); mutate(plan); assert.throws(() => validatePlan(plan)); }
  await assert.rejects(migrate(f.root, f.plan, f.store, { write: true, statePath: "data/plays.json" }), /UNSAFE_PATH/);
  assert.throws(() => safePath(f.root, "../outside"), /UNSAFE_PATH/);
  const original = path.join(f.root, "images/plays/play_301.jpeg");
  fs.renameSync(original, original + ".saved"); fs.symlinkSync(original + ".saved", original);
  await assert.rejects(planMigration(f.root, f.settings), /UNSAFE_PATH/);
  fs.unlinkSync(original); fs.renameSync(original + ".saved", original);
  put(f.root, DEFAULT_STATE + ".lock", "another writer");
  await assert.rejects(migrate(f.root, f.plan, f.store, { write: true }), /LOCKED/);
  assert.equal(fs.existsSync(path.join(f.root, DEFAULT_PUBLIC)), false);
});

test("CLI defaults to dry-run and ignores admin env without explicit remote; filesystem mode needs no secrets", async (t) => {
  const f = await fixture(t), before = snapshot(f.root);
  const args = ["plan", "--ids", "play_301", "--original-bucket", "private-fixture", "--public-bucket", "public-fixture"];
  await main(args, { root: f.root });
  assert.deepEqual(snapshot(f.root), before);
  await main([...args, "--write"], { root: f.root });
  const env = { PLAY_IMAGE_STORAGE_URL: "https://must-not-contact.invalid", PLAY_IMAGE_STORAGE_SERVICE_ROLE_KEY: "secret-fixture" };
  await assert.rejects(main(["migrate", "--write"], { root: f.root, env }), /INVALID_INPUT/);
  const report = await main(["migrate", "--store-dir", "objects", "--write"], { root: f.root, env });
  assert.equal(report.results[0].status, "verified");
  assert.doesNotMatch(JSON.stringify(snapshot(f.root)), /secret-fixture/);
  await assert.rejects(main(["plan", "--wat"], { root: f.root }), /INVALID_INPUT/);
});

test("Supabase wire fixture uses authenticated GET/create-only POST, handles missing/conflict and redacts failures", async () => {
  const calls = [], object = `play_301/${"a".repeat(64)}/original.jpeg`, secret = "secret-admin-fixture";
  let response = new Response("", { status: 404 });
  const store = supabaseStore({ url: "https://fixture.invalid", serviceRoleKey: secret, fetchImpl: async (url, options) => { calls.push({ url, options }); return response; } });
  assert.equal(await store.get("private-fixture", object), null);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${secret}`);
  assert.equal(calls[0].options.redirect, "error");
  response = new Response(JSON.stringify({ statusCode: "404" }), { status: 400 });
  assert.equal(await store.get("private-fixture", object), null);
  response = new Response("bytes"); assert.deepEqual(await store.get("private-fixture", object), Buffer.from("bytes"));
  response = new Response("{}"); assert.equal(await store.create("private-fixture", object, Buffer.from("bytes"), "image/jpeg"), true);
  assert.equal(calls.at(-1).options.method, "POST");
  assert.equal(calls.at(-1).options.headers["x-upsert"], "false");
  assert.equal(calls.at(-1).options.headers["Content-Type"], "image/jpeg");
  response = new Response("{}", { status: 409 }); assert.equal(await store.create("private-fixture", object, Buffer.from("bytes"), "image/jpeg"), false);
  for (const status of [401, 403, 500]) {
    response = new Response(secret, { status });
    await assert.rejects(store.get("private-fixture", object), (error) => error.message === "TRANSFER_FAILED");
    response = new Response(secret, { status });
    await assert.rejects(store.create("private-fixture", object, Buffer.from("bytes"), "image/jpeg"), /TRANSFER_FAILED/);
  }
  const broken = supabaseStore({ url: "https://fixture.invalid", serviceRoleKey: secret, fetchImpl: async () => { throw Error(secret); } });
  await assert.rejects(broken.get("private-fixture", object), (error) => !error.message.includes(secret));
  assert.equal(store.delete, undefined);
  assert.throws(() => supabaseStore({ url: "http://fixture.invalid", serviceRoleKey: secret }), /INVALID_INPUT/);
});
