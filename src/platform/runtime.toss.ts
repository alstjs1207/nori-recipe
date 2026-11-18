import { Clipboard, Device, NavigationBar, SafeArea, Screen, Share, Storage, User, graniteEvent, loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";
import "@/platform/devtools";
import { createTossRuntime } from "./toss-runtime";
import { createCompletionAd } from "./completion-ad";

export const appRuntime = createTossRuntime({
  storage: Storage,
  identify: () => User.getAnonymousKey(),
  createLink: (options) => Share.createLink(options),
  share: (options) => Share.sendMessage(options),
  copy: (text) => Clipboard.setText(text),
  close: () => Screen.close(),
  openExternal: (url) => Device.openURL(url),
  configureNavigation: () => NavigationBar.setOptions({
    withBackButton: true, withHomeButton: true, withTitle: true,
    transparentBackground: false, backgroundColor: "#FAFAFE", theme: "dark",
  }),
  onNavigation: (event, onEvent, onError) => graniteEvent.addEventListener(event, { onEvent, onError }),
  getInsets: () => SafeArea.get(),
  onInsets: (onEvent) => SafeArea.subscribe({ onEvent }),
}, process.env.EXPO_PUBLIC_TOSS_APP_NAME || "nori-recipe");

appRuntime.completionAd = createCompletionAd({
  isSupported: () => loadFullScreenAd.isSupported() && showFullScreenAd.isSupported(),
  load: loadFullScreenAd,
  show: showFullScreenAd,
}, process.env.EXPO_PUBLIC_TOSS_COMPLETION_AD_GROUP_ID || "", () =>
  document.visibilityState === "visible" &&
  !document.documentElement.classList.contains("toss-checking-user") &&
  !document.querySelector("dialog[open]"),
);
