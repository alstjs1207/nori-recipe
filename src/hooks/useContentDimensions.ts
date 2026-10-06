import { Platform, useWindowDimensions } from "react-native";

export function useContentDimensions() {
  const dimensions = useWindowDimensions();
  return Platform.OS === "web" ? { ...dimensions, width: Math.min(dimensions.width, 720) } : dimensions;
}
