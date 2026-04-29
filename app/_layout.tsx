import { useEffect, useRef, useState } from "react";
import {
  IBMPlexSansKR_400Regular,
  IBMPlexSansKR_600SemiBold,
  IBMPlexSansKR_700Bold,
  useFonts,
} from "@expo-google-fonts/ibm-plex-sans-kr";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";

import { APP_COLORS, APP_FONTS } from "@/constants/theme";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";

export default function RootLayout() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const hasStarted = useRef(false);
  const initSession = useSessionStore((state) => state.initSession);
  const loadPlays = usePlaysStore((state) => state.loadPlays);
  const [fontsLoaded] = useFonts({
    IBMPlexSansKR_400Regular,
    IBMPlexSansKR_600SemiBold,
    IBMPlexSansKR_700Bold,
  });

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    void Promise.all([initSession(), loadPlays()]).finally(() => {
      setBootstrapped(true);
    });
  }, [initSession, loadPlays]);

  if (!bootstrapped || !fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color={APP_COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <ReducedMotionConfig mode={ReduceMotion.System} />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          animation: "fade",
          headerStyle: { backgroundColor: APP_COLORS.surface },
          headerTintColor: APP_COLORS.ink,
          headerTitleStyle: { fontWeight: "600", fontFamily: APP_FONTS.heading },
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
