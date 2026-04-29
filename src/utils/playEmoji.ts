import type { DevArea } from "@/constants/devAreas";
import type { MaterialSlug } from "@/constants/materials";
import type { Play } from "@/types";

const DEV_AREA_EMOJI: Record<DevArea, string> = {
  fine_motor: "✏️",
  gross_motor: "🏃",
  cognitive: "🧩",
  language: "💬",
  emotional: "💛",
  social: "🤝",
  sensory: "🎨",
};

const MATERIAL_EMOJI: Partial<Record<MaterialSlug, string>> = {
  ball: "⚽",
  balloon: "🎈",
  bead: "📿",
  blanket: "🛏️",
  block: "🧱",
  book: "📚",
  bubble: "🫧",
  cardboard: "📦",
  chopsticks: "🥢",
  clay: "🫳",
  crayon: "🖍️",
  cup: "🥤",
  doll: "🧸",
  flashlight: "🔦",
  flour: "🥣",
  mirror: "🪞",
  paint: "🎨",
  paper: "📄",
  puzzle: "🧩",
  sand: "🏖️",
  scissors: "✂️",
  slime: "🫠",
  smartphone: "📱",
  spoon: "🥄",
  sticker: "🏷️",
  straw: "🥤",
  string: "🧵",
  tissue: "🧻",
  tongs: "🤏",
  water: "💧",
};

const PLAY_KEYWORD_EMOJI: Array<{ emoji: string; keywords: string[] }> = [
  { emoji: "🌬️", keywords: ["바람", "후", "불기", "바람개비"] },
  { emoji: "📖", keywords: ["스토리", "이야기", "동화", "자기전"] },
  { emoji: "🛏️", keywords: ["베개", "쿠션", "요새", "이불"] },
  { emoji: "🎵", keywords: ["노래", "음악", "동요", "율동", "리듬"] },
  { emoji: "🧸", keywords: ["인형극", "인형", "장난감"] },
  { emoji: "📚", keywords: ["그림책", "책", "읽어주기", "독서"] },
  { emoji: "📱", keywords: ["전화", "베이비사인", "실황"] },
  { emoji: "🪞", keywords: ["거울", "표정", "감정"] },
  { emoji: "⚽", keywords: ["공", "축구", "볼링", "배구"] },
  { emoji: "🏃", keywords: ["달리기", "점프", "균형", "장애물", "터널", "터미타임"] },
  { emoji: "🎈", keywords: ["풍선", "모빌"] },
  { emoji: "🎨", keywords: ["그리기", "그림", "물감", "색연필", "크레용", "도장", "콜라주"] },
  { emoji: "✂️", keywords: ["가위", "오리기", "자르기"] },
  { emoji: "🧩", keywords: ["퍼즐", "미로", "패턴", "분류", "수수께끼"] },
  { emoji: "🧱", keywords: ["블록", "쌓기", "탑", "구조물"] },
  { emoji: "📿", keywords: ["구슬", "꿰기", "끈"] },
  { emoji: "🏷️", keywords: ["스티커"] },
  { emoji: "📄", keywords: ["종이접기", "색종이", "신문지", "종이컵"] },
  { emoji: "🥢", keywords: ["젓가락"] },
  { emoji: "🥣", keywords: ["밀가루", "반죽", "요리사", "음식", "두부"] },
  { emoji: "🫧", keywords: ["물", "얼음", "목욕"] },
  { emoji: "🤲", keywords: ["촉감", "오감", "감각", "찰흙", "점토", "클레이", "슬라임", "플레이도"] },
  { emoji: "👀", keywords: ["눈맞춤", "까꿍", "숨기", "찾기"] },
  { emoji: "🤝", keywords: ["함께", "협동", "주고받기", "차례", "상호작용"] },
];

function normalize(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

export function getPlayRepresentativeEmoji(play: Play): string {
  const haystack = normalize([play.name, ...play.tags].join(" "));

  for (const { emoji, keywords } of PLAY_KEYWORD_EMOJI) {
    if (keywords.some((keyword) => haystack.includes(normalize(keyword)))) {
      return emoji;
    }
  }

  const materials = [
    ...play.materials.required,
    ...play.materials.optional,
    ...play.materials.substitutes,
  ];
  for (const material of materials) {
    const emoji = MATERIAL_EMOJI[material];
    if (emoji) {
      return emoji;
    }
  }

  return DEV_AREA_EMOJI[play.devAreas[0] ?? "cognitive"] ?? "🎮";
}
