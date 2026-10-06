import { useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { APP_COLORS, APP_FONTS } from "@/constants/theme";
import { getAgeMonthsFromBirthMonth, getBirthMonthOptions } from "@/onboarding/utils";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import { useContentDimensions } from "@/hooks/useContentDimensions";

export function WebWelcome() {
  const { width } = useContentDimensions();
  const profile = useSessionStore((state) => state.userContext);
  const upsertUserContext = useSessionStore((state) => state.upsertUserContext);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const plays = usePlaysStore((state) => state.plays);
  const [age, setAge] = useState<number | null>(
    profile.childBirthMonth === null ? null : Math.min(48, getAgeMonthsFromBirthMonth(profile.childBirthMonth)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = [...plays].sort((a, b) => a.prepTime - b.prepTime).slice(0, 3);

  async function start() {
    if (age === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      const option = getBirthMonthOptions().find((item) => item.ageMonths === age);
      if (!option) throw new Error("0~48개월 중에서 선택해 주세요.");
      await upsertUserContext({ ...profile, childBirthMonth: option.monthIndex });
      await completeOnboarding();
      router.replace("/(main)");
    } catch {
      setError("저장하지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>0–48개월 · 집에 있는 재료로</Text>
        <Text accessibilityRole="header" style={[styles.title, { fontSize: Math.min(32, (width - 48) / 12) }]}>오늘은 아이와{"\n"}어떤 놀이를 할까요?</Text>
        <Text style={styles.description}>아이 월령만 알려주세요.{"\n"}지금 할 만한 놀이를 추천해드려요.</Text>
        <View accessibilityElementsHidden style={styles.decorations}>
          <Text style={styles.decoration}>🧸</Text><Text style={styles.decoration}>🖍️</Text><Text style={styles.decoration}>🫧</Text>
        </View>
      </View>

      <View style={styles.startCard}>
        <label htmlFor="child-age" style={{ fontWeight: 700, fontSize: 17 }}>아이의 월령</label>
        <select id="child-age" aria-label="아이 월령" value={age ?? ""} onChange={(event) => setAge(event.target.value === "" ? null : Number(event.target.value))} className="age-select">
          <option value="">월령을 선택해 주세요</option>
          {Array.from({ length: 49 }, (_, month) => <option key={month} value={month}>{month}개월{month >= 12 ? ` · 만 ${Math.floor(month / 12)}세` : ""}</option>)}
        </select>
        <Pressable accessibilityRole="button" disabled={age === null || saving} onPress={() => { void start(); }} style={({ pressed }) => [styles.primary, (age === null || saving) && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{saving ? "추천 준비 중…" : "맞춤 놀이 바로 보기 →"}</Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.note}>종이, 그릇, 컵, 크레용을 기본 재료로 시작해요.{"\n"}집에 있는 재료는 추천 화면에서 바꿀 수 있어요.</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push("/(main)/search")} style={styles.browse}>
          <Text style={styles.browseText}>월령 설정 없이 놀이 둘러보기</Text>
        </Pressable>
      </View>

      <View style={styles.previewSection}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>이런 놀이를 만나볼 수 있어요</Text>
        {previews.map((play) => (
          <Pressable key={play.id} accessibilityRole="link" onPress={() => router.push({ pathname: "/(main)/play/[id]", params: { id: play.id } })} style={({ pressed }) => [styles.preview, pressed && styles.pressed]}>
            <img src={`/media/thumbs/${play.id}.webp`} alt="" width="76" height="76" loading="lazy" decoding="async" style={{ objectFit: "cover", borderRadius: 16, flexShrink: 0 }} />
            <View style={styles.previewCopy}><Text style={styles.previewTitle}>{play.name}</Text><Text style={styles.previewMeta}>{play.ageMin}–{play.ageMax}개월 · 준비 {play.prepTime}분</Text></View>
            <Text style={styles.arrow}>↗</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.footer}>회원가입 없이 시작할 수 있어요.{"\n"}설정과 놀이 기록은 이 브라우저에 저장돼요.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 32, paddingBottom: 40, gap: 24, backgroundColor: APP_COLORS.background },
  hero: { alignItems: "center", gap: 16 },
  eyebrow: { fontSize: 13, color: "#86652B", fontWeight: "600" },
  title: { fontFamily: APP_FONTS.heading, fontSize: 32, lineHeight: 44, fontWeight: "800", textAlign: "center", color: APP_COLORS.ink },
  description: { fontSize: 16, lineHeight: 25, color: "#6E665A", textAlign: "center" },
  decorations: { flexDirection: "row", gap: 26, paddingVertical: 8 },
  decoration: { fontSize: 44 },
  startCard: { padding: 22, borderRadius: 24, borderWidth: 1, borderColor: "#EDE2C8", backgroundColor: "#FFFFFF", gap: 16 },
  primary: { minHeight: 54, borderRadius: 16, backgroundColor: APP_COLORS.mustard, alignItems: "center", justifyContent: "center", padding: 12 },
  primaryText: { fontWeight: "700", fontSize: 17, color: APP_COLORS.accentText },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  note: { fontSize: 12, lineHeight: 20, color: "#786E5E", textAlign: "center" },
  browse: { paddingVertical: 8, alignItems: "center" },
  browseText: { fontSize: 14, color: "#645641", textDecorationLine: "underline" },
  error: { fontSize: 13, color: "#A53320", lineHeight: 20 },
  previewSection: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: APP_COLORS.ink, marginBottom: 4 },
  preview: { flexDirection: "row", gap: 14, alignItems: "center", padding: 12, borderRadius: 20, backgroundColor: "#FFF7E5" },
  previewCopy: { flex: 1, gap: 6 },
  previewTitle: { fontSize: 15, fontWeight: "700", color: APP_COLORS.ink },
  previewMeta: { fontSize: 12, color: "#796D59" },
  arrow: { fontSize: 22, color: "#9D803C" },
  footer: { color: "#8B8172", fontSize: 12, lineHeight: 20, textAlign: "center" },
});
