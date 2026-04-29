import { Redirect } from "expo-router";

import { useSessionStore } from "@/store/sessionStore";

export default function IndexScreen() {
  const onboardingCompleted = useSessionStore((state) => state.onboardingCompleted);

  return <Redirect href={onboardingCompleted ? "/(main)" : "/(onboarding)"} />;
}
