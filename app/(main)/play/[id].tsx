import { useEffect, useRef, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEV_AREA_LABELS, DEV_AREA_THEME } from "@/constants/devAreas";
import {
  MATERIAL_DISPLAY_NAMES,
  MATERIAL_SLUGS,
  type MaterialSlug,
} from "@/constants/materials";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getLatestPlayLog, isFavorite, toggleFavorite } from "@/db/queries";
import {
  advanceAutoProgress,
  completeStep,
  getNextIncompleteStepIndex,
} from "@/play/stepProgress";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import type { Play, PlayLogRecord, PlaySource } from "@/types";

type DetailTab = "overview" | "materials" | "steps";

type YoutubePreview =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; title: string; thumbnailUrl: string | null };

type MaterialReadinessSummary = {
  body: string;
  tone: "missing" | "ready";
  title: string;
};

type StepRowProps = {
  active: boolean;
  completed: boolean;
  index: number;
  onPress?: () => void;
  text: string;
};

type MaterialRowProps = {
  label: string;
  missing: boolean;
  requirementLabel: string;
};

type IconCircleButtonProps = {
  accent?: boolean;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  text: string;
};

type ArtworkVariant = "bath" | "dough" | "plate" | "paper" | "book" | "blocks";

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "소개" },
  { key: "materials", label: "준비물" },
  { key: "steps", label: "순서" },
];

const PLACE_LABELS: Record<Play["place"], string> = {
  indoor: "실내",
  outdoor: "실외",
  any: "어디서나",
};

const SOURCE_LABELS: Record<PlaySource["type"], string> = {
  youtube: "유튜브",
  instagram: "인스타그램",
  naver_blog: "블로그",
  chaisplay: "차이의 놀이",
  tistory: "티스토리",
  brunch: "브런치",
  manual: "에디터 정리",
};

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" ? value : null;
}

function readMaterialParams(value: string | string[] | undefined): MaterialSlug[] {
  const rawValues =
    typeof value === "string"
      ? value.split(",")
      : Array.isArray(value)
        ? value.flatMap((item) => item.split(","))
        : [];
  const validMaterials = new Set<MaterialSlug>(MATERIAL_SLUGS);

  return rawValues.filter(
    (material): material is MaterialSlug => validMaterials.has(material as MaterialSlug),
  );
}

function isYoutubeSource(source: PlaySource): boolean {
  return source.type === "youtube" && typeof source.url === "string" && source.url.length > 0;
}

function formatDuration(play: Play): string {
  if (play.durationMin === play.durationMax) {
    return `${play.durationMin}분`;
  }

  return `${play.durationMin}-${play.durationMax}분`;
}

function formatAgeRange(play: Play): string {
  return `${play.ageMin}-${play.ageMax}개월`;
}

function getSourceTitle(play: Play, preview: YoutubePreview): string {
  if (preview.status === "ready") {
    return preview.title;
  }

  return isYoutubeSource(play.source)
    ? "유튜브에서 보기"
    : `${SOURCE_LABELS[play.source.type]} 열기`;
}

function getSourceDescription(play: Play, preview: YoutubePreview): string {
  if (preview.status === "loading") {
    return "영상 정보를 불러오는 중이에요.";
  }

  if (preview.status === "error") {
    return "미리보기를 불러오지 못해도 링크는 바로 열 수 있어요.";
  }

  return "앱을 벗어나 원문 링크를 열어요.";
}

function formatCompletedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "최근 완료 기록";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function renderStars(value: number | null): string {
  if (!value) {
    return "평가 없음";
  }

  return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
}

function getMaterialReadinessSummary(
  play: Play,
  selectedMaterialsSet: Set<MaterialSlug>,
): MaterialReadinessSummary {
  const missingRequiredCount = play.materials.required.filter(
    (material) => !selectedMaterialsSet.has(material),
  ).length;
  const missingOptionalCount = play.materials.optional.filter(
    (material) => !selectedMaterialsSet.has(material),
  ).length;

  if (play.materials.required.length === 0 && play.materials.optional.length === 0) {
    return {
      title: "준비물 없이 바로 시작 가능",
      body: "별도 준비 없이 바로 놀이를 시작할 수 있어요.",
      tone: "ready",
    };
  }

  if (missingRequiredCount > 0) {
    return {
      title: `필수 재료 ${missingRequiredCount}개 부족`,
      body: "없는 필수 재료를 먼저 확인하고 시작해 주세요.",
      tone: "missing",
    };
  }

  if (missingOptionalCount > 0) {
    return {
      title: "지금 시작 가능",
      body: `선택 재료 ${missingOptionalCount}개가 더 있으면 놀이를 더 풍부하게 할 수 있어요.`,
      tone: "ready",
    };
  }

  return {
    title: "준비 완료",
    body: "필수와 선택 재료가 모두 준비되어 있어요.",
    tone: "ready",
  };
}

function getArtworkVariant(play: Play): ArtworkVariant {
  const text = [play.name, ...play.tags].join(" ").replace(/\s+/g, "").toLowerCase();
  const allMaterials = [
    ...play.materials.required,
    ...play.materials.optional,
    ...play.materials.substitutes,
  ];

  if (
    text.includes("목욕") ||
    text.includes("물") ||
    allMaterials.includes("water") ||
    allMaterials.includes("bubble")
  ) {
    return "bath";
  }

  if (
    text.includes("밀가루") ||
    text.includes("반죽") ||
    text.includes("점토") ||
    text.includes("슬라임") ||
    allMaterials.includes("flour") ||
    allMaterials.includes("clay") ||
    allMaterials.includes("slime")
  ) {
    return "dough";
  }

  if (text.includes("요리") || text.includes("접시") || text.includes("음식")) {
    return "plate";
  }

  if (text.includes("책") || text.includes("동화") || allMaterials.includes("book")) {
    return "book";
  }

  if (
    text.includes("그리기") ||
    text.includes("그림") ||
    allMaterials.includes("paper") ||
    allMaterials.includes("paint") ||
    allMaterials.includes("crayon")
  ) {
    return "paper";
  }

  return "blocks";
}

function IconCircleButton({
  accent = false,
  disabled = false,
  label,
  onPress,
  text,
}: IconCircleButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        accent && styles.iconButtonAccent,
        disabled && styles.iconButtonDisabled,
        pressed && !disabled && styles.iconButtonPressed,
      ]}
    >
      <Text style={[styles.iconButtonText, accent && styles.iconButtonTextAccent]}>{text}</Text>
    </Pressable>
  );
}

function MaterialRow({ label, missing, requirementLabel }: MaterialRowProps) {
  return (
    <View style={styles.materialRow}>
      <View style={styles.materialIcon}>
        <View style={styles.materialIconInner} />
      </View>
      <Text style={styles.materialLabel}>{label}</Text>
      <Text style={styles.materialAmount}>{requirementLabel}</Text>
      <View
        style={[
          styles.materialStatus,
          missing ? styles.materialStatusMissing : styles.materialStatusReady,
        ]}
      >
        <Text
          style={[
            styles.materialStatusText,
            missing ? styles.materialStatusTextMissing : styles.materialStatusTextReady,
          ]}
        >
          {missing ? "!" : "✓"}
        </Text>
      </View>
    </View>
  );
}

function StepRow({ active, completed, index, onPress, text }: StepRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ checked: completed }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepRow,
        active && styles.stepRowActive,
        completed && styles.stepRowCompleted,
        pressed && styles.stepRowPressed,
      ]}
    >
      <View style={[styles.stepBadge, active && styles.stepBadgeActive]}>
        <Text style={[styles.stepBadgeText, active && styles.stepBadgeTextActive]}>
          {completed ? "✓" : index + 1}
        </Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={[styles.stepText, completed && styles.stepTextCompleted]}>{text}</Text>
        <Text style={[styles.stepMeta, active && styles.stepMetaActive]}>
          {completed ? "완료됨" : active ? "지금 단계" : "탭해서 완료 표시"}
        </Text>
      </View>
    </Pressable>
  );
}

function PlayHeroArtwork({ play }: { play: Play }) {
  const variant = getArtworkVariant(play);

  return (
    <View style={styles.artFrame}>
      <View style={styles.artShadow} />
      <View style={styles.artStage}>
        <View style={styles.artPlateOuter} />
        <View style={styles.artPlateInner} />
        {variant === "bath" ? (
          <>
            <View style={styles.artBathTub} />
            <View style={styles.artBubbleOne} />
            <View style={styles.artBubbleTwo} />
            <View style={styles.artBubbleThree} />
          </>
        ) : null}
        {variant === "dough" ? (
          <>
            <View style={styles.artDoughBlob} />
            <View style={styles.artDoughStem} />
            <View style={styles.artDoughDotOne} />
            <View style={styles.artDoughDotTwo} />
            <View style={styles.artDoughDotThree} />
          </>
        ) : null}
        {variant === "plate" ? (
          <>
            <View style={styles.artPlateFoodLeft} />
            <View style={styles.artPlateFoodRight} />
            <View style={styles.artPlateFoodTop} />
          </>
        ) : null}
        {variant === "paper" ? (
          <>
            <View style={styles.artPaperSheet} />
            <View style={styles.artPaperMarkOne} />
            <View style={styles.artPaperMarkTwo} />
          </>
        ) : null}
        {variant === "book" ? (
          <>
            <View style={styles.artBookLeft} />
            <View style={styles.artBookRight} />
            <View style={styles.artBookSpine} />
          </>
        ) : null}
        {variant === "blocks" ? (
          <>
            <View style={styles.artBlockBase} />
            <View style={styles.artBlockLeft} />
            <View style={styles.artBlockRight} />
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function PlayDetailScreen() {
  const autoProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; fallback?: string; materials?: string | string[] }>();
  const playId = readParam(params.id);
  const guestId = useSessionStore((state) => state.guestId);
  const play = usePlaysStore((state) => state.plays.find((item) => item.id === playId));
  const [activeTab, setActiveTab] = useState<DetailTab>("materials");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [hasStartedPlay, setHasStartedPlay] = useState(false);
  const [isAutoProgressing, setIsAutoProgressing] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [youtubePreview, setYoutubePreview] = useState<YoutubePreview>({ status: "idle" });
  const [latestLog, setLatestLog] = useState<PlayLogRecord | null>(null);

  function clearAutoProgressTimer() {
    if (!autoProgressTimerRef.current) {
      return;
    }

    clearTimeout(autoProgressTimerRef.current);
    autoProgressTimerRef.current = null;
  }

  useEffect(() => {
    clearAutoProgressTimer();
    setActiveTab("materials");
    setCompletedSteps([]);
    setHasStartedPlay(false);
    setIsAutoProgressing(false);
    setFavorite(false);
    setLatestLog(null);
  }, [playId]);

  useEffect(() => clearAutoProgressTimer, []);

  useEffect(() => {
    if (!guestId || !playId) {
      setFavorite(false);
      return;
    }

    let active = true;

    void isFavorite(guestId, playId)
      .then((value) => {
        if (active) {
          setFavorite(value);
        }
      })
      .catch(() => {
        if (active) {
          setFavorite(false);
        }
      });

    return () => {
      active = false;
    };
  }, [guestId, playId]);

  useEffect(() => {
    if (!guestId || !playId) {
      setLatestLog(null);
      return;
    }

    let active = true;

    void getLatestPlayLog(guestId, playId)
      .then((value) => {
        if (active) {
          setLatestLog(value);
        }
      })
      .catch(() => {
        if (active) {
          setLatestLog(null);
        }
      });

    return () => {
      active = false;
    };
  }, [guestId, playId]);

  useEffect(() => {
    if (!play || !isYoutubeSource(play.source) || !play.source.url) {
      setYoutubePreview({ status: "idle" });
      return;
    }

    let active = true;

    setYoutubePreview({ status: "loading" });

    void fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(play.source.url)}&format=json`,
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("oEmbed request failed");
        }

        const payload = (await response.json()) as {
          title?: unknown;
          thumbnail_url?: unknown;
        };

        if (!active) {
          return;
        }

        setYoutubePreview({
          status: "ready",
          title:
            typeof payload.title === "string" && payload.title.length > 0
              ? payload.title
              : "유튜브에서 보기",
          thumbnailUrl:
            typeof payload.thumbnail_url === "string" && payload.thumbnail_url.length > 0
              ? payload.thumbnail_url
              : null,
        });
      })
      .catch(() => {
        if (active) {
          setYoutubePreview({ status: "error" });
        }
      });

    return () => {
      active = false;
    };
  }, [play]);

  async function handleToggleFavorite() {
    if (!guestId || !play) {
      return;
    }

    try {
      const nextValue = await toggleFavorite(guestId, play.id);
      setFavorite(nextValue);
    } catch {
      setFavorite((current) => current);
    }
  }

  async function handleOpenSource() {
    if (!play?.source.url) {
      return;
    }

    try {
      await Linking.openURL(play.source.url);
    } catch {
      // Opening an external app can fail offline or when the OS blocks the scheme.
    }
  }

  function moveToFeedback() {
    if (!play) {
      return;
    }

    router.push({
      pathname: "/(main)/feedback/[id]",
      params: { id: play.id },
    });
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(main)");
  }

  function toggleStep(index: number) {
    if (!hasStartedPlay) {
      setHasStartedPlay(true);
      setActiveTab("steps");
    }

    setCompletedSteps((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : completeStep(current, index),
    );
  }

  function handlePrimaryAction() {
    if (isAutoProgressing) {
      return;
    }

    if (hasStartedPlay && allStepsCompleted) {
      moveToFeedback();
      return;
    }

    setActiveTab("steps");

    if (!hasStartedPlay) {
      setHasStartedPlay(true);
      setIsAutoProgressing(true);
      return;
    }

    if (nextIncompleteStepIndex >= 0) {
      setIsAutoProgressing(true);
    }
  }

  const selectedMaterials = readMaterialParams(params.materials);
  const selectedMaterialsSet = new Set(selectedMaterials);
  const requiredMaterials = play?.materials.required ?? [];
  const optionalMaterials = play?.materials.optional ?? [];
  const allMaterials = play
    ? [
        ...requiredMaterials.map((material) => ({ material, optional: false })),
        ...optionalMaterials.map((material) => ({ material, optional: true })),
      ]
    : [];
  const hasMissingMaterials = allMaterials.some(
    ({ material }) => !selectedMaterialsSet.has(material),
  );
  const missingRequiredCount = requiredMaterials.filter(
    (material) => !selectedMaterialsSet.has(material),
  ).length;
  const materialReadiness = play
    ? getMaterialReadinessSummary(play, selectedMaterialsSet)
    : null;
  const hasPreviousLog = Boolean(latestLog);
  const totalStepCount = play?.steps.length ?? 0;
  const allStepsCompleted = totalStepCount > 0 && completedSteps.length === totalStepCount;
  const nextIncompleteStepIndex = getNextIncompleteStepIndex(totalStepCount, completedSteps);
  const footerLabel = !hasStartedPlay
    ? hasPreviousLog
      ? "다시 놀이하기"
      : "첫 번째 단계 시작"
    : allStepsCompleted
      ? "놀이 마치고 기록하기"
      : isAutoProgressing
        ? "자동 진행 중"
        : nextIncompleteStepIndex >= 0
          ? `${nextIncompleteStepIndex + 1}단계 완료하기`
          : "놀이 기록하기";
  const footerHelperText = allStepsCompleted
    ? "단계를 모두 체크했어요. 기록 화면으로 넘어갑니다."
    : hasStartedPlay
      ? isAutoProgressing
        ? `${nextIncompleteStepIndex + 1}단계로 자동 진행 중이에요.`
        : `${play?.steps.length ?? 0}단계 · 약 ${play?.durationMax ?? 0}분 소요`
      : hasPreviousLog
        ? `${formatCompletedAt(latestLog!.completedAt)}에 완료한 기록이 있어요.`
        : `${play?.steps.length ?? 0}단계 · 약 ${play?.durationMax ?? 0}분 소요`;

  useEffect(() => {
    if (!hasStartedPlay || !isAutoProgressing) {
      clearAutoProgressTimer();
      return;
    }

    if (allStepsCompleted || nextIncompleteStepIndex < 0) {
      clearAutoProgressTimer();
      setIsAutoProgressing(false);
      return;
    }

    clearAutoProgressTimer();
    autoProgressTimerRef.current = setTimeout(() => {
      setCompletedSteps((current) => advanceAutoProgress(totalStepCount, current).completedSteps);
    }, 1000);

    return clearAutoProgressTimer;
  }, [allStepsCompleted, hasStartedPlay, isAutoProgressing, nextIncompleteStepIndex, totalStepCount]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + 16,
              paddingBottom: play ? 150 + Math.max(insets.bottom, 16) : 32,
            },
          ]}
        >
          <View style={styles.topBar}>
            <IconCircleButton label="뒤로 가기" onPress={handleBack} text="‹" />
            <View style={styles.topBarActions}>
              <IconCircleButton
                accent
                label={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                onPress={handleToggleFavorite}
                text={favorite ? "★" : "☆"}
              />
            </View>
          </View>

          {play ? (
            <>
              <View style={styles.heroCard}>
                <PlayHeroArtwork play={play} />
                <View style={styles.heroChipRow}>
                  {play.devAreas[0] ? (
                    <View
                      style={[
                        styles.heroPrimaryChip,
                        {
                          backgroundColor: DEV_AREA_THEME[play.devAreas[0]].textColor,
                        },
                      ]}
                    >
                      <Text style={styles.heroPrimaryChipText}>
                        {DEV_AREA_LABELS[play.devAreas[0]]} 놀이
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.heroSecondaryChip}>
                    <Text style={styles.heroSecondaryChipText}>{formatDuration(play)}</Text>
                  </View>
                </View>
                <Text style={styles.heroTitle}>{play.name}</Text>
                <Text style={styles.heroSubtitle}>
                  {formatAgeRange(play)} · 엄마 {play.prepTime}분 준비
                </Text>
              </View>

              <View style={styles.tabBar}>
                {DETAIL_TABS.map((tab) => (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="button"
                    onPress={() => setActiveTab(tab.key)}
                    style={[
                      styles.tabButton,
                      activeTab === tab.key && styles.tabButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabButtonText,
                        activeTab === tab.key && styles.tabButtonTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {activeTab === "overview" ? (
                <>
                  {materialReadiness ? (
                    <View
                      style={[
                        styles.infoCard,
                        materialReadiness.tone === "missing"
                          ? styles.infoCardMissing
                          : styles.infoCardReady,
                      ]}
                    >
                      <Text style={styles.infoCardTitle}>{materialReadiness.title}</Text>
                      <Text style={styles.infoCardBody}>{materialReadiness.body}</Text>
                    </View>
                  ) : null}

                  <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>놀이 정보</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>{PLACE_LABELS[play.place]}</Text>
                      </View>
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>난이도 {play.difficulty}/3</Text>
                      </View>
                      <View style={styles.metaChip}>
                        <Text style={styles.metaChipText}>{play.steps.length}단계</Text>
                      </View>
                    </View>
                    <View style={styles.devTagRow}>
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

                  {latestLog ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.sectionTitle}>최근 완료 기록</Text>
                      <Text style={styles.historyDate}>{formatCompletedAt(latestLog.completedAt)}</Text>
                      <Text style={styles.historyStars}>{renderStars(latestLog.starRating)}</Text>
                      {latestLog.childReaction.length > 0 ? (
                        <Text style={styles.bodyText}>
                          반응: {latestLog.childReaction.join(" · ")}
                        </Text>
                      ) : null}
                      {latestLog.memo ? <Text style={styles.subtleText}>{latestLog.memo}</Text> : null}
                    </View>
                  ) : null}

                  {play.tip ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.sectionTitle}>놀이 팁</Text>
                      <Text style={styles.bodyText}>{play.tip}</Text>
                    </View>
                  ) : null}

                  {play.safetyNotes.length > 0 ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.sectionTitle}>안전 메모</Text>
                      <View style={styles.noteList}>
                        {play.safetyNotes.map((note, index) => (
                          <View key={`${play.id}-safety-${index}`} style={styles.noteRow}>
                            <View style={styles.noteBullet} />
                            <Text style={styles.bodyText}>{note}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {play.educationalEffects.length > 0 ? (
                    <View style={styles.infoCard}>
                      <Text style={styles.sectionTitle}>기대 효과</Text>
                      <View style={styles.noteList}>
                        {play.educationalEffects.map((effect, index) => (
                          <View key={`${play.id}-effect-${index}`} style={styles.noteRow}>
                            <View style={styles.noteBullet} />
                            <Text style={styles.bodyText}>{effect}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {play.source.url ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleOpenSource}
                      style={({ pressed }) => [styles.sourceCard, pressed && styles.sourceCardPressed]}
                    >
                      {youtubePreview.status === "ready" && youtubePreview.thumbnailUrl ? (
                        <Image source={{ uri: youtubePreview.thumbnailUrl }} style={styles.sourceThumbnail} />
                      ) : null}
                      <View style={styles.sourceBody}>
                        <View style={styles.sourceBadge}>
                          <Text style={styles.sourceBadgeText}>{SOURCE_LABELS[play.source.type]}</Text>
                        </View>
                        <Text style={styles.sourceTitle}>{getSourceTitle(play, youtubePreview)}</Text>
                        <Text style={styles.subtleText}>
                          {getSourceDescription(play, youtubePreview)}
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              {activeTab === "materials" ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>필요한 재료 · {allMaterials.length}개</Text>
                  {allMaterials.length > 0 ? (
                    <>
                      {allMaterials.map(({ material, optional }) => (
                        <MaterialRow
                          key={`${material}-${optional ? "optional" : "required"}`}
                          label={MATERIAL_DISPLAY_NAMES[material]}
                          missing={!selectedMaterialsSet.has(material)}
                          requirementLabel={optional ? "선택" : "필수"}
                        />
                      ))}
                      {play.materials.substitutes.length > 0 ? (
                        <Text style={styles.subtleText}>
                          대체 재료:{" "}
                          {play.materials.substitutes
                            .map((material) => MATERIAL_DISPLAY_NAMES[material])
                            .join(", ")}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <View style={styles.infoCard}>
                      <Text style={styles.bodyText}>준비물이 없는 놀이예요.</Text>
                    </View>
                  )}
                </View>
              ) : null}

              {activeTab === "steps" ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionHeading}>놀이 순서</Text>
                  <View style={styles.stepList}>
                    {play.steps.map((step, index) => (
                      <StepRow
                        active={hasStartedPlay && index === nextIncompleteStepIndex}
                        key={`${play.id}-step-${index}`}
                        completed={completedSteps.includes(index)}
                        index={index}
                        onPress={isAutoProgressing ? undefined : () => toggleStep(index)}
                        text={step}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>놀이를 찾지 못했어요</Text>
              <Text style={styles.bodyText}>
                선택한 카드가 현재 번들 목록에 없는 상태입니다. 홈으로 돌아가 다시 선택해 주세요.
              </Text>
            </View>
          )}
        </ScrollView>

        {play ? (
          <View style={[styles.footerWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.footerCard}>
              <View style={styles.footerTextWrap}>
                <Text style={styles.footerTitle}>{footerLabel}</Text>
                <Text style={styles.footerSubtitle}>{footerHelperText}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isAutoProgressing }}
                disabled={isAutoProgressing}
                onPress={handlePrimaryAction}
                style={({ pressed }) => [
                  styles.footerAction,
                  isAutoProgressing && styles.footerActionDisabled,
                  pressed && !isAutoProgressing && styles.footerActionPressed,
                ]}
              >
                <Text style={styles.footerActionText}>{allStepsCompleted ? "✓" : "▶"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  container: {
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: APP_COLORS.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarActions: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.52)",
    borderWidth: 1,
    borderColor: "#D8CBAE",
  },
  iconButtonAccent: {
    backgroundColor: APP_COLORS.mustard,
    borderColor: APP_COLORS.mustard,
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  iconButtonPressed: {
    opacity: 0.88,
  },
  iconButtonText: {
    color: APP_COLORS.ink,
    fontSize: 18,
    lineHeight: 20,
    fontFamily: APP_FONTS.heading,
  },
  iconButtonTextAccent: {
    color: "#4E3B0F",
  },
  heroCard: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    borderRadius: 32,
    backgroundColor: "#F1D7C8",
    gap: 14,
  },
  heroChipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  heroPrimaryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroPrimaryChipText: {
    color: APP_COLORS.accentText,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  heroSecondaryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FAF3E5",
  },
  heroSecondaryChipText: {
    color: "#8B7F68",
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  heroTitle: {
    color: APP_COLORS.ink,
    fontSize: 30,
    lineHeight: 38,
    textAlign: "center",
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  heroSubtitle: {
    color: "#7F7566",
    fontSize: 16,
    textAlign: "center",
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 999,
    backgroundColor: "#F9F0DB",
    borderWidth: 1,
    borderColor: "#DCCFB1",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: APP_COLORS.accent,
  },
  tabButtonText: {
    color: "#6E705C",
    fontSize: 16,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: APP_COLORS.accentText,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeading: {
    color: APP_COLORS.ink,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  infoCard: {
    gap: 10,
    padding: 18,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: "#E0D4B7",
    ...APP_SHADOWS.card,
  },
  infoCardReady: {
    backgroundColor: APP_COLORS.sageSoft,
  },
  infoCardMissing: {
    backgroundColor: APP_COLORS.coralSoft,
  },
  infoCardTitle: {
    color: APP_COLORS.ink,
    fontSize: 18,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  infoCardBody: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  sectionTitle: {
    color: APP_COLORS.ink,
    fontSize: 20,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: APP_COLORS.background,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
  },
  metaChipText: {
    color: APP_COLORS.ink,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  devTagRow: {
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
    fontWeight: "600",
  },
  historyDate: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
  historyStars: {
    color: "#B38A18",
    fontSize: 13,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  bodyText: {
    color: APP_COLORS.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  subtleText: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  noteList: {
    gap: 10,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noteBullet: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: 999,
    backgroundColor: APP_COLORS.mustard,
  },
  sourceCard: {
    flexDirection: "row",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: "#E0D4B7",
    ...APP_SHADOWS.card,
  },
  sourceCardPressed: {
    opacity: 0.88,
  },
  sourceThumbnail: {
    width: 110,
    height: 80,
    borderRadius: 16,
    backgroundColor: APP_COLORS.line,
  },
  sourceBody: {
    flex: 1,
    gap: 8,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: APP_COLORS.card,
  },
  sourceBadgeText: {
    color: APP_COLORS.ink,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  sourceTitle: {
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  materialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: "#E0D4B7",
    ...APP_SHADOWS.card,
  },
  materialIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#E5E8D6",
  },
  materialIconInner: {
    width: 14,
    height: 12,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: "#5C624B",
  },
  materialLabel: {
    flex: 1,
    color: APP_COLORS.ink,
    fontSize: 18,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  materialAmount: {
    color: "#817766",
    fontSize: 15,
    fontFamily: APP_FONTS.body,
    fontWeight: "600",
  },
  materialStatus: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  materialStatusReady: {
    backgroundColor: APP_COLORS.accent,
  },
  materialStatusMissing: {
    backgroundColor: APP_COLORS.coralSoft,
  },
  materialStatusText: {
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  materialStatusTextReady: {
    color: APP_COLORS.accentText,
  },
  materialStatusTextMissing: {
    color: "#7A5646",
  },
  stepList: {
    gap: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: "#E0D4B7",
    ...APP_SHADOWS.card,
  },
  stepRowActive: {
    borderColor: APP_COLORS.accent,
    backgroundColor: "#EEF2E2",
  },
  stepRowCompleted: {
    backgroundColor: "#F4EFE1",
  },
  stepRowPressed: {
    opacity: 0.92,
  },
  stepBadge: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: APP_COLORS.background,
  },
  stepBadgeActive: {
    backgroundColor: APP_COLORS.mustard,
  },
  stepBadgeText: {
    color: APP_COLORS.ink,
    fontSize: 14,
    fontFamily: APP_FONTS.body,
    fontWeight: "700",
  },
  stepBadgeTextActive: {
    color: "#4E3B0F",
  },
  stepBody: {
    flex: 1,
    gap: 6,
  },
  stepText: {
    color: APP_COLORS.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: APP_FONTS.body,
  },
  stepTextCompleted: {
    color: APP_COLORS.muted,
  },
  stepMeta: {
    color: APP_COLORS.muted,
    fontSize: 12,
    fontFamily: APP_FONTS.body,
  },
  stepMetaActive: {
    color: APP_COLORS.accent,
    fontWeight: "600",
  },
  footerWrap: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
  },
  footerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 28,
    backgroundColor: "#46552F",
    ...APP_SHADOWS.cardLifted,
  },
  footerTextWrap: {
    flex: 1,
    gap: 2,
  },
  footerTitle: {
    color: APP_COLORS.accentText,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  footerSubtitle: {
    color: "rgba(244,235,214,0.72)",
    fontSize: 15,
    fontFamily: APP_FONTS.body,
  },
  footerAction: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: APP_COLORS.mustard,
  },
  footerActionDisabled: {
    backgroundColor: "#A69C84",
  },
  footerActionPressed: {
    opacity: 0.88,
  },
  footerActionText: {
    color: "#4E3B0F",
    fontSize: 20,
    lineHeight: 22,
    fontFamily: APP_FONTS.heading,
  },
  artFrame: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  artShadow: {
    position: "absolute",
    bottom: 53,
    width: 136,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(40,36,26,0.12)",
  },
  artStage: {
    width: 220,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  artPlateOuter: {
    position: "absolute",
    bottom: 28,
    width: 130,
    height: 34,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.surface,
  },
  artPlateInner: {
    position: "absolute",
    bottom: 34,
    width: 92,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#938B7A",
    backgroundColor: "rgba(244,235,214,0.7)",
  },
  artBathTub: {
    position: "absolute",
    bottom: 42,
    width: 86,
    height: 40,
    borderRadius: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.lavenderSoft,
  },
  artBubbleOne: {
    position: "absolute",
    bottom: 74,
    left: 68,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.surface,
  },
  artBubbleTwo: {
    position: "absolute",
    bottom: 82,
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.surface,
  },
  artBubbleThree: {
    position: "absolute",
    bottom: 74,
    right: 68,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#5E594D",
    backgroundColor: APP_COLORS.surface,
  },
  artDoughBlob: {
    position: "absolute",
    bottom: 46,
    width: 74,
    height: 34,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: "#EFE5C8",
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artDoughStem: {
    position: "absolute",
    bottom: 76,
    width: 8,
    height: 12,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
  artDoughDotOne: {
    position: "absolute",
    bottom: 68,
    left: 93,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_COLORS.coral,
  },
  artDoughDotTwo: {
    position: "absolute",
    bottom: 66,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_COLORS.mustard,
  },
  artDoughDotThree: {
    position: "absolute",
    bottom: 70,
    right: 93,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_COLORS.sky,
  },
  artPlateFoodLeft: {
    position: "absolute",
    bottom: 44,
    left: 78,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: APP_COLORS.coralSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artPlateFoodRight: {
    position: "absolute",
    bottom: 46,
    right: 74,
    width: 26,
    height: 18,
    borderRadius: 999,
    backgroundColor: APP_COLORS.sageSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artPlateFoodTop: {
    position: "absolute",
    bottom: 64,
    width: 8,
    height: 14,
    borderRadius: 999,
    backgroundColor: APP_COLORS.accent,
  },
  artPaperSheet: {
    position: "absolute",
    bottom: 40,
    width: 66,
    height: 50,
    borderRadius: 14,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artPaperMarkOne: {
    position: "absolute",
    bottom: 66,
    width: 26,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_COLORS.coral,
    transform: [{ rotate: "-20deg" }],
  },
  artPaperMarkTwo: {
    position: "absolute",
    bottom: 56,
    width: 28,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_COLORS.lavender,
    transform: [{ rotate: "18deg" }],
  },
  artBookLeft: {
    position: "absolute",
    bottom: 40,
    left: 72,
    width: 34,
    height: 48,
    backgroundColor: APP_COLORS.coralSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 16,
  },
  artBookRight: {
    position: "absolute",
    bottom: 40,
    right: 72,
    width: 34,
    height: 48,
    backgroundColor: APP_COLORS.mustardSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 16,
  },
  artBookSpine: {
    position: "absolute",
    bottom: 40,
    width: 8,
    height: 48,
    backgroundColor: APP_COLORS.surface,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: "#5E594D",
  },
  artBlockBase: {
    position: "absolute",
    bottom: 40,
    width: 62,
    height: 26,
    borderRadius: 10,
    backgroundColor: APP_COLORS.lavenderSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artBlockLeft: {
    position: "absolute",
    bottom: 58,
    left: 76,
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: APP_COLORS.mustardSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
  artBlockRight: {
    position: "absolute",
    bottom: 58,
    right: 76,
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: APP_COLORS.coralSoft,
    borderWidth: 2,
    borderColor: "#5E594D",
  },
});
