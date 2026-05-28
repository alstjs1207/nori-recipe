import { useCallback, useMemo, useRef, useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import {
  Image,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { fadeInUp, layoutTransition } from "@/animations/motion";
import { MotionPressable } from "@/components/motion/MotionPressable";
import { OnboardingStepScreen } from "@/components/onboarding/OnboardingStepScreen";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getBirthMonthOptions } from "@/onboarding/utils";
import { useSessionStore } from "@/store/sessionStore";

const onboardingHeroImage = require("../../images/onboarding/onboarding.png");
const birthMonthOptions = getBirthMonthOptions();
const DEFAULT_AGE_MONTHS = 17;
const MIN_AGE_MONTHS = 0;
const MAX_AGE_MONTHS = 48;
const AGE_ITEM_HEIGHT = 44;
const AGE_WHEEL_VISIBLE_ROWS = 5;
const AGE_WHEEL_HEIGHT = AGE_ITEM_HEIGHT * AGE_WHEEL_VISIBLE_ROWS;
const AGE_WHEEL_PADDING = (AGE_WHEEL_HEIGHT - AGE_ITEM_HEIGHT) / 2;
const AGE_WHEEL_CENTER_ROW = Math.floor(AGE_WHEEL_VISIBLE_ROWS / 2);

function clampAgeMonths(ageMonths: number): number {
  return Math.min(Math.max(ageMonths, MIN_AGE_MONTHS), MAX_AGE_MONTHS);
}

function getAgeMonthsFromMonthIndex(monthIndex: number | null): number {
  if (monthIndex === null) {
    return DEFAULT_AGE_MONTHS;
  }

  return (
    birthMonthOptions.find((option) => option.monthIndex === monthIndex)?.ageMonths ??
    DEFAULT_AGE_MONTHS
  );
}

function getMonthIndexFromAgeMonths(ageMonths: number): number {
  return (
    birthMonthOptions.find((option) => option.ageMonths === ageMonths)?.monthIndex ??
    birthMonthOptions.find((option) => option.ageMonths === DEFAULT_AGE_MONTHS)?.monthIndex ??
    birthMonthOptions[0].monthIndex
  );
}

function formatAgeSummary(ageMonths: number): string {
  if (ageMonths < 12) {
    return `만 ${ageMonths}개월`;
  }

  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;

  if (months === 0) {
    return `만 ${years}세`;
  }

  return `만 ${years}세 ${months}개월`;
}

export default function ChildInfoScreen() {
  const userContext = useSessionStore((state) => state.userContext);
  const savedChildName = useSessionStore((state) => state.childName);
  const upsertUserContext = useSessionStore((state) => state.upsertUserContext);
  const updateOnboardingProfile = useSessionStore((state) => state.updateOnboardingProfile);
  const reduceMotion = useReducedMotion();
  const shouldAnimate = !reduceMotion && Platform.OS !== "web";
  const selectedAgeMonthsRef = useRef(getAgeMonthsFromMonthIndex(userContext.childBirthMonth));
  const gestureStartAgeMonthsRef = useRef(selectedAgeMonthsRef.current);
  const [childName, setChildName] = useState(savedChildName);
  const [screenScrollEnabled, setScreenScrollEnabled] = useState(true);
  const [selectedAgeMonths, setSelectedAgeMonths] = useState(selectedAgeMonthsRef.current);

  const updateSelectedAgeMonths = useCallback((ageMonths: number) => {
    const nextAgeMonths = clampAgeMonths(ageMonths);
    selectedAgeMonthsRef.current = nextAgeMonths;
    setSelectedAgeMonths(nextAgeMonths);
  }, []);

  const handleAgeWheelTouchStart = useCallback(() => {
    Keyboard.dismiss();
    setScreenScrollEnabled(false);
  }, []);

  const handleAgeWheelTouchEnd = useCallback(() => {
    setScreenScrollEnabled(true);
  }, []);

  const handleAgeWheelTouchCancel = useCallback(() => {
    setScreenScrollEnabled(true);
  }, []);

  const selectAgeMonths = useCallback(
    (ageMonths: number) => {
      updateSelectedAgeMonths(ageMonths);
    },
    [updateSelectedAgeMonths],
  );

  const ageWheelPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => {
          Keyboard.dismiss();
          setScreenScrollEnabled(false);
          return false;
        },
        onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dy) > 4,
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          Keyboard.dismiss();
          setScreenScrollEnabled(false);
          gestureStartAgeMonthsRef.current = selectedAgeMonthsRef.current;
        },
        onPanResponderMove: (_event, gestureState) => {
          const monthDelta = Math.round(-gestureState.dy / AGE_ITEM_HEIGHT);
          updateSelectedAgeMonths(gestureStartAgeMonthsRef.current + monthDelta);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const monthDelta = Math.round(-gestureState.dy / AGE_ITEM_HEIGHT);
          updateSelectedAgeMonths(gestureStartAgeMonthsRef.current + monthDelta);
          setScreenScrollEnabled(true);
        },
        onPanResponderTerminate: () => {
          setScreenScrollEnabled(true);
        },
        onShouldBlockNativeResponder: () => true,
      }),
    [updateSelectedAgeMonths],
  );

  const visibleAgeMonthOptions = useMemo(
    () =>
      Array.from({ length: AGE_WHEEL_VISIBLE_ROWS }, (_, index) => {
        const ageMonths = selectedAgeMonths + index - AGE_WHEEL_CENTER_ROW;
        return ageMonths >= MIN_AGE_MONTHS && ageMonths <= MAX_AGE_MONTHS ? ageMonths : null;
      }),
    [selectedAgeMonths],
  );

  async function handleContinue() {
    const latestUserContext = useSessionStore.getState().userContext;

    await upsertUserContext({
      ...latestUserContext,
      childBirthMonth: getMonthIndexFromAgeMonths(selectedAgeMonths),
    });
    await updateOnboardingProfile({
      childName: childName.trim(),
      familyType: null,
    });

    router.push("/(onboarding)/materials");
  }

  return (
    <OnboardingStepScreen
      title="아이에 대해 알려주세요"
      description="연령에 맞는 놀이를 추천해드릴게요."
      heroArt={<ChildHeroArt />}
      scrollEnabled={screenScrollEnabled}
      footer={
        <MotionPressable
          accessibilityRole="button"
          onPress={() => {
            void handleContinue();
          }}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.primaryButtonText}>다음</Text>
        </MotionPressable>
      }
    >
      <Animated.View
        entering={shouldAnimate ? fadeInUp(50) : undefined}
        layout={shouldAnimate ? layoutTransition : undefined}
        style={styles.formPanel}
      >
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabelRow}>
            <View style={styles.bullet} />
            <Text style={styles.fieldLabel}>아이 이름을 알려주세요</Text>
          </View>
          <TextInput
            placeholder="예) 서아"
            placeholderTextColor={APP_COLORS.placeholder}
            value={childName}
            onChangeText={setChildName}
            style={styles.textInput}
            returnKeyType="done"
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabelRow}>
            <View style={styles.bullet} />
            <Text style={styles.fieldLabel}>아이의 개월 수를 알려주세요</Text>
          </View>
          <Text style={styles.helper}>정확한 놀이 추천을 위해 필요해요.</Text>

          <View style={styles.agePickerRow}>
            <View
              {...ageWheelPanResponder.panHandlers}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              accessibilityRole="adjustable"
              accessibilityValue={{ text: `${selectedAgeMonths}개월` }}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === "increment") {
                  selectAgeMonths(selectedAgeMonths + 1);
                }

                if (event.nativeEvent.actionName === "decrement") {
                  selectAgeMonths(selectedAgeMonths - 1);
                }
              }}
              onTouchCancel={handleAgeWheelTouchCancel}
              onTouchEnd={handleAgeWheelTouchEnd}
              onTouchStart={handleAgeWheelTouchStart}
              style={styles.ageWheel}
              testID="age-month-wheel"
            >
              <View style={styles.ageWheelSelection} pointerEvents="none" />
              <View style={styles.ageWheelContent}>
                {visibleAgeMonthOptions.map((ageMonths, index) => {
                  if (ageMonths === null) {
                    return <View key={`empty-${index}`} style={styles.ageRow} />;
                  }

                  const selected = ageMonths === selectedAgeMonths;

                  return (
                    <MotionPressable
                      key={ageMonths}
                      accessibilityRole="button"
                      accessibilityLabel={`${ageMonths}개월 선택`}
                      onPress={() => selectAgeMonths(ageMonths)}
                      scaleTo={0.98}
                      style={({ pressed }) => [
                        styles.ageRow,
                        pressed && styles.ageRowPressed,
                      ]}
                    >
                      <Text style={[styles.ageRowText, selected && styles.ageRowTextSelected]}>
                        {ageMonths}
                      </Text>
                      {selected ? <Text style={styles.ageUnit}>개월</Text> : null}
                    </MotionPressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.ageSummaryCard}>
              <Text style={styles.ageSummaryIcon}>♥</Text>
              <Text style={styles.ageSummaryTitle}>{formatAgeSummary(selectedAgeMonths)}</Text>
              <Text style={styles.ageSummaryBody}>
                또래 평균 발달에 맞는 놀이를 추천해드려요.
              </Text>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.ageSummaryIconBubble}
              >
                <MaterialCommunityIcons
                  name="baby-face-outline"
                  size={30}
                  color={APP_COLORS.coral}
                />
              </View>
            </View>
          </View>

        </View>
      </Animated.View>
    </OnboardingStepScreen>
  );
}

function ChildHeroArt() {
  const { width } = useWindowDimensions();
  const compact = width < 430;
  const frameWidth = compact ? 148 : 238;
  const frameHeight = compact ? 170 : 240;
  const imageWidth = compact ? 148 : 224;
  const imageHeight = compact ? 170 : 258;
  const imageLeft = compact ? 0 : 8;
  const imageTop = compact ? 0 : -2;

  return (
    <View style={[styles.heroArtFrame, { width: frameWidth, height: frameHeight }]}>
      <Image
        accessibilityIgnoresInvertColors
        source={onboardingHeroImage}
        resizeMode="contain"
        style={[
          styles.heroImage,
          {
            left: imageLeft,
            top: imageTop,
            width: imageWidth,
            height: imageHeight,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  formPanel: {
    gap: 34,
    paddingHorizontal: 28,
    paddingTop: 34,
    paddingBottom: 28,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.lineSoft,
    ...APP_SHADOWS.card,
  },
  fieldGroup: {
    gap: 14,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
  fieldLabel: {
    flex: 1,
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  helper: {
    color: APP_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: APP_FONTS.body,
    paddingLeft: 18,
  },
  textInput: {
    minHeight: 74,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
    color: APP_COLORS.ink,
    fontSize: 16,
    fontFamily: APP_FONTS.body,
  },
  agePickerRow: {
    flexDirection: "row",
    gap: 22,
    alignItems: "center",
  },
  ageWheel: {
    flex: 1,
    minWidth: 0,
    height: AGE_WHEEL_HEIGHT,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  ageWheelSelection: {
    position: "absolute",
    left: -8,
    right: -8,
    top: AGE_WHEEL_PADDING,
    height: AGE_ITEM_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.control,
  },
  ageWheelContent: {
    height: AGE_WHEEL_HEIGHT,
  },
  ageRow: {
    height: AGE_ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ageRowPressed: {
    opacity: 0.8,
  },
  ageRowText: {
    color: APP_COLORS.placeholder,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  ageRowTextSelected: {
    color: APP_COLORS.ink,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  ageUnit: {
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  ageSummaryCard: {
    width: 148,
    minHeight: 204,
    gap: 10,
    padding: 18,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: APP_COLORS.card,
  },
  ageSummaryIcon: {
    color: APP_COLORS.coral,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  ageSummaryTitle: {
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  ageSummaryBody: {
    color: APP_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: APP_FONTS.body,
  },
  ageSummaryIconBubble: {
    position: "absolute",
    right: 14,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: APP_COLORS.coralSoft,
  },
  primaryButton: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: APP_COLORS.accent,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: APP_COLORS.ink,
    fontSize: 17,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  heroArtFrame: {
    overflow: "hidden",
  },
  heroImage: {
    position: "absolute",
  },
});
