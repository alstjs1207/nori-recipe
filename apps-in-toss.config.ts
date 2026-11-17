import { defineConfig } from "@apps-in-toss/web-framework/config";

const appName = process.env.TOSS_APP_NAME || "nori-recipe";
if (!/^[a-z][a-z0-9-]{0,49}$/.test(appName)) throw new Error("TOSS_APP_NAME을 확인해 주세요.");

export default defineConfig({
  appName,
  webBundleDir: "dist-toss",
  permissions: [{ name: "clipboard", access: "write" }],
  navigationBar: { withBackButton: true, withHomeButton: true, withTitle: true, theme: "dark" },
  webView: { bounces: false, pullToRefreshEnabled: false, overScrollMode: "never", allowsBackForwardNavigationGestures: false },
});
