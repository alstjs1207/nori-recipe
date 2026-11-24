// Expo also bundles SSR/development fallbacks into its single-file web export.
// Toss runs in a browser: retain the existing browser paths, without shipping
// the server UUID import or the development string-execution loader.
module.exports = function staticTossWeb({ types: t, caller }) {
  const web = caller(value => value?.platform === "web");
  return {
    name: "toss-static-web",
    visitor: {
      FunctionDeclaration(path, state) {
        if (!web) return;
        const filename = (state.filename || "").replaceAll("\\", "/");
        const name = path.node.id?.name;
        const statements = path.get("body.body");
        const source = state.file.code;
        if (filename.endsWith("/expo-modules-core/src/uuid/index.web.ts") && name === "uuidv4") {
          const fallback = statements[0];
          const browser = statements[1];
          if (statements.length !== 2 || !fallback.isIfStatement() ||
            !/eval\(['"]require['"]\)/.test(source.slice(fallback.node.start, fallback.node.end)) ||
            !browser.isReturnStatement() || !t.isCallExpression(browser.node.argument) ||
            !t.isMemberExpression(browser.node.argument.callee) ||
            !t.isIdentifier(browser.node.argument.callee.object, { name: "crypto" }) ||
            !t.isIdentifier(browser.node.argument.callee.property, { name: "randomUUID" })) {
            throw path.buildCodeFrameError("Expo UUID fallback changed; review the Toss browser-only transform.");
          }
          fallback.remove();
        }
        if (filename.endsWith("/expo/src/async-require/fetchThenEval.web.ts") && name === "fetchThenEvalAsync") {
          const fallback = statements[0];
          const code = fallback && source.slice(fallback.node.start, fallback.node.end);
          if (!fallback?.isIfStatement() || !code.includes("typeof window") || !code.includes("__DEV__") ||
            !/require\(['"]\.\/fetchThenEvalJs['"]\)/.test(code) ||
            !statements[1]?.isReturnStatement()) {
            throw path.buildCodeFrameError("Expo bundle loader fallback changed; review the Toss browser-only transform.");
          }
          fallback.remove();
        }
      },
    },
  };
};
