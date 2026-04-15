import { Redirect, Stack, usePathname } from "expo-router";

import { OnboardingProgressHeader } from "@/components/onboarding/OnboardingProgressHeader";
import { APP_COLORS } from "@/constants/theme";
import { useSessionStore } from "@/store/sessionStore";

export default function OnboardingLayout() {
  const pathname = usePathname();
  const onboardingCompleted = useSessionStore((state) => state.onboardingCompleted);
  const currentStep = getCurrentStep(pathname);

  if (onboardingCompleted) {
    return <Redirect href="/(main)" />;
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: APP_COLORS.background },
        headerShadowVisible: false,
        header: () => <OnboardingProgressHeader currentStep={currentStep} />,
      }}
    >
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="child-info" options={{ title: "" }} />
      <Stack.Screen name="materials" options={{ title: "" }} />
      <Stack.Screen name="first-result" options={{ title: "" }} />
    </Stack>
  );
}

function getCurrentStep(pathname: string): number {
  if (pathname.endsWith("/child-info")) {
    return 1;
  }

  if (pathname.endsWith("/materials")) {
    return 2;
  }

  if (pathname.endsWith("/first-result")) {
    return 3;
  }

  return 0;
}
