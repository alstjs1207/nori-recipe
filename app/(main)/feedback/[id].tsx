import { useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CHILD_REACTION_OPTIONS, type ChildReaction } from "@/constants/feedback";
import { DEV_AREA_LABELS, DEV_AREA_THEME } from "@/constants/devAreas";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { applyPlayFeedbackSignals, insertPlayLog } from "@/db/queries";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function StarButton({
  active,
  index,
  onPress,
}: {
  active: boolean;
  index: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${index}점`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.starButton,
        active && styles.starButtonActive,
        pressed && styles.starButtonPressed,
      ]}
    >
      <Text style={[styles.starText, active && styles.starTextActive]}>★</Text>
      <Text style={[styles.starMeta, active && styles.starMetaActive]}>{index}</Text>
    </Pressable>
  );
}

function ReactionChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: ChildReaction;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.reactionChip,
        active && styles.reactionChipActive,
        pressed && styles.reactionChipPressed,
      ]}
    >
      <Text style={[styles.reactionChipText, active && styles.reactionChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function FeedbackScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const playId = readParam(params.id);
  const guestId = useSessionStore((state) => state.guestId);
  const play = usePlaysStore((state) => state.plays.find((item) => item.id === playId));
  const [rating, setRating] = useState<number>(0);
  const [selectedReactions, setSelectedReactions] = useState<ChildReaction[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleReaction(reaction: ChildReaction) {
    setSelectedReactions((current) =>
      current.includes(reaction)
        ? current.filter((item) => item !== reaction)
        : [...current, reaction],
    );
  }

  async function handleSave() {
    if (!guestId || !play || rating === 0 || saving) {
      return;
    }

    setSaving(true);

    try {
      await insertPlayLog(
        guestId,
        play.id,
        rating,
        selectedReactions,
        memo.trim().length > 0 ? memo.trim() : null,
      );
      const nextUserContext = await applyPlayFeedbackSignals(
        guestId,
        play.id,
        rating,
        selectedReactions,
      );

      useSessionStore.setState({ userContext: nextUserContext });
      router.replace("/(main)");
    } catch {
      Alert.alert("저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "피드백",
          headerStyle: { backgroundColor: APP_COLORS.surface },
          headerTintColor: APP_COLORS.ink,
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {play ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.eyebrow}>놀이 기록</Text>
                <Text style={styles.title}>{play.name}</Text>
                <Text style={styles.body}>
                  오늘 어땠는지 가볍게 남겨두면 다음 추천이 조금 더 맞아집니다.
                </Text>
                <View style={styles.tagRow}>
                  {play.devAreas.map((devArea) => (
                    <View
                      key={devArea}
                      style={[
                        styles.devTag,
                        { backgroundColor: DEV_AREA_THEME[devArea].backgroundColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.devTagText,
                          { color: DEV_AREA_THEME[devArea].textColor },
                        ]}
                      >
                        {DEV_AREA_LABELS[devArea]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>전체 만족도</Text>
                <Text style={styles.sectionBody}>별점 1개부터 5개까지 선택해 주세요.</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <StarButton
                      key={value}
                      active={value <= rating}
                      index={value}
                      onPress={() => setRating(value)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>아이 반응</Text>
                <Text style={styles.sectionBody}>해당되는 반응은 여러 개 함께 고를 수 있어요.</Text>
                <View style={styles.reactionGrid}>
                  {CHILD_REACTION_OPTIONS.map((reaction) => (
                    <ReactionChip
                      key={reaction}
                      active={selectedReactions.includes(reaction)}
                      label={reaction}
                      onPress={() => toggleReaction(reaction)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>메모</Text>
                <Text style={styles.sectionBody}>선택 항목이에요.</Text>
                <TextInput
                  multiline
                  placeholder="오늘 기억하고 싶은 순간이 있나요?"
                  placeholderTextColor={APP_COLORS.muted}
                  style={styles.memoInput}
                  value={memo}
                  onChangeText={setMemo}
                  textAlignVertical="top"
                />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={rating === 0 || saving}
                onPress={() => {
                  void handleSave();
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (rating === 0 || saving) && styles.primaryButtonDisabled,
                  pressed && rating !== 0 && !saving && styles.primaryButtonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "저장 중..." : "기록 저장"}
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.title}>놀이를 찾지 못했어요</Text>
              <Text style={styles.body}>홈으로 돌아가 다시 선택해 주세요.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
    backgroundColor: APP_COLORS.background,
  },
  heroCard: {
    gap: 12,
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
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  devTag: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  devTagText: {
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  sectionCard: {
    gap: 14,
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
  sectionBody: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  starsRow: {
    flexDirection: "row",
    gap: 10,
  },
  starButton: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  starButtonActive: {
    backgroundColor: "#fff1d6",
    borderColor: "#cf8b18",
  },
  starButtonPressed: {
    opacity: 0.88,
  },
  starText: {
    color: "#c1b8a4",
    fontSize: 22,
    lineHeight: 22,
  },
  starTextActive: {
    color: "#cf8b18",
  },
  starMeta: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  starMetaActive: {
    color: "#915700",
  },
  reactionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  reactionChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  reactionChipActive: {
    backgroundColor: APP_COLORS.pill,
    borderColor: APP_COLORS.accent,
  },
  reactionChipPressed: {
    opacity: 0.88,
  },
  reactionChipText: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  reactionChipTextActive: {
    color: APP_COLORS.ink,
  },
  memoInput: {
    minHeight: 128,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.background,
    color: APP_COLORS.ink,
    fontSize: 15,
    lineHeight: 22,
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
