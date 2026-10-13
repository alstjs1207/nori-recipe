import assert from "node:assert/strict";
import test from "node:test";
import { ANALYTICS_CONSENT_KEY, ANALYTICS_PREVIEW_CONSENT_KEY, getAnalyticsPage } from "./policy";

test("Preview 웹 어댑터는 운영 동의를 보존하고 동의 후에도 태그·쿠키·이벤트를 만들지 않는다", async () => {
  const origin = "https://nori-preview.vercel.app";
  const storage = new Map([[ANALYTICS_CONSENT_KEY, "production-choice"]]);
  let scripts = 0;
  let cookies = 0;
  const fakeWindow = {
    location: { origin, hostname: "nori-preview.vercel.app" },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  };
  const globals = new Map(["window", "document", "navigator"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const envKeys = ["EXPO_PUBLIC_GA_ENABLED", "EXPO_PUBLIC_GA_MEASUREMENT_ID", "EXPO_PUBLIC_ANALYTICS_ORIGIN", "EXPO_PUBLIC_ANALYTICS_PREVIEW"];
  const env = new Map(envKeys.map((key) => [key, process.env[key]]));
  try {
    Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    Object.defineProperty(globalThis, "document", { value: {
      referrer: "", createElement: () => { scripts += 1; throw new Error("Preview must never load Google tag"); },
      set cookie(_value: string) { cookies += 1; },
    }, configurable: true });
    process.env.EXPO_PUBLIC_ANALYTICS_PREVIEW = "true";
    // Even a matching GA4 configuration must not override Preview's hard block.
    process.env.EXPO_PUBLIC_GA_ENABLED = "true";
    process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID = "G-ABC1234567";
    process.env.EXPO_PUBLIC_ANALYTICS_ORIGIN = origin;
    const { webAnalytics, resetAnalyticsConsent } = await import("./analytics.web");
    assert.equal(webAnalytics.enabled, false);
    assert.equal(webAnalytics.consentAvailable, true);
    assert.equal(webAnalytics.getConsent(), "unknown");
    webAnalytics.setConsent("granted");
    assert.equal(webAnalytics.getConsent(), "granted");
    assert.equal(JSON.parse(storage.get(ANALYTICS_PREVIEW_CONSENT_KEY)!).value, "granted");
    for (const path of ["/play/play_200", "/search", "/settings"]) webAnalytics.trackPage(getAnalyticsPage(path));
    assert.equal(await webAnalytics.track({ name: "favorite_add", params: { play_id: "play_200" } }), false);
    webAnalytics.setConsent("denied");
    resetAnalyticsConsent();
    assert.equal(storage.has(ANALYTICS_PREVIEW_CONSENT_KEY), false);
    assert.equal(storage.get(ANALYTICS_CONSENT_KEY), "production-choice");
    assert.equal(Reflect.get(fakeWindow, "dataLayer"), undefined);
    assert.equal(Reflect.get(fakeWindow, "gtag"), undefined);
    assert.equal(scripts, 0);
    assert.equal(cookies, 0);
  } finally {
    for (const [key, value] of env) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    for (const [name, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
  }
});
