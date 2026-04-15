import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import packageJson from "../../package.json";

import { MATERIAL_DISPLAY_NAMES, type MaterialSlug } from "@/constants/materials";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import {
  getBirthMonthOptions,
  getVisibleMaterialCategories,
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
  const [childName, setChildName] = useState(childNameFromStore);
  const [selectedBirthMonth, setSelectedBirthMonth] = useState<number | null>(
    userContext.childBirthMonth,
  );
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSlug[]>(
    userContext.ownedMaterials,
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setChildName(childNameFromStore);
  }, [childNameFromStore]);

  useEffect(() => {
    setSelectedBirthMonth(userContext.childBirthMonth);
    setSelectedMaterials(userContext.ownedMaterials);
  }, [userContext.childBirthMonth, userContext.ownedMaterials]);

  function toggleMaterial(material: MaterialSlug) {
    setSelectedMaterials((current) =>
      current.includes(material)
        ? current.filter((item) => item !== material)
        : [...current, material],
    );
  }

  async function handleSave() {
    if (selectedBirthMonth === null || saving) {
      return;
    }

    setSaving(true);

    try {
      await Promise.all([
        upsertUserContext({
          ...userContext,
          childBirthMonth: selectedBirthMonth,
          ownedMaterials: selectedMaterials,
        }),
        updateOnboardingProfile({
          childName: childName.trim(),
        }),
      ]);

      Alert.alert("저장했어요", "아이 정보와 재료 설정을 업데이트했습니다.");
    } catch {
      Alert.alert("저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  function showAccountSoon() {
    Alert.alert(
      "Coming Soon",
      "소셜 로그인과 계정 연동은 Phase 2에서 연결됩니다.",
    );
  }

  function confirmReset() {
    Alert.alert("기록 초기화", "놀이 기록, 즐겨찾기, 피드백 신호를 이 기기에서 삭제할까요?", [
      {
        text: "취소",
        style: "cancel",
      },
      {
        text: "초기화",
        style: "destructive",
        onPress: () => {
          void handleReset();
        },
      },
    ]);
  }

  async function handleReset() {
    if (!guestId || resetting) {
      return;
    }

    setResetting(true);

    try {
      const nextUserContext = await resetUserActivity(guestId);
      useSessionStore.setState({ userContext: nextUserContext });
      Alert.alert("초기화했어요", "놀이 기록과 즐겨찾기를 비웠습니다.");
    } catch {
      Alert.alert("초기화하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>설정</Text>
        <Text style={styles.title}>아이 정보와 데이터 상태를 한 번에 관리하세요.</Text>
        <Text style={styles.body}>
          재료를 바꾸면 홈 추천 결과가 바로 달라지고, 기록 초기화는 저장된 피드백 신호까지 함께
          비웁니다.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>아이 정보</Text>

        <View style={styles.field}>
          <Text style={styles.label}>이름</Text>
          <TextInput
            placeholder="하윤이, 우리 딸 ..."
            placeholderTextColor={APP_COLORS.muted}
            style={styles.textInput}
            value={childName}
            onChangeText={setChildName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>생년월</Text>
          <View style={styles.chipGrid}>
            {birthMonthOptions.map((option) => {
              const selected = option.monthIndex === selectedBirthMonth;

              return (
                <Pressable
                  key={option.monthIndex}
                  accessibilityRole="button"
                  onPress={() => setSelectedBirthMonth(option.monthIndex)}
                  style={({ pressed }) => [
                    styles.monthChip,
                    selected && styles.monthChipSelected,
                    pressed && styles.monthChipPressed,
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
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>재료 목록</Text>
        {visibleCategories.map((category) => (
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
                      pressed && styles.materialChipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.materialChipText,
                        selected && styles.materialChipTextSelected,
                      ]}
                    >
                      {MATERIAL_DISPLAY_NAMES[material]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>데이터</Text>
        <Pressable
          accessibilityRole="button"
          onPress={showAccountSoon}
          style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
        >
          <Text style={styles.actionTitle}>계정 만들기</Text>
          <Text style={styles.actionMeta}>Coming Soon</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={confirmReset}
          style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
        >
          <Text style={styles.actionTitle}>기록 초기화</Text>
          <Text style={styles.actionMeta}>{resetting ? "처리 중..." : "놀이 기록 삭제"}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>앱 정보</Text>
        <Text style={styles.body}>버전 {packageJson.version}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={selectedBirthMonth === null || saving}
        onPress={() => {
          void handleSave();
        }}
        style={({ pressed }) => [
          styles.primaryButton,
          (selectedBirthMonth === null || saving) && styles.primaryButtonDisabled,
          pressed && selectedBirthMonth !== null && !saving && styles.primaryButtonPressed,
        ]}
      >
        <Text style={styles.primaryButtonText}>{saving ? "저장 중..." : "변경 사항 저장"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
    backgroundColor: APP_COLORS.background,
  },
  heroCard: {
    gap: 10,
    padding: 22,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.cardLifted,
  },
  eyebrow: {
    color: APP_COLORS.accent,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: APP_FONTS.mono,
    fontWeight: "700",
  },
  title: {
    color: APP_COLORS.ink,
    fontSize: 26,
    lineHeight: 34,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  body: {
    color: APP_COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  sectionCard: {
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    ...APP_SHADOWS.card,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 19,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  field: {
    gap: 12,
  },
  label: {
    color: APP_COLORS.ink,
    fontSize: 16,
    fontFamily: APP_FONTS.heading,
    fontWeight: "700",
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.background,
    color: APP_COLORS.ink,
    fontSize: 16,
    fontFamily: APP_FONTS.body,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  monthChip: {
    minWidth: "30%",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  monthChipSelected: {
    backgroundColor: APP_COLORS.card,
    borderColor: APP_COLORS.accent,
  },
  monthChipPressed: {
    opacity: 0.88,
  },
  monthChipLabel: {
    color: APP_COLORS.ink,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  monthChipLabelSelected: {
    color: APP_COLORS.ink,
  },
  monthChipMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  monthChipMetaSelected: {
    color: APP_COLORS.accent,
  },
  materialChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  materialChipSelected: {
    backgroundColor: APP_COLORS.pill,
    borderColor: APP_COLORS.accent,
  },
  materialChipPressed: {
    opacity: 0.88,
  },
  materialChipText: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  materialChipTextSelected: {
    color: APP_COLORS.ink,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  actionRowPressed: {
    opacity: 0.88,
  },
  actionTitle: {
    color: APP_COLORS.ink,
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  actionMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: APP_COLORS.accent,
    ...APP_SHADOWS.card,
  },
  primaryButtonDisabled: {
    backgroundColor: APP_COLORS.line,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
});
