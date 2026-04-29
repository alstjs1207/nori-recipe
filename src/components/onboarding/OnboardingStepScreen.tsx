import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { fadeInUp, layoutTransition } from "@/animations/motion";
import { APP_COLORS, APP_FONTS } from "@/constants/theme";

type OnboardingStepScreenProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  heroArt?: ReactNode;
};

export function OnboardingStepScreen({
  title,
  description,
  children,
  footer,
  heroArt,
}: OnboardingStepScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = !reduceMotion && Platform.OS !== "web";

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.screen}>
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.container,
            footer ? styles.containerWithFooter : null,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            entering={shouldAnimate ? fadeInUp() : undefined}
            layout={shouldAnimate ? layoutTransition : undefined}
            style={styles.hero}
          >
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>
            {heroArt ? <View style={styles.heroArt}>{heroArt}</View> : null}
          </Animated.View>
          <Animated.View
            entering={shouldAnimate ? fadeInUp(80) : undefined}
            layout={shouldAnimate ? layoutTransition : undefined}
            style={styles.content}
          >
            {children}
          </Animated.View>
        </Animated.ScrollView>
        {footer ? (
          <Animated.View
            entering={shouldAnimate ? fadeInUp(140) : undefined}
            layout={shouldAnimate ? layoutTransition : undefined}
            style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            {footer}
          </Animated.View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 32,
    gap: 10,
    backgroundColor: APP_COLORS.background,
  },
  containerWithFooter: {
    paddingBottom: 138,
  },
  hero: {
    minHeight: 154,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroCopy: {
    flex: 1,
    gap: 10,
  },
  heroArt: {
    flexShrink: 0,
  },
  title: {
    color: APP_COLORS.ink,
    fontSize: 28,
    lineHeight: 36,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  description: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  content: {
    gap: 16,
  },
  footer: {
    gap: 12,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: APP_COLORS.background,
  },
});
