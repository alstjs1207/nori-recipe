import { useCallback, useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";

import { APP_COLORS, APP_FONTS } from "@/constants/theme";
import { WebShell } from "@/components/web/WebShell";
import { useAppFonts } from "@/hooks/useAppFonts";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";

export default function RootLayout() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const initSession = useSessionStore((state) => state.initSession);
  const loadPlays = usePlaysStore((state) => state.loadPlays);
  const fontsLoaded = useAppFonts();

  const bootstrap = useCallback(async () => {
    setBootstrapped(false);
    setBootstrapError(null);

    try {
      await Promise.all([initSession(), loadPlays()]);
      const sessionError = useSessionStore.getState().error;
      const playsError = usePlaysStore.getState().error;

      if (sessionError || playsError) {
        throw new Error(sessionError ?? playsError ?? "앱을 시작하지 못했습니다.");
      }
    } catch (error) {
      setBootstrapError(
        error instanceof Error ? error.message : "앱을 시작하지 못했습니다.",
      );
    } finally {
      setBootstrapped(true);
    }
  }, [initSession, loadPlays]);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    void bootstrap();
  }, [bootstrap]);

  if (!bootstrapped || !fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color={APP_COLORS.accent} size="large" />
      </View>
    );
  }

  if (bootstrapError) {
    return (
      <View style={styles.errorScreen}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>앱을 시작하지 못했어요</Text>
        <Text style={styles.errorBody}>{bootstrapError}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void bootstrap();
          }}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        >
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebShell>
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
        <Stack.Screen name="start" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
      </Stack>
    </WebShell>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: APP_COLORS.background,
  },
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 28,
    backgroundColor: APP_COLORS.background,
  },
  errorTitle: {
    color: APP_COLORS.ink,
    fontSize: 22,
    lineHeight: 29,
    textAlign: "center",
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  errorBody: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: APP_FONTS.body,
  },
  retryButton: {
    minWidth: 140,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: APP_COLORS.mustard,
  },
  retryButtonPressed: {
    opacity: 0.72,
  },
  retryButtonText: {
    color: APP_COLORS.accentText,
    fontSize: 15,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
});
