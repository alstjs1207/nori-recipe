import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppRuntime } from "./contract";

export const appRuntime: AppRuntime = {
  target: "web",
  storage: AsyncStorage,
  async initialize() {},
};
