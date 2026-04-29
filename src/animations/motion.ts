import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

export const MOTION = {
  pressScale: 0.97,
  durations: {
    fast: 140,
    normal: 220,
    slow: 320,
    screen: 420,
  },
  spring: {
    damping: 18,
    stiffness: 220,
    mass: 0.7,
  },
} as const;

export function fadeInUp(delay = 0) {
  return FadeInDown
    .delay(delay)
    .duration(MOTION.durations.screen)
    .easing(Easing.out(Easing.cubic))
    .reduceMotion(ReduceMotion.System);
}

export function quickFadeIn(delay = 0) {
  return FadeIn
    .delay(delay)
    .duration(MOTION.durations.normal)
    .easing(Easing.out(Easing.quad))
    .reduceMotion(ReduceMotion.System);
}

export function fadeOutSoft() {
  return FadeOut
    .duration(MOTION.durations.fast)
    .reduceMotion(ReduceMotion.System);
}

export function fadeOutDownSoft() {
  return FadeOutDown
    .duration(MOTION.durations.fast)
    .reduceMotion(ReduceMotion.System);
}

export const layoutTransition = LinearTransition
  .springify()
  .damping(MOTION.spring.damping)
  .stiffness(MOTION.spring.stiffness)
  .mass(MOTION.spring.mass)
  .reduceMotion(ReduceMotion.System);
