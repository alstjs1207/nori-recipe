import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { gunzipSync } from "node:zlib";
import { createWebServer } from "../scripts/serve-web.mjs";
import { withPlayMetadata } from "../scripts/web/html.mjs";

let directory;
let server;
let port;
const baseHtml = '<html><head><title>노리 레시피</title><meta name="description" content="기본 설명" /></head><body>app shell</body></html>';

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "nori-web-test-"));
  await fs.mkdir(path.join(directory, "play/play_001"), { recursive: true });
  await fs.mkdir(path.join(directory, "assets/node_modules/.pnpm/icons"), { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), baseHtml);
  await fs.writeFile(path.join(directory, "play/play_001/index.html"), withPlayMetadata(baseHtml, { id: "play_001", name: '종이 <놀이> "함께"', ageMin: 12, ageMax: 24, prepTime: 2, steps: ["종이를 접어요 & 펼쳐요"] }));
  await fs.writeFile(path.join(directory, "sw.js"), "self.addEventListener('fetch', () => {});");
  await fs.writeFile(path.join(directory, "manifest.webmanifest"), '{"display":"standalone"}');
  await fs.writeFile(path.join(directory, "assets/node_modules/.pnpm/icons/font.ttf"), Buffer.alloc(2000, 7));
  server = createWebServer({ directory });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  port = server.address().port;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: pathname, ...options }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("놀이 직접 링크는 온보딩 없이 HTML과 안전하게 인코딩된 공유 정보를 반환한다", async () => {
  const response = await request("/play/play_001?materials=paper");
  const html = response.body.toString();
  assert.equal(response.status, 200);
  assert.match(html, /종이 &lt;놀이&gt; &quot;함께&quot;/);
  assert.match(html, new RegExp(`http://127.0.0.1:${port}/play/play_001`));
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /__NORI_ORIGIN__|materials=paper|<놀이>/);
});

test("검색·설정·피드백 경로를 새로고침해도 앱 셸이 제공된다", async () => {
  for (const pathname of ["/search", "/start", "/favorites", "/feedback/play_001"]) {
    const response = await request(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(response.body.toString(), /app shell/);
  }
});

test("없는 놀이와 정적 파일은 404이며 JS 요청에 HTML을 돌려주지 않는다", async () => {
  assert.equal((await request("/play/play_999")).status, 404);
  const missingJs = await request("/missing.js");
  assert.equal(missingJs.status, 404);
  assert.doesNotMatch(missingJs.body.toString(), /app shell/);
});

test("서비스 워커·설치 설정은 갱신 가능하고 pnpm 경로의 아이콘 폰트는 압축 제공된다", async () => {
  const sw = await request("/sw.js");
  assert.equal(sw.headers["cache-control"], "no-cache");
  assert.match(sw.headers["content-type"], /javascript/);
  assert.equal(sw.headers["service-worker-allowed"], "/");
  const manifest = await request("/manifest.webmanifest");
  assert.match(manifest.headers["content-type"], /manifest\+json/);
  const font = await request("/assets/node_modules/.pnpm/icons/font.ttf", { headers: { "accept-encoding": "gzip" } });
  assert.equal(font.status, 200);
  assert.equal(font.headers["content-encoding"], "gzip");
  assert.deepEqual(gunzipSync(font.body), Buffer.alloc(2000, 7));
  assert.equal((await request("/sw.js", { method: "HEAD" })).body.length, 0);
});

test("쓰기 요청, 경로 탈출과 숨김 파일 접근을 허용하지 않는다", async () => {
  assert.equal((await request("/", { method: "POST" })).status, 405);
  for (const pathname of ["/%2e%2e/package.json", "/assets/../../package.json", "/.git/config", "/.env", "/assets/%5c../secret"]) {
    assert.equal((await request(pathname)).status, 404, pathname);
  }
  assert.equal((await request("/%ZZ")).status, 400);
});
