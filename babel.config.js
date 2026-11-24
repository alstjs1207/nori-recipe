module.exports = function (api) {
  const target = api.cache.using(() => `${process.env.EXPO_PUBLIC_APP_TARGET || "web"}:${process.env.TOSS_DEVTOOLS || ""}`);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      ...(target === "toss:" ? ["./scripts/toss/babel-static-web.cjs"] : []),
      "react-native-reanimated/plugin",
    ],
  };
};
