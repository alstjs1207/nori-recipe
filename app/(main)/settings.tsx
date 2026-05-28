import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import packageJson from "../../package.json";

import { MATERIAL_DISPLAY_NAMES, type MaterialSlug } from "@/constants/materials";
import { APP_COLORS, APP_FONTS } from "@/constants/theme";
import {
  getBirthMonthOptions,
  getVisibleMaterialCategories,
  formatBirthMonth,
} from "@/onboarding/utils";
import { resetUserActivity } from "@/db/queries";
import { useSessionStore } from "@/store/sessionStore";

const birthMonthOptions = getBirthMonthOptions();
const visibleCategories = getVisibleMaterialCategories();

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const guestId = useSessionStore((state) => state.guestId);
  const userContext = useSessionStore((state) => state.userContext);
  const childNameFromStore = useSessionStore((state) => state.childName);
  const upsertUserContext = useSessionStore((state) => state.upsertUserContext);
  const updateOnboardingProfile = useSessionStore((state) => state.updateOnboardingProfile);
  const resetOnboarding = useSessionStore((state) => state.resetOnboarding);

  const [childName, setChildName] = useState(childNameFromStore);
  const [selectedBirthMonth, setSelectedBirthMonth] = useState<number | null>(
    userContext.childBirthMonth,
  );
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSlug[]>(
    userContext.ownedMaterials,
  );
  const [birthMonthExpanded, setBirthMonthExpanded] = useState(false);
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveNoticeVisible, setSaveNoticeVisible] = useState(false);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [resetNoticeVisible, setResetNoticeVisible] = useState(false);

  useEffect(() => {
    setChildName(childNameFromStore);
  }, [childNameFromStore]);

  useEffect(() => {
    setSelectedBirthMonth(userContext.childBirthMonth);
    setSelectedMaterials(userContext.ownedMaterials);
  }, [userContext.childBirthMonth, userContext.ownedMaterials]);

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
    if (selectedBirthMonth === null || saving) return;
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

  async function handleResetOnboarding() {
    try {
      await resetOnboarding();
      router.replace("/(onboarding)/child-info");
    } catch {
      Alert.alert("온보딩을 열지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  }

  const selectedBirthLabel = selectedBirthMonth !== null
    ? `${formatBirthMonth(selectedBirthMonth)} · ${birthMonthOptions.find(o => o.monthIndex === selectedBirthMonth)?.ageLabel ?? ""}`
    : "선택 안 함";

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>관리</Text>
          <Text style={styles.pageSubtitle}>재료, 아이 정보, 기록을 한곳에서 관리해요.</Text>
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
            <Pressable
              accessibilityRole="button"
              onPress={() => setBirthMonthExpanded((v) => !v)}
              style={styles.collapsibleHeader}
            >
              <View>
                <Text style={styles.label}>생년월</Text>
                <Text style={styles.collapsibleValue}>{selectedBirthLabel}</Text>
              </View>
              <Text style={styles.chevron}>{birthMonthExpanded ? "▲" : "▼"}</Text>
            </Pressable>

            {birthMonthExpanded && (
              <View style={styles.chipGrid}>
                {birthMonthOptions.map((option) => {
                  const selected = option.monthIndex === selectedBirthMonth;
                  return (
                    <Pressable
                      key={option.monthIndex}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedBirthMonth(option.monthIndex);
                        setBirthMonthExpanded(false);
                      }}
                      style={({ pressed }) => [
                        styles.monthChip,
                        selected && styles.monthChipSelected,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text style={[styles.monthChipLabel, selected && styles.monthChipLabelSelected]}>
                        {option.monthLabel}
                      </Text>
                      <Text style={[styles.monthChipMeta, selected && styles.monthChipMetaSelected]}>
                        {option.ageLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* 재료 목록 */}
        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMaterialsExpanded((v) => !v)}
            style={styles.collapsibleHeader}
          >
            <View>
              <Text style={styles.sectionTitle}>재료 목록</Text>
              <Text style={styles.collapsibleValue}>선택됨 {selectedMaterials.length}개</Text>
            </View>
            <Text style={styles.chevron}>{materialsExpanded ? "▲" : "▼"}</Text>
          </Pressable>

          {materialsExpanded && visibleCategories.map((category) => (
            <View key={category.name} style={styles.field}>
              <Text style={styles.label}>{category.name}</Text>
              <View style={styles.chipGrid}>
                {category.materials.map((material) => {
                  const selected = selectedMaterials.includes(material);
                  return (
                    <Pressable
                      key={material}
                      accessibilityRole="button"
                      onPress={() => toggleMaterial(material)}
                      style={({ pressed }) => [
                        styles.materialChip,
                        selected && styles.materialChipSelected,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text style={[styles.materialChipText, selected && styles.materialChipTextSelected]}>
                        {MATERIAL_DISPLAY_NAMES[material]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
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
                disabled={selectedBirthMonth === null || saving}
                onPress={() => { void handleSave(); }}
                style={({ pressed }) => [
                  styles.saveButton,
                  (selectedBirthMonth === null || saving) && styles.saveButtonDisabled,
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
  field: {
    gap: 10,
  },
  label: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  body: {
    color: APP_COLORS.muted,
    fontSize: 14,
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
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  collapsibleValue: {
    color: APP_COLORS.ink,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    marginTop: 2,
  },
  chevron: {
    color: APP_COLORS.muted,
    fontSize: 11,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  monthChip: {
    minWidth: "30%",
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  monthChipSelected: {
    backgroundColor: APP_COLORS.pill,
    borderColor: APP_COLORS.accent,
  },
  monthChipLabel: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  monthChipLabelSelected: {
    color: APP_COLORS.accent,
  },
  monthChipMeta: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
  },
  monthChipMetaSelected: {
    color: APP_COLORS.accent,
  },
  materialChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  materialChipSelected: {
    backgroundColor: APP_COLORS.pill,
    borderColor: APP_COLORS.accent,
  },
  materialChipText: {
    color: APP_COLORS.muted,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
  },
  materialChipTextSelected: {
    color: APP_COLORS.ink,
    fontWeight: "600",
  },
  chipPressed: {
    opacity: 0.85,
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
