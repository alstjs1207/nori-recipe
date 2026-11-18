import { Link, type LinkProps } from "expo-router";
import { hrefPath, screenEntries } from "./entries";

/** Explicit app entries reset position; modifier/new-window links keep browser behavior. */
export function AppLink({ onPress, ...props }: LinkProps) {
  return <Link {...props} onPress={event => {
    onPress?.(event);
    const pointer = event as { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number };
    if (event.defaultPrevented || props.target === "_blank" || pointer.metaKey || pointer.ctrlKey || pointer.shiftKey || pointer.altKey || (pointer.button !== undefined && pointer.button !== 0)) return;
    screenEntries.forward(hrefPath(props.href));
  }} />;
}
