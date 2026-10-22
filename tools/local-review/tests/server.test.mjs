import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { startServer } from "../server.mjs";
import { createService, readSnapshot } from "../service.mjs";
import { STATE, fingerprint, bytesAt, commitTransaction, prepareTransaction, recoverTransaction, pendingTransactions, atomicWrite, json } from "../files.mjs";
import { fixture, read, write, approve } from "./fixture.mjs";
import { applyApproval } from "../../../scripts/review/review-core.mjs";
import { buildCatalog } from "../../../scripts/build-play-catalog.mjs";
import { buildReview } from "../../../scripts/build-play-review.mjs";

async function client(instance) {
  const html = await (await fetch(instance.url + "/reviews/fixture")).text();
  const config = JSON.parse(html.match(/id="local-review-config">([\s\S]*?)<\/script>/)[1]);
  return {
    config, html,
    get: async () => (await fetch(instance.url + "/api/local-review/batches/fixture")).json(),
    async post(action, snapshot, id, options = {}) {
      const response = await fetch(instance.url + "/api/local-review/batches/fixture/" + action, {
        method: "POST", headers: { origin: instance.url, "content-type": "application/json", "x-nori-review-token": config.token, ...options.headers },
        body: options.raw ?? JSON.stringify({ revision: snapshot.revision, results: snapshot.results, ...(id ? { id } : {}) }),
      });
      return { status: response.status, body: await response.json() };
    },
  };
}
async function setup(t) {
  const root = fixture(t), instance = await startServer({ root, port: 0 });
  t.after(() => instance.close());
  return { root, instance, api: await client(instance) };
}

test("start, catalog, review and GET APIs are read-only; only whitelisted files and origins are accepted", async (t) => {
  const root = fixture(t), before = fingerprint(root);
  const instance = await startServer({ root, port: 0 });
  t.after(() => instance.close());
  const api = await client(instance), snapshot = await api.get();
  const catalog = await fetch(instance.url + "/catalog");
  assert.equal(catalog.status, 200);
  assert.match(await catalog.text(), /로컬 서버 검증용 수집 건/);
  assert.match(api.html, /서버 파일에 자동 저장/);
  assert.match(api.html, /noriReviewPersistence/);
  assert.equal((await fetch(instance.url + "/images/plays/play_301.jpeg")).status, 200);
  for (const relative of ["/data/plays.json", "/package.json", "/.env", "/results/local-review/state.json", "/results/other.html", "/images/material/%2e%2e%2f%2e%2e%2fdata/plays.json"]) assert.equal((await fetch(instance.url + relative)).status, 404);
  assert.equal(await new Promise((resolve, reject) => {
    const request = http.get(instance.url + "/", { headers: { host: "evil.example" } }, (response) => { response.resume(); resolve(response.statusCode); });
    request.on("error", reject);
  }), 403);
  assert.equal((await api.post("save", snapshot, null, { headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await api.post("save", snapshot, null, { headers: { "x-nori-review-token": "bad" } })).status, 403);
  assert.equal((await api.post("save", snapshot, null, { headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await api.post("save", snapshot, null, { raw: "{" })).status, 400);
  assert.equal((await api.post("save", snapshot, null, { raw: " ".repeat(2 * 1024 * 1024 + 1) })).status, 413);
  assert.deepEqual(fingerprint(root), before);
  assert.equal(fs.existsSync(path.join(root, "results")), false);
  await assert.rejects(startServer({ root, port: 0 }), /이미 실행/);
});

test("clean URLs link the backoffice, redirect legacy pages and preserve standalone file links without writes", async (t) => {
  const root = fixture(t);
  const batch = read(root, "data/review-batches/fixture.json");
  batch.reviewOutput = "results/play-image-audit.html";
  write(root, "data/review-batches/fixture.json", batch);
  write(root, "data/review-batches/next-batch.json", { ...batch, batchId: "next-batch", reviewOutput: "results/reviews/next-batch.html" });
  const before = fingerprint(root), instance = await startServer({ root, port: 0 });
  t.after(() => instance.close());
  const routes = [
    ["/", "/catalog"],
    ["/catalog/", "/catalog"],
    ["/materials/", "/materials"],
    ["/reviews/", "/reviews"],
    ["/results/play-catalog.html", "/catalog"],
    ["/results/play-image-audit.html", "/reviews/fixture"],
    ["/results/reviews/next-batch.html", "/reviews/next-batch"],
    ["/reviews/fixture/", "/reviews/fixture"],
  ];
  for (const [oldUrl, cleanUrl] of routes) {
    const response = await fetch(instance.url + oldUrl + "?from=bookmark", { redirect: "manual" });
    assert.equal(response.status, 302, oldUrl);
    assert.equal(response.headers.get("location"), cleanUrl + "?from=bookmark");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  const listing = await (await fetch(instance.url + "/api/local-review/batches")).json();
  assert.deepEqual(listing.batches.map(({ batchId, url }) => [batchId, url]), [["fixture", "/reviews/fixture"], ["next-batch", "/reviews/next-batch"]]);
  for (const url of ["/catalog", "/materials", "/reviews", "/reviews/fixture", "/reviews/next-batch"]) {
    const response = await fetch(instance.url + url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /href="\/catalog"/);
    assert.match(html, /href="\/materials"/);
    assert.match(html, /href="\/reviews"/);
    assert.doesNotMatch(html, /href="(?:\/catalog)?#(?:materials|review-batches)"/);
    assert.doesNotMatch(html, /href="[^"]*\.html(?:[?#][^"]*)?"/);
    const view = { "/catalog": "plays", "/materials": "materials", "/reviews": "reviews" }[url];
    if (view) {
      assert.match(html, new RegExp('data-catalog-view="' + view + '"'));
      assert.match(html, /href="\/catalog#play_301"/);
      const activeId = { plays: "plays-tab", materials: "materials-tab", reviews: "reviews-nav" }[view];
      assert.match(html, new RegExp('id="' + activeId + '" href="' + url + '" aria-current="page"'));
    }
    const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(images.length > 0);
    assert.ok(images.every((src) => src.startsWith("/images/")));
    assert.equal((await fetch(instance.url + images[0])).status, 200);
    if (url === "/catalog") assert.match(html, /href="\/reviews\/next-batch"/);
    const head = await fetch(instance.url + url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  }
  for (const url of ["/reviews/missing", "/reviews/fixture.html", "/catalog.html", "/materials/other", "/results/unlisted.html", "/reviews/fixture/other"]) {
    assert.equal((await fetch(instance.url + url)).status, 404, url);
  }
  const offlineCatalog = buildCatalog(root, "results/play-catalog.html", { write: false }).html;
  assert.match(offlineCatalog, /href="play-image-audit\.html"/);
  assert.match(offlineCatalog, /<button[^>]+id="materials-tab"/);
  assert.match(offlineCatalog, /href="#review-batches"/);
  const offline = buildReview(root, "data/review-batches/fixture.json", batch.reviewOutput, { write: false }).html;
  assert.match(offline, /href="play-catalog\.html"/);
  assert.match(offline, /src="\.\.\/images\/plays\/play_301\.jpeg\?v=/);
  assert.deepEqual(fingerprint(root), before);
  assert.equal(fs.existsSync(path.join(root, "results")), false);
});

test("incomplete opinions and statuses persist in files across restart and a new browser; imports do not publish", async (t) => {
  const { root, instance, api } = await setup(t), snapshot = await api.get();
  Object.assign(snapshot.results.records[0], { decision: "changes_requested", comment: "" });
  snapshot.results.records[5].comment = "다른 놀이의 검수 의견";
  snapshot.results.materialRecords[0].decision = "replace"; // saved before reason/target are entered
  approve(snapshot.results, "play_306");
  const response = await api.post("save", snapshot);
  assert.equal(response.status, 200);
  assert.equal(read(root, STATE).batches.fixture.results.records[5].comment, "다른 놀이의 검수 의견");
  assert.equal(read(root, "data/plays.json").plays[5].status, "draft");
  await instance.close();
  const restarted = await startServer({ root, port: 0 });
  t.after(() => restarted.close());
  const newClient = await client(restarted), restored = await newClient.get();
  assert.equal(restored.results.records[0].decision, "changes_requested");
  assert.equal(restored.results.records[5].comment, "다른 놀이의 검수 의견");
  assert.equal(restored.results.materialRecords[0].decision, "replace");
  assert.notEqual(newClient.config.token, api.config.token);
  assert.equal((await newClient.post("save", snapshot, null, { headers: { "x-nori-review-token": api.config.token } })).status, 403);
});

test("simultaneous writes serialize and reject stale versions without losing the winning opinion", async (t) => {
  const { root, api } = await setup(t), a = await api.get(), b = structuredClone(a);
  a.results.records[0].comment = "브라우저 A"; b.results.records[0].comment = "브라우저 B";
  const responses = await Promise.all([api.post("save", a), api.post("save", b)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const winning = responses[0].status === 200 ? "브라우저 A" : "브라우저 B";
  assert.equal(read(root, STATE).batches.fixture.results.records[0].comment, winning);
  assert.equal(pendingTransactions(root).length, 0);
});

test("bad records, missing confirmations, unknown IDs and archived approvals cause no writes", async (t) => {
  const { root, api } = await setup(t), initial = await api.get(), before = fingerprint(root);
  const bad = structuredClone(initial); bad.results.records[0].comment = 3;
  assert.equal((await api.post("save", bad)).status, 400);
  const duplicate = structuredClone(initial); duplicate.results.records[1] = duplicate.results.records[0];
  assert.equal((await api.post("save", duplicate)).status, 400);
  const unconfirmed = structuredClone(initial); unconfirmed.results.records[0].decision = "approved";
  assert.equal((await api.post("approve", unconfirmed, "play_301")).status, 400);
  assert.equal((await api.post("approve", initial, "play_999")).status, 400);
  const archived = structuredClone(initial); approve(archived.results, "play_305");
  assert.equal((await api.post("approve", archived, "play_305")).status, 400);
  const noCompare = structuredClone(initial); noCompare.results.materialRecords[0].decision = "add";
  assert.equal((await api.post("materials", noCompare, "basket")).status, 400);
  assert.deepEqual(fingerprint(root), before);
  assert.equal(fs.existsSync(path.join(root, STATE)), false);
});

test("only the clicked approval publishes, with the existing image mapping and receipt logic; other states survive", async (t) => {
  const { root, api } = await setup(t), snapshot = await api.get();
  approve(snapshot.results, "play_301"); approve(snapshot.results, "play_306");
  Object.assign(snapshot.results.records[2], { decision: "held", comment: "원문을 다시 확인" });
  const response = await api.post("approve", snapshot, "play_301");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.summary.changedIds, ["play_301"]);
  const bundle = read(root, "data/plays.json");
  assert.equal(bundle.plays[0].status, "live"); assert.equal(bundle.plays[0].imageStatus, undefined);
  assert.equal(bundle.plays[5].status, "draft"); assert.equal(bundle.plays[3].status, "live");
  const next = await api.get();
  assert.equal(next.results.records[2].comment, "원문을 다시 확인");
  assert.equal(next.results.records[2].decision, "held");
  assert.equal(next.results.records[5].decision, "approved");
  assert.match(fs.readFileSync(path.join(root, "src/constants/playImages.ts"), "utf8"), /play_301: require/);
  const receipt = read(root, response.body.summary.backupDirectory + "/receipt.json");
  assert.deepEqual(receipt.changedIds, ["play_301"]);
  assert.equal(receipt.records.find((r) => r.id === "play_306").decision, "pending");
  assert.equal(receipt.records.find((r) => r.id === "play_303").decision, "held");
  const transaction = read(root, "results/local-review/transactions/" + response.body.transactionId + "/plan.json");
  assert.equal(transaction.status, "committed");
  assert.ok(transaction.entries.some((e) => e.relative === STATE));
});

test("external content, images, material definitions, mappings and new batches invalidate a previous request", async (t) => {
  const { root, api, instance } = await setup(t);
  let snapshot = await api.get();
  approve(snapshot.results, "play_301"); snapshot.results.records[0].comment = "검토 의견 보존";
  assert.equal((await api.post("save", snapshot)).status, 200);
  snapshot = await api.get();
  const bundle = read(root, "data/plays.json"); bundle.plays[0].steps[0] = "외부 수집 스킬이 본문을 수정했습니다.";
  write(root, "data/plays.json", bundle);
  assert.equal((await api.post("approve", snapshot, "play_301")).status, 409);
  const changed = await api.get();
  assert.equal(changed.results.records[0].decision, "pending");
  assert.equal(changed.results.records[0].comment, "검토 의견 보존");
  assert.equal(changed.results.records[0].contentReviewed, false);
  assert.equal((await api.post("approve", { ...snapshot, revision: changed.revision }, "play_301")).status, 400);
  for (const edit of [
    () => fs.appendFileSync(path.join(root, "images/plays/play_301.jpeg"), Buffer.from([1])),
    () => { const registry = read(root, "data/materials.json"); registry.displayNames.cup = "새 컵 정의"; write(root, "data/materials.json", registry); },
    () => fs.appendFileSync(path.join(root, "src/constants/playImages.ts"), "// 외부 수정\n"),
    () => { const batch = read(root, "data/review-batches/fixture.json"); batch.batchId = "new-collection"; batch.reviewOutput = "results/reviews/new-collection.html"; write(root, "data/review-batches/new-collection.json", batch); },
  ]) {
    const stale = await api.get(); edit();
    assert.equal((await api.post("save", stale)).status, 409);
  }
  const catalog = await (await fetch(instance.url + "/catalog")).text();
  assert.match(catalog, /href="\/reviews\/new-collection"/);
  assert.equal((await fetch(instance.url + "/reviews/new-collection")).status, 200);
});

test("material add, hold and replacement apply separately; drafts cannot bypass re-review", async (t) => {
  const { root, api } = await setup(t);
  let snapshot = await api.get();
  approve(snapshot.results, "play_302");
  assert.equal((await api.post("approve", snapshot, "play_302")).status, 400);
  snapshot = await api.get();
  Object.assign(snapshot.results.materialRecords[0], { decision: "add", confirmed: true });
  Object.assign(snapshot.results.materialRecords[1], { decision: "held", comment: "나중에 확인" });
  assert.equal((await api.post("materials", snapshot, "basket")).status, 200);
  assert.deepEqual(read(root, "data/materials.json").reviewPending, ["dropper"]);
  assert.equal(read(root, "data/review-batches/fixture.json").appliedMaterialDecisions.dropper, undefined);
  snapshot = await api.get();
  assert.equal((await api.post("materials", snapshot, "dropper")).status, 200);
  snapshot = await api.get(); approve(snapshot.results, "play_302");
  assert.equal((await api.post("approve", snapshot, "play_302")).status, 200);
  snapshot = await api.get();
  Object.assign(snapshot.results.materialRecords[1], { decision: "replace", replacementSlug: "cup", confirmed: true, comment: "컵으로 방법 수정 필요" });
  const replaced = await api.post("materials", snapshot, "dropper");
  assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
  assert.deepEqual(read(root, "data/plays.json").plays[2].materials.required, ["cup"]);
  snapshot = await api.get(); approve(snapshot.results, "play_303");
  assert.equal((await api.post("approve", snapshot, "play_303")).status, 400);
  const bundle = read(root, "data/plays.json"); bundle.plays[2].steps[0] = "보호자가 큰 컵을 준비합니다."; write(root, "data/plays.json", bundle);
  snapshot = await api.get(); approve(snapshot.results, "play_303");
  assert.equal((await api.post("approve", snapshot, "play_303")).status, 200);
  assert.equal(read(root, "data/plays.json").plays[2].status, "live");
});

test("an image change clears saved material confirmation and never reuses an unapplied add", (t) => {
  const root = fixture(t), service = createService(root), snapshot = service.read("fixture");
  Object.assign(snapshot.results.materialRecords[0], { decision: "add", confirmed: true, comment: "이 이미지 확인" });
  return service.mutate("fixture", { revision: snapshot.revision, results: snapshot.results }).then(() => {
    fs.appendFileSync(path.join(root, "images/material/basket.jpeg"), Buffer.from([2]));
    const next = service.read("fixture").results.materialRecords[0];
    assert.equal(next.decision, "pending"); assert.equal(next.confirmed, false); assert.equal(next.comment, "이 이미지 확인");
  });
});

test("newer CLI receipts take precedence over older server opinions even with old browser timestamps", async (t) => {
  const root = fixture(t), service = createService(root), snapshot = service.read("fixture");
  Object.assign(snapshot.results.records[5], { decision: "held", comment: "이전 서버 의견" });
  await service.mutate("fixture", { revision: snapshot.revision, results: snapshot.results });
  const current = service.read("fixture");
  approve(current.results, "play_301");
  Object.assign(current.results.records[5], { decision: "held", comment: "새 CLI 의견", updatedAt: "2000-01-01T00:00:00.000Z" });
  applyApproval(root, read(root, "data/review-batches/fixture.json"), current.results, { write: true });
  const restored = service.read("fixture").results.records[5];
  assert.equal(restored.decision, "held");
  assert.equal(restored.comment, "새 CLI 의견");
});

test("interrupted transactions block writes and explicitly recover without overwriting subsequent external edits", async (t) => {
  const root = fixture(t), original = bytesAt(root, "data/plays.json"), updates = new Map([["data/plays.json", Buffer.from(original + "\n")], [STATE, json({ schemaVersion: 1, batches: {} })]]);
  const prepared = prepareTransaction(root, updates, fingerprint(root));
  atomicWrite(root, "data/plays.json", updates.get("data/plays.json")); // process stopped after first rename
  const snapshot = readSnapshot(root, "fixture");
  assert.equal(snapshot.recovery.length, 1);
  await assert.rejects(createService(root).mutate("fixture", { revision: snapshot.revision, results: snapshot.results }), /복구/);
  fs.appendFileSync(path.join(root, "data/plays.json"), "\n");
  assert.throws(() => recoverTransaction(root, prepared.plan.id), /외부 수정/);
  atomicWrite(root, "data/plays.json", updates.get("data/plays.json"));
  assert.equal(recoverTransaction(root, prepared.plan.id).recovered, true);
  assert.deepEqual(bytesAt(root, "data/plays.json"), original);
  assert.equal(bytesAt(root, STATE), null);
  assert.deepEqual(pendingTransactions(root), []);
});

test("a failed multi-file replacement rolls back completely; corrupt state and symlinks fail closed", (t) => {
  const root = fixture(t), before = fingerprint(root), original = bytesAt(root, "data/plays.json");
  const rename = fs.renameSync;
  let failOnce = true;
  fs.renameSync = (from, to) => {
    if (to === path.join(root, STATE) && failOnce) { failOnce = false; throw new Error("simulated disk failure"); }
    return rename(from, to);
  };
  try { assert.throws(() => commitTransaction(root, new Map([["data/plays.json", Buffer.from(original + "\n")], [STATE, json({ schemaVersion: 1, batches: {} })]]), before), /disk failure/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual(fingerprint(root), before);
  assert.deepEqual(pendingTransactions(root), []);
  fs.writeFileSync(path.join(root, STATE), "broken");
  assert.throws(() => readSnapshot(root, "fixture"), /JSON/);
  assert.equal(fs.readFileSync(path.join(root, STATE), "utf8"), "broken");
  fs.rmSync(path.join(root, STATE));
  fs.symlinkSync(path.join(root, "data/plays.json"), path.join(root, "images/material/unsafe.jpeg"));
  assert.throws(() => readSnapshot(root, "fixture"), /심볼릭 링크/);
});

test("an external image edit during commit is detected; own changes roll back and the external edit survives", (t) => {
  const root = fixture(t), before = fingerprint(root), master = bytesAt(root, "data/plays.json"), rename = fs.renameSync;
  const image = "images/plays/play_301.jpeg", external = Buffer.concat([bytesAt(root, image), Buffer.from([3])]);
  let editOnce = true;
  fs.renameSync = (from, to) => {
    const result = rename(from, to);
    if (to === path.join(root, STATE) && editOnce) { editOnce = false; fs.writeFileSync(path.join(root, image), external); }
    return result;
  };
  try { assert.throws(() => commitTransaction(root, new Map([["data/plays.json", Buffer.from(master + "\n")], [STATE, json({ schemaVersion: 1, batches: {} })]]), before), /외부 파일/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual(bytesAt(root, "data/plays.json"), master);
  assert.equal(bytesAt(root, STATE), null);
  assert.deepEqual(bytesAt(root, image), external);
  assert.deepEqual(pendingTransactions(root), []);
});

test("unused removes only the selected play, its image and every batch link, then allows continued review", async (t) => {
  const { root, instance, api } = await setup(t);
  const batch = read(root, "data/review-batches/fixture.json");
  write(root, "data/review-batches/overlap.json", { ...batch, batchId: "overlap", reviewOutput: "results/reviews/overlap.html", playIds: ["play_302"] });
  let snapshot = await api.get();
  snapshot.results.records.find((r) => r.id === "play_306").comment = "다음 검수 의견";
  assert.equal((await api.post("unused", snapshot, "play_999")).status, 400);
  const response = await api.post("unused", snapshot, "play_302");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.summary.removedIds, ["play_302"]);
  assert.equal(read(root, "data/plays.json").plays.length, 5);
  assert.equal(fs.existsSync(path.join(root, "images/plays/play_302.jpeg")), false);
  assert.equal(read(root, "data/review-batches/fixture.json").materialProposals[0].usages.length, 0);
  assert.deepEqual(read(root, "data/review-batches/overlap.json").playIds, []);
  assert.equal((await fetch(instance.url + "/reviews/overlap")).status, 200);
  const catalog = await (await fetch(instance.url + "/catalog")).text();
  assert.doesNotMatch(catalog, /id="play_302"/);
  assert.equal(response.body.results.records.find((r) => r.id === "play_306").comment, "다음 검수 의견");
  assert.equal((await api.post("save", snapshot)).status, 409);
  const transaction = read(root, "results/local-review/transactions/" + response.body.transactionId + "/plan.json");
  const image = transaction.entries.find((e) => e.relative === "images/plays/play_302.jpeg");
  assert.equal(image.afterHash, null);
  assert.ok(fs.existsSync(path.join(root, "results/local-review/transactions", transaction.id, image.index + ".before")));
  snapshot = await api.get();
  approve(snapshot.results, "play_301");
  const approved = await api.post("approve", snapshot, "play_301");
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.manifest.entries.find((e) => e.id === "play_301").status, "live");
});

test("unused can remove registered plays and native mappings; deletion journals recover removed images", async (t) => {
  const { root, api } = await setup(t);
  const native = path.join(root, "src/constants/playImages.ts");
  fs.writeFileSync(native, 'const PLAY_IMAGE_SOURCES: Record<string, ImageSourcePropType> = {\n  play_304: require("../../images/plays/play_304.jpeg"),\n};\n');
  const snapshot = await api.get();
  assert.equal((await api.post("unused", snapshot, "play_304")).status, 200);
  assert.doesNotMatch(fs.readFileSync(native, "utf8"), /play_304/);
  const original = bytesAt(root, "images/plays/play_301.jpeg");
  const { plan } = prepareTransaction(root, new Map([["images/plays/play_301.jpeg", null]]), fingerprint(root));
  fs.rmSync(path.join(root, "images/plays/play_301.jpeg"));
  recoverTransaction(root, plan.id);
  assert.deepEqual(bytesAt(root, "images/plays/play_301.jpeg"), original);
});

test("catalog excludes applied unused replacements from pending without registering them, and reopens reused materials", async (t) => {
  const root = fixture(t), service = createService(root);
  let snapshot = service.read("fixture");
  Object.assign(snapshot.results.materialRecords.find((r) => r.slug === "basket"), {
    decision: "replace", replacementSlug: "cup", confirmed: true, comment: "컵으로 대체",
  });
  await service.mutate("fixture", snapshot, { type: "material", id: "basket" });
  let catalog = buildCatalog(root, undefined, { write: false, serverUrls: true });
  assert.equal(catalog.pendingMaterials, 1);
  assert.match(catalog.html, /id="material-basket" data-state="replaced"/);
  assert.match(catalog.html, /대체 재료: 컵/);
  assert.match(catalog.html, /id="material-dropper" data-state="pending"/);
  assert.ok(read(root, "data/materials.json").reviewPending.includes("basket"));
  const bundle = read(root, "data/plays.json");
  bundle.plays.find((p) => p.id === "play_306").materials.optional.push("basket");
  write(root, "data/plays.json", bundle);
  catalog = buildCatalog(root, undefined, { write: false });
  assert.equal(catalog.pendingMaterials, 2);
  assert.match(catalog.html, /id="material-basket" data-state="pending"/);
});
