export function tossBackAction(path: string, canGoBack: boolean, dialogOpen: boolean) {
  if (dialogOpen) return "dialog";
  if (path === "/" || path === "/start") return "close";
  return canGoBack ? "back" : "home";
}
