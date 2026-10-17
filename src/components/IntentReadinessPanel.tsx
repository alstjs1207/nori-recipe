import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { APP_COLORS, APP_FONTS } from "@/constants/theme";
import { inferPlayIntent, INTENT_LABELS } from "@/engine/intentSignals";
import type { IntentReadiness, Play } from "@/types";

export function IntentReadinessPanel({ candidate, materials, confirmed, onChange }: {
  candidate: Play;
  materials: readonly string[];
  confirmed: boolean;
  onChange: (readiness: IntentReadiness | null) => Promise<void>;
}) {
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intent = inferPlayIntent(materials);
  const conditions = [
    "보호자가 준비하고 놀이하는 동안 바로 곁에서 함께할 수 있어요.",
    "가위·풀·물감 등 사용할 제품의 표시 연령이 우리 아이에게 맞아요. ‘3세 이상’ 제품은 36개월 미만에게 사용하지 않아요.",
    intent === "cutting"
      ? "재료를 입에 넣지 않고, 앉아서 가위를 여닫아 종이 끝을 한 번씩 자를 준비가 되어 있어요."
      : "재료를 입에 넣지 않아요. 약한 점착 테이프와 연령에 맞는 세척 가능한 미술 재료를 사용하고, 필요한 동작은 보호자가 도와줄 수 있어요.",
  ];
  async function save() {
    setSaving(true); setError(null);
    try {
      await onChange(confirmed ? null : {
        adultSupervision: checks[0], productsAgeAppropriate: checks[1], noMouthing: checks[2],
        scissorSnipping: intent === "cutting" && checks[2], tapeSurfaceSafe: checks[2], washablePaint: checks[2],
      });
      setChecks([false, false, false]);
    } catch { setError("조건을 저장하지 못했어요. 다시 시도해 주세요."); }
    finally { setSaving(false); }
  }
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{confirmed ? "보호자 도움 조건을 확인했어요" : `${intent ? INTENT_LABELS[intent] : "선택한 재료 놀이"}를 더 찾아볼까요?`}</Text>
      <Text style={styles.body}>{confirmed
        ? "확인한 준비 조건에 맞춰 보호자가 곁에서 도와주세요. 조건이 달라지면 아래 버튼으로 현재 월령 놀이만 다시 추천받을 수 있어요."
        : `‘${candidate.name}’는 기본 ${candidate.ageMin}개월부터인 놀이예요. 아래 조건을 확인하면 선택한 재료로 해볼 수 있는 놀이를 1개까지 포함해 추천 3개를 다시 구성해요.`}</Text>
      {!confirmed ? conditions.map((label, i) => (
        <Pressable key={label} accessibilityRole="checkbox" accessibilityState={{ checked: checks[i], disabled: saving }} disabled={saving}
          onPress={() => setChecks((old) => old.map((value, index) => index === i ? !value : value))} style={styles.check}>
          <Text style={styles.mark}>{checks[i] ? "☑" : "☐"}</Text><Text style={styles.body}>{label}</Text>
        </Pressable>
      )) : null}
      {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={saving || (!confirmed && !checks.every(Boolean))} onPress={() => { void save(); }}
        style={[styles.button, (!confirmed && !checks.every(Boolean)) && styles.disabled]}>
        <Text style={styles.buttonText}>{saving ? "저장 중…" : confirmed ? "현재 월령 놀이만 추천받기" : "조건을 확인하고 추천 다시 받기"}</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { backgroundColor: "#F5F2FF", borderRadius: 16, borderWidth: 1, borderColor: "#E1DBF8", padding: 18, gap: 12, marginBottom: 20 },
  title: { color: APP_COLORS.ink, fontFamily: APP_FONTS.heading, fontSize: 16, fontWeight: "600" },
  body: { color: APP_COLORS.ink, fontFamily: APP_FONTS.body, fontSize: 13, lineHeight: 21, flexShrink: 1 },
  check: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  mark: { color: APP_COLORS.ink, fontSize: 21 },
  button: { alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: "#7162D9" },
  buttonText: { color: "white", fontFamily: APP_FONTS.heading, fontSize: 13, fontWeight: "600" },
  disabled: { opacity: 0.4 },
});
