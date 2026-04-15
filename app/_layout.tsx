import { useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { APP_COLORS } from "@/constants/theme";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";

export default function RootLayout() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const hasStarted = useRef(false);
  const initSession = useSessionStore((state) => state.initSession);
  const loadPlays = usePlaysStore((state) => state.loadPlays);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    void Promise.all([initSession(), loadPlays()]).finally(() => {
      setBootstrapped(true);
    });
  }, [initSession, loadPlays]);

  if (!bootstrapped) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color={APP_COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: APP_COLORS.surface },
          headerTintColor: APP_COLORS.ink,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: APP_COLORS.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: APP_COLORS.background,
  },
});
