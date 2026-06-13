import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  Image,
  Keyboard,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import packageJson from "../../package.json";

import { MotionPressable } from "@/components/motion/MotionPressable";
import { LEGAL_NOTICE, PRIVACY_NOTICE } from "@/constants/legalNotices";
import { MATERIAL_DISPLAY_NAMES, type MaterialSlug } from "@/constants/materials";
import { getMaterialVisualSpec } from "@/constants/materialVisuals";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import {
  getBirthMonthOptions,
  getVisibleMaterialCategories,
  formatBirthMonth,
} from "@/onboarding/utils";
import { resetUserActivity } from "@/db/queries";
import { useSessionStore } from "@/store/sessionStore";

const birthMonthOptions = getBirthMonthOptions();
const visibleCategories = getVisibleMaterialCategories();
const ALL_CATEGORY = "전체";
const DEFAULT_AGE_MONTHS = 17;
const MIN_AGE_MONTHS = 0;
const MAX_AGE_MONTHS = 48;
const AGE_ITEM_HEIGHT = 44;
const AGE_WHEEL_VISIBLE_ROWS = 5;
const AGE_WHEEL_HEIGHT = AGE_ITEM_HEIGHT * AGE_WHEEL_VISIBLE_ROWS;
const AGE_WHEEL_PADDING = (AGE_WHEEL_HEIGHT - AGE_ITEM_HEIGHT) / 2;
const AGE_WHEEL_CENTER_ROW = Math.floor(AGE_WHEEL_VISIBLE_ROWS / 2);
const MATERIAL_TILE_GAP = 12;
const MAX_MATERIAL_GRID_WIDTH = 560;

const NOTICE_DISCLOSURES = [
  { key: "privacy", notice: PRIVACY_NOTICE },
  { key: "legal", notice: LEGAL_NOTICE },
] as const;

type NoticeDisclosureKey = (typeof NOTICE_DISCLOSURES)[number]["key"];

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

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const guestId = useSessionStore((state) => state.guestId);
  const userContext = useSessionStore((state) => state.userContext);
  const childNameFromStore = useSessionStore((state) => state.childName);
  const upsertUserContext = useSessionStore((state) => state.upsertUserContext);
  const updateOnboardingProfile = useSessionStore((state) => state.updateOnboardingProfile);
  const resetOnboarding = useSessionStore((state) => state.resetOnboarding);
  const resetLocalData = useSessionStore((state) => state.resetLocalData);
  const selectedAgeMonthsRef = useRef(getAgeMonthsFromMonthIndex(userContext.childBirthMonth));
  const gestureStartAgeMonthsRef = useRef(selectedAgeMonthsRef.current);

  const [childName, setChildName] = useState(childNameFromStore);
  const [screenScrollEnabled, setScreenScrollEnabled] = useState(true);
  const [selectedAgeMonths, setSelectedAgeMonths] = useState(selectedAgeMonthsRef.current);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSlug[]>(
    userContext.ownedMaterials,
  );
  const [activeMaterialCategory, setActiveMaterialCategory] = useState(ALL_CATEGORY);
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveNoticeVisible, setSaveNoticeVisible] = useState(false);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [resetNoticeVisible, setResetNoticeVisible] = useState(false);
  const [fullResetConfirmVisible, setFullResetConfirmVisible] = useState(false);
  const [fullResetting, setFullResetting] = useState(false);
  const [openNotice, setOpenNotice] = useState<NoticeDisclosureKey | null>(null);

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

  const selectedBirthMonth = useMemo(
    () => getMonthIndexFromAgeMonths(selectedAgeMonths),
    [selectedAgeMonths],
  );
  const selectedBirthMonthLabel = formatBirthMonth(selectedBirthMonth);
  const visibleAgeMonthOptions = useMemo(
    () =>
      Array.from({ length: AGE_WHEEL_VISIBLE_ROWS }, (_, index) => {
        const ageMonths = selectedAgeMonths + index - AGE_WHEEL_CENTER_ROW;
        return ageMonths >= MIN_AGE_MONTHS && ageMonths <= MAX_AGE_MONTHS ? ageMonths : null;
      }),
    [selectedAgeMonths],
  );
  const filteredMaterialEntries = useMemo(
    () =>
      activeMaterialCategory === ALL_CATEGORY
        ? materialEntries
        : materialEntries.filter((entry) => entry.categoryName === activeMaterialCategory),
    [activeMaterialCategory],
  );
  const materialColumns = width < 380 ? 3 : 4;
  const materialGridWidth = Math.max(0, Math.min(width - 80, MAX_MATERIAL_GRID_WIDTH));
  const materialTileWidth = Math.max(
    68,
    Math.floor(
      (materialGridWidth - MATERIAL_TILE_GAP * (materialColumns - 1)) / materialColumns,
    ),
  );

  useEffect(() => {
    setChildName(childNameFromStore);
  }, [childNameFromStore]);

  useEffect(() => {
    updateSelectedAgeMonths(getAgeMonthsFromMonthIndex(userContext.childBirthMonth));
    setSelectedMaterials(userContext.ownedMaterials);
  }, [updateSelectedAgeMonths, userContext.childBirthMonth, userContext.ownedMaterials]);

  useEffect(() => {
    if (!saveNoticeVisible) {
      return;
    }

    const timer = setTimeout(() => {
      setSaveNoticeVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [saveNoticeVisible]);

  useEffect(() => {
    if (!resetNoticeVisible) {
      return;
    }

    const timer = setTimeout(() => {
      setResetNoticeVisible(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [resetNoticeVisible]);

  const hasChanges = useMemo(() => {
    const nameChanged = childName.trim() !== childNameFromStore.trim();
    const birthChanged = selectedBirthMonth !== userContext.childBirthMonth;
    const materialsChanged =
      selectedMaterials.length !== userContext.ownedMaterials.length ||
      selectedMaterials.some((m) => !userContext.ownedMaterials.includes(m));
    return nameChanged || birthChanged || materialsChanged;
  }, [childName, childNameFromStore, selectedBirthMonth, userContext, selectedMaterials]);

  function toggleMaterial(material: MaterialSlug) {
    setSelectedMaterials((current) =>
      current.includes(material)
        ? current.filter((item) => item !== material)
        : [...current, material],
    );
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const latestUserContext = useSessionStore.getState().userContext;

      await upsertUserContext({
        ...latestUserContext,
        childBirthMonth: selectedBirthMonth,
        ownedMaterials: selectedMaterials,
      });
      await updateOnboardingProfile({ childName: childName.trim() });
      setSaveNoticeVisible(true);
    } catch {
      Alert.alert("저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!guestId || resetting) return;
    setResetting(true);
    try {
      const nextUserContext = await resetUserActivity(guestId);
      useSessionStore.setState({ userContext: nextUserContext });
      setResetConfirmVisible(false);
      setResetNoticeVisible(true);
    } catch {
      Alert.alert("초기화하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setResetting(false);
    }
  }

  async function handleFullReset() {
    if (!guestId || fullResetting) return;
    setFullResetting(true);
    try {
      await resetLocalData();
      setFullResetConfirmVisible(false);
      router.replace("/(onboarding)/child-info");
    } catch {
      Alert.alert("초기화하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setFullResetting(false);
    }
  }

  async function handleResetOnboarding() {
    try {
      await resetOnboarding();
      router.replace("/(onboarding)/child-info");
    } catch {
      Alert.alert("온보딩을 열지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}
        scrollEnabled={screenScrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>마이페이지</Text>
          <Text style={styles.pageSubtitle}>아이 정보, 재료, 기록을 한곳에서 관리해요.</Text>
        </View>

        {/* 아이 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>아이 정보</Text>

          <View style={styles.field}>
            <Text style={styles.label}>이름</Text>
            <TextInput
              placeholder="이찬이, 우리아들 ..."
              placeholderTextColor={APP_COLORS.muted}
              style={styles.textInput}
              value={childName}
              onChangeText={setChildName}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>아이의 개월 수</Text>
            <Text style={styles.helper}>생년월 {selectedBirthMonthLabel}</Text>

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
                testID="settings-age-month-wheel"
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
                <Text style={styles.ageSummaryTitle}>{formatAgeSummary(selectedAgeMonths)}</Text>
                <Text style={styles.ageSummaryBody}>{selectedBirthMonthLabel} 출생 기준</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 재료 목록 */}
        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: materialsExpanded }}
            onPress={() => setMaterialsExpanded((current) => !current)}
            style={({ pressed }) => [
              styles.collapsibleSectionHeader,
              pressed && styles.actionRowPressed,
            ]}
          >
            <Text style={styles.sectionTitle}>재료 목록</Text>
            <View style={styles.sectionHeaderActions}>
              <Text style={styles.sectionMeta}>선택됨 {selectedMaterials.length}개</Text>
              <Text style={styles.chevron}>{materialsExpanded ? "▲" : "▼"}</Text>
            </View>
          </Pressable>

          {materialsExpanded ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
                style={styles.categoryBand}
              >
                {[ALL_CATEGORY, ...visibleCategories.map((category) => category.name)].map((categoryName) => {
                  const selected = categoryName === activeMaterialCategory;

                  return (
                    <MotionPressable
                      key={categoryName}
                      accessibilityRole="button"
                      onPress={() => setActiveMaterialCategory(categoryName)}
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

              <View style={styles.materialGrid}>
                {filteredMaterialEntries.map(({ categoryName, material }) => {
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
                        { width: materialTileWidth },
                        selected && styles.materialCardSelected,
                        pressed && styles.materialCardPressed,
                      ]}
                    >
                      <View style={styles.materialImageSlot}>
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
              </View>
            </>
          ) : null}
        </View>

        {/* 데이터 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>데이터</Text>

          <Pressable
            accessibilityRole="button"
            disabled
            style={[styles.actionRow, styles.actionRowDisabled]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleDisabled]}>🔒 계정 만들기</Text>
            <Text style={styles.actionBadge}>출시 예정</Text>
          </Pressable>

          <View style={styles.divider} />

          {__DEV__ ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void handleResetOnboarding();
                }}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              >
                <Text style={[styles.actionTitle, styles.actionTitleDev]}>온보딩 초기화</Text>
                <Text style={styles.actionMeta}>개발용</Text>
              </Pressable>

              <View style={styles.divider} />
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setResetConfirmVisible((current) => !current);
              setResetNoticeVisible(false);
            }}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleDestructive]}>기록 초기화</Text>
            <Text style={styles.actionMeta}>
              {resetting ? "처리 중..." : resetConfirmVisible ? "한 번 더 확인" : "놀이 기록 삭제"}
            </Text>
          </Pressable>

          {resetConfirmVisible ? (
            <View style={styles.resetPanel}>
              <Text style={styles.resetPanelBody}>
                놀이 기록, 즐겨찾기, 추천에 반영된 피드백 신호를 이 기기에서 삭제합니다.
              </Text>
              <View style={styles.resetActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={resetting}
                  onPress={() => setResetConfirmVisible(false)}
                  style={({ pressed }) => [
                    styles.resetSecondaryButton,
                    pressed && styles.actionRowPressed,
                  ]}
                >
                  <Text style={styles.resetSecondaryButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={resetting}
                  onPress={() => {
                    void handleReset();
                  }}
                  style={({ pressed }) => [
                    styles.resetPrimaryButton,
                    resetting && styles.resetPrimaryButtonDisabled,
                    pressed && !resetting && styles.actionRowPressed,
                  ]}
                >
                  <Text style={styles.resetPrimaryButtonText}>
                    {resetting ? "삭제 중..." : "지금 초기화"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {resetNoticeVisible ? (
            <View style={styles.resetNotice}>
              <Text style={styles.resetNoticeText}>놀이 기록과 즐겨찾기를 비웠습니다.</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFullResetConfirmVisible((current) => !current);
              setResetNoticeVisible(false);
            }}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          >
            <Text style={[styles.actionTitle, styles.actionTitleDestructive]}>
              전체 로컬 데이터 초기화
            </Text>
            <Text style={styles.actionMeta}>
              {fullResetting ? "처리 중..." : fullResetConfirmVisible ? "한 번 더 확인" : "앱 데이터 삭제"}
            </Text>
          </Pressable>

          {fullResetConfirmVisible ? (
            <View style={styles.resetPanel}>
              <Text style={styles.resetPanelBody}>
                아이 정보, 재료, 놀이 기록, 즐겨찾기, 추천 피드백을 이 기기에서 삭제하고
                처음 설정 화면으로 돌아갑니다.
              </Text>
              <View style={styles.resetActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={fullResetting}
                  onPress={() => setFullResetConfirmVisible(false)}
                  style={({ pressed }) => [
                    styles.resetSecondaryButton,
                    pressed && styles.actionRowPressed,
                  ]}
                >
                  <Text style={styles.resetSecondaryButtonText}>취소</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={fullResetting}
                  onPress={() => {
                    void handleFullReset();
                  }}
                  style={({ pressed }) => [
                    styles.resetPrimaryButton,
                    fullResetting && styles.resetPrimaryButtonDisabled,
                    pressed && !fullResetting && styles.actionRowPressed,
                  ]}
                >
                  <Text style={styles.resetPrimaryButtonText}>
                    {fullResetting ? "삭제 중..." : "모두 삭제"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* 개인정보와 고지 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>개인정보 및 법적 고지</Text>
          {NOTICE_DISCLOSURES.map(({ key, notice }, index) => {
            const expanded = openNotice === key;

            return (
              <View key={key} style={styles.noticeDisclosure}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setOpenNotice((current) => (current === key ? null : key))}
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.actionRowPressed,
                  ]}
                >
                  <View style={styles.noticeRowText}>
                    <Text style={styles.actionTitle}>{notice.title}</Text>
                    <Text style={styles.noticeRowSummary}>{notice.summary}</Text>
                  </View>
                  <Text style={styles.actionMeta}>{expanded ? "접기" : "보기"}</Text>
                </Pressable>

                {expanded ? (
                  <View style={styles.noticeBlock}>
                    <Text style={styles.noticeTitle}>{notice.title}</Text>
                    {notice.items.map((item) => (
                      <Text key={item} style={styles.noticeBody}>
                        {item}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* 앱 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          <Text style={styles.body}>버전 {packageJson.version}</Text>
        </View>

        <View style={{ height: hasChanges || saveNoticeVisible ? insets.bottom + 96 : 0 }} />
      </ScrollView>

      {/* 플로팅 저장 버튼 */}
      {(hasChanges || saveNoticeVisible) && (
        <View pointerEvents="box-none" style={styles.floatingBar}>
          <View style={[styles.floatingBarPanel, { paddingBottom: insets.bottom + 12 }]}>
            {saveNoticeVisible && !hasChanges ? (
              <View style={[styles.saveButton, styles.saveButtonSuccess]}>
                <Text style={styles.saveButtonText}>저장되었습니다</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => { void handleSave(); }}
                style={({ pressed }) => [
                  styles.saveButton,
                  saving && styles.saveButtonDisabled,
                  pressed && styles.saveButtonPressed,
                ]}
              >
                <Text style={styles.saveButtonText}>{saving ? "저장 중..." : "변경 사항 저장"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  pageHeader: {
    gap: 4,
    paddingBottom: 4,
  },
  pageTitle: {
    color: APP_COLORS.ink,
    fontSize: 34,
    lineHeight: 42,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  pageSubtitle: {
    color: APP_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: APP_FONTS.body,
  },
  section: {
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 17,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  collapsibleSectionHeader: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  chevron: {
    color: APP_COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  field: {
    gap: 10,
  },
  label: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  helper: {
    color: APP_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: APP_FONTS.body,
  },
  body: {
    color: APP_COLORS.muted,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
  },
  noticeDisclosure: {
    gap: 12,
  },
  noticeRowText: {
    flex: 1,
    gap: 4,
  },
  noticeRowSummary: {
    color: APP_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: APP_FONTS.body,
  },
  noticeBlock: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  noticeTitle: {
    color: APP_COLORS.ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  noticeBody: {
    color: APP_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: APP_FONTS.body,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.background,
    color: APP_COLORS.ink,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
  },
  agePickerRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  ageWheel: {
    width: 118,
    height: AGE_WHEEL_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  ageWheelSelection: {
    position: "absolute",
    top: AGE_WHEEL_PADDING,
    left: 8,
    right: 8,
    height: AGE_ITEM_HEIGHT,
    borderRadius: 14,
    backgroundColor: APP_COLORS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.accent,
  },
  ageWheelContent: {
    zIndex: 1,
  },
  ageRow: {
    height: AGE_ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  ageRowPressed: {
    opacity: 0.72,
  },
  ageRowText: {
    color: APP_COLORS.muted,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  ageRowTextSelected: {
    color: APP_COLORS.ink,
    fontSize: 28,
    lineHeight: 36,
  },
  ageUnit: {
    color: APP_COLORS.ink,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  ageSummaryCard: {
    flex: 1,
    minHeight: AGE_WHEEL_HEIGHT,
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: APP_COLORS.card,
    borderWidth: 1,
    borderColor: APP_COLORS.lineSoft,
  },
  ageSummaryTitle: {
    color: APP_COLORS.ink,
    fontSize: 18,
    lineHeight: 25,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  ageSummaryBody: {
    color: APP_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: APP_FONTS.body,
  },
  categoryBand: {
    marginHorizontal: -4,
  },
  categoryRow: {
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  categoryChip: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
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
    gap: MATERIAL_TILE_GAP,
  },
  materialCard: {
    height: 136,
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
  divider: {
    height: 1,
    backgroundColor: APP_COLORS.line,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  actionRowPressed: {
    opacity: 0.7,
  },
  actionRowDisabled: {
    opacity: 0.45,
  },
  actionTitle: {
    color: APP_COLORS.ink,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  actionTitleDisabled: {
    color: APP_COLORS.muted,
  },
  actionTitleDestructive: {
    color: "#DC2626",
  },
  actionTitleDev: {
    color: APP_COLORS.accentText,
  },
  actionBadge: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: APP_COLORS.card,
    borderRadius: 999,
    overflow: "hidden",
  },
  actionMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  resetPanel: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  resetPanelBody: {
    color: APP_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: APP_FONTS.body,
  },
  resetActions: {
    flexDirection: "row",
    gap: 10,
  },
  resetSecondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  resetSecondaryButtonText: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  resetPrimaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#DC2626",
  },
  resetPrimaryButtonDisabled: {
    backgroundColor: "#F1A8A8",
  },
  resetPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  resetNotice: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#E7F7EC",
  },
  resetNoticeText: {
    color: "#166534",
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  floatingBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  floatingBarPanel: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: APP_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: APP_COLORS.line,
  },
  saveButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: APP_COLORS.accent,
  },
  saveButtonDisabled: {
    backgroundColor: APP_COLORS.line,
  },
  saveButtonSuccess: {
    backgroundColor: "#166534",
  },
  saveButtonPressed: {
    opacity: 0.88,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
});
