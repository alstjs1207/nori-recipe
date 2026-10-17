import catalog from "./intentCatalog.json";
import type { Play, PlayIntent } from "@/types";

export const INTENT_REVIEW_VERSION = catalog.version;

export const INTENT_LABELS: Record<PlayIntent, string> = {
  cutting: "종이 자르기",
  gluing: "풀로 붙이기",
  tape: "테이프 떼기·붙이기",
  painting: "물감으로 표현하기",
};

export function inferPlayIntent(materials: readonly string[]): PlayIntent | null {
  const selected = new Set(materials);
  if (["car_toy", "ball", "book", "doll", "puzzle"].some((m) => selected.has(m))) return null;
  if (["scissors", "paper", "paint"].every((m) => selected.has(m))) return null;
  if (selected.has("scissors") && selected.has("paper")) return "cutting";
  if (selected.has("glue") && ["paper", "cardboard"].some((m) => selected.has(m))) return "gluing";
  if (selected.has("tape") && ["paper", "paper_plate", "animal_toy"].some((m) => selected.has(m))) return "tape";
  if (selected.has("paint") && ["paper", "paper_plate"].some((m) => selected.has(m))) return "painting";
  return null;
}

const rows = new Map(catalog.items.map((row) => [row.id, row]));

// Fail closed after content edits. Do not cache by object identity: callers can edit a play.
export function getReviewedIntent(play: Play) {
  const row = rows.get(play.id);
  return row && row.signature === JSON.stringify(play) ? row : null;
}

export function playMatchesIntent(play: Play, intent: PlayIntent | null): boolean {
  return intent !== null && (getReviewedIntent(play)?.intents.includes(intent) ?? false);
}

export function isReadyIntentMatch(play: Play, materials: readonly string[]): boolean {
  return playMatchesIntent(play, inferPlayIntent(materials)) && play.materials.required.every((m) => materials.includes(m));
}
