import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fixture, read, write, approve } from "../tools/local-review/tests/fixture.mjs";
import { createService } from "../tools/local-review/service.mjs";
import { fingerprint, hash, bytesAt, pendingTransactions, prepareTransaction, atomicWrite, recoverTransaction } from "../tools/local-review/files.mjs";
import { PUBLICATIONS, STORAGE_ORIGIN } from "../scripts/review/image-publication.mjs";
import { registerReview } from "../scripts/review/register-review.mjs";
import { publicImageInput } from "../scripts/web/play-images.mjs";
import { publicMaterialInput } from "../scripts/web/material-images.mjs";
import { applyApproval } from "../scripts/review/review-core.mjs";
import { applyMaterialReview } from "../scripts/apply-material-review.mjs";

function setup(t, options = {}) {
  const root = fixture(t), objects = new Map(), creates = [];
  const store = {
    async get(bucket, key) { return objects.get(`${bucket}/${key}`) ?? null; },
    async create(bucket, key, bytes) {
      creates.push(`${bucket}/${key}`);
      await options.onCreate?.(bucket, key, root);
      if (objects.has(`${bucket}/${key}`)) return false;
      objects.set(`${bucket}/${key}`, Buffer.from(bytes)); return true;
    },
    async getPublic(bucket, key) { return options.publicRead === false ? null : store.get(bucket, key); },
  };
  const storage = { stores: { play: store, material: store }, env: {} };
  const service = createService(root, { storage });
  const publish = async (id = "play_301") => {
    const snapshot = service.read("fixture"); approve(snapshot.results, id);
    return service.mutate("fixture", snapshot, { type: "play", id });
  };
  return { root, store, storage, service, objects, creates, publish };
}

test("Studio uploads only the selected approved play and commits its public manifest with status", async t => {
  const f = setup(t), snapshot = f.service.read("fixture");
  approve(snapshot.results, "play_301"); approve(snapshot.results, "play_306");
  const result = await f.service.mutate("fixture", snapshot, { type: "play", id: "play_301" });
  assert.equal(result.summary.images.length, 1);
  const manifest = read(f.root, PUBLICATIONS.play), entry = manifest.entries.play_301;
  assert.deepEqual(Object.keys(manifest.entries), ["play_301"]);
  assert.equal(read(f.root, "data/plays.json").plays[0].status, "live");
  assert.equal(read(f.root, "data/plays.json").plays[5].status, "draft");
  assert.equal(f.objects.size, 3);
  assert.equal(hash(f.objects.get(`play-assets/${entry.detail.path}`)), entry.detail.sha256);
  assert.ok([...f.objects.keys()].some(key => key.startsWith("play-originals/play_301/")));
  assert.doesNotMatch(JSON.stringify(manifest), /service_role|original\.jpeg|Authorization|apikey/);
  const transaction = read(f.root, `results/local-review/transactions/${result.transactionId}/plan.json`);
  assert.equal(transaction.status, "committed");
  assert.ok(transaction.entries.some(e => e.relative === PUBLICATIONS.play));
});

test("partial upload leaves every local file unchanged; retry verifies existing bytes and completes", async t => {
  let fail = true;
  const f = setup(t, { onCreate(bucket, key) { if (fail && key.endsWith("thumbnail.webp")) throw new Error("provider secret response"); } });
  const before = fingerprint(f.root);
  await assert.rejects(f.publish(), error => !error.message.includes("secret") && /등록은 반영하지 않았습니다/.test(error.message));
  assert.deepEqual(fingerprint(f.root), before);
  assert.equal(f.objects.size, 2);
  fail = false;
  await f.publish();
  assert.equal(f.objects.size, 3);
  assert.equal(f.creates.filter(key => key.startsWith("play-originals/")).length, 1);
  assert.equal(pendingTransactions(f.root).length, 0);
});

test("anonymous public-read failure and existing-object corruption prevent registration", async t => {
  const f = setup(t, { publicRead: false });
  const before = fingerprint(f.root);
  await assert.rejects(f.publish(), /업로드·다운로드 검증/);
  assert.deepEqual(fingerprint(f.root), before);
  const g = setup(t, { onCreate(bucket, key) { if (key.endsWith("thumbnail.webp")) throw new Error("stop"); } });
  await assert.rejects(g.publish());
  const originalKey = [...g.objects.keys()].find(key => key.startsWith("play-originals/"));
  g.objects.set(originalKey, Buffer.from("corrupt"));
  const count = g.creates.length;
  await assert.rejects(g.publish(), /업로드·다운로드 검증/);
  assert.equal(g.creates.length, count);
  assert.equal(bytesAt(g.root, PUBLICATIONS.play), null);
});

test("content or publication changes during upload reject the final commit without losing external edits", async t => {
  for (const target of ["content", "publication"]) {
    let changed = false;
    const f = setup(t, { onCreate(bucket, key, root) {
      if (changed) return;
      changed = true;
      if (target === "content") {
        const bundle = read(root, "data/plays.json"); bundle.plays[0].tip = "다른 작업의 수정"; write(root, "data/plays.json", bundle);
      } else write(root, PUBLICATIONS.play, { external: true });
    } });
    await assert.rejects(f.publish(), error => error.status === 409);
    assert.equal(read(f.root, "data/plays.json").plays[0].status, "draft");
    if (target === "content") assert.equal(read(f.root, "data/plays.json").plays[0].tip, "다른 작업의 수정");
    else assert.deepEqual(read(f.root, PUBLICATIONS.play), { external: true });
    assert.equal(pendingTransactions(f.root).length, 0);
  }
});

test("new material approval publishes its icon and source hashes before permitting play registration", async t => {
  const f = setup(t), snapshot = f.service.read("fixture");
  Object.assign(snapshot.results.materialRecords[0], { decision: "add", confirmed: true });
  const result = await f.service.mutate("fixture", snapshot, { type: "material", id: "basket" });
  const entry = read(f.root, PUBLICATIONS.material).entries.basket;
  assert.equal(result.summary.images[0].id, "basket");
  assert.equal(f.objects.size, 2);
  assert.equal(hash(f.objects.get(`material-assets/${entry.icon.path}`)), entry.icon.sha256);
  assert.deepEqual(read(f.root, "data/materials.json").reviewPending, ["dropper"]);
  assert.equal(read(f.root, "data/plays.json").plays[1].status, "draft");
  assert.equal(read(f.root, "src/constants/materialImageSourceHashes.json").basket.sourceHash, entry.sourceHash);
  await f.publish("play_302");
  assert.equal(read(f.root, "data/plays.json").plays[1].status, "live");
});

test("material upload failure preserves reviewPending; held materials never upload", async t => {
  const f = setup(t, { onCreate() { throw new Error("offline"); } }), snapshot = f.service.read("fixture");
  Object.assign(snapshot.results.materialRecords[0], { decision: "add", confirmed: true });
  const before = fingerprint(f.root);
  await assert.rejects(f.service.mutate("fixture", snapshot, { type: "material", id: "basket" }), /업로드·다운로드 검증/);
  assert.deepEqual(fingerprint(f.root), before);
  Object.assign(snapshot.results.materialRecords[0], { decision: "held", confirmed: false });
  await f.service.mutate("fixture", snapshot, { type: "material", id: "basket" });
  assert.equal(f.objects.size, 0);
  assert.equal(bytesAt(f.root, PUBLICATIONS.material), null);
});

test("missing local credentials block approval, while saves and CLI dry-runs remain offline", async t => {
  const root = fixture(t), service = createService(root, { storage: { env: {} } }), snapshot = service.read("fixture");
  approve(snapshot.results, "play_301");
  const before = fingerprint(root);
  assert.equal(applyApproval(root, read(root, "data/review-batches/fixture.json"), snapshot.results).wrote, false);
  assert.equal(applyMaterialReview(root, "data/review-batches/fixture.json", snapshot.results).wrote, false);
  assert.deepEqual(fingerprint(root), before);
  await assert.rejects(service.mutate("fixture", snapshot, { type: "play", id: "play_301" }), /PLAY_IMAGE_STORAGE_SERVICE_ROLE_KEY/);
  assert.deepEqual(fingerprint(root), before);
  await service.mutate("fixture", snapshot);
  assert.equal(read(root, "data/plays.json").plays[0].status, "draft");
});

test("CLI batch registration shares uploads, manifests and transaction recovery with Studio", async t => {
  const f = setup(t), snapshot = f.service.read("fixture");
  approve(snapshot.results, "play_301"); approve(snapshot.results, "play_306");
  const result = await registerReview(f.root, "data/review-batches/fixture.json", snapshot.results, "play", { storage: f.storage });
  assert.deepEqual(result.images.map(e => e.id), ["play_301", "play_306"]);
  assert.equal(f.objects.size, 6);
  const bytes = bytesAt(f.root, PUBLICATIONS.play), bundle = bytesAt(f.root, "data/plays.json");
  const updates = new Map([[PUBLICATIONS.play, null], ["data/plays.json", Buffer.from(bundle + "\n")]]);
  const transaction = prepareTransaction(f.root, updates, fingerprint(f.root));
  fs.unlinkSync(path.join(f.root, PUBLICATIONS.play));
  atomicWrite(f.root, "data/plays.json", updates.get("data/plays.json"));
  recoverTransaction(f.root, transaction.plan.id);
  assert.deepEqual(bytesAt(f.root, PUBLICATIONS.play), bytes);
  assert.deepEqual(bytesAt(f.root, "data/plays.json"), bundle);
  const replay = await registerReview(f.root, "data/review-batches/fixture.json", snapshot.results, "play", { storage: f.storage });
  assert.equal(replay.wrote, false);
  assert.equal(f.creates.length, 6);
});

test("CLI material registration is idempotent and retains current approval receipts", async t => {
  const f = setup(t), snapshot = f.service.read("fixture");
  Object.assign(snapshot.results.materialRecords[0], { decision: "add", confirmed: true });
  const first = await registerReview(f.root, "data/review-batches/fixture.json", snapshot.results, "material", { storage: f.storage });
  assert.equal(first.wrote, true);
  const second = await registerReview(f.root, "data/review-batches/fixture.json", snapshot.results, "material", { storage: f.storage });
  assert.equal(second.alreadyApplied, true);
  assert.equal(second.wrote, false);
  assert.equal(f.creates.length, 2);
});

test("real adapter contract keeps credentials on authenticated requests and verifies anonymous derivatives", async t => {
  const root = fixture(t), objects = new Map(), requests = [], originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    const key = new URL(url).pathname.replace(/^\/storage\/v1\/object\/(?:public\/)?/, "");
    requests.push({ url, options });
    if (options?.method === "POST") {
      assert.equal(options.headers["x-upsert"], "false");
      objects.set(key, Buffer.from(options.body)); return new Response("{}", { status: 200 });
    }
    return objects.has(key) ? new Response(objects.get(key), { status: 200 }) : new Response("{}", { status: 404 });
  };
  const service = createService(root, { storage: { env: { PLAY_IMAGE_STORAGE_URL: STORAGE_ORIGIN, PLAY_IMAGE_STORAGE_SERVICE_ROLE_KEY: "fake-local-only-secret" } } });
  const snapshot = service.read("fixture"); approve(snapshot.results, "play_301");
  const result = await service.mutate("fixture", snapshot, { type: "play", id: "play_301" });
  const publicReads = requests.filter(r => r.url.includes("/object/public/"));
  assert.equal(publicReads.length, 2);
  for (const request of publicReads) assert.equal(request.options.headers, undefined);
  for (const request of requests.filter(r => !r.url.includes("/object/public/"))) assert.equal(request.options.headers.Authorization, "Bearer fake-local-only-secret");
  assert.doesNotMatch(JSON.stringify(result), /fake-local-only-secret/);
  assert.doesNotMatch(bytesAt(root, PUBLICATIONS.play).toString(), /fake-local-only-secret/);
});

test("web build merges new play registrations with migration evidence without original JPEGs", async t => {
  const f = setup(t); await f.publish();
  write(f.root, "base-plays.json", { schemaVersion: 1, bucket: "play-assets", entries: {} });
  const bundle = read(f.root, "data/plays.json"), registry = read(f.root, "data/materials.json");
  const env = { PLAY_IMAGE_PUBLIC_MANIFEST: path.join(f.root, "base-plays.json"), PLAY_IMAGE_PUBLIC_ORIGIN: STORAGE_ORIGIN, PLAY_IMAGE_PUBLIC_BUCKET: "play-assets" };
  const build = () => publicImageInput({ root: f.root, plays: [bundle.plays[0]], registry, env });
  fs.unlinkSync(path.join(f.root, "images/plays/play_301.jpeg"));
  assert.match(build().manifest.entries.play_301.detail, /supabase\.co\/storage\/v1\/object\/public\/play-assets\//);
  bundle.plays[0].tip = "새 내용";
  assert.throws(build, /stale public image content/);
  write(f.root, PUBLICATIONS.play, null);
  assert.throws(build, /origin mismatch/);
});

test("web build uses newly approved material and rejects mapping changes without reading originals", async t => {
  const f = setup(t), snapshot = f.service.read("fixture");
  Object.assign(snapshot.results.materialRecords[0], { decision: "add", confirmed: true });
  await f.service.mutate("fixture", snapshot, { type: "material", id: "basket" });
  write(f.root, "data/materials.json", { categories: { 도구: ["basket"] }, displayNames: { basket: "바구니" } });
  fs.writeFileSync(path.join(f.root, "src/constants/materialImageSources.ts"), 'const MATERIAL_IMAGE_SOURCES = {\n  basket: require("../../images/material/basket.jpeg"),\n};\n');
  write(f.root, "base-materials.json", { schemaVersion: 1, transform: "material-webp-192-inside-q65-v1", bucket: "material-assets", entries: {} });
  const env = { MATERIAL_IMAGE_PUBLIC_MANIFEST: path.join(f.root, "base-materials.json"), MATERIAL_IMAGE_PUBLIC_ORIGIN: STORAGE_ORIGIN, MATERIAL_IMAGE_PUBLIC_BUCKET: "material-assets" };
  fs.unlinkSync(path.join(f.root, "images/material/basket.jpeg"));
  assert.ok(publicMaterialInput({ root: f.root, env }).manifest.entries.basket);
  fs.writeFileSync(path.join(f.root, "src/constants/materialImageSources.ts"), 'const MATERIAL_IMAGE_SOURCES = {\n  basket: require("../../images/material/other.jpeg"),\n};\n');
  assert.throws(() => publicMaterialInput({ root: f.root, env }), /stale public material/);
});
