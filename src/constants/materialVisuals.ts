import type { ImageSourcePropType } from "react-native";

import type { MaterialSlug } from "@/constants/materials";

type MaterialVisualSpec = {
  symbol: string;
  backgroundColor: string;
  tintColor: string;
  imageSource: ImageSourcePropType;
};

type MaterialVisualFallback = Omit<MaterialVisualSpec, "imageSource">;

export const MATERIAL_IMAGE_GUIDELINES = [
  "1:1 square asset with transparent or warm white background.",
  "Object-only crop, front or slight 3/4 angle, no labels or hands.",
  "Soft daylight shadow, consistent object scale, safe padding around edges.",
  "Use one asset per material slug so selected and unselected states can share the same image.",
] as const;

const MATERIAL_IMAGES = {
  paper: require("../../images/material/Stack_of_paper_202604282312.jpeg"),
  cardboard: require("../../images/material/Cardboard_box_with_202604282312.jpeg"),
  tissue: require("../../images/material/A_3D_rendered_202604282312_2.jpeg"),
  sticker: require("../../images/material/Round_colorful_stickers_202604282312.jpeg"),
  cloth: require("../../images/material/Folded_cloth_handkerchief_202604282312.jpeg"),
  blanket: require("../../images/material/Folded_blanket_icon_202604282312.jpeg"),
  flour: require("../../images/material/Flour_pile_with_202604282312.jpeg"),
  rice_flour: require("../../images/material/Rice_flour_in_202604282312.jpeg"),
  water: require("../../images/material/A_3D_rendered_202604282312.jpeg"),
  bowl: require("../../images/material/Empty_ceramic_mixing_202604282312.jpeg"),
  cup: require("../../images/material/Empty_ceramic_cup_202604282312.jpeg"),
  spoon: require("../../images/material/Wooden_spoon_on_202604282312.jpeg"),
  chopsticks: require("../../images/material/A_3D_rendered_202604282312_3.jpeg"),
  bottle: require("../../images/material/A_3D_rendered_202604282312_4.jpeg"),
  soft_food: require("../../images/material/A_3D_rendered_202604282312_5.jpeg"),
  crayon: require("../../images/material/Five_colored_pencils_202604282312.jpeg"),
  paint: require("../../images/material/Paint_palette_with_202604282312.jpeg"),
  glue: require("../../images/material/Glue_stick_with_202604282312.jpeg"),
  tape: require("../../images/material/Roll_of_tape_202604282312.jpeg"),
  string: require("../../images/material/A_3D_rendered_202604282312_7.jpeg"),
  rubber_band: require("../../images/material/A_3D_rendered_202604282312_11.jpeg"),
  straw: require("../../images/material/A_3D_rendered_202604282312_13.jpeg"),
  sand: require("../../images/material/Sand_mound_with_202604282312.jpeg"),
  kinetic_sand: require("../../images/material/Kinetic_sand_icon_202604282312.jpeg"),
  water_bin: require("../../images/material/Plastic_basin_with_202604282312.jpeg"),
  water_beads: require("../../images/material/Water_beads_pile_202604282312.jpeg"),
  bubble: require("../../images/material/Bubble_wand_bottle_202604282312.jpeg"),
  balloon: require("../../images/material/Three_balloons_tied_202604282312.jpeg"),
  slime: require("../../images/material/A_3D_rendered_202604282312_6.jpeg"),
  block: require("../../images/material/Wooden_building_blocks_202604282312.jpeg"),
  magnetic_tile: require("../../images/material/Three_magnetic_tiles_202604282312.jpeg"),
  ball: require("../../images/material/A_3D_rendered_202604282312_12.jpeg"),
  puzzle: require("../../images/material/Four_interlocking_jigsaw_202604282312.jpeg"),
  book: require("../../images/material/Children's_book_icon_202604282312.jpeg"),
  mirror: require("../../images/material/A_3D_rendered_202604282312_10.jpeg"),
  doll: require("../../images/material/Plush_doll_sitting_202604282312.jpeg"),
  marble: require("../../images/material/Pile_of_glass_202604282312.jpeg"),
  bead: require("../../images/material/Pile_of_colorful_202604282312.jpeg"),
  car_toy: require("../../images/material/A_3D_rendered_202604282312_8.jpeg"),
  clay: require("../../images/material/Three_clay_balls_202604282312.jpeg"),
  foam: require("../../images/material/Sponge_icon_on_202604282312.jpeg"),
  play_corn: require("../../images/material/Play_corn_pieces_202604282312.jpeg"),
  scissors: require("../../images/material/A_3D_rendered_202604282312_14.jpeg"),
  tongs: require("../../images/material/Kitchen_tongs_on_202604282312.jpeg"),
  smartphone: require("../../images/material/A_3D_rendered_202604282312_9.jpeg"),
  flashlight: require("../../images/material/Handheld_flashlight_on_202604282312.jpeg"),
  mat: require("../../images/material/Folded_play_mat_202604282312.jpeg"),
  shape_ruler: require("../../images/material/Plastic_shape_stencil_202604282312.jpeg"),
} satisfies Record<MaterialSlug, ImageSourcePropType>;

const CATEGORY_VISUALS: Record<string, MaterialVisualFallback> = {
  종이류: {
    symbol: "□",
    backgroundColor: "#F6F8FB",
    tintColor: "#8A9BB2",
  },
  주방: {
    symbol: "◯",
    backgroundColor: "#FFF5E2",
    tintColor: "#D89A32",
  },
  공작: {
    symbol: "✎",
    backgroundColor: "#FFF1E8",
    tintColor: "#F07857",
  },
  감각: {
    symbol: "●",
    backgroundColor: "#EAF7FF",
    tintColor: "#4EA9D8",
  },
  "블록/장난감": {
    symbol: "◆",
    backgroundColor: "#F0F4FF",
    tintColor: "#6F86E8",
  },
  조형: {
    symbol: "◒",
    backgroundColor: "#F2F8ED",
    tintColor: "#75A85F",
  },
  도구: {
    symbol: "◇",
    backgroundColor: "#F6F4F1",
    tintColor: "#8E8377",
  },
};

const MATERIAL_VISUALS: Partial<Record<MaterialSlug, MaterialVisualFallback>> = {
  paper: { symbol: "□", backgroundColor: "#F6F8FB", tintColor: "#91A0AF" },
  cardboard: { symbol: "▰", backgroundColor: "#FFF0D8", tintColor: "#B98243" },
  tissue: { symbol: "▱", backgroundColor: "#F7F9FB", tintColor: "#A9B6C3" },
  sticker: { symbol: "✦", backgroundColor: "#FFF3C7", tintColor: "#E5A900" },
  cloth: { symbol: "≈", backgroundColor: "#F0F2FF", tintColor: "#7C8DD7" },
  blanket: { symbol: "▤", backgroundColor: "#F2F0FF", tintColor: "#9279D9" },
  flour: { symbol: "◌", backgroundColor: "#FFFAEA", tintColor: "#D8C08B" },
  rice_flour: { symbol: "⋯", backgroundColor: "#FFFBEF", tintColor: "#D4B978" },
  water: { symbol: "∿", backgroundColor: "#EAF7FF", tintColor: "#56B3DF" },
  bowl: { symbol: "◡", backgroundColor: "#FFF0D8", tintColor: "#D99B43" },
  cup: { symbol: "▱", backgroundColor: "#EEF7FF", tintColor: "#6AAFDA" },
  spoon: { symbol: "⌒", backgroundColor: "#F5F2ED", tintColor: "#9B8E7E" },
  chopsticks: { symbol: "∥", backgroundColor: "#FFF2DC", tintColor: "#B9874F" },
  bottle: { symbol: "♢", backgroundColor: "#EAF8F5", tintColor: "#5BB9A7" },
  soft_food: { symbol: "◕", backgroundColor: "#FFF0EA", tintColor: "#E88772" },
  crayon: { symbol: "✎", backgroundColor: "#FFF1E8", tintColor: "#F47B4F" },
  paint: { symbol: "▦", backgroundColor: "#FFF5D8", tintColor: "#EEB21E" },
  glue: { symbol: "▮", backgroundColor: "#EEFAE9", tintColor: "#7DC867" },
  tape: { symbol: "◎", backgroundColor: "#FFF7E2", tintColor: "#D9A448" },
  string: { symbol: "∞", backgroundColor: "#F2F0FF", tintColor: "#927DDF" },
  rubber_band: { symbol: "○", backgroundColor: "#FFF0EC", tintColor: "#E37764" },
  straw: { symbol: "╱", backgroundColor: "#F1F8FF", tintColor: "#5499D3" },
  sand: { symbol: "◍", backgroundColor: "#FFF1D6", tintColor: "#D5A150" },
  kinetic_sand: { symbol: "◍", backgroundColor: "#F6EDDD", tintColor: "#B9915F" },
  water_bin: { symbol: "▭", backgroundColor: "#E8F7FF", tintColor: "#52AADC" },
  water_beads: { symbol: "●", backgroundColor: "#EEF4FF", tintColor: "#6B83E9" },
  bubble: { symbol: "○", backgroundColor: "#ECFAFF", tintColor: "#67BDE2" },
  balloon: { symbol: "◖", backgroundColor: "#FFF0F3", tintColor: "#ED7794" },
  slime: { symbol: "∽", backgroundColor: "#ECF9EB", tintColor: "#67BD70" },
  block: { symbol: "■", backgroundColor: "#FFF3D8", tintColor: "#E2A131" },
  magnetic_tile: { symbol: "◇", backgroundColor: "#EEF3FF", tintColor: "#6F86E8" },
  ball: { symbol: "●", backgroundColor: "#FFF0F3", tintColor: "#E87791" },
  puzzle: { symbol: "▣", backgroundColor: "#EFF7EC", tintColor: "#73A866" },
  book: { symbol: "▤", backgroundColor: "#F0F2FF", tintColor: "#697FDF" },
  mirror: { symbol: "◯", backgroundColor: "#F2FAFF", tintColor: "#82B9D9" },
  doll: { symbol: "☺", backgroundColor: "#FFF0EA", tintColor: "#D98776" },
  marble: { symbol: "●", backgroundColor: "#F5F2FF", tintColor: "#8E79DD" },
  bead: { symbol: "∙", backgroundColor: "#FFF1F7", tintColor: "#D976A6" },
  car_toy: { symbol: "▰", backgroundColor: "#EEF7FF", tintColor: "#5D9CD4" },
  clay: { symbol: "◒", backgroundColor: "#F2F8ED", tintColor: "#76A85F" },
  foam: { symbol: "▧", backgroundColor: "#F6FAEE", tintColor: "#96AF5B" },
  play_corn: { symbol: "▥", backgroundColor: "#FFF4DA", tintColor: "#E2A439" },
  scissors: { symbol: "✂", backgroundColor: "#F7F7F8", tintColor: "#8A8A92" },
  tongs: { symbol: "⌯", backgroundColor: "#F7F2EA", tintColor: "#A78762" },
  smartphone: { symbol: "▯", backgroundColor: "#F0F2F6", tintColor: "#6E7785" },
  flashlight: { symbol: "◖", backgroundColor: "#FFF7D7", tintColor: "#E3B12A" },
  mat: { symbol: "▤", backgroundColor: "#F2F7EF", tintColor: "#7FA66F" },
  shape_ruler: { symbol: "△", backgroundColor: "#F2F0FF", tintColor: "#8874DC" },
};

export function getMaterialVisualSpec(
  material: MaterialSlug,
  categoryName: string,
): MaterialVisualSpec {
  return {
    ...(MATERIAL_VISUALS[material] ?? CATEGORY_VISUALS[categoryName] ?? CATEGORY_VISUALS.도구),
    imageSource: MATERIAL_IMAGES[material],
  };
}
