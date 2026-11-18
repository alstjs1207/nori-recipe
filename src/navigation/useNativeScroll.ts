import { useNavigation } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from "react-native";
import { screenEntries } from "./entries";
import { useScreenEntry } from "./useScreenEntry";

export function useNativeScroll() {
  const entry = useScreenEntry();
  const navigation = useNavigation();
  const ref = useRef<ScrollView>(null);
  const restoring = useRef<number | null>(null);
  useEffect(() => {
    if (!entry.version) return;
    restoring.current = entry.scrollY;
    ref.current?.scrollTo({ y: entry.scrollY, animated: false });
  }, [entry]);
  const attach = useCallback((instance: ScrollView | null) => {
    ref.current = instance;
    if (restoring.current !== null) instance?.scrollTo({ y: restoring.current, animated: false });
  }, []);
  return {
    ref: attach,
    scrollEventThrottle: 16,
    onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
      if (!navigation.isFocused()) return;
      const y = event.nativeEvent.contentOffset.y;
      if (restoring.current !== null && Math.abs(y - restoring.current) > 1) return;
      restoring.current = null;
      if (entry.version) screenEntries.save(entry.path, y);
    },
    onScrollBeginDrag() { restoring.current = null; },
    onContentSizeChange() {
      if (restoring.current !== null) ref.current?.scrollTo({ y: restoring.current, animated: false });
    },
  };
}
