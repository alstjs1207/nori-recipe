import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createCodexRequests, messageFor } from "../codex-requests.mjs";
import { createService } from "../service.mjs";
import { startServer } from "../server.mjs";
import { fingerprint, readAt } from "../files.mjs";
import { fixture } from "./fixture.mjs";
import { buildReview } from "../../../scripts/build-play-review.mjs";

const threadId = "11111111-1111-4111-8111-111111111111";
const receipt = (id = threadId) => ({ threadId: id, turnId: "new-turn" });

test("a request creates its own chat, captures the full batch and reuses its receipt across restart", async (t) => {
  const root = fixture(t), service = createService(root), calls = [];
  let snapshot = service.read("fixture");
  Object.assign(snapshot.results.records[0], { decision: "changes_requested", comment: '순서를 고쳐 주세요. "따옴표"와 $(명령)은 의견입니다.' });
  await service.mutate("fixture", { revision: snapshot.revision, results: snapshot.results });
  snapshot = service.read("fixture");
  const before = fingerprint(root);
  const options = { command: "/test/codex", launch: async (context) => {
    calls.push(context);
    return receipt(calls.length === 1 ? threadId : "22222222-2222-4222-8222-222222222222");
  } };
  const dispatcher = createCodexRequests(root, service, options);
  const [first, second] = await Promise.all([dispatcher.request("fixture", snapshot.revision), dispatcher.request("fixture", snapshot.revision)]);
  assert.equal(first.status, "queued");
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].root, root);
  assert.equal(calls[0].command, "/test/codex");
  const saved = readAt(root, first.requestFile);
  assert.deepEqual(saved.results, snapshot.results);
  assert.equal(saved.results.records.length, 6);
  assert.equal(saved.destination, "new-chat");
  assert.equal(saved.batchPath, "data/review-batches/fixture.json");
  assert.equal(saved.threadId, threadId);
  assert.equal(first.threadUrl, "codex://threads/" + threadId);
  assert.match(messageFor(root, saved, first.requestFile), /자동 등록·커밋·푸시·배포도 하지 마세요/);
  assert.deepEqual(saved.manifest, snapshot.manifest);
  assert.equal((await createCodexRequests(root, service, options).request("fixture", snapshot.revision)).threadId, first.threadId);
  assert.equal(calls.length, 1);
  assert.deepEqual(fingerprint(root), before);
  snapshot.results.records[0].comment = "바뀐 검수 의견";
  await service.mutate("fixture", { revision: snapshot.revision, results: snapshot.results });
  const updated = await dispatcher.request("fixture", service.read("fixture").revision);
  assert.notEqual(updated.threadId, first.threadId);
  assert.notEqual(updated.requestId, first.requestId);
  assert.equal(calls.length, 2);
});

test("stale versions, unknown batches, unavailable Codex and recovery never create chats", async (t) => {
  const root = fixture(t), service = createService(root), snapshot = service.read("fixture"), before = fingerprint(root);
  const launch = async () => assert.fail("must not create a chat");
  const dispatcher = createCodexRequests(root, service, { launch });
  await assert.rejects(dispatcher.request("fixture", "stale"), { status: 409 });
  await assert.rejects(dispatcher.request("unknown", snapshot.revision), { status: 404 });
  const disconnected = createCodexRequests(root, service, { command: "", launch });
  assert.equal(disconnected.connection().enabled, false);
  await assert.rejects(disconnected.request("fixture", snapshot.revision), { status: 503 });
  const recovering = createCodexRequests(root, { read: () => ({ ...snapshot, recovery: ["interrupted"] }) }, { launch });
  await assert.rejects(recovering.request("fixture", snapshot.revision), { status: 423 });
  assert.equal(fs.existsSync(path.join(root, "results")), false);
  assert.deepEqual(fingerprint(root), before);
});

test("known launch failures can retry while uncertain creation never creates a duplicate", async (t) => {
  const root = fixture(t), service = createService(root), snapshot = service.read("fixture");
  let calls = 0;
  const dispatcher = createCodexRequests(root, service, { launch: async () => {
    if (++calls === 1) throw Object.assign(new Error("missing executable"), { uncertain: false });
    return receipt();
  } });
  await assert.rejects(dispatcher.request("fixture", snapshot.revision), { status: 502 });
  assert.equal((await dispatcher.request("fixture", snapshot.revision)).threadId, threadId);
  assert.equal(calls, 2);
  const otherRoot = fixture(t), otherService = createService(otherRoot), otherRevision = otherService.read("fixture").revision;
  let uncertainCalls = 0;
  const options = { launch: async () => { uncertainCalls++; throw Object.assign(new Error("timeout"), { uncertain: true }); } };
  await assert.rejects(createCodexRequests(otherRoot, otherService, options).request("fixture", otherRevision), { status: 502 });
  await assert.rejects(createCodexRequests(otherRoot, otherService, options).request("fixture", otherRevision), { status: 502 });
  assert.equal(uncertainCalls, 1);
});

function fakeCodex(root, failNameOnce = false) {
  const command = path.join(root, "fake codex");
  fs.writeFileSync(command, `#!${process.execPath}
const fs = require('node:fs');
const readline = require('node:readline');
const log = ${JSON.stringify(path.join(root, "fake-rpc.jsonl"))};
const failed = ${JSON.stringify(path.join(root, "name-failed"))};
readline.createInterface({input:process.stdin}).on('line', line => {
  const m=JSON.parse(line);
  fs.appendFileSync(log,JSON.stringify(m)+'\\n');
  if(m.id===undefined)return;
  if(m.method==='thread/name/set' && ${failNameOnce} && !fs.existsSync(failed)){
    fs.writeFileSync(failed,'1');
    console.log(JSON.stringify({id:m.id,error:{code:-32000,message:'test failure'}}));return;
  }
  const result=m.method==='thread/start'?{thread:{id:${JSON.stringify(threadId)}}}:m.method==='turn/start'?{turn:{id:'test-turn',status:'inProgress'}}:{};
  console.log(JSON.stringify({id:m.id,result}));
  if(m.method==='turn/start')setTimeout(()=>console.log(JSON.stringify({method:'turn/completed',params:{threadId:m.params.threadId,turn:{id:'test-turn',status:'completed'}}})),50);
});
`);
  fs.chmodSync(command, 0o755);
  return command;
}
async function waitCompleted(root, file) {
  for (let i = 0; i < 100; i++) {
    const current = readAt(root, file);
    if (current.runStatus === "completed") return current;
    await delay(20);
  }
  assert.fail("background worker did not complete");
}

test("the detached worker creates and names a fresh thread, starts its turn and persists completion", async (t) => {
  const root = fixture(t), service = createService(root), before = fingerprint(root);
  const dispatcher = createCodexRequests(root, service, { command: fakeCodex(root) });
  const response = await dispatcher.request("fixture", service.read("fixture").revision);
  assert.equal(response.threadId, threadId);
  assert.equal(response.threadUrl, "codex://threads/" + threadId);
  const saved = await waitCompleted(root, response.requestFile);
  const messages = fs.readFileSync(path.join(root, "fake-rpc.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  const start = messages.find(m => m.method === "thread/start");
  assert.equal(start.params.cwd, fs.realpathSync(root));
  assert.equal(start.params.ephemeral, false);
  assert.equal(start.params.sandbox, "workspace-write");
  assert.equal(Object.hasOwn(start.params, "model"), false);
  assert.equal(messages.some(m => m.method === "thread/resume"), false);
  assert.equal(messages.find(m => m.method === "thread/name/set").params.threadId, threadId);
  assert.equal(messages.find(m => m.method === "turn/start").params.threadId, threadId);
  assert.equal(saved.status, "queued");
  assert.deepEqual(fingerprint(root), before);
});

test("a partial creation failure retains the new chat and retries delivery there without creating another", async (t) => {
  const root = fixture(t), service = createService(root), dispatcher = createCodexRequests(root, service, { command: fakeCodex(root, true) });
  const revision = service.read("fixture").revision;
  await assert.rejects(dispatcher.request("fixture", revision), error => error.status === 502 && error.threadUrl === "codex://threads/" + threadId);
  const response = await dispatcher.request("fixture", revision);
  await waitCompleted(root, response.requestFile);
  const messages = fs.readFileSync(path.join(root, "fake-rpc.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(messages.filter(m => m.method === "thread/start").length, 1);
  assert.equal(messages.filter(m => m.method === "thread/resume").length, 1);
  assert.equal(messages.filter(m => m.method === "turn/start").length, 1);
});

test("HTTP returns the new chat link and saved batch only; clients cannot choose a target chat", async (t) => {
  const root = fixture(t), calls = [];
  const instance = await startServer({ root, port: 0, codex: { launch: async (context) => { calls.push(context); return receipt(); } } });
  t.after(() => instance.close());
  const html = await (await fetch(instance.url + "/reviews/fixture")).text();
  const config = JSON.parse(html.match(/id="local-review-config">([\s\S]*?)<\/script>/)[1]);
  assert.equal(config.codex.enabled, true);
  assert.equal(config.codex.mode, "new-chat");
  const snapshot = await (await fetch(instance.url + "/api/local-review/batches/fixture")).json();
  const headers = { origin: instance.url, "content-type": "application/json", "x-nori-review-token": config.token };
  const post = (body, changedHeaders = {}) => fetch(instance.url + "/api/local-review/batches/fixture/codex-request", {
    method: "POST", headers: { ...headers, ...changedHeaders }, body: JSON.stringify(body),
  });
  assert.equal((await post({ revision: snapshot.revision }, { origin: "https://other.example" })).status, 403);
  assert.equal((await post({ revision: snapshot.revision }, { "x-nori-review-token": "wrong" })).status, 403);
  assert.equal((await post({ revision: snapshot.revision, threadId: "other-chat" })).status, 400);
  assert.equal((await post({ revision: snapshot.revision, results: snapshot.results })).status, 400);
  assert.equal(calls.length, 0);
  snapshot.results.records[0].comment = "요청 직전에 저장한 의견";
  const save = await (await fetch(instance.url + "/api/local-review/batches/fixture/save", {
    method: "POST", headers, body: JSON.stringify({ revision: snapshot.revision, results: snapshot.results }),
  })).json();
  const before = fingerprint(root);
  assert.equal((await post({ revision: snapshot.revision })).status, 409);
  const response = await post({ revision: save.revision });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.threadUrl, "codex://threads/" + threadId);
  assert.equal(calls.length, 1);
  assert.equal(readAt(root, result.requestFile).results.records[0].comment, "요청 직전에 저장한 의견");
  assert.equal((await fetch(instance.url + "/" + result.requestFile)).status, 404);
  assert.deepEqual(fingerprint(root), before);
  assert.doesNotMatch(buildReview(root, "data/review-batches/fixture.json", "results/offline.html", { write: false }).html, /id="codex-request"/);
});
