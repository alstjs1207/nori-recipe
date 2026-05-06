import { type ComponentProps, useEffect } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Redirect, Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
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

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type TabGlyph = "home" | "search" | "record" | "heart" | "person";

const TAB_ICONS: Record<
  TabGlyph,
  { active: MaterialCommunityIconName; inactive: MaterialCommunityIconName; size: number }
> = {
  home: { active: "home-variant", inactive: "home-variant-outline", size: 27 },
  search: { active: "magnify", inactive: "magnify", size: 28 },
  record: { active: "clipboard-check", inactive: "clipboard-check-outline", size: 27 },
  heart: { active: "heart", inactive: "heart-outline", size: 27 },
  person: { active: "account-circle", inactive: "account-circle-outline", size: 27 },
};

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
    <Animated.View style={[styles.iconWrap, animatedStyle]}>
      {renderGlyph(glyph, focused)}
    </Animated.View>
  );
}

function renderGlyph(glyph: TabGlyph, focused: boolean) {
  const color = focused ? APP_COLORS.accentText : "#8F8F8F";
  const icon = TAB_ICONS[glyph];

  return (
    <MaterialCommunityIcons
      name={focused ? icon.active : icon.inactive}
      size={icon.size}
      color={color}
    />
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
});
