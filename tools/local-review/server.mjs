import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildCatalog } from "../../scripts/build-play-catalog.mjs";
import { buildReview } from "../../scripts/build-play-review.mjs";
import { createService } from "./service.mjs";
import { createCodexRequests } from "./codex-requests.mjs";
import { ReviewError, bytesAt, fingerprint, revisionOf, recoverTransaction, hash } from "./files.mjs";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browserScript = fs.readFileSync(new URL("./browser.js", import.meta.url));
const catalogUrl = "/catalog";
const catalogViews = { "/catalog": "plays", "/materials": "materials", "/reviews": "reviews" };
const reviewUrl = (batchId) => "/reviews/" + encodeURIComponent(batchId);
const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
const publicSnapshot = (s) => ({ revision: s.revision, manifest: s.manifest, results: s.results, recovery: s.recovery,
  batches: s.batches.map(({ batch }) => ({ batchId: batch.batchId, title: batch.title, url: reviewUrl(batch.batchId),
    count: batch.playIds.length, registered: batch.playIds.filter((id) => s.bundle.plays.some((p) => p.id === id && p.status === "live" && p.imageStatus !== "review")).length })) });

export function acquireLock(root) {
  const file = path.join(os.tmpdir(), "nori-local-review-" + hash(root).slice(0, 24) + ".lock");
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    try { process.kill(saved.pid, 0); throw new ReviewError(409, "이 저장소의 로컬 검수 서버가 이미 실행 중입니다."); }
    catch (error) { if (error.code === "ESRCH") fs.unlinkSync(file); else throw error; }
  }
  const bytes = JSON.stringify({ pid: process.pid, id: crypto.randomUUID() });
  fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
  return () => { if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === bytes) fs.unlinkSync(file); };
}

async function bodyOf(req) {
  if (req.headers["content-type"]?.split(";")[0] !== "application/json") throw new ReviewError(415, "JSON 요청만 저장할 수 있습니다.");
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new ReviewError(413, "검수 요청이 너무 큽니다.");
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new ReviewError(400, "잘못된 JSON 요청입니다."); }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !["revision", "results", "id"].includes(k))) throw new ReviewError(400, "잘못된 저장 요청입니다.");
  return value;
}

function render(root, snapshot, selected, token, initialView, codex) {
  let html = selected ? buildReview(root, selected.batchPath, selected.output, { write: false, serverUrls: true }).html
    : buildCatalog(root, "results/play-catalog.html", { write: false, serverUrls: true, initialView }).html;
  const config = { token, revision: snapshot.revision, batchId: selected?.batch.batchId ?? null, recovery: snapshot.recovery, codex };
  const bridge = '<script type="application/json" id="local-review-config">' + safeJson(config) + '</script><script src="/local-review/browser.js"></script>';
  if (selected) {
    const data = { manifest: snapshot.manifest, initialRecords: snapshot.results.records, initialMaterialRecords: snapshot.results.materialRecords };
    html = html.replace(/(<script type="application\/json" id="review-data">)[\s\S]*?(<\/script>)/, (_, open, close) => open + safeJson(data) + close);
    html = html.replace('<script type="application/json" id="review-data">', bridge + '<script type="application/json" id="review-data">');
    html = html.replace("놀이·재료 검수 상태와 의견은 이 브라우저에 자동 저장됩니다.", "놀이·재료 검수 상태와 의견은 이 컴퓨터의 서버 파일에 자동 저장됩니다.");
    html = html.replace("내보낸 결과는 승인된 항목만 반영하며, 수정 요청·보류·미검수 항목은 현재 등록 상태를 유지합니다.", "승인하면 해당 놀이가 로컬에 등록됩니다. JSON 가져오기는 검수 기록만 저장합니다.");
    html = html.replace("브라우저 기록은 같은 브라우저·파일 위치에서 유지됩니다. 다른 기기에서 이어갈 때는 내보내기와 가져오기를 사용하세요.", "서버 저장은 재시작·다른 브라우저에서도 복원됩니다. 기존 file:// 검수는 계속 사용할 수 있고, 기록은 JSON으로 가져올 수 있습니다. 반영한 파일과 복구 기록은 results/local-review/transactions/에 보관됩니다.");
  } else html = html.replace("</body>", bridge + "</body>");
  if (revisionOf(fingerprint(root)) !== snapshot.revision) throw new ReviewError(409, "화면을 만드는 중 파일이 변경되었습니다. 새로고침해 주세요.");
  return html;
}

export async function startServer({ root = project, port = 4317, codex: codexOptions } = {}) {
  root = fs.realpathSync(root);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ReviewError(400, "포트는 0~65535 정수로 지정하세요.");
  const release = acquireLock(root), service = createService(root), token = crypto.randomBytes(32).toString("hex");
  const codex = createCodexRequests(root, service, codexOptions);
  const server = http.createServer(async (req, res) => {
    const send = (status, value, type = "application/json; charset=utf-8") => {
      res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      res.end(req.method === "HEAD" ? undefined : Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value));
    };
    try {
      const actualPort = server.address().port;
      const hosts = ["127.0.0.1:" + actualPort, "localhost:" + actualPort];
      if (!hosts.includes(req.headers.host)) throw new ReviewError(403, "이 서버의 localhost 주소만 사용할 수 있습니다.");
      const requestUrl = new URL(req.url, "http://" + req.headers.host);
      const pathname = decodeURIComponent(requestUrl.pathname);
      const redirect = (location) => {
        res.writeHead(302, { Location: location + requestUrl.search, "Cache-Control": "no-store" });
        res.end();
      };
      if (!["GET", "HEAD", "POST"].includes(req.method)) throw new ReviewError(405, "지원하지 않는 요청입니다.");
      if (req.method === "POST") {
        if (req.headers.origin !== "http://" + req.headers.host || req.headers["x-nori-review-token"] !== token ||
            req.headers["sec-fetch-site"] && !["same-origin", "none"].includes(req.headers["sec-fetch-site"])) throw new ReviewError(403, "이 검수 화면에서 보낸 저장 요청만 허용합니다. 서버 재시작 후에는 새로고침하세요.");
        const match = pathname.match(/^\/api\/local-review\/batches\/([a-z0-9-]+)\/(save|approve|materials|codex-request)$/);
        if (!match) throw new ReviewError(404, "저장 API를 찾을 수 없습니다.");
        const body = await bodyOf(req);
        if (match[2] === "codex-request") {
          if (Object.keys(body).some((key) => key !== "revision")) throw new ReviewError(400, "검수 요청에는 현재 버전만 지정하세요.");
          return send(200, await codex.request(match[1], body.revision));
        }
        if (match[2] !== "save" && (typeof body.id !== "string" || !/^[a-z0-9_]+$/.test(body.id))) throw new ReviewError(400, "반영할 항목 ID가 필요합니다.");
        let result;
        try { result = await service.mutate(match[1], body, match[2] === "save" ? null : { type: match[2] === "approve" ? "play" : "material", id: body.id }); }
        catch (error) { if (!error.status && !error.code) error.status = 400; throw error; }
        return send(200, result);
      }
      if (["/", catalogUrl + "/", "/results/play-catalog.html"].includes(pathname)) return redirect(catalogUrl);
      if (["/materials/", "/reviews/"].includes(pathname)) return redirect(pathname.slice(0, -1));
      if (pathname === "/local-review/browser.js") return send(200, browserScript, "text/javascript; charset=utf-8");
      const api = pathname.match(/^\/api\/local-review\/(batches|version)(?:\/([a-z0-9-]+))?$/);
      if (api) {
        const snapshot = service.read(api[2]);
        return send(200, api[1] === "version" ? { revision: snapshot.revision, recovery: snapshot.recovery } : publicSnapshot(snapshot));
      }
      if (/^\/images\/(?:plays|material)\/[a-zA-Z0-9_-]+\.(?:jpeg|jpg|png|webp)$/.test(pathname)) {
        const bytes = bytesAt(root, pathname.slice(1));
        if (!bytes) throw new ReviewError(404, "이미지가 없습니다.");
        const ext = path.extname(pathname);
        return send(200, bytes, ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg");
      }
      const list = service.read();
      const batch = list.batches.find((b) => [reviewUrl(b.batch.batchId), reviewUrl(b.batch.batchId) + "/", "/" + b.output].includes(pathname));
      if (batch && pathname !== reviewUrl(batch.batch.batchId)) return redirect(reviewUrl(batch.batch.batchId));
      const initialView = Object.hasOwn(catalogViews, pathname) ? catalogViews[pathname] : null;
      if (!initialView && !batch) throw new ReviewError(404, "허용된 검수 화면·이미지만 열 수 있습니다.");
      const snapshot = batch ? service.read(batch.batch.batchId) : list;
      return send(200, render(root, snapshot, batch, token, initialView, codex.connection()), "text/html; charset=utf-8");
    } catch (error) {
      send(error.status ?? (error instanceof URIError ? 400 : 500), { error: error.message,
        ...(/^codex:\/\/threads\/[a-f0-9-]{36}$/i.test(error.threadUrl ?? "") ? { threadUrl: error.threadUrl } : {}) });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.on("close", release);
  try { await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); }); }
  catch (error) { release(); throw error; }
  return { server, url: "http://127.0.0.1:" + server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const args = process.argv.slice(2);
    let port = 4317, recovery;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--port" && args[i + 1]) port = Number(args[++i]);
      else if (args[i] === "--recover" && args[i + 1]) recovery = args[++i];
      else throw new Error("사용법: pnpm review:local [--port 4317] [--recover 거래ID]");
    }
    if (recovery) {
      const release = acquireLock(fs.realpathSync(project));
      try { console.info(JSON.stringify(recoverTransaction(project, recovery), null, 2)); } finally { release(); }
    } else {
      const instance = await startServer({ port });
      console.info("로컬 검수: " + instance.url + catalogUrl + "\n저장: results/local-review/state.json\n종료: Ctrl+C");
      for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => instance.server.close(() => process.exit(0)));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
