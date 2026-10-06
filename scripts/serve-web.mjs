import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gzip, brotliCompress } from "node:zlib";
import { escapeHtml } from "./web/html.mjs";

const compressGzip = promisify(gzip);
const compressBrotli = promisify(brotliCompress);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const appRoutes = new Set(["/", "/start", "/search", "/favorites", "/record", "/mypage", "/settings", "/history", "/child-info", "/materials", "/first-result"]);

export function createWebServer({ directory = path.join(root, "dist"), publicOrigin = process.env.PUBLIC_ORIGIN } = {}) {
  const base = path.resolve(directory);
  const compressed = new Map();
  return http.createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return;
    }
    try {
      const decoded = decodeURIComponent((request.url ?? "/").split("?")[0]);
      if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("\0") || decoded.split("/").some((part) => part === ".." || part === "." || (part.startsWith(".") && part !== ".pnpm"))) {
        response.writeHead(404); response.end("Not found"); return;
      }
      if (decoded === "/health") {
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(request.method === "HEAD" ? undefined : '{"status":"ok"}'); return;
      }
      const pathname = decoded.length > 1 ? decoded.replace(/\/$/, "") : decoded;
      let filename = path.join(base, pathname);
      let status = 200;
      try {
        const info = await fs.stat(filename);
        if (info.isDirectory()) filename = path.join(filename, "index.html");
        await fs.access(filename);
      } catch {
        const isAppRoute = appRoutes.has(pathname) || /^\/feedback\/play_\d{3}$/.test(pathname);
        const isPlayRoute = /^\/play\/[^/]+$/.test(pathname);
        if (!isAppRoute && !isPlayRoute) { response.writeHead(404); response.end("Not found"); return; }
        filename = path.join(base, "index.html");
        if (isPlayRoute) status = 404;
      }
      const extension = path.extname(filename);
      const type = types[extension] ?? "application/octet-stream";
      const stats = await fs.stat(filename);
      let body = await fs.readFile(filename);
      if (extension === ".html") {
        const protocol = request.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const origin = new URL(publicOrigin ?? `${protocol}://${request.headers.host ?? "localhost"}`).origin;
        body = Buffer.from(body.toString("utf8").replaceAll("__NORI_ORIGIN__", escapeHtml(origin)));
      }
      response.setHeader("Content-Type", type);
      response.setHeader("Cache-Control", extension === ".html" || pathname === "/sw.js" || pathname === "/manifest.webmanifest" ? "no-cache" : pathname.startsWith("/_expo/static/") ? "public, max-age=31536000, immutable" : "public, max-age=3600");
      if (pathname === "/sw.js") response.setHeader("Service-Worker-Allowed", "/");
      const accepted = request.headers["accept-encoding"] ?? "";
      const encoding = /\bbr\b/.test(accepted) ? "br" : /\bgzip\b/.test(accepted) ? "gzip" : null;
      if (encoding && body.length > 1024 && /^(text\/|font\/|application\/(json|manifest\+json|wasm))/.test(type)) {
        const key = `${filename}:${stats.mtimeMs}:${encoding}`;
        if (extension !== ".html" && compressed.has(key)) body = compressed.get(key);
        else {
          body = await (encoding === "br" ? compressBrotli(body) : compressGzip(body));
          if (extension !== ".html") compressed.set(key, body);
        }
        response.setHeader("Content-Encoding", encoding);
      }
      response.setHeader("Vary", "Accept-Encoding");
      response.setHeader("Content-Length", body.length);
      response.writeHead(status);
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error instanceof URIError ? "Bad request" : "웹 빌드가 필요합니다. pnpm build:web을 먼저 실행해 주세요.");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 4173);
  const host = process.env.HOST ?? "127.0.0.1";
  try { await fs.access(path.join(root, "dist/index.html")); }
  catch { console.error("pnpm build:web을 먼저 실행해 주세요."); process.exit(1); }
  const server = createWebServer();
  server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.info(`노리 레시피 웹: http://${host}:${port}`));
}
