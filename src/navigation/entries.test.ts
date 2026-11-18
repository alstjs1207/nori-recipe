import test from "node:test";
import assert from "node:assert/strict";
import { createScreenEntries, hrefPath, historyKeys, routePath } from "./entries";

test("same-play fresh entry resets while an actual return preserves the source list", () => {
  const entries = createScreenEntries();
  entries.enter("search", "/search", ["home", "search"]);
  entries.save("/search", 650);
  entries.forward("/play/play_010");
  const detail = entries.enter("play", "/play/play_010", ["home", "search", "play"]);
  assert.equal(detail.scrollY, 0);
  entries.save(detail.path, 400);
  entries.back();
  const back = entries.enter("search", "/search", ["home", "search"]);
  assert.equal(back.kind, "back"); assert.equal(back.scrollY, 650);
  entries.forward(detail.path);
  assert.equal(entries.enter("play", detail.path, ["home", "search", "play"]).scrollY, 0);
});

test("home / record fresh entry and same-screen presses never inherit old positions", () => {
  const entries = createScreenEntries();
  const first = entries.enter("home", "/", ["home"]);
  entries.save("/", 600);
  entries.forward("/");
  const again = entries.enter("home", "/", ["home"]);
  assert.ok(again.version > first.version); assert.equal(again.scrollY, 0);
  entries.forward("/search");
  // A source screen observes the intent before the destination focuses.
  assert.equal(entries.enter("home", "/", ["home"]), again);
  assert.equal(entries.enter("search", "/search", ["home", "search"]).kind, "new");
});

test("hardware-back history shrink restores, forward tab revisits start at top", () => {
  const entries = createScreenEntries();
  entries.enter("record", "/record", ["home", "record"]);
  entries.save("/record", 250);
  entries.enter("play", "/play/play_003", ["home", "record", "play"]);
  assert.equal(entries.enter("record", "/record", ["home", "record"]).scrollY, 250);
  entries.enter("home", "/", ["record", "home"]);
  assert.equal(entries.enter("record", "/record", ["home", "record"]).scrollY, 0);
});

test("parameter-only updates and multiple observers do not create a new visit", () => {
  const entries = createScreenEntries();
  const initial = entries.enter("search", "/search", ["search"]);
  assert.equal(entries.enter("search", "/search", ["search"]), initial);
  entries.forward("/search");
  const next = entries.enter("search", "/search", ["search"]);
  assert.equal(entries.enter("search", "/search", ["search"]), next);
  assert.equal(next.version, initial.version + 1);
});

test("route normalization handles groups, dynamic IDs, aliases and external URLs", () => {
  assert.equal(hrefPath({ pathname: "/(main)/play/[id]", params: { id: "play_010" } }), "/play/play_010");
  assert.equal(hrefPath("/search?situation=quiet&reset=1"), "/search");
  assert.equal(routePath({ name: "index" }), "/");
  assert.equal(hrefPath("https://example.test"), null);
  assert.equal(hrefPath("#policy"), null);
  assert.deepEqual(historyKeys({ routes: [], history: [null, {type:"route",key:"x"}, {type:"drawer"}] }), ["x"]);
});

test("real TabRouter retains repeated visits so back cannot skip the latest filtered search", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const expoRequire = createRequire(require.resolve("expo-router/package.json"));
  const { SCREEN_BACK_BEHAVIOR } = await import("./entries");
  type TabState = { index: number; routes: { key: string; name: string; params?: object }[]; history: { type: string; key: string }[] };
  type Action = { type: string; payload?: { name?: string; params?: object }; source?: string };
  const { TabRouter } = expoRequire("@react-navigation/routers") as {
    TabRouter(options: { backBehavior: typeof SCREEN_BACK_BEHAVIOR }): {
      getInitialState(options: object): TabState;
      getStateForAction(state: TabState, action: Action, options: object): TabState | null;
    };
  };
  const options = { routeNames: ["index", "search", "play/[id]"], routeParamList: {}, routeGetIdList: {} };
  const router = TabRouter({ backBehavior: SCREEN_BACK_BEHAVIOR });
  let state = router.getInitialState(options);
  const entries = createScreenEntries();
  const activate = () => {
    const route = state.routes[state.index];
    return entries.enter(route.key, routePath(route), historyKeys(state));
  };
  const navigate = (name: string, params?: object) => {
    state = router.getStateForAction(state, { type: "NAVIGATE", payload: { name, params } }, options)!;
    return activate();
  };
  activate();
  navigate("search", { category: "fine_motor" });
  navigate("play/[id]", { id: "play_010" });
  navigate("index");
  navigate("search", { category: "fine_motor" });
  entries.save("/search", 250);
  const before = state.history.length;
  navigate("play/[id]", { id: "play_003" });
  assert.equal(state.history.length, before + 1, "revisited detail must push, not replace the source URL");
  state = router.getStateForAction(state, { type: "GO_BACK" }, options)!;
  const restored = activate();
  assert.equal(state.routes[state.index].name, "search");
  assert.deepEqual(state.routes[state.index].params, { category: "fine_motor" });
  assert.equal(restored.kind, "back");
  assert.equal(restored.scrollY, 250);
});
