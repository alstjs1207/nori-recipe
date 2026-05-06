import { type ComponentProps, useEffect, useMemo, useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fadeInUp, layoutTransition } from "@/animations/motion";
import { MotionPressable } from "@/components/motion/MotionPressable";
import {
  CHILD_REACTION_OPTIONS,
  type ChildReaction,
  type ChildReactionOption,
} from "@/constants/feedback";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { applyPlayFeedbackSignals, insertPlayLog } from "@/db/queries";
import { getAgeMonthsFromBirthMonth } from "@/onboarding/utils";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Play } from "@/types";

const MEMO_MAX_LENGTH = 100;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type RatingMood = "sadStrong" | "sad" | "softSmile" | "smile" | "happy";
type RatingOption = {
  icon: MaterialCommunityIconName;
  label: string;
  mood: RatingMood;
  value: 1 | 2 | 3 | 4 | 5;
};

const RATING_OPTIONS = [
  { icon: "emoticon-cry-outline", label: "전혀 즐기지 못했어요", mood: "sadStrong", value: 1 },
  { icon: "emoticon-sad-outline", label: "조금 아쉬웠어요", mood: "sad", value: 2 },
  { icon: "emoticon-neutral-outline", label: "보통이었어요", mood: "softSmile", value: 3 },
  { icon: "emoticon-happy-outline", label: "즐거워했어요", mood: "smile", value: 4 },
  { icon: "emoticon-excited-outline", label: "아주 즐거워했어요", mood: "happy", value: 5 },
] satisfies readonly RatingOption[];

const REACTION_DETAILS: Record<
  ChildReactionOption,
  { backgroundColor: string; color: string; icon: MaterialCommunityIconName; label: string }
> = {
  "집중했어요": {
    backgroundColor: APP_COLORS.skySoft,
    color: "#4C9BD4",
    icon: "bullseye-arrow",
    label: "집중했어요",
  },
  "스스로 했어요": {
    backgroundColor: APP_COLORS.sageSoft,
    color: "#3EB78E",
    icon: "hand-okay",
    label: "스스로\n했어요",
  },
  "도움이 필요했어요": {
    backgroundColor: APP_COLORS.coralSoft,
    color: APP_COLORS.coral,
    icon: "hand-heart-outline",
    label: "도움이\n필요했어요",
  },
  "흥미가 적었어요": {
    backgroundColor: APP_COLORS.lavenderSoft,
    color: APP_COLORS.lavender,
    icon: "emoticon-sad-outline",
    label: "흥미가\n적었어요",
  },
};

const PLAY_ART_PALETTES = [
  ["#F7D9E5", "#FF6D8B", "#73B8FF", "#8B6DFF"],
  ["#FFF0C4", "#FFD33D", "#FF9F6D", "#65D2B0"],
  ["#EAF6FF", "#8BD2FF", "#7C8CFF", "#FF9AC2"],
  ["#F0F4DD", "#9DDA7A", "#F8C74A", "#76B7FF"],
] as const;

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function getPaletteIndex(seed: string): number {
  return (
    seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    PLAY_ART_PALETTES.length
  );
}

function formatFeedbackDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day} (${WEEKDAY_LABELS[date.getDay()]})`;
}

function formatAgeBadge(play: Play, childBirthMonth: number | null): string {
  if (childBirthMonth !== null) {
    const ageMonths = getAgeMonthsFromBirthMonth(childBirthMonth);

    if (ageMonths < 12) {
      return `${ageMonths}개월`;
    }

    return `${Math.floor(ageMonths / 12) + 1}세`;
  }

  if (play.ageMin === play.ageMax) {
    return `${play.ageMin}개월`;
  }

  return `${play.ageMin}~${play.ageMax}개월`;
}

function PlaySummaryArt({ playId }: { playId: string }) {
  const palette = PLAY_ART_PALETTES[getPaletteIndex(playId)];

  return (
    <View style={[styles.playArt, { backgroundColor: palette[0] }]}>
      <View style={[styles.artBlob, styles.artBlobOne, { backgroundColor: palette[1] }]} />
      <View style={[styles.artBlob, styles.artBlobTwo, { backgroundColor: palette[2] }]} />
      <View style={[styles.artBlob, styles.artBlobThree, { backgroundColor: palette[3] }]} />
      <View style={[styles.artDot, styles.artDotOne]} />
      <View style={[styles.artDot, styles.artDotTwo]} />
      <MaterialCommunityIcons
        name="clipboard-check-outline"
        size={42}
        color="rgba(34,34,34,0.72)"
        style={styles.playArtIcon}
      />
    </View>
  );
}

function HeaderIconButton({
  disabled,
  icon,
  label,
  onPress,
  subdued,
}: {
  disabled?: boolean;
  icon: MaterialCommunityIconName;
  label: string;
  onPress: () => void;
  subdued?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerIconButton,
        disabled && styles.headerIconButtonDisabled,
        subdued && !disabled && styles.headerIconButtonSubdued,
        pressed && !disabled && styles.headerIconButtonPressed,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={30} color={APP_COLORS.ink} />
    </Pressable>
  );
}

function RatingFace({
  active,
  option,
}: {
  active: boolean;
  option: RatingOption;
}) {
  return (
    <View style={[styles.faceCircle, active && styles.faceCircleActive]}>
      <MaterialCommunityIcons
        name={option.icon}
        size={active ? 43 : 40}
        color={active ? APP_COLORS.ink : "#8B8D95"}
      />
    </View>
  );
}

function RatingButton({
  active,
  option,
  onPress,
}: {
  active: boolean;
  option: (typeof RATING_OPTIONS)[number];
  onPress: () => void;
}) {
  return (
    <MotionPressable
      accessibilityLabel={`${option.value}점, ${option.label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      containerStyle={styles.ratingButtonContainer}
      onPress={onPress}
      style={({ pressed }) => [styles.ratingButton, pressed && styles.ratingButtonPressed]}
    >
      <RatingFace active={active} option={option} />
    </MotionPressable>
  );
}

function ReactionCard({
  active,
  reaction,
  onPress,
}: {
  active: boolean;
  reaction: ChildReactionOption;
  onPress: () => void;
}) {
  const details = REACTION_DETAILS[reaction];

  return (
    <MotionPressable
      accessibilityLabel={reaction}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      containerStyle={styles.reactionCardContainer}
      onPress={onPress}
      style={({ pressed }) => [
        styles.reactionCard,
        active && styles.reactionCardActive,
        pressed && styles.reactionCardPressed,
      ]}
    >
      {active ? (
        <View style={styles.reactionCheck}>
          <MaterialCommunityIcons name="check" size={17} color={APP_COLORS.surface} />
        </View>
      ) : null}
      <View
        style={[
          styles.reactionIconBubble,
          { backgroundColor: active ? APP_COLORS.surface : details.backgroundColor },
        ]}
      >
        <MaterialCommunityIcons
          name={details.icon}
          size={34}
          color={details.color}
        />
      </View>
      <Text style={[styles.reactionLabel, active && styles.reactionLabelActive]}>
        {details.label}
      </Text>
    </MotionPressable>
  );
}

export default function FeedbackScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const playId = readParam(params.id);
  const insets = useSafeAreaInsets();
  const guestId = useSessionStore((state) => state.guestId);
  const childBirthMonth = useSessionStore((state) => state.userContext.childBirthMonth);
  const play = usePlaysStore((state) => state.plays.find((item) => item.id === playId));
  const [rating, setRating] = useState<number>(0);
  const [selectedReactions, setSelectedReactions] = useState<ChildReaction[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [ratingPromptVisible, setRatingPromptVisible] = useState(false);
  const reduceMotion = useReducedMotion();
  const feedbackDate = useMemo(() => formatFeedbackDate(new Date()), []);
  const canAttemptSave = Boolean(guestId && play && !saving);
  const canSave = canAttemptSave && rating > 0;

  useEffect(() => {
    setRating(0);
    setSelectedReactions([]);
    setMemo("");
    setSaving(false);
    setRatingPromptVisible(false);
  }, [playId]);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(main)");
  }

  function toggleReaction(reaction: ChildReactionOption) {
    setSelectedReactions((current) =>
      current.includes(reaction)
        ? current.filter((item) => item !== reaction)
        : [...current, reaction],
    );
  }

  function updateMemo(value: string) {
    setMemo(value.slice(0, MEMO_MAX_LENGTH));
  }

  function selectRating(value: RatingOption["value"]) {
    setRating(value);
    setRatingPromptVisible(false);
  }

  function requestSave() {
    if (!guestId || !play || saving) {
      return;
    }

    if (rating === 0) {
      setRatingPromptVisible(true);
      return;
    }

    void handleSave();
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
      router.replace({
        pathname: "/(main)",
        params: { completedPlayId: play.id },
      });
    } catch {
      Alert.alert("저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <HeaderIconButton icon="chevron-left" label="뒤로 가기" onPress={handleBack} />
          <Text style={styles.headerTitle}>기록 작성</Text>
          <HeaderIconButton
            disabled={!canAttemptSave}
            icon="check"
            label="기록 저장"
            onPress={requestSave}
            subdued={!canSave}
          />
        </View>

        <Animated.ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.container,
            { paddingBottom: 132 + Math.max(insets.bottom, 12) },
          ]}
        >
          {play ? (
            <>
              <Animated.View
                entering={reduceMotion ? undefined : fadeInUp()}
                layout={reduceMotion ? undefined : layoutTransition}
                style={styles.summaryCard}
              >
                <PlaySummaryArt playId={play.id} />
                <View style={styles.summaryContent}>
                  <Text style={styles.playTitle} numberOfLines={2}>
                    {play.name}
                  </Text>
                  <View style={styles.summaryMetaRow}>
                    <View style={styles.ageBadge}>
                      <Text style={styles.ageBadgeText}>
                        {formatAgeBadge(play, childBirthMonth)}
                      </Text>
                    </View>
                    <Text style={styles.summaryDate}>{feedbackDate}</Text>
                  </View>
                </View>
              </Animated.View>

              <Animated.View
                entering={reduceMotion ? undefined : fadeInUp(60)}
                layout={reduceMotion ? undefined : layoutTransition}
                style={styles.section}
              >
                <Text style={styles.questionText}>1. 우리 아이는 이 놀이를 얼마나 즐겼나요?</Text>
                <View style={styles.ratingControlGroup}>
                  <View style={styles.ratingRow}>
                    {RATING_OPTIONS.map((option) => (
                      <RatingButton
                        key={option.value}
                        active={rating === option.value}
                        option={option}
                        onPress={() => selectRating(option.value)}
                      />
                    ))}
                  </View>
                  {ratingPromptVisible ? (
                    <View style={styles.ratingPrompt}>
                      <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={18}
                        color={APP_COLORS.coral}
                      />
                      <Text style={styles.ratingPromptText}>
                        만족도를 먼저 선택해 주세요.
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Animated.View>

              <Animated.View
                entering={reduceMotion ? undefined : fadeInUp(100)}
                layout={reduceMotion ? undefined : layoutTransition}
                style={styles.section}
              >
                <Text style={styles.questionText}>2. 놀이 중 우리 아이의 모습은 어땠나요?</Text>
                <View style={styles.reactionRow}>
                  {CHILD_REACTION_OPTIONS.map((reaction) => (
                    <ReactionCard
                      key={reaction}
                      active={selectedReactions.includes(reaction)}
                      reaction={reaction}
                      onPress={() => toggleReaction(reaction)}
                    />
                  ))}
                </View>
              </Animated.View>

              <Animated.View
                entering={reduceMotion ? undefined : fadeInUp(140)}
                layout={reduceMotion ? undefined : layoutTransition}
                style={styles.section}
              >
                <Text style={styles.questionText}>
                  3. 한 줄 기록 <Text style={styles.optionalText}>(선택)</Text>
                </Text>
                <View style={styles.memoBox}>
                  <View style={styles.memoIconBubble}>
                    <MaterialCommunityIcons
                      name="text-box-edit-outline"
                      size={23}
                      color={APP_COLORS.muted}
                    />
                  </View>
                  <TextInput
                    maxLength={MEMO_MAX_LENGTH}
                    placeholder="오늘 놀이에 대한 짧은 기록을 남겨보세요."
                    placeholderTextColor={APP_COLORS.placeholder}
                    returnKeyType="done"
                    style={styles.memoInput}
                    value={memo}
                    onChangeText={updateMemo}
                  />
                  <Text style={styles.memoCount}>
                    {memo.length}/{MEMO_MAX_LENGTH}
                  </Text>
                </View>
              </Animated.View>
            </>
          ) : (
            <Animated.View
              entering={reduceMotion ? undefined : fadeInUp()}
              style={styles.emptyCard}
            >
              <Text style={styles.emptyTitle}>놀이를 찾지 못했어요</Text>
              <Text style={styles.emptyBody}>홈으로 돌아가 다시 선택해 주세요.</Text>
            </Animated.View>
          )}
        </Animated.ScrollView>

        {play ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <MotionPressable
              accessibilityLabel="기록 저장"
              accessibilityRole="button"
              disabled={!canAttemptSave}
              onPress={requestSave}
              style={({ pressed }) => [
                styles.primaryButton,
                !canSave && styles.primaryButtonDisabled,
                pressed && canSave && styles.primaryButtonPressed,
              ]}
            >
              <View style={styles.primaryButtonContent}>
                <MaterialCommunityIcons
                  name="content-save-check-outline"
                  size={23}
                  color={APP_COLORS.accentText}
                />
                <Text style={styles.primaryButtonText}>
                  {saving ? "저장 중..." : rating === 0 ? "만족도 선택 후 저장" : "기록 저장"}
                </Text>
              </View>
            </MotionPressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: APP_COLORS.background,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerIconButtonDisabled: {
    opacity: 0.28,
  },
  headerIconButtonSubdued: {
    opacity: 0.36,
  },
  headerIconButtonPressed: {
    opacity: 0.62,
  },
  headerTitle: {
    color: APP_COLORS.ink,
    fontSize: 22,
    lineHeight: 30,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  container: {
    gap: 34,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: APP_COLORS.background,
  },
  summaryCard: {
    minHeight: 118,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    padding: 18,
    borderRadius: 18,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  playArt: {
    width: 78,
    height: 78,
    overflow: "hidden",
    borderRadius: 16,
  },
  artBlob: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.78,
  },
  artBlobOne: {
    width: 54,
    height: 34,
    left: -8,
    top: 12,
    transform: [{ rotate: "18deg" }],
  },
  artBlobTwo: {
    width: 58,
    height: 38,
    right: -12,
    top: 4,
    transform: [{ rotate: "-16deg" }],
  },
  artBlobThree: {
    width: 62,
    height: 42,
    left: 12,
    bottom: 4,
    transform: [{ rotate: "-8deg" }],
  },
  artDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  artDotOne: {
    left: 14,
    top: 14,
  },
  artDotTwo: {
    right: 12,
    bottom: 16,
  },
  playArtIcon: {
    position: "absolute",
    left: 18,
    top: 18,
  },
  summaryContent: {
    flex: 1,
    gap: 14,
    minWidth: 0,
  },
  playTitle: {
    color: APP_COLORS.ink,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ageBadge: {
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: APP_COLORS.mustard,
  },
  ageBadgeText: {
    color: "#2F2710",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  summaryDate: {
    flexShrink: 1,
    color: APP_COLORS.muted,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  section: {
    gap: 22,
  },
  questionText: {
    color: APP_COLORS.ink,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  optionalText: {
    color: APP_COLORS.muted,
    fontFamily: APP_FONTS.body,
    fontWeight: "500",
  },
  ratingControlGroup: {
    gap: 12,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  ratingButtonContainer: {
    flex: 1,
    alignItems: "center",
  },
  ratingButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingButtonPressed: {
    opacity: 0.82,
  },
  faceCircle: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "#ECECEC",
  },
  faceCircleActive: {
    backgroundColor: APP_COLORS.mustard,
    ...APP_SHADOWS.control,
  },
  ratingPrompt: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: APP_COLORS.coralSoft,
  },
  ratingPromptText: {
    color: "#9B4A43",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  reactionRow: {
    flexDirection: "row",
    gap: 10,
  },
  reactionCardContainer: {
    flex: 1,
  },
  reactionCard: {
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 6,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  reactionCardActive: {
    borderColor: APP_COLORS.mustard,
    backgroundColor: "#FFF9EA",
    ...APP_SHADOWS.control,
  },
  reactionCardPressed: {
    opacity: 0.86,
  },
  reactionCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: APP_COLORS.mustard,
  },
  reactionIconBubble: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
  },
  reactionLabel: {
    color: "#565B67",
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  reactionLabelActive: {
    color: APP_COLORS.ink,
  },
  memoBox: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    backgroundColor: APP_COLORS.surface,
  },
  memoIconBubble: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: APP_COLORS.background,
  },
  memoInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 15,
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  memoCount: {
    color: APP_COLORS.muted,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: APP_COLORS.background,
  },
  primaryButton: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 17,
    backgroundColor: APP_COLORS.accent,
    ...APP_SHADOWS.card,
  },
  primaryButtonDisabled: {
    backgroundColor: "#E3DED1",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: APP_COLORS.accentText,
    fontSize: 21,
    lineHeight: 29,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  emptyCard: {
    gap: 10,
    padding: 20,
    borderRadius: 18,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  emptyTitle: {
    color: APP_COLORS.ink,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  emptyBody: {
    color: APP_COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
});
