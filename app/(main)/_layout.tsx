import { Redirect, Tabs } from "expo-router";
import { Platform, Text } from "react-native";

import { APP_COLORS, APP_FONTS } from "@/constants/theme";
import { useSessionStore } from "@/store/sessionStore";

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {icon}
    </Text>
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
        tabBarActiveTintColor: APP_COLORS.accent,
        tabBarInactiveTintColor: APP_COLORS.muted,
        tabBarStyle: {
          backgroundColor: APP_COLORS.surface,
          borderTopColor: APP_COLORS.line,
          borderTopWidth: 0.5,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          ...Platform.select({
            ios: {
              shadowColor: APP_COLORS.ink,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarLabelStyle: {
          fontFamily: APP_FONTS.body,
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "기록",
          tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} />,
        }}
      />
      <Tabs.Screen name="play/[id]" options={{ href: null }} />
      <Tabs.Screen name="feedback/[id]" options={{ href: null }} />
    </Tabs>
  );
}
