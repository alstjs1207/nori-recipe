import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Image, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { fadeInUp, layoutTransition } from "@/animations/motion";
import { MotionPressable } from "@/components/motion/MotionPressable";
import { OnboardingStepScreen } from "@/components/onboarding/OnboardingStepScreen";
import { MATERIAL_DISPLAY_NAMES, type MaterialSlug } from "@/constants/materials";
import { getMaterialVisualSpec } from "@/constants/materialVisuals";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import {
  ONBOARDING_DEFAULT_MATERIALS,
  getVisibleMaterialCategories,
} from "@/onboarding/utils";
import { useSessionStore } from "@/store/sessionStore";

const ALL_CATEGORY = "전체";
const visibleCategories = getVisibleMaterialCategories();
const TILE_GAP = 12;
const MAX_CONTENT_WIDTH = 640;
const SCREEN_HORIZONTAL_PADDING = 40;
const materialHeroImage = require("../../images/onboarding/Woven_basket_with.png");

type MaterialEntry = {
  categoryName: string;
  material: MaterialSlug;
};

const materialEntries: MaterialEntry[] = visibleCategories.flatMap((category) =>
  category.materials.map((material) => ({
    categoryName: category.name,
    material,
  })),
);

export default function MaterialsScreen() {
  const userContext = useSessionStore((state) => state.userContext);
  const upsertUserContext = useSessionStore((state) => state.upsertUserContext);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const reduceMotion = useReducedMotion();
  const shouldAnimate = !reduceMotion && Platform.OS !== "web";
  const { width } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSlug[]>(
    userContext.ownedMaterials.length > 0 ? userContext.ownedMaterials : ONBOARDING_DEFAULT_MATERIALS,
  );
  const columns = width < 380 ? 3 : 4;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - SCREEN_HORIZONTAL_PADDING;
  const tileWidth = Math.max(
    74,
    Math.floor((contentWidth - TILE_GAP * (columns - 1)) / columns),
  );
  const filteredEntries = useMemo(
    () =>
      activeCategory === ALL_CATEGORY
        ? materialEntries
        : materialEntries.filter((entry) => entry.categoryName === activeCategory),
    [activeCategory],
  );

  function toggleMaterial(material: MaterialSlug) {
    setSelectedMaterials((current) =>
      current.includes(material)
        ? current.filter((item) => item !== material)
        : [...current, material],
    );
  }

  async function persistSelection(materials: MaterialSlug[]) {
    const latestUserContext = useSessionStore.getState().userContext;

    await upsertUserContext({
      ...latestUserContext,
      ownedMaterials: materials,
    });
  }

  async function handleComplete(materials: MaterialSlug[]) {
    await persistSelection(materials);
    await completeOnboarding();
    router.replace("/(main)");
  }

  return (
    <OnboardingStepScreen
      title="지금 집에 있는 재료를 선택해 주세요"
      description="있는 재료로 할 수 있는 놀이를 추천해드려요."
      heroArt={<MaterialsHeroArt />}
      footer={
        <>
          <MotionPressable
            accessibilityRole="button"
            onPress={() => {
              void handleComplete(selectedMaterials);
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <Text style={styles.primaryButtonText}>완료</Text>
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            onPress={() => {
              void handleComplete([]);
            }}
            style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
          >
            <Text style={styles.skipButtonText}>건너뛰고 나중에 선택할게요</Text>
          </MotionPressable>
        </>
      }
    >
      <Animated.View
        entering={shouldAnimate ? fadeInUp(40) : undefined}
        layout={shouldAnimate ? layoutTransition : undefined}
        style={styles.categoryBand}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {[ALL_CATEGORY, ...visibleCategories.map((category) => category.name)].map((categoryName) => {
            const selected = categoryName === activeCategory;

            return (
              <MotionPressable
                key={categoryName}
                accessibilityRole="button"
                onPress={() => setActiveCategory(categoryName)}
                scaleTo={0.97}
                style={({ pressed }) => [
                  styles.categoryChip,
                  selected && styles.categoryChipSelected,
                  pressed && styles.categoryChipPressed,
                ]}
              >
                <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                  {categoryName}
                </Text>
              </MotionPressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      <Animated.View
        entering={shouldAnimate ? fadeInUp(70) : undefined}
        layout={shouldAnimate ? layoutTransition : undefined}
        style={styles.materialGrid}
      >
        {filteredEntries.map(({ categoryName, material }) => {
          const selected = selectedMaterials.includes(material);
          const visual = getMaterialVisualSpec(material, categoryName);

          return (
            <MotionPressable
              key={`${categoryName}-${material}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${MATERIAL_DISPLAY_NAMES[material]} 선택`}
              onPress={() => toggleMaterial(material)}
              scaleTo={0.98}
              style={({ pressed }) => [
                styles.materialCard,
                { width: tileWidth },
                selected && styles.materialCardSelected,
                pressed && styles.materialCardPressed,
              ]}
            >
              <View
                style={styles.materialImageSlot}
              >
                <Image
                  accessibilityIgnoresInvertColors
                  resizeMode="contain"
                  source={visual.imageSource}
                  style={styles.materialImage}
                />
              </View>
              <Text style={styles.materialLabel} numberOfLines={2}>
                {MATERIAL_DISPLAY_NAMES[material]}
              </Text>
              <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
                {selected ? <Text style={styles.checkText}>✓</Text> : null}
              </View>
            </MotionPressable>
          );
        })}
      </Animated.View>

      <Animated.View
        entering={shouldAnimate ? fadeInUp(110) : undefined}
        layout={shouldAnimate ? layoutTransition : undefined}
        style={styles.tipBanner}
      >
        <Text style={styles.tipIcon}>!</Text>
        <Text style={styles.tipText}>
          선택한 재료 {selectedMaterials.length}개를 기준으로 추천을 더 정확히 맞출게요.
        </Text>
      </Animated.View>
    </OnboardingStepScreen>
  );
}

function MaterialsHeroArt() {
  return (
    <View style={styles.materialsHeroFrame} pointerEvents="none">
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={materialHeroImage}
        style={styles.materialsHeroImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  categoryBand: {
    marginHorizontal: -20,
  },
  categoryRow: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  categoryChip: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  categoryChipSelected: {
    borderColor: APP_COLORS.accent,
    backgroundColor: APP_COLORS.accent,
  },
  categoryChipPressed: {
    opacity: 0.82,
  },
  categoryChipText: {
    color: APP_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  categoryChipTextSelected: {
    color: APP_COLORS.ink,
  },
  materialGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
  },
  materialCard: {
    height: 146,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  materialCardSelected: {
    borderColor: APP_COLORS.accent,
    backgroundColor: APP_COLORS.card,
    ...APP_SHADOWS.control,
  },
  materialCardPressed: {
    opacity: 0.84,
  },
  materialImageSlot: {
    width: "100%",
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: APP_COLORS.surface,
  },
  materialImage: {
    width: "100%",
    height: "100%",
  },
  materialLabel: {
    width: "100%",
    minHeight: 34,
    color: APP_COLORS.ink,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  checkCircle: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  checkCircleSelected: {
    borderColor: APP_COLORS.accent,
    backgroundColor: APP_COLORS.accent,
  },
  checkText: {
    color: APP_COLORS.surface,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  tipBanner: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: APP_COLORS.card,
  },
  tipIcon: {
    color: APP_COLORS.accent,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  tipText: {
    flexShrink: 1,
    color: APP_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
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
  skipButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
  },
  skipButtonPressed: {
    opacity: 0.64,
  },
  skipButtonText: {
    color: APP_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  materialsHeroFrame: {
    width: 172,
    height: 154,
  },
  materialsHeroImage: {
    width: "100%",
    height: "100%",
  },
});
