import type { HardFilterReason } from "@/engine/types";
import type { Play, FilterInput } from "@/types";

type HardFilterResult = {
  pass: boolean;
  reason?: HardFilterReason;
};

function getAllMaterials(play: Play): Play["materials"]["required"] {
  return [
    ...play.materials.required,
    ...play.materials.optional,
    ...play.materials.substitutes,
  ];
}

export function hardFilter(play: Play, ctx: FilterInput): HardFilterResult {
  if (play.status !== "live") {
    return { pass: false, reason: "status" };
  }

  if (ctx.childAgeMonths < play.ageMin || ctx.childAgeMonths > play.ageMax) {
    return { pass: false, reason: "age" };
  }

  if (!(ctx.place === "any" || play.place === "any" || play.place === ctx.place)) {
    return { pass: false, reason: "place" };
  }

  if (play.durationMin > ctx.availableMinutes * 1.3) {
    return { pass: false, reason: "time" };
  }

  const blockedMaterials = new Set(ctx.blockedMaterials);
  if (getAllMaterials(play).some((material) => blockedMaterials.has(material))) {
    return { pass: false, reason: "blocked_material" };
  }

  return { pass: true };
}
