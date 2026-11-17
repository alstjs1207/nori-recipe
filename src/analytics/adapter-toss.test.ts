import assert from "node:assert/strict";
import test from "node:test";

test("토스는 잘못 주입된 운영·Preview 분석 설정과 기존 동의도 읽거나 전송하지 않는다", async () => {
  const globals = new Map(["window", "document", "navigator"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const keys = ["EXPO_PUBLIC_APP_TARGET", "EXPO_PUBLIC_GA_ENABLED", "EXPO_PUBLIC_GA_MEASUREMENT_ID", "EXPO_PUBLIC_ANALYTICS_ORIGIN", "EXPO_PUBLIC_ANALYTICS_PREVIEW"];
  const env = new Map(keys.map(key => [key, process.env[key]]));
  let reads = 0, scripts = 0;
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://nori-recipe.apps.tossmini.com" }, localStorage: { getItem: () => { reads++; return "existing-web-consent"; } } } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { referrer: "", createElement: () => { scripts++; } } });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
    Object.assign(process.env, { EXPO_PUBLIC_APP_TARGET: "toss", EXPO_PUBLIC_GA_ENABLED: "true", EXPO_PUBLIC_ANALYTICS_PREVIEW: "true", EXPO_PUBLIC_GA_MEASUREMENT_ID: "G-ABC1234567", EXPO_PUBLIC_ANALYTICS_ORIGIN: "https://nori-recipe.apps.tossmini.com" });
    const { webAnalytics } = await import("./analytics.web");
    assert.equal(webAnalytics.enabled, false);
    assert.equal(webAnalytics.consentAvailable, false);
    webAnalytics.setConsent("granted");
    assert.equal(await webAnalytics.track({ name: "favorite_add", params: { play_id: "play_001" } }), false);
    assert.equal(reads, 0); assert.equal(scripts, 0);
  } finally {
    for (const [key, value] of env) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    for (const [name, value] of globals) { if (value) Object.defineProperty(globalThis, name, value); else Reflect.deleteProperty(globalThis, name); }
  }
});
