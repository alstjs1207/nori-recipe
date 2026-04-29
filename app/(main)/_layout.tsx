import { useEffect } from "react";
import { Redirect, Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { MOTION } from "@/animations/motion";
import { APP_COLORS, APP_FONTS } from "@/constants/theme";
import { useSessionStore } from "@/store/sessionStore";

type TabGlyph = "home" | "search" | "record" | "heart" | "person";

function TabIcon({ focused, glyph }: { focused: boolean; glyph: TabGlyph }) {
  const scale = useSharedValue(focused ? 1 : 0.94);
  const opacity = useSharedValue(focused ? 1 : 0.72);
  const translateY = useSharedValue(focused ? -1 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.94, {
      damping: MOTION.spring.damping,
      stiffness: MOTION.spring.stiffness,
      mass: 0.8,
      reduceMotion: ReduceMotion.System,
    });
    opacity.value = withTiming(focused ? 1 : 0.62, {
      duration: MOTION.durations.fast,
      reduceMotion: ReduceMotion.System,
    });
    translateY.value = withTiming(focused ? -1 : 0, {
      duration: MOTION.durations.fast,
      reduceMotion: ReduceMotion.System,
    });
  }, [focused, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.iconWrap, glyph === "record" && styles.recordIconWrap, animatedStyle]}>
      {renderGlyph(glyph, focused)}
    </Animated.View>
  );
}

function renderGlyph(glyph: TabGlyph, focused: boolean) {
  const color = focused ? APP_COLORS.accentText : "#8F8F8F";

  if (glyph === "home") {
    return (
      <View style={styles.homeGlyph}>
        <View style={[styles.homeRoof, { backgroundColor: color }]} />
        <View style={[styles.homeBody, { borderColor: color }]} />
      </View>
    );
  }

  if (glyph === "search") {
    return (
      <View style={styles.searchGlyph}>
        <View style={[styles.searchRing, { borderColor: color }]} />
        <View style={[styles.searchHandle, { backgroundColor: color }]} />
      </View>
    );
  }

  if (glyph === "record") {
    return (
      <View style={styles.recordGlyph}>
        <Text style={styles.recordGlyphText}>+</Text>
      </View>
    );
  }

  if (glyph === "heart") {
    return <Text style={[styles.symbolGlyph, { color }]}>{focused ? "♥" : "♡"}</Text>;
  }

  return (
    <View style={styles.personGlyph}>
      <View style={[styles.personHead, { backgroundColor: color }]} />
      <View style={[styles.personBody, { borderColor: color }]} />
    </View>
  );
}

export default function MainLayout() {
  const onboardingCompleted = useSessionStore((state) => state.onboardingCompleted);

  if (!onboardingCompleted) {
    return <Redirect href="/(onboarding)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: APP_COLORS.background,
        },
        tabBarActiveTintColor: "#F2C600",
        tabBarInactiveTintColor: "#8F8F8F",
        tabBarStyle: {
          backgroundColor: APP_COLORS.surface,
          borderTopColor: APP_COLORS.line,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 92 : 76,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          ...Platform.select({
            ios: {
              shadowColor: "#1D1D1D",
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.06,
              shadowRadius: 22,
            },
            android: { elevation: 10 },
          }),
        },
        tabBarItemStyle: {
          paddingTop: 4,
          paddingBottom: 4,
        },
        tabBarLabelStyle: {
          fontFamily: APP_FONTS.body,
          fontSize: 11,
          lineHeight: 13,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ focused }) => <TabIcon glyph="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "검색",
          tabBarIcon: ({ focused }) => <TabIcon glyph="search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "놀이 기록",
          tabBarIcon: ({ focused }) => <TabIcon glyph="record" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "찜",
          tabBarIcon: ({ focused }) => <TabIcon glyph="heart" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: "마이페이지",
          tabBarIcon: ({ focused }) => <TabIcon glyph="person" focused={focused} />,
        }}
      />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="play/[id]" options={{ href: null }} />
      <Tabs.Screen name="feedback/[id]" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 30,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  recordIconWrap: {
    width: 56,
    height: 36,
  },
  homeGlyph: {
    width: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  homeRoof: {
    position: "absolute",
    top: 1,
    width: 11,
    height: 11,
    transform: [{ rotate: "45deg" }],
    borderTopLeftRadius: 3,
  },
  homeBody: {
    width: 15,
    height: 11,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  searchGlyph: {
    width: 24,
    height: 24,
  },
  searchRing: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 15,
    height: 15,
    borderRadius: 999,
    borderWidth: 2,
  },
  searchHandle: {
    position: "absolute",
    right: 3,
    bottom: 4,
    width: 9,
    height: 2,
    borderRadius: 999,
    transform: [{ rotate: "45deg" }],
  },
  recordGlyph: {
    width: 50,
    height: 50,
    marginTop: -16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
    shadowColor: "#1D1D1D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  recordGlyphText: {
    color: APP_COLORS.accentText,
    fontSize: 34,
    lineHeight: 36,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  symbolGlyph: {
    fontSize: 26,
    lineHeight: 28,
    fontFamily: APP_FONTS.heading,
  },
  personGlyph: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  personHead: {
    position: "absolute",
    top: 2,
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  personBody: {
    width: 16,
    height: 10,
    borderWidth: 2,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomWidth: 0,
  },
});
