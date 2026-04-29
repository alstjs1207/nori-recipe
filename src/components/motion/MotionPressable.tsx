import type { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { MOTION } from "@/animations/motion";

type MotionPressableProps = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  containerStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

export function MotionPressable({
  children,
  containerStyle,
  disabled,
  onPressIn,
  onPressOut,
  pressedStyle,
  scaleTo = MOTION.pressScale,
  style,
  ...props
}: MotionPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(scale.value, {
          damping: MOTION.spring.damping,
          stiffness: MOTION.spring.stiffness,
          mass: MOTION.spring.mass,
          reduceMotion: ReduceMotion.System,
        }),
      },
    ],
  }));

  function resolveStyle(state: PressableStateCallbackType) {
    return [
      typeof style === "function" ? style(state) : style,
      state.pressed ? pressedStyle : null,
    ];
  }

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={(event) => {
          scale.value = disabled ? 1 : scaleTo;
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = 1;
          onPressOut?.(event);
        }}
        style={resolveStyle}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
