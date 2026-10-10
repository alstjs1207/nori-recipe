import assert from "node:assert/strict";
import test from "node:test";
import { getAnalyticsPage } from "./policy";

test("실제 웹 어댑터는 동의 후에만 태그를 로드하고 URL 정리·광고 제한·철회를 적용한다", async () => {
  const origin = "https://nori.example.com";
  const storage = new Map<string, string>();
  const cookies: string[] = [];
  type Script = { id: string; src: string; async: boolean; referrerPolicy: string; onload: (() => void) | null; onerror: (() => void) | null; remove: () => void };
  const scripts: Script[] = [];
  const fakeWindow = {
    location: { origin, hostname: "nori.example.com" },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    setTimeout, clearTimeout, dataLayer: [] as unknown[],
  };
  const fakeDocument = {
    referrer: "https://search.example.com/private?q=child",
    getElementById: () => null,
    createElement: () => ({ id: "", src: "", async: false, referrerPolicy: "", onload: null, onerror: null, remove: () => {} } as Script),
    head: { appendChild: (script: Script) => scripts.push(script) },
    set cookie(value: string) { cookies.push(value); },
  };
  const globals = new Map(["window", "document", "navigator"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const envKeys = ["EXPO_PUBLIC_GA_ENABLED", "EXPO_PUBLIC_GA_MEASUREMENT_ID", "EXPO_PUBLIC_ANALYTICS_ORIGIN"];
  const env = new Map(envKeys.map((key) => [key, process.env[key]]));
  try {
    Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
    Object.defineProperty(globalThis, "document", { value: fakeDocument, configurable: true });
    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    process.env.EXPO_PUBLIC_GA_ENABLED = "true";
    process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID = "G-ABC1234567";
    process.env.EXPO_PUBLIC_ANALYTICS_ORIGIN = origin;
    const { webAnalytics, resetAnalyticsConsent } = await import("./analytics.web");
    assert.equal(webAnalytics.enabled, true);
    webAnalytics.trackPage(getAnalyticsPage("/play/play_200?materials=bead&memo=private"));
    assert.equal(scripts.length, 0);
    assert.equal(fakeWindow.dataLayer.length, 0);
    webAnalytics.setConsent("granted");
    webAnalytics.trackPage(getAnalyticsPage("/play/play_200?materials=bead&memo=private"));
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].referrerPolicy, "no-referrer");
    assert.equal(fakeWindow.dataLayer.length, 0);
    scripts[0].onload?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const commands = () => fakeWindow.dataLayer.map((item) => Array.from(item as ArrayLike<unknown>));
    const setup = commands().find((command) => command[0] === "config")?.[2] as Record<string, unknown>;
    assert.equal(setup.send_page_view, false);
    assert.equal(setup.allow_google_signals, false);
    assert.equal(setup.allow_ad_personalization_signals, false);
    assert.equal(setup.cookie_prefix, "nori");
    assert.equal(setup.cookie_expires, 30 * 86400);
    assert.equal(setup.page_location, `${origin}/play/play_200`);
    webAnalytics.trackPage(getAnalyticsPage("/settings?childName=private"));
    await webAnalytics.track({ name: "favorite_add", params: { play_id: "play_200" } });
    const updates = commands().filter((command) => command[0] === "config");
    assert.equal((updates.at(-1)?.[2] as Record<string, unknown>).page_location, `${origin}/settings`);
    assert.equal((updates.at(-1)?.[2] as Record<string, unknown>).update, true);
    assert(!JSON.stringify(commands()).includes("private"));
    const beforeWithdrawal = fakeWindow.dataLayer.length;
    webAnalytics.setConsent("denied");
    assert.equal(Reflect.get(fakeWindow, "ga-disable-G-ABC1234567"), true);
    assert.equal(await webAnalytics.track({ name: "favorite_remove", params: { play_id: "play_200" } }), false);
    assert.equal(fakeWindow.dataLayer.length, beforeWithdrawal);
    assert(cookies.some((cookie) => cookie.startsWith("nori_ga=") && cookie.includes("Max-Age=0")));
    assert(!cookies.some((cookie) => cookie.startsWith("_ga=")));
    webAnalytics.setConsent("granted");
    webAnalytics.trackPage(getAnalyticsPage("/search"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(scripts.length, 1);
    assert.equal(Reflect.get(fakeWindow, "ga-disable-G-ABC1234567"), false);
    resetAnalyticsConsent();
    assert.equal(storage.size, 0);
  } finally {
    for (const [key, value] of env) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    for (const [name, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
  }
});
