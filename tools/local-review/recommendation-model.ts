import { recommend } from "../../src/engine/recommend";
import { hardFilter } from "../../src/engine/hardFilter";
import { applyFallback } from "../../src/engine/fallback";
import { softScore } from "../../src/engine/softScore";
import { pickTop3 } from "../../src/engine/diversity";
import { getMaterialFit, pickFeaturedPlay } from "../../src/engine/materialFit";
import { inferPlayIntent, playMatchesIntent, getReviewedIntent } from "../../src/engine/intentSignals";
import { getConditionalIntentCandidates, readinessAllowsPlay } from "../../src/engine/intentRecommendation";
import { DEFAULT_WEIGHTS, COLD_START_WEIGHTS } from "../../src/engine/weights";
import type { FilterInput, Play } from "../../src/types";
import type { UserStats } from "../../src/engine/types";

const reasons = { status: "공개 상태가 아님", age: "현재 월령 범위 밖", place: "선택한 장소와 다름", time: "시간 범위 초과", blocked_material: "제외 재료 포함" };

/** Studio observes the actual app engine. It never substitutes its own ranking. */
export function inspectRecommendation(plays: Play[], ctx: FilterInput, stats: UserStats = { totalPlays: 0 }) {
  const intent = inferPlayIntent(ctx.availableMaterials);
  const weights = stats.totalPlays === 0 ? COLD_START_WEIGHTS : DEFAULT_WEIGHTS;
  const hard = plays.map((play) => ({ play, filter: hardFilter(play, ctx) }));
  const pool = hard.filter((r) => r.filter.pass || r.filter.reason === "time").map((r) => r.play);
  const fallback = applyFallback(ctx, pool);
  const candidateIds = new Set(fallback.plays.map((p) => p.id));
  const baseline = pickTop3(fallback.plays.map((play) => ({ play, ...softScore(play, ctx, weights) })), ctx, new Set(stats.recentCompletedPlayIds ?? []));
  const conditional = getConditionalIntentCandidates(plays, ctx);
  const conditionalIds = new Set(conditional.map((p) => p.id));
  const actual = recommend(plays, ctx, stats);
  const selectedIds = new Set(actual.results.map((p) => p.id));
  const featured = pickFeaturedPlay(actual.results, ctx.availableMaterials, ctx.childAgeMonths);
  const available = new Set(ctx.availableMaterials);
  const strict = pool.filter((p) => p.durationMin <= ctx.availableMinutes * 1.3);
  const currentIntent = (strict.length >= 3 ? strict : pool.filter((p) => p.durationMin <= ctx.availableMinutes * 1.5))
    .filter((p) => playMatchesIntent(p, intent) && p.materials.required.every((m) => available.has(m)));
  const rows = hard.map(({ play, filter }) => {
    const fit = getMaterialFit(play, available);
    const intentMatch = playMatchesIntent(play, intent);
    const offer = conditionalIds.has(play.id);
    const allowed = offer && readinessAllowsPlay(play, ctx);
    const selected = selectedIds.has(play.id);
    let reason: string;
    if (selected) {
      reason = play.ageMin > ctx.childAgeMonths ? "검수한 상위 월령 · 준비 완료 · 도움 조건 확인"
        : intentMatch && fit.missing === 0 ? "현재 월령 · 활동 의도 일치 · 준비 완료"
        : fit.matched > 0 ? fit.missing === 0 ? "선택 재료 활용 · 준비 완료" : `선택 재료 일부 활용 · 추가 ${fit.missing}종 필요`
        : play.materials.required.length === 0 ? ctx.availableMaterials.length ? "관련 후보 부족으로 무재료 놀이 보충" : "현재 월령 · 재료 없이 가능한 놀이"
        : ctx.availableMaterials.length ? "관련 후보 부족으로 다른 놀이 보충" : `현재 월령 · 필수 재료 ${play.materials.required.length}종 준비 필요`;
    } else if (offer) {
      reason = allowed ? "조건부 자격은 충족하나 현재 의도 후보 우선·최대 1개 보충 규칙으로 미선정" : "조건부 검수 후보 · 보호자 도움/제품 연령/동작 준비 조건 미확인";
    } else if (play.ageMin > ctx.childAgeMonths && play.status === "live") {
      const nonAge = hardFilter(play, { ...ctx, childAgeMonths: play.ageMin });
      const review = getReviewedIntent(play);
      reason = nonAge.reason && nonAge.reason !== "time" ? reasons[nonAge.reason]
        : play.ageMin > ctx.childAgeMonths + 3 ? "+3개월 후보 탐색 범위 밖"
        : !review || !("minSupportedMonths" in review) ? "상위 월령 보충 검수 대상이 아니거나 검수 후 내용이 변경됨"
        : !intentMatch ? "추정한 활동 의도와 다름"
        : fit.missing > 0 ? `상위 후보의 필수 재료 ${fit.missing}종 부족`
        : "시험 최소 월령·시간·제외 기준 등 조건부 자격 미충족";
    } else if (!filter.pass && filter.reason !== "time") {
      reason = reasons[filter.reason!];
    } else if (!candidateIds.has(play.id)) {
      reason = "기본 후보 풀에서 제외 · 시간 완화 한도 또는 준비 완료 후보 우선";
    } else {
      reason = "후보 자격은 충족하나 재료·최근 완료·점수·다양성 비교 후 미선정";
    }
    return { play, selected, featured: featured?.id === play.id, intentMatch, fit,
      currentCandidate: candidateIds.has(play.id), conditionalCandidate: offer, conditionalAllowed: allowed,
      filterReason: filter.reason ?? null, reason, missing: play.materials.required.filter((m) => !available.has(m)), score: softScore(play, ctx, weights) };
  });
  return { results: actual.results, featured, baseline, intent, weights, usedFallback: actual.usedFallback,
    conditional, currentIntent, rows,
    counts: { total: plays.length, live: plays.filter((p) => p.status === "live").length,
      hardPass: hard.filter((r) => r.filter.pass).length, baselinePool: fallback.plays.length,
      currentIntent: currentIntent.length, conditional: conditional.length,
      allowedConditional: conditional.filter((p) => readinessAllowsPlay(p, ctx)).length,
      selected: actual.results.length } };
}
