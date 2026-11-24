import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export function assertNoDynamicCode(source, name) {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  if (file.parseDiagnostics.length) throw new Error(`Invalid JavaScript in Toss bundle: ${name}`);
  const property = node => ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : null;
  const callee = node => {
    if (ts.isParenthesizedExpression(node)) return callee(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) return callee(node.right);
    if (ts.isPropertyAccessExpression(node)) return property(node.name);
    if (ts.isElementAccessExpression(node)) return property(node.argumentExpression);
    return property(node);
  };
  function visit(node) {
    if ((ts.isIdentifier(node) && node.text === "eval") ||
        (ts.isElementAccessExpression(node) && property(node.argumentExpression) === "eval")) {
      throw new Error(`Dynamic code execution (eval) in Toss bundle: ${name}`);
    }
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && callee(node.expression) === "Function") {
      throw new Error(`Dynamic code execution (Function constructor) in Toss bundle: ${name}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

export async function tossFiles(directory, prefix = "") {
  const entries = await fs.readdir(path.join(directory, prefix), { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected bundle symlink: ${name}`);
    return entry.isDirectory() ? tossFiles(directory, name) : [{ name, bytes: (await fs.stat(path.join(directory, name))).size }];
  }))).flat();
}

export async function checkTossDirectory(directory) {
  const files = await tossFiles(directory);
  const bytes = files.reduce((total, file) => total + file.bytes, 0);
  if (bytes > 100_000_000) throw new Error(`Toss bundle exceeds 100MB: ${bytes}`);
  for (const { name } of files) {
    const expoAsset = /^assets\/.+\.(?:ttf|woff2?|png|webp|svg)$/.test(name);
    if (!expoAsset && /(?:^|\/)(?:\.[^/]+|node_modules|generated|results|tools)(?:\/|$)|\.(?:map|jpe?g)$|(?:^|\/)(?:pwa\.js|sw\.js|manifest\.webmanifest)$/.test(name)) throw new Error(`Private, debug or PWA file in Toss bundle: ${name}`);
    if (/\.(?:js|html|css|json)$/.test(name)) {
      const text = await fs.readFile(path.join(directory, name), "utf8");
      if (/__aitDevtools|__ait_storage:|sourceMappingURL=|sb_secret_[A-Za-z0-9_]+|SUPABASE_SERVICE_ROLE_KEY\s*[:=]/.test(text)) throw new Error(`Debug code or credentials in Toss bundle: ${name}`);
      if (name.endsWith(".js")) assertNoDynamicCode(text, name);
      if (name.endsWith(".html")) {
        for (const script of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
          if (script[1].trim()) assertNoDynamicCode(script[1], `${name} (inline script)`);
        }
      }
    }
  }
  const html = await fs.readFile(path.join(directory, "index.html"), "utf8");
  if (!html.includes('data-nori-target="toss"') || !html.includes('href="/toss.css"') || !html.includes("user-scalable=no") || /pwa\.js|rel="manifest"|rel="canonical"/.test(html)) throw new Error("Invalid Toss entry HTML");
  const scripts = files.filter(file => file.name.endsWith(".js"));
  const texts = await Promise.all(scripts.map(file => fs.readFile(path.join(directory, file.name), "utf8")));
  if (!texts.some(text => text.includes("nori-recipe/toss/v1/"))) throw new Error("Toss runtime is missing from the bundle");
  return { bytes, files: files.length, scripts: scripts.length, dynamicCodeChecked: true };
}
