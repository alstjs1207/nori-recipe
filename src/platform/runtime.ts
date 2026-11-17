import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppRuntime } from "./contract";

// Metro selects runtime.web.ts for browsers and runtime.toss.ts only for Toss.
export const appRuntime: AppRuntime = {
  target: "native",
  storage: AsyncStorage,
  async initialize() {},
};
