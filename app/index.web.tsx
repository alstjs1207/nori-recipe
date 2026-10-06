import { Redirect } from "expo-router";
import { WebWelcome } from "@/components/web/WebWelcome";
import { useSessionStore } from "@/store/sessionStore";

export default function WebIndexScreen() {
  const completed = useSessionStore((state) => state.onboardingCompleted);
  const birthMonth = useSessionStore((state) => state.userContext.childBirthMonth);
  return completed && birthMonth !== null ? <Redirect href="/(main)" /> : <WebWelcome />;
}
