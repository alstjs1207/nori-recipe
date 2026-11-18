import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { historyKeys, routePath, screenEntries, type ScreenEntry } from "./entries";

const INITIAL: ScreenEntry = { version: 0, kind: "new", path: "/", scrollY: 0 };
export function useScreenEntry() {
  const navigation = useNavigation();
  const [entry, setEntry] = useState(INITIAL);
  const sync = useCallback(() => {
    if (!navigation.isFocused()) return;
    const state = navigation.getState();
    if (!state) return;
    const route = state.routes[state.index ?? 0];
    if (route) setEntry(screenEntries.enter(route.key, routePath(route), historyKeys(state)));
  }, [navigation]);
  useFocusEffect(sync);
  useEffect(() => screenEntries.subscribe(sync), [sync]);
  useEffect(() => navigation.addListener("state", sync), [navigation, sync]);
  return entry;
}
