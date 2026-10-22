import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startServer } from "../server.mjs";
import { fingerprint } from "../files.mjs";
import { buildCatalog } from "../../../scripts/build-play-catalog.mjs";
import { fixture, read, write } from "./fixture.mjs";

const payloadOf = (html) => JSON.parse(html.match(/id="recommendation-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
test("recommendation menu is served read-only across Studio routes and stays absent in standalone exports", async (t) => {
  const root = fixture(t), before = fingerprint(root), instance = await startServer({ root, port: 0 });
  t.after(() => instance.close());
  for (const route of ["/catalog", "/materials", "/reviews", "/reviews/fixture", "/recommendations"]) {
    const response = await fetch(instance.url + route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, /id="recommendations-nav" href="\/recommendations"/);
    if (route === "/recommendations") {
      assert.match(html, /id="recommendations-nav" href="\/recommendations" aria-current="page"/);
      assert.match(html, /추천 엔진 흐름도/);
      assert.doesNotMatch(html, /id="local-review-config"|src="\/local-review\/browser.js"/);
      const payload = payloadOf(html);
      assert.equal(payload.plays.length, 6);
      assert.match(payload.engineHash, /^[a-f0-9]{64}$/);
      assert.ok(payload.sourceFiles.includes("src/engine/recommend.ts"));
      assert.ok(payload.sourceFiles.includes("src/engine/intentCatalog.json"));
      assert.equal((await fetch(instance.url + route, { method: "HEAD" })).status, 200);
      assert.equal(await (await fetch(instance.url + route, { method: "HEAD" })).text(), "");
    }
  }
  const redirect = await fetch(instance.url + "/recommendations/?age=33", { redirect: "manual" });
  assert.equal(redirect.headers.get("location"), "/recommendations?age=33");
  assert.doesNotMatch(buildCatalog(root, "results/test.html", { write: false }).html, /recommendations-nav|href="\/recommendations"/);
  assert.deepEqual(fingerprint(root), before);
  assert.equal(fs.existsSync(path.join(root, "results")), false);
});

test("reload embeds fresh catalog and safely escapes user content without exposing files or write credentials", async (t) => {
  const root = fixture(t), instance = await startServer({ root, port: 0 });
  t.after(() => instance.close());
  const first = payloadOf(await (await fetch(instance.url + "/recommendations")).text());
  const bundle = read(root, "data/plays.json");
  bundle.plays[0].name = '</script><script>globalThis.injected = true</script> & 새 놀이';
  write(root, "data/plays.json", bundle);
  const before = fingerprint(root);
  const html = await (await fetch(instance.url + "/recommendations")).text(), next = payloadOf(html);
  assert.equal(next.plays[0].name, bundle.plays[0].name);
  assert.notEqual(next.revision, first.revision);
  assert.equal(next.engineHash, first.engineHash);
  assert.ok(!html.includes(bundle.plays[0].name));
  for (const relative of ["/src/engine/intentCatalog.json", "/tools/local-review/recommendation-client.ts", "/data/plays.json"]) {
    assert.equal((await fetch(instance.url + relative)).status, 404);
  }
  assert.equal((await fetch(instance.url + "/recommendations", { method: "POST", headers: { origin: instance.url, "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.deepEqual(fingerprint(root), before);
});
