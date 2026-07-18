import type { MaterialSlug } from "@/constants/materials";
import type { Play } from "@/types";

type SafetyRule = {
  materials: MaterialSlug[];
  note: string;
};

const SAFETY_RULES: SafetyRule[] = [
  {
    materials: ["marble", "bead", "water_beads", "play_corn"],
    note: "작은 재료는 삼킴·질식 위험이 있으므로 아이의 손이 닿는 동안 보호자가 곁에서 지켜보고, 놀이 후 즉시 수거해 주세요.",
  },
  {
    materials: ["balloon"],
    note: "풍선은 터진 조각도 질식 위험이 있으므로 보호자가 직접 불고, 터지면 모든 조각을 바로 치워 주세요.",
  },
  {
    materials: ["scissors", "chopsticks", "straw"],
    note: "가위나 길고 뾰족한 도구는 보호자가 사용 상태를 확인하고 얼굴을 향하지 않도록 지도해 주세요.",
  },
  {
    materials: ["string", "rubber_band"],
    note: "끈과 고무줄은 목이나 손가락에 감기지 않도록 짧게 사용하고, 놀이 내내 보호자가 함께해 주세요.",
  },
  {
    materials: ["water", "water_bin", "bubble"],
    note: "물놀이는 소량의 물도 보호자가 바로 옆에서 감독하고, 젖은 바닥은 즉시 닦아 미끄럼을 예방해 주세요.",
  },
  {
    materials: ["flour", "rice_flour", "soft_food"],
    note: "식재료는 알레르기와 섭취 가능 여부를 먼저 확인하고, 생재료를 입에 넣지 않도록 지켜봐 주세요.",
  },
  {
    materials: ["paint", "glue", "slime", "clay", "kinetic_sand", "sand"],
    note: "조형·미술 재료는 유아용 무독성 제품을 사용하고 눈과 입에 닿지 않게 한 뒤 놀이 후 손을 씻어 주세요.",
  },
  {
    materials: ["magnetic_tile"],
    note: "자석 장난감은 파손 여부를 먼저 확인하고, 자석이 노출되거나 빠진 제품은 즉시 폐기해 주세요.",
  },
];

const DEFAULT_SAFETY_NOTE =
  "놀이 전 아이의 현재 발달과 컨디션, 주변 환경을 확인하고 보호자가 가까이에서 함께해 주세요.";

export function getPlaySafetyNotes(play: Play): string[] {
  const materials = new Set<MaterialSlug>([
    ...play.materials.required,
    ...play.materials.optional,
    ...play.materials.substitutes,
  ]);
  const generatedNotes = SAFETY_RULES.filter((rule) =>
    rule.materials.some((material) => materials.has(material)),
  ).map((rule) => rule.note);
  const notes = [...play.safetyNotes, ...generatedNotes];

  return [...new Set(notes.length > 0 ? notes : [DEFAULT_SAFETY_NOTE])];
}
