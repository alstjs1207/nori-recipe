import { StyleSheet, Text, View } from "react-native";

import { APP_FONTS } from "@/constants/theme";
import { useIsNewPlay } from "@/hooks/useIsNewPlay";

export function NewPlayBadge({ createdAt }: { createdAt?: string }) {
  if (!useIsNewPlay(createdAt)) return null;
  return (
    <View accessible accessibilityLabel="새로 추가된 놀이" style={styles.badge}>
      <Text style={styles.text}>NEW</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "center",
    flexShrink: 0,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "#5846E8",
  },
  text: {
    color: "#FFFFFF",
    fontFamily: APP_FONTS.body,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
});
