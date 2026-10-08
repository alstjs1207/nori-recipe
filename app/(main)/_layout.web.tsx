import { Tabs } from "expo-router";
import { WebNavigation } from "@/components/web/NoriUI";

export default function MainWebLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#FAFAFE" },
      }}
      tabBar={() => <WebNavigation placement="bottom" />}
    >
      <Tabs.Screen name="index" options={{ title: "발견" }} />
      <Tabs.Screen name="search" options={{ title: "탐색" }} />
      <Tabs.Screen name="favorites" options={{ title: "저장" }} />
      <Tabs.Screen name="record" options={{ title: "기록" }} />
      <Tabs.Screen name="mypage" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="play/[id]" options={{ href: null }} />
      <Tabs.Screen name="feedback/[id]" options={{ href: null }} />
    </Tabs>
  );
}
