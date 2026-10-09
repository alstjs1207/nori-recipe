import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEV_AREAS = new Set(["fine_motor", "gross_motor", "cognitive", "language", "emotional", "social", "sensory"]);
const SOURCE_TYPES = new Set(["youtube", "instagram", "naver_blog", "chaisplay", "tistory", "brunch", "manual"]);
const stringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
function isDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validatePlayBundle(bundle, registry) {
  const errors = [];
  const warnings = [];
  const fail = (id, field, message) => errors.push({ id, field, message });
  const warn = (id, field, message) => warnings.push({ id, field, message });
  if (!bundle || typeof bundle.version !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bundle.updatedAt ?? "")) {
    fail("bundle", "metadata", "version과 YYYY-MM-DD 형식 updatedAt이 필요합니다.");
  }
  if (!Array.isArray(bundle?.plays) || bundle.plays.length === 0) {
    fail("bundle", "plays", "비어 있지 않은 plays 배열이 필요합니다.");
    return { errors, warnings };
  }
  const slugs = new Set(Object.values(registry.categories).flat());
  const ids = new Set();
  const liveNames = new Set();
  for (const play of bundle.plays) {
    const id = play?.id ?? "unknown";
    if (!play || typeof play !== "object") { fail(id, "play", "놀이 객체가 필요합니다."); continue; }
    if (!/^play_\d{3,}$/.test(id) || ids.has(id)) fail(id, "id", "ID 형식이 잘못되었거나 중복입니다.");
    ids.add(id);
    if (play.createdAt !== undefined && !isDateOnly(play.createdAt)) fail(id, "createdAt", "생성일은 실제로 존재하는 YYYY-MM-DD 날짜여야 합니다.");
    if (typeof play.name !== "string" || !play.name.trim()) fail(id, "name", "빈 놀이명은 사용할 수 없습니다.");
    if (![play.ageMin, play.ageMax].every(Number.isInteger) || !(0 <= play.ageMin && play.ageMin <= play.ageMax && play.ageMax <= 48)) fail(id, "age", "월령은 0~48 사이 정수이며 최소≤최대여야 합니다.");
    if (![play.durationMin, play.durationMax, play.prepTime].every(Number.isFinite) || !(0 < play.durationMin && play.durationMin <= play.durationMax && play.prepTime >= 0)) fail(id, "duration", "놀이 시간은 양수이며 최소≤최대, 준비 시간은 0 이상이어야 합니다.");
    if (!["indoor", "outdoor", "any"].includes(play.place)) fail(id, "place", "잘못된 장소입니다.");
    if (![1, 2, 3].includes(play.difficulty)) fail(id, "difficulty", "잘못된 난이도입니다.");
    if (!["live", "draft", "archived"].includes(play.status)) fail(id, "status", "잘못된 게시 상태입니다.");
    if (play.imageStatus !== undefined && play.imageStatus !== "review") fail(id, "imageStatus", "이미지 검토 상태는 review만 사용할 수 있습니다.");
    if (play.tip !== undefined && typeof play.tip !== "string") fail(id, "tip", "팁은 문자열이어야 합니다.");
    for (const field of ["devAreas", "steps", "safetyNotes", "educationalEffects", "tags"]) {
      if (!stringArray(play[field])) fail(id, field, "빈 문자열이 없는 문자열 배열이어야 합니다.");
    }
    if (!Array.isArray(play.devAreas) || play.devAreas.length === 0 || play.devAreas.some((area) => !DEV_AREAS.has(area))) fail(id, "devAreas", "유효한 발달영역이 필요합니다.");
    if (Array.isArray(play.steps) && play.steps.length < 2) fail(id, "steps", "준비와 진행을 포함한 최소 두 단계가 필요합니다.");
    if (Array.isArray(play.tags) && play.tags.some((tag) => /\d+\s*개월|돌아기|신생아/.test(tag))) fail(id, "tags", "연령은 태그 대신 월령 필드에 기록합니다.");
    const materials = play.materials;
    if (!materials || !["required", "optional", "substitutes"].every((field) => stringArray(materials[field]))) {
      fail(id, "materials", "required·optional·substitutes 배열이 필요합니다.");
    } else {
      const all = [...materials.required, ...materials.optional, ...materials.substitutes];
      if (all.some((slug) => !slugs.has(slug))) fail(id, "materials", "등록되지 않은 재료입니다.");
      if (new Set(all).size !== all.length) fail(id, "materials", "중복 또는 필수·선택 재료 중첩입니다.");
      if (materials.substitutes.length) fail(id, "materials.substitutes", "대체 재료 배열은 비워 둡니다.");
      if (play.status === "live") {
        if (all.some((slug) => ["flour", "rice_flour"].includes(slug))) fail(id, "materials", "생가루·생반죽 직접 놀이는 게시하지 않습니다.");
        if (play.ageMin < 36 && all.some((slug) => ["marble", "bead", "pom_pom", "water_beads", "play_corn", "slime"].includes(slug))) fail(id, "materials", "작은 구슬·공작 조각과 일반 슬라임은 3세 미만 추천에서 제외합니다.");
      }
    }
    const source = play.source;
    if (!source || !SOURCE_TYPES.has(source.type)) { fail(id, "source.type", "잘못된 출처 유형입니다."); continue; }
    if (source.instagramAccount !== null && typeof source.instagramAccount !== "string") fail(id, "source.instagramAccount", "계정은 문자열 또는 null이어야 합니다.");
    if (source.url === null) {
      if (source.type !== "manual") fail(id, "source.url", "외부 출처는 개별 원문 URL이 필요합니다.");
    } else {
      try {
        const url = new URL(source.url);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("protocol");
        const host = url.hostname.toLowerCase();
        const matches = {
          youtube: ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"].includes(host),
          instagram: ["instagram.com", "www.instagram.com"].includes(host),
          naver_blog: ["blog.naver.com", "m.blog.naver.com"].includes(host),
          chaisplay: ["chaisplay.com", "www.chaisplay.com"].includes(host),
          brunch: host === "brunch.co.kr",
          tistory: host.endsWith(".tistory.com") || host === "kidsgrowthlab.com",
          manual: true,
        };
        if (!matches[source.type]) {
          if (source.type === "tistory") warn(id, "source.url", "티스토리 맞춤 도메인은 원문 플랫폼 확인이 필요합니다.");
          else fail(id, "source.url", "출처 플랫폼과 URL 도메인이 다릅니다.");
        }
        if (source.type === "youtube" && !(host === "youtu.be" ? /^\/[^/]+\/?$/.test(url.pathname) : (url.pathname === "/watch" && url.searchParams.has("v")) || /^\/(shorts|embed)\/[^/]+\/?$/.test(url.pathname))) fail(id, "source.url", "검색·채널 목록 대신 개별 영상 URL을 사용합니다.");
      } catch { fail(id, "source.url", "유효한 HTTP(S) 원문 URL이 필요합니다."); }
    }
    if (play.status === "live") {
      if (liveNames.has(play.name)) fail(id, "name", "게시 중인 놀이명이 중복입니다.");
      liveNames.add(play.name);
      if (Array.isArray(play.educationalEffects) && !play.educationalEffects.length) warn(id, "educationalEffects", "게시 중인 놀이 효과가 비어 있습니다.");
      if (Array.isArray(play.safetyNotes) && !play.safetyNotes.length && play.ageMin < 36) warn(id, "safetyNotes", "3세 미만 대상 개별 안전 안내를 확인해 주세요. 화면에서는 공통 안내를 보완합니다.");
    }
  }
  return { errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const bundle = JSON.parse(await fs.readFile(path.join(root, "data/plays.json"), "utf8"));
    const registry = JSON.parse(await fs.readFile(path.join(root, "data/materials.json"), "utf8"));
    const result = validatePlayBundle(bundle, registry);
    const statuses = Object.fromEntries(["live", "draft", "archived"].map((status) => [status, bundle.plays.filter((play) => play.status === status).length]));
    console.info(JSON.stringify({ plays: bundle.plays.length, statuses, ...result }, null, 2));
    if (result.errors.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
