import type { MaterialSlug } from "@/constants/materials";
import type { Play } from "@/types";

type SafetyRule = {
  materials: MaterialSlug[];
  note: string;
};

const SAFETY_RULES: SafetyRule[] = [
  {
    materials: ["marble", "bead", "pom_pom", "water_beads", "play_corn"],
    note: "작은 재료는 삼킴·질식 위험이 있어 3세 미만에게 제공하지 않습니다. 제품 사용 연령을 확인하고 입에 넣는 아이에게는 주지 않으며, 놀이 후 즉시 수거해 주세요.",
  },
  {
    materials: ["balloon"],
    note: "보호자가 직접 불고 불지 않은 풍선은 아이에게 주지 않습니다. 터진 조각도 질식 위험이 있으므로 바로 모두 치워 주세요.",
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
    materials: ["flour", "rice_flour"],
    note: "생밀가루·생반죽을 직접 만지는 놀이로 제공하지 않습니다. 식용 표시는 생가루를 먹거나 놀이해도 안전하다는 뜻이 아닙니다.",
  },
  {
    materials: ["soft_food"],
    note: "식재료의 종류·질감이 아이에게 이미 적합한지, 알레르기나 섭취 제한이 있는지 먼저 확인합니다. 안정된 자세에서 곁을 지키고 먹이거나 만지기를 강요하지 않습니다.",
  },
  {
    materials: ["paint", "glue", "slime", "clay", "kinetic_sand", "sand"],
    note: "조형·미술 재료는 제품에 표시된 사용 연령을 지킵니다. 무독성은 먹어도 된다는 뜻이 아니며, 눈과 입에 닿지 않게 하고 놀이 후 손을 씻어 주세요.",
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
