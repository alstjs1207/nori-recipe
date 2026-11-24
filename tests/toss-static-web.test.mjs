import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { assertNoDynamicCode, checkTossDirectory } from "../scripts/toss/check.mjs";
import { tossHtml } from "../scripts/toss/config.mjs";
import os from "node:os";

const require = createRequire(import.meta.url);
const babel = createRequire(require.resolve("babel-preset-expo"))("@babel/core");
const plugin = require("../scripts/toss/babel-static-web.cjs");
const expo = path.dirname(require.resolve("expo/package.json"));
const core = path.dirname(createRequire(path.join(expo, "package.json")).resolve("expo-modules-core/package.json"));
const uuidFile = path.join(core, "src/uuid/index.web.ts");
const loaderFile = path.join(expo, "src/async-require/fetchThenEval.web.ts");
function transform(source, filename, platform = "web") {
  return babel.transformSync(source, { filename, configFile: false, babelrc: false,
    caller: { name: "toss-regression", platform }, parserOpts: { plugins: ["typescript"] },
    plugins: [plugin], ast: true });
}
function javascript(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}

test("Toss UUID keeps browser crypto and leaves UUID v5 and namespace exports intact", async () => {
  const source = await fs.readFile(uuidFile, "utf8");
  const result = transform(source, uuidFile);
  assertNoDynamicCode(javascript(result.code), "uuid.js");
  assert.match(result.code, /v5: v35\('v5', 0x50, sha1\)/);
  assert.match(result.code, /namespace: Uuidv5Namespace/);
  const fn = result.ast.program.body.find(node => node.type === "FunctionDeclaration" && node.id.name === "uuidv4");
  const isolated = babel.transformFromAstSync(babel.types.file(babel.types.program([fn])), null, { configFile: false, babelrc: false }).code;
  const expected = "8d6f2c7a-b44c-4ed4-bfd5-b835b31f844d";
  let calls = 0;
  const context = { crypto: { randomUUID() { calls++; return expected; } } };
  vm.runInNewContext(javascript(isolated) + ";result=uuidv4();", context);
  assert.equal(context.result, expected);
  assert.equal(calls, 1);
});

test("Toss loader preserves the production browser loader without the server/development dependency", async () => {
  const result = transform(await fs.readFile(loaderFile, "utf8"), loaderFile);
  assert.doesNotMatch(result.code, /fetchThenEvalJs|__DEV__|typeof window/);
  const exports = {};
  const scripts = [];
  const document = { currentScript: null, createElement: () => ({ setAttribute(name, value) { this[name] = value; } }), head: { appendChild(script) {
    scripts.push(script);
    script.parentNode = { removeChild() {} };
    queueMicrotask(() => script.onload());
  } } };
  const code = javascript(result.code);
  assertNoDynamicCode(code, "loader.js");
  vm.runInNewContext(code, { exports, document, window: { location: { origin: "https://nori-recipe.apps.tossmini.com" } } });
  await exports.fetchThenEvalAsync("https://nori-recipe.apps.tossmini.com/local.js", { nonce: "nonce", scriptType: "text/javascript" });
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "https://nori-recipe.apps.tossmini.com/local.js");
  assert.equal(scripts[0].nonce, "nonce");
  assert.equal(scripts[0].type, "text/javascript");
});

test("ordinary web, native, and Toss Devtools retain Expo's original fallbacks", async () => {
  const source = await fs.readFile(uuidFile, "utf8");
  assert.match(transform(source, uuidFile, "ios").code, /eval\('require'\)/);
  assert.match(transform(source, uuidFile, "android").code, /eval\('require'\)/);
  const config = require("../babel.config.js");
  const saved = { target: process.env.EXPO_PUBLIC_APP_TARGET, dev: process.env.TOSS_DEVTOOLS };
  try {
    for (const [target, dev, enabled] of [["web", "", false], ["toss", "1", false], ["toss", "", true]]) {
      process.env.EXPO_PUBLIC_APP_TARGET = target;
      process.env.TOSS_DEVTOOLS = dev;
      const cache = { using: fn => fn() };
      const plugins = config({ cache }).plugins;
      assert.equal(plugins.includes("./scripts/toss/babel-static-web.cjs"), enabled);
    }
  } finally {
    if (saved.target === undefined) delete process.env.EXPO_PUBLIC_APP_TARGET; else process.env.EXPO_PUBLIC_APP_TARGET = saved.target;
    if (saved.dev === undefined) delete process.env.TOSS_DEVTOOLS; else process.env.TOSS_DEVTOOLS = saved.dev;
  }
});

test("unexpected upstream fallback changes stop the targeted transform", async () => {
  const uuid = (await fs.readFile(uuidFile, "utf8")).replace("crypto.randomUUID();\n}", "crypto.getRandomValues(new Uint8Array(16));\n}");
  assert.throws(() => transform(uuid, uuidFile), /UUID fallback changed/);
  const loader = (await fs.readFile(loaderFile, "utf8")).replace("./fetchThenEvalJs", "./different-loader");
  assert.throws(() => transform(loader, loaderFile), /bundle loader fallback changed/);
});

test("dynamic-code gate rejects executable direct, indirect, computed and escaped forms, but permits strings and comments", () => {
  for (const code of ["eval(body)", "(0, eval)(body)", "globalThis.eval(body)", 'window["eval"](body)', "\\u0065val(body)", 'new Function("return 1")', 'Function("return 1")', 'window["Function"]("return 1")', '(0, Function)("return 1")']) {
    assert.throws(() => assertNoDynamicCode(code, "bad.js"), /Dynamic code execution/);
  }
  assert.doesNotThrow(() => assertNoDynamicCode('const explanation = "eval(body)"; // eval(body)\nfunction safe(){return 1}', "safe.js"));
  assert.throws(() => assertNoDynamicCode("const = ;", "broken.js"), /Invalid JavaScript/);
});

test("bundle gate checks scripts and inline HTML scripts before accepting a Toss export", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nori-toss-dynamic-code-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const html = tossHtml('<head><meta name="viewport" content="width=device-width"></head><body></body>');
  await fs.writeFile(path.join(root, "index.html"), html);
  await fs.writeFile(path.join(root, "entry.js"), 'window.storagePrefix="nori-recipe/toss/v1/"; eval(body);');
  await assert.rejects(checkTossDirectory(root), /Dynamic code execution.*entry\.js/);
  await fs.writeFile(path.join(root, "entry.js"), 'window.storagePrefix="nori-recipe/toss/v1/";');
  await fs.writeFile(path.join(root, "index.html"), html.replace("</head>", '<script>eval(body)</script></head>'));
  await assert.rejects(checkTossDirectory(root), /Dynamic code execution.*inline script/);
  await fs.writeFile(path.join(root, "index.html"), html);
  assert.equal((await checkTossDirectory(root)).dynamicCodeChecked, true);
});
