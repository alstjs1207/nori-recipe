const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");
config.resolver.unstable_enableSymlinks = true;

// Build-time selection keeps the Toss SDK and native bridge out of the normal web.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && process.env.EXPO_PUBLIC_APP_TARGET === "toss") {
    if (moduleName === "@/platform/runtime") return { type: "sourceFile", filePath: path.join(__dirname, "src/platform/runtime.toss.ts") };
    if (process.env.TOSS_DEVTOOLS === "1") {
      if (moduleName === "@apps-in-toss/web-framework") return { type: "sourceFile", filePath: require.resolve("@apps-in-toss/devtools/mock/3x") };
      if (moduleName === "@/platform/devtools") return { type: "sourceFile", filePath: path.join(__dirname, "src/platform/devtools.preview.ts") };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
