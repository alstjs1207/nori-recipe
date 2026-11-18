import { router as expoRouter } from "expo-router";
import { hrefPath, screenEntries } from "./entries";

export const appRouter = {
  ...expoRouter,
  push(...args: Parameters<typeof expoRouter.push>) {
    screenEntries.forward(hrefPath(args[0]));
    return expoRouter.push(...args);
  },
  navigate(...args: Parameters<typeof expoRouter.navigate>) {
    screenEntries.forward(hrefPath(args[0]));
    return expoRouter.navigate(...args);
  },
  replace(...args: Parameters<typeof expoRouter.replace>) {
    screenEntries.forward(hrefPath(args[0]));
    return expoRouter.replace(...args);
  },
  back() { screenEntries.back(); return expoRouter.back(); },
};
