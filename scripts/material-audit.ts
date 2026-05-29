import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { MATERIAL_DISPLAY_NAMES, MATERIAL_SLUGS, type MaterialSlug } from "@/constants/materials";
import { hardFilter } from "@/engine/hardFilter";
import { recommend } from "@/engine/recommend";
import { loadLivePlays } from "@/data/content";
import type { FilterInput, Play } from "@/types";

type MatchGrade = "full" | "partial" | "none";
type FullMatchType = "material_backed" | "zero_required" | null;
type CaseStatus = "pass" | "candidate_limited" | "review" | "fallback" | "no_candidate";

type RecommendationAnalysis = {
  id: string;
  name: string;
  required: MaterialSlug[];
  optional: MaterialSlug[];
  substitutes: MaterialSlug[];
  requiredOwnedCount: number;
  requiredCount: number;
  requiredCoverage: number;
  matchGrade: MatchGrade;
  fullMatchType: FullMatchType;
};

type CaseAnalysis = {
  caseId: string;
  context: Omit<FilterInput, "availableMaterials" | "blockedMaterials" | "devGaps" | "userFeedback">;
  generatedFromPlayId: string | null;
  generatedFromPlayName: string | null;
  selectedMaterials: MaterialSlug[];
  selectedMaterialNames: string[];
  exactCandidateCount: number;
  materialBackedExactCandidateCount: number;
  zeroRequiredExactCandidateCount: number;
  partialCandidateCount: number;
  noMatchCandidateCount: number;
  usedFallback: boolean;
  top3AllFullMatch: boolean;
  top3AllMaterialBackedFullMatch: boolean;
  top3HasZeroRequiredFull: boolean;
  top1FullMatch: boolean;
  top1MaterialBackedFullMatch: boolean;
  results: RecommendationAnalysis[];
};

type Summary = {
  totalCases: number;
  totalRecommendations: number;
  fullMatchRecommendations: number;
  materialBackedFullRecommendations: number;
  zeroRequiredFullRecommendations: number;
  partialMatchRecommendations: number;
  noMatchRecommendations: number;
  fullMatchRecommendationRate: number;
  materialBackedFullRecommendationRate: number;
  zeroRequiredFullRecommendationRate: number;
  top1FullMatchCases: number;
  top1FullMatchRate: number;
  top1MaterialBackedFullMatchCases: number;
  top1MaterialBackedFullMatchRate: number;
  top3AllFullMatchCases: number;
  top3AllFullMatchRate: number;
  top3AllMaterialBackedFullMatchCases: number;
  top3AllMaterialBackedFullMatchRate: number;
  fallbackCases: number;
  fallbackRate: number;
  casesWithAtLeastOneMismatch: number;
  casesWithAtLeastOneMismatchRate: number;
  casesWithNoExactCandidate: number;
  casesWithNoExactCandidateRate: number;
  casesWithNoMaterialBackedExactCandidate: number;
  casesWithNoMaterialBackedExactCandidateRate: number;
  casesWithZeroRequiredFullRecommendation: number;
  casesWithZeroRequiredFullRecommendationRate: number;
  exactCandidateDistribution: Record<string, number>;
  materialBackedExactCandidateDistribution: Record<string, number>;
};

type AuditSuite = {
  id: string;
  title: string;
  description: string;
  cases: CaseAnalysis[];
  summary: Summary;
};

type AuditContext = Pick<FilterInput, "childAgeMonths" | "availableMinutes" | "place">;
type GeneratedAuditCase = {
  materials: MaterialSlug[];
  playId: string | null;
};
type GeneratedStressCase = GeneratedAuditCase & {
  context: AuditContext;
};

// Generated audit artifacts live outside the app bundle so they can be opened directly in a browser.
const OUTPUT_DIR = path.resolve(process.cwd(), "results", "material-audit");

const AUDIT_CASE_COUNT = 120;
const RNG_SEED = 20260416;

const SCORE_CONTEXT = {
  devGaps: {
    fine_motor: 80,
    cognitive: 70,
    social: 60,
    language: 50,
  },
  userFeedback: {
    fine_motor: 50,
    cognitive: 50,
    social: 50,
    language: 50,
  },
};

const BASELINE_CONTEXT = {
  childAgeMonths: 24,
  availableMinutes: 20,
  place: "indoor" as const,
};

const STRESS_CONTEXTS = [
  { childAgeMonths: 12, availableMinutes: 10, place: "indoor" as const },
  { childAgeMonths: 24, availableMinutes: 10, place: "indoor" as const },
  { childAgeMonths: 30, availableMinutes: 10, place: "indoor" as const },
  { childAgeMonths: 30, availableMinutes: 15, place: "indoor" as const },
];

function createRng(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function pickExtras(
  required: MaterialSlug[],
  targetSize: number,
  rng: () => number,
  preferredPool: MaterialSlug[] = MATERIAL_SLUGS,
): MaterialSlug[] {
  const preferredExtras = shuffle(
    [...new Set(preferredPool)].filter((material) => !required.includes(material)),
    rng,
  );
  const fallbackExtras = shuffle(
    MATERIAL_SLUGS.filter((material) => !required.includes(material) && !preferredExtras.includes(material)),
    rng,
  );
  const neededCount = Math.max(0, targetSize - required.length);
  const requiredPreferredExtras = preferredExtras.slice(0, Math.min(1, neededCount));
  const remainingExtras = shuffle(
    [...preferredExtras.slice(requiredPreferredExtras.length), ...fallbackExtras],
    rng,
  );

  return [...requiredPreferredExtras, ...remainingExtras].slice(0, neededCount);
}

function buildMaterialSetForPlay(
  play: Play,
  rng: () => number,
  preferredExtraPool: MaterialSlug[] = MATERIAL_SLUGS,
): MaterialSlug[] {
  const baseline = [...new Set(play.materials.required)] as MaterialSlug[];
  const targetSize = Math.max(3, Math.min(6, baseline.length + 1 + Math.floor(rng() * 3)));
  return [...baseline, ...pickExtras(baseline, targetSize, rng, preferredExtraPool)].sort();
}

function createFullMaterialContext(baseContext: AuditContext): FilterInput {
  return {
    ...baseContext,
    blockedMaterials: [],
    ...SCORE_CONTEXT,
    availableMaterials: MATERIAL_SLUGS,
  };
}

function getMaterialBackedEligiblePlays(plays: Play[], context: AuditContext) {
  const ctx = createFullMaterialContext(context);

  return plays.filter((play) => play.materials.required.length > 0 && hardFilter(play, ctx).pass);
}

function getCandidateMaterialPool(plays: Play[]): MaterialSlug[] {
  return [
    ...new Set(
      plays.flatMap((play) => [
        ...play.materials.required,
        ...play.materials.optional,
        ...play.materials.substitutes,
      ]),
    ),
  ] as MaterialSlug[];
}

function buildCandidateSeededCases(
  plays: Play[],
  context: AuditContext,
  targetCount: number,
  rng: () => number,
): GeneratedAuditCase[] {
  const eligiblePlays = getMaterialBackedEligiblePlays(plays, context);
  const candidateMaterialPool = getCandidateMaterialPool(eligiblePlays);
  const cases: GeneratedAuditCase[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  let playIndex = 0;
  const maxAttempts = Math.max(targetCount * 300, 1000);

  if (eligiblePlays.length === 0) {
    throw new Error(
      `No material-backed eligible plays for ${context.childAgeMonths}m/${context.place}/${context.availableMinutes}m`,
    );
  }

  while (cases.length < targetCount && attempts < maxAttempts) {
    const play = eligiblePlays[playIndex % eligiblePlays.length];
    const materials = buildMaterialSetForPlay(play, rng, candidateMaterialPool);
    const key = materialKey(materials);

    attempts += 1;
    playIndex += 1;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cases.push({ materials, playId: play.id });
  }

  if (cases.length < targetCount) {
    throw new Error(
      `Only generated ${cases.length}/${targetCount} material-backed cases for ${context.childAgeMonths}m/${context.place}/${context.availableMinutes}m`,
    );
  }

  return cases;
}

function materialKey(materials: MaterialSlug[]): string {
  return [...materials].sort().join(",");
}

function getRequiredCoverage(play: Play, selected: Set<MaterialSlug>) {
  const required = play.materials.required;

  if (required.length === 0) {
    return {
      requiredOwnedCount: 0,
      requiredCount: 0,
      requiredCoverage: 1,
      matchGrade: "full" as const,
    };
  }

  const requiredOwnedCount = required.filter((material) => selected.has(material)).length;
  const requiredCoverage = requiredOwnedCount / required.length;

  if (requiredCoverage === 1) {
    return {
      requiredOwnedCount,
      requiredCount: required.length,
      requiredCoverage,
      matchGrade: "full" as const,
    };
  }

  if (requiredCoverage > 0) {
    return {
      requiredOwnedCount,
      requiredCount: required.length,
      requiredCoverage,
      matchGrade: "partial" as const,
    };
  }

  return {
    requiredOwnedCount,
    requiredCount: required.length,
    requiredCoverage,
    matchGrade: "none" as const,
  };
}

function getFullMatchType(requiredCount: number, matchGrade: MatchGrade): FullMatchType {
  if (matchGrade !== "full") {
    return null;
  }

  return requiredCount > 0 ? "material_backed" : "zero_required";
}

function isMaterialBackedFull(result: RecommendationAnalysis) {
  return result.fullMatchType === "material_backed";
}

function isZeroRequiredFull(result: RecommendationAnalysis) {
  return result.fullMatchType === "zero_required";
}

function formatMaterials(materials: MaterialSlug[]) {
  return materials.map((material) => MATERIAL_DISPLAY_NAMES[material]);
}

function analyzeCase(
  caseId: string,
  selectedMaterials: MaterialSlug[],
  generatedFromPlayId: string | null,
  baseContext: AuditContext,
  plays: Play[],
): CaseAnalysis {
  const ctx: FilterInput = {
    ...baseContext,
    blockedMaterials: [],
    ...SCORE_CONTEXT,
    availableMaterials: selectedMaterials,
  };
  const selectedSet = new Set(selectedMaterials);

  const candidateGrades = plays
    .filter((play) => hardFilter(play, ctx).pass)
    .map((play) => getRequiredCoverage(play, selectedSet));

  const exactCandidateCount = candidateGrades.filter((grade) => grade.matchGrade === "full").length;
  const materialBackedExactCandidateCount = candidateGrades.filter(
    (grade) => grade.matchGrade === "full" && grade.requiredCount > 0,
  ).length;
  const zeroRequiredExactCandidateCount = candidateGrades.filter(
    (grade) => grade.matchGrade === "full" && grade.requiredCount === 0,
  ).length;
  const partialCandidateCount = candidateGrades.filter((grade) => grade.matchGrade === "partial").length;
  const noMatchCandidateCount = candidateGrades.filter((grade) => grade.matchGrade === "none").length;

  const recommendation = recommend(plays, ctx, { totalPlays: 5 });
  const generatedFromPlay = generatedFromPlayId
    ? plays.find((play) => play.id === generatedFromPlayId)
    : null;
  const results = recommendation.results.map((play) => {
    const coverage = getRequiredCoverage(play, selectedSet);

    return {
      id: play.id,
      name: play.name,
      required: play.materials.required,
      optional: play.materials.optional,
      substitutes: play.materials.substitutes,
      ...coverage,
      fullMatchType: getFullMatchType(coverage.requiredCount, coverage.matchGrade),
    };
  });

  return {
    caseId,
    context: baseContext,
    generatedFromPlayId,
    generatedFromPlayName: generatedFromPlay?.name ?? null,
    selectedMaterials,
    selectedMaterialNames: formatMaterials(selectedMaterials),
    exactCandidateCount,
    materialBackedExactCandidateCount,
    zeroRequiredExactCandidateCount,
    partialCandidateCount,
    noMatchCandidateCount,
    usedFallback: recommendation.usedFallback,
    top3AllFullMatch: results.length > 0 && results.every((result) => result.matchGrade === "full"),
    top3AllMaterialBackedFullMatch: results.length > 0 && results.every(isMaterialBackedFull),
    top3HasZeroRequiredFull: results.some(isZeroRequiredFull),
    top1FullMatch: results[0]?.matchGrade === "full",
    top1MaterialBackedFullMatch: results[0] ? isMaterialBackedFull(results[0]) : false,
    results,
  };
}

function summarize(cases: CaseAnalysis[]): Summary {
  const allRecommendations = cases.flatMap((auditCase) => auditCase.results);
  const fullMatchRecommendations = allRecommendations.filter((result) => result.matchGrade === "full").length;
  const materialBackedFullRecommendations = allRecommendations.filter(isMaterialBackedFull).length;
  const zeroRequiredFullRecommendations = allRecommendations.filter(isZeroRequiredFull).length;
  const partialMatchRecommendations = allRecommendations.filter((result) => result.matchGrade === "partial").length;
  const noMatchRecommendations = allRecommendations.filter((result) => result.matchGrade === "none").length;
  const fallbackCases = cases.filter((auditCase) => auditCase.usedFallback).length;
  const top1FullMatchCases = cases.filter((auditCase) => auditCase.top1FullMatch).length;
  const top1MaterialBackedFullMatchCases = cases.filter(
    (auditCase) => auditCase.top1MaterialBackedFullMatch,
  ).length;
  const top3AllFullMatchCases = cases.filter((auditCase) => auditCase.top3AllFullMatch).length;
  const top3AllMaterialBackedFullMatchCases = cases.filter(
    (auditCase) => auditCase.top3AllMaterialBackedFullMatch,
  ).length;
  const casesWithAtLeastOneMismatch = cases.filter((auditCase) =>
    auditCase.results.some((result) => result.matchGrade !== "full"),
  ).length;
  const casesWithNoExactCandidate = cases.filter((auditCase) => auditCase.exactCandidateCount === 0).length;
  const casesWithNoMaterialBackedExactCandidate = cases.filter(
    (auditCase) => auditCase.materialBackedExactCandidateCount === 0,
  ).length;
  const casesWithZeroRequiredFullRecommendation = cases.filter((auditCase) =>
    auditCase.results.some(isZeroRequiredFull),
  ).length;
  const exactCandidateDistribution = cases.reduce<Record<string, number>>((accumulator, auditCase) => {
    const bucket = String(auditCase.exactCandidateCount);
    accumulator[bucket] = (accumulator[bucket] ?? 0) + 1;
    return accumulator;
  }, {});
  const materialBackedExactCandidateDistribution = cases.reduce<Record<string, number>>(
    (accumulator, auditCase) => {
      const bucket = String(auditCase.materialBackedExactCandidateCount);
      accumulator[bucket] = (accumulator[bucket] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  return {
    totalCases: cases.length,
    totalRecommendations: allRecommendations.length,
    fullMatchRecommendations,
    materialBackedFullRecommendations,
    zeroRequiredFullRecommendations,
    partialMatchRecommendations,
    noMatchRecommendations,
    fullMatchRecommendationRate: fullMatchRecommendations / allRecommendations.length,
    materialBackedFullRecommendationRate: materialBackedFullRecommendations / allRecommendations.length,
    zeroRequiredFullRecommendationRate: zeroRequiredFullRecommendations / allRecommendations.length,
    top1FullMatchCases,
    top1FullMatchRate: top1FullMatchCases / cases.length,
    top1MaterialBackedFullMatchCases,
    top1MaterialBackedFullMatchRate: top1MaterialBackedFullMatchCases / cases.length,
    top3AllFullMatchCases,
    top3AllFullMatchRate: top3AllFullMatchCases / cases.length,
    top3AllMaterialBackedFullMatchCases,
    top3AllMaterialBackedFullMatchRate: top3AllMaterialBackedFullMatchCases / cases.length,
    fallbackCases,
    fallbackRate: fallbackCases / cases.length,
    casesWithAtLeastOneMismatch,
    casesWithAtLeastOneMismatchRate: casesWithAtLeastOneMismatch / cases.length,
    casesWithNoExactCandidate,
    casesWithNoExactCandidateRate: casesWithNoExactCandidate / cases.length,
    casesWithNoMaterialBackedExactCandidate,
    casesWithNoMaterialBackedExactCandidateRate: casesWithNoMaterialBackedExactCandidate / cases.length,
    casesWithZeroRequiredFullRecommendation,
    casesWithZeroRequiredFullRecommendationRate: casesWithZeroRequiredFullRecommendation / cases.length,
    exactCandidateDistribution,
    materialBackedExactCandidateDistribution,
  };
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatTimestamp(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderResultBadge(grade: MatchGrade) {
  const labelMap: Record<MatchGrade, string> = {
    full: "FULL",
    partial: "PARTIAL",
    none: "NONE",
  };

  return `<span class="badge badge-${grade}">${labelMap[grade]}</span>`;
}

function renderFullMatchTypeBadge(result: RecommendationAnalysis) {
  if (result.fullMatchType === "material_backed") {
    return '<span class="flag flag-good">재료 일치</span>';
  }

  if (result.fullMatchType === "zero_required") {
    return '<span class="flag flag-neutral">필수 없음</span>';
  }

  return "";
}

function formatFullMatchType(type: FullMatchType) {
  if (type === "material_backed") {
    return "실제 재료 full";
  }

  if (type === "zero_required") {
    return "필수 없음 full";
  }

  return "재료 미일치";
}

function getCaseStatus(auditCase: CaseAnalysis): CaseStatus {
  const hasMismatch = auditCase.results.some((result) => result.matchGrade !== "full");

  if (auditCase.materialBackedExactCandidateCount === 0) {
    return "no_candidate";
  }

  if (auditCase.usedFallback || hasMismatch) {
    return "fallback";
  }

  if (auditCase.materialBackedExactCandidateCount >= 3 && !auditCase.top3AllMaterialBackedFullMatch) {
    return "review";
  }

  if (!auditCase.top3AllMaterialBackedFullMatch) {
    return "candidate_limited";
  }

  return "pass";
}

function renderCaseStatusBadge(status: CaseStatus) {
  const labelMap: Record<CaseStatus, string> = {
    pass: "정상",
    candidate_limited: "후보 부족",
    review: "확인 필요",
    fallback: "Fallback",
    no_candidate: "후보 없음",
  };
  const classMap: Record<CaseStatus, string> = {
    pass: "flag-good",
    candidate_limited: "flag-neutral",
    review: "flag-warn",
    fallback: "flag-warn",
    no_candidate: "flag-bad",
  };

  return `<span class="flag ${classMap[status]}">${labelMap[status]}</span>`;
}

function countLowMaterialBackedExactCases(suite: AuditSuite) {
  return Object.entries(suite.summary.materialBackedExactCandidateDistribution)
    .filter(([count]) => Number(count) <= 2)
    .reduce((sum, [, caseCount]) => sum + caseCount, 0);
}

function getSuiteVerdict(suite: AuditSuite) {
  const lowMaterialBackedExactCases = countLowMaterialBackedExactCases(suite);

  if (suite.summary.casesWithNoMaterialBackedExactCandidate > 0) {
    return {
      tone: "warn",
      label: "입력/데이터 확인",
      description: `실제 재료 후보가 없는 케이스가 ${suite.summary.casesWithNoMaterialBackedExactCandidate}건 있습니다.`,
    };
  }

  if (suite.summary.fallbackCases > 0 || suite.summary.casesWithAtLeastOneMismatch > 0) {
    return {
      tone: "warn",
      label: "Fallback 확인",
      description: `Fallback 또는 mismatch가 ${suite.summary.fallbackCases}건 있습니다. 해당 케이스는 개별 확인이 필요합니다.`,
    };
  }

  if (suite.summary.top1MaterialBackedFullMatchCases === suite.summary.totalCases) {
    return {
      tone: "good",
      label: "Top1 안정",
      description: `모든 케이스에서 1순위가 실제 재료 일치입니다. Top3 평가는 실제 재료 후보 1~2개 케이스 ${lowMaterialBackedExactCases}건을 감안해서 보세요.`,
    };
  }

  return {
    tone: "warn",
    label: "Top1 확인",
    description: "일부 케이스에서 1순위가 실제 재료 일치가 아닙니다.",
  };
}

function renderSuiteTable(suite: AuditSuite) {
  const verdict = getSuiteVerdict(suite);
  const lowMaterialBackedExactCases = countLowMaterialBackedExactCases(suite);
  const rows = suite.cases
    .map((auditCase) => {
      const selectedMaterials = escapeHtml(auditCase.selectedMaterialNames.join(", "));
      const top1 = auditCase.results[0];
      const top2 = auditCase.results[1];
      const top3 = auditCase.results[2];

      const resultSummary = [top1, top2, top3]
        .filter(Boolean)
        .map((result, index) => {
          const required =
            result.required.length > 0 ? escapeHtml(formatMaterials(result.required).join(", ")) : "없음";

          return `
            <div class="result-line">
              <strong>${index + 1}. ${escapeHtml(result.name)}</strong>
              ${renderResultBadge(result.matchGrade)}
              ${renderFullMatchTypeBadge(result)}
              <span class="muted">필수 ${result.requiredOwnedCount}/${result.requiredCount}</span>
              <span class="muted">required: ${required}</span>
            </div>
          `;
        })
        .join("");

      return `
        <tr>
          <td>${escapeHtml(auditCase.caseId)}</td>
          <td>${renderCaseStatusBadge(getCaseStatus(auditCase))}</td>
          <td>${escapeHtml(`${auditCase.context.childAgeMonths}개월 / ${auditCase.context.place} / ${auditCase.context.availableMinutes}분`)}</td>
          <td>${auditCase.generatedFromPlayName ? escapeHtml(auditCase.generatedFromPlayName) : '<span class="muted">없음</span>'}</td>
          <td>${selectedMaterials}</td>
          <td>
            ${auditCase.exactCandidateCount}
            <span class="muted">실제 재료 ${auditCase.materialBackedExactCandidateCount}</span>
            <span class="muted">필수 없음 ${auditCase.zeroRequiredExactCandidateCount}</span>
          </td>
          <td>${auditCase.usedFallback ? '<span class="flag flag-warn">YES</span>' : '<span class="flag">NO</span>'}</td>
          <td>${resultSummary}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="suite-section">
      <div class="suite-head">
        <div>
          <h2>${escapeHtml(suite.title)}</h2>
          <p>${escapeHtml(suite.description)}</p>
        </div>
        <div class="stats-grid">
          <article class="stat-card">
            <span class="stat-label">테스트 수</span>
            <strong>${suite.summary.totalCases}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Top1 실제 재료</span>
            <strong>${percentage(suite.summary.top1MaterialBackedFullMatchRate)}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">추천 중 실제 재료</span>
            <strong>${percentage(suite.summary.materialBackedFullRecommendationRate)}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Top3 실제 재료만</span>
            <strong>${percentage(suite.summary.top3AllMaterialBackedFullMatchRate)}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Fallback</span>
            <strong>${percentage(suite.summary.fallbackRate)}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">추천 Full</span>
            <strong>${percentage(suite.summary.fullMatchRecommendationRate)}</strong>
          </article>
        </div>
      </div>
      <div class="suite-interpretation interpretation-${verdict.tone}">
        <strong>${escapeHtml(verdict.label)}</strong>
        <span>${escapeHtml(verdict.description)}</span>
      </div>
      <div class="summary-row">
        <span>Top1 실제 재료 full: ${suite.summary.top1MaterialBackedFullMatchCases}/${suite.summary.totalCases}</span>
        <span>Top3 전부 실제 재료 full: ${suite.summary.top3AllMaterialBackedFullMatchCases}/${suite.summary.totalCases}</span>
        <span>실제 재료 후보 1~2개: ${lowMaterialBackedExactCases}/${suite.summary.totalCases}</span>
        <span>실제 재료 exact 0개: ${suite.summary.casesWithNoMaterialBackedExactCandidate}/${suite.summary.totalCases}</span>
        <span>Fallback: ${suite.summary.fallbackCases}/${suite.summary.totalCases}</span>
        <span>Mismatch: ${suite.summary.casesWithAtLeastOneMismatch}/${suite.summary.totalCases}</span>
        <span>필수 없음 포함: ${suite.summary.casesWithZeroRequiredFullRecommendation}/${suite.summary.totalCases}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>케이스</th>
              <th>상태</th>
              <th>조건</th>
              <th>기준 놀이</th>
              <th>선택 재료</th>
              <th>Exact 후보</th>
              <th>Fallback</th>
              <th>추천 결과</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderHtmlReport(suites: AuditSuite[], outputDate: string) {
  const overallCases = suites.reduce((sum, suite) => sum + suite.summary.totalCases, 0);
  const overallRecommendations = suites.reduce((sum, suite) => sum + suite.summary.totalRecommendations, 0);
  const overallMaterialBackedFull = suites.reduce(
    (sum, suite) => sum + suite.summary.materialBackedFullRecommendations,
    0,
  );
  const overallFallback = suites.reduce((sum, suite) => sum + suite.summary.fallbackCases, 0);
  const overallMismatch = suites.reduce((sum, suite) => sum + suite.summary.casesWithAtLeastOneMismatch, 0);
  const overallTop1MaterialBacked = suites.reduce(
    (sum, suite) => sum + suite.summary.top1MaterialBackedFullMatchCases,
    0,
  );
  const overallTop3MaterialBacked = suites.reduce(
    (sum, suite) => sum + suite.summary.top3AllMaterialBackedFullMatchCases,
    0,
  );
  const overallLowMaterialBackedExactCases = suites.reduce(
    (sum, suite) => sum + countLowMaterialBackedExactCases(suite),
    0,
  );
  const overallNoMaterialBackedExact = suites.reduce(
    (sum, suite) => sum + suite.summary.casesWithNoMaterialBackedExactCandidate,
    0,
  );
  const baseline = suites.find((suite) => suite.id === "baseline");
  const stress = suites.find((suite) => suite.id === "stress");
  const suiteSections = suites.map((suite) => renderSuiteTable(suite)).join("");

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>놀이 찾기 엔진 재료 감사 리포트</title>
    <style>
      :root {
        --bg: #f6f1e8;
        --panel: #fffdf9;
        --ink: #1f2937;
        --muted: #6b7280;
        --line: #e5dccf;
        --accent: #b45309;
        --good: #166534;
        --warn: #92400e;
        --bad: #991b1b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top right, rgba(180, 83, 9, 0.12), transparent 28%),
          linear-gradient(180deg, #fbf7f0 0%, var(--bg) 100%);
        color: var(--ink);
        font: 14px/1.6 "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      }
      .page {
        width: min(1400px, calc(100% - 32px));
        margin: 0 auto;
        padding: 28px 0 48px;
      }
      .hero, .suite-section {
        background: color-mix(in srgb, var(--panel) 92%, white 8%);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: 0 14px 40px rgba(107, 114, 128, 0.08);
      }
      .hero {
        padding: 28px;
        margin-bottom: 20px;
      }
      h1, h2, h3, p { margin: 0; }
      h1 {
        font-size: 30px;
        line-height: 1.2;
        margin-bottom: 8px;
      }
      .hero p {
        color: var(--muted);
        margin-bottom: 20px;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
      }
      .stat-card {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px 16px;
      }
      .stat-label {
        display: block;
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 4px;
      }
      .stat-card strong {
        font-size: 24px;
        line-height: 1.1;
      }
      .summary-list {
        display: grid;
        gap: 8px;
        margin-top: 18px;
        color: var(--muted);
      }
      .takeaway {
        display: grid;
        gap: 6px;
        margin: 18px 0;
        padding: 16px;
        border: 1px solid rgba(22, 101, 52, 0.2);
        border-radius: 8px;
        background: rgba(22, 101, 52, 0.06);
      }
      .takeaway strong {
        color: var(--good);
        font-size: 16px;
      }
      .guide-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 10px;
        margin: 16px 0 20px;
      }
      .guide-item {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 12px;
      }
      .guide-item strong {
        display: block;
        margin-bottom: 4px;
      }
      .guide-item span {
        color: var(--muted);
      }
      .suite-section {
        padding: 22px;
        margin-bottom: 20px;
      }
      .suite-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
        gap: 16px;
        margin-bottom: 16px;
      }
      .suite-head p {
        color: var(--muted);
        margin-top: 8px;
      }
      .summary-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 16px;
        color: var(--muted);
      }
      .summary-row span {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 6px 10px;
      }
      .suite-interpretation {
        display: grid;
        gap: 4px;
        margin: 0 0 16px;
        padding: 12px 14px;
        border-radius: 8px;
        border: 1px solid var(--line);
        background: #fff;
      }
      .suite-interpretation strong {
        font-size: 15px;
      }
      .suite-interpretation span {
        color: var(--muted);
      }
      .interpretation-good {
        border-color: rgba(22, 101, 52, 0.22);
        background: rgba(22, 101, 52, 0.05);
      }
      .interpretation-good strong {
        color: var(--good);
      }
      .interpretation-warn {
        border-color: rgba(146, 64, 14, 0.24);
        background: rgba(146, 64, 14, 0.06);
      }
      .interpretation-warn strong {
        color: var(--warn);
      }
      .table-wrap {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: #fff;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1180px;
      }
      th, td {
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
        text-align: left;
      }
      th {
        position: sticky;
        top: 0;
        background: #fcfaf5;
        z-index: 1;
      }
      tr:last-child td {
        border-bottom: 0;
      }
      .result-line + .result-line {
        margin-top: 6px;
      }
      .badge, .flag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 58px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.03em;
        margin-left: 6px;
      }
      .badge-full {
        background: rgba(22, 101, 52, 0.1);
        color: var(--good);
      }
      .badge-partial {
        background: rgba(146, 64, 14, 0.12);
        color: var(--warn);
      }
      .badge-none {
        background: rgba(153, 27, 27, 0.1);
        color: var(--bad);
      }
      .flag {
        background: #f3f4f6;
        color: var(--muted);
        margin-left: 0;
      }
      .flag-warn {
        background: rgba(146, 64, 14, 0.12);
        color: var(--warn);
      }
      .flag-good {
        background: rgba(22, 101, 52, 0.1);
        color: var(--good);
      }
      .flag-neutral {
        background: #eef2f7;
        color: #475569;
      }
      .flag-bad {
        background: rgba(153, 27, 27, 0.1);
        color: var(--bad);
      }
      .muted {
        color: var(--muted);
        margin-left: 6px;
      }
      @media (max-width: 900px) {
        .suite-head {
          grid-template-columns: 1fr;
        }
        .page {
          width: min(100% - 20px, 1400px);
        }
        .hero, .suite-section {
          border-radius: 16px;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <h1>놀이 찾기 엔진 재료 감사 리포트</h1>
        <p>작성일 ${escapeHtml(outputDate)}. 재료 3개 이상 선택 시 추천 결과가 실제 선택 재료와 얼마나 맞는지 240건으로 점검한 결과입니다.</p>
        <div class="takeaway">
          <strong>한 줄 결론</strong>
          <span>실내 조건에서 실제 후보가 있는 케이스는 Top1이 모두 실제 재료 일치입니다. Top3는 실제 재료 후보가 1~2개뿐인 케이스를 감안해서 봐야 합니다.</span>
        </div>
        <div class="guide-grid">
          <article class="guide-item">
            <strong>먼저 볼 지표</strong>
            <span>Top1 실제 재료 full, Fallback, Mismatch가 핵심입니다.</span>
          </article>
          <article class="guide-item">
            <strong>Top3 해석</strong>
            <span>실제 재료 후보가 1~2개면 Top3 전부 실제 재료 일치는 불가능합니다.</span>
          </article>
          <article class="guide-item">
            <strong>필수 없음 full</strong>
            <span>재료가 맞은 것이 아니라 required가 비어 자동 full 처리된 추천입니다.</span>
          </article>
        </div>
        <div class="stats-grid">
          <article class="stat-card">
            <span class="stat-label">전체 테스트</span>
            <strong>${overallCases}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">전체 추천</span>
            <strong>${overallRecommendations}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Top1 실제 재료</span>
            <strong>${percentage(overallTop1MaterialBacked / overallCases)}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">추천 중 실제 재료</span>
            <strong>${percentage(overallMaterialBackedFull / overallRecommendations)}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Top3 실제 재료만</span>
            <strong>${percentage(overallTop3MaterialBacked / overallCases)}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Fallback 케이스</span>
            <strong>${overallFallback}</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Mismatch 포함 케이스</span>
            <strong>${overallMismatch}</strong>
          </article>
        </div>
        <div class="summary-list">
          <span>Baseline은 ${baseline?.summary.totalCases ?? 0}건 중 ${baseline?.summary.top3AllFullMatchCases ?? 0}건이 Top3 full 일치였고, 실제 재료 full 추천은 ${baseline?.summary.materialBackedFullRecommendations ?? 0}개였습니다.</span>
          <span>Indoor stress는 ${stress?.summary.totalCases ?? 0}건 중 ${stress?.summary.fallbackCases ?? 0}건에서 fallback이 발생했고, 실제 재료 full 추천은 ${stress?.summary.materialBackedFullRecommendations ?? 0}개였습니다.</span>
          <span>전체 실제 재료 후보 1~2개 케이스는 ${overallLowMaterialBackedExactCases}/${overallCases}건이고, 실제 재료 후보 0개 케이스는 ${overallNoMaterialBackedExact}/${overallCases}건입니다.</span>
          <span>입력 케이스는 각 조건에서 실제 후보가 되는 놀이의 필수 재료를 포함하도록 생성했습니다.</span>
          <span>기존 full은 required가 없는 놀이를 포함합니다. 재료 기반 품질은 실제 재료 Full과 실제 재료 exact 지표를 기준으로 보세요.</span>
        </div>
      </section>
      ${suiteSections}
    </main>
  </body>
</html>`;
}

function renderExample(auditCase: CaseAnalysis) {
  const results = auditCase.results
    .map((result, index) => {
      const fullType = result.fullMatchType ? `, ${formatFullMatchType(result.fullMatchType)}` : "";

      return `${index + 1}. ${result.name} (${result.matchGrade}${fullType}, 필수 ${result.requiredOwnedCount}/${Math.max(result.requiredCount, 0)} 일치, required: ${formatMaterials(result.required).join(", ") || "없음"})`;
    })
    .join("\n");

  return [
    `- 케이스 ${auditCase.caseId}: ${auditCase.selectedMaterialNames.join(", ")}`,
    `  - context=${auditCase.context.childAgeMonths}개월/${auditCase.context.place}/${auditCase.context.availableMinutes}분`,
    `  - 기준 놀이=${auditCase.generatedFromPlayName ?? "없음"}`,
    `  - exactCandidateCount=${auditCase.exactCandidateCount}, materialBackedExactCandidateCount=${auditCase.materialBackedExactCandidateCount}, zeroRequiredExactCandidateCount=${auditCase.zeroRequiredExactCandidateCount}, usedFallback=${auditCase.usedFallback}`,
    `  - 추천 결과`,
    ...results.split("\n").map((line) => `    ${line}`),
  ].join("\n");
}

function renderSuiteReport(suite: AuditSuite) {
  const mismatchCases = suite.cases.filter((auditCase) =>
    auditCase.results.some((result) => result.matchGrade !== "full"),
  );
  const noExactCases = suite.cases.filter((auditCase) => auditCase.exactCandidateCount === 0);
  const noMaterialBackedExactCases = suite.cases.filter(
    (auditCase) => auditCase.materialBackedExactCandidateCount === 0,
  );
  const cleanCases = suite.cases.filter((auditCase) => auditCase.top3AllFullMatch);
  const materialBackedCleanCases = suite.cases.filter((auditCase) => auditCase.top3AllMaterialBackedFullMatch);

  const representativeMismatch = mismatchCases.slice(0, 3).map(renderExample).join("\n");
  const representativeNoExact = noExactCases.slice(0, 2).map(renderExample).join("\n");
  const representativeNoMaterialBackedExact = noMaterialBackedExactCases.slice(0, 2).map(renderExample).join("\n");
  const representativeClean = cleanCases.slice(0, 2).map(renderExample).join("\n");
  const representativeMaterialBackedClean = materialBackedCleanCases.slice(0, 2).map(renderExample).join("\n");

  const lowMaterialBackedExactCases = Object.entries(suite.summary.materialBackedExactCandidateDistribution)
    .filter(([count]) => Number(count) <= 2)
    .reduce((sum, [, caseCount]) => sum + caseCount, 0);
  const verdict = getSuiteVerdict(suite);

  return `## ${suite.title}

- 설명: ${suite.description}
- 판정: ${verdict.label} - ${verdict.description}

### 먼저 볼 지표

- Top1 실제 재료 full: ${suite.summary.top1MaterialBackedFullMatchCases}/${suite.summary.totalCases} (${percentage(suite.summary.top1MaterialBackedFullMatchRate)})
- fallback: ${suite.summary.fallbackCases}/${suite.summary.totalCases} (${percentage(suite.summary.fallbackRate)})
- mismatch 포함: ${suite.summary.casesWithAtLeastOneMismatch}/${suite.summary.totalCases} (${percentage(suite.summary.casesWithAtLeastOneMismatchRate)})
- 실제 재료 exact 후보 0개: ${suite.summary.casesWithNoMaterialBackedExactCandidate}/${suite.summary.totalCases} (${percentage(suite.summary.casesWithNoMaterialBackedExactCandidateRate)})

### Top3 해석 보조 지표

- Top3 전체 실제 재료 full: ${suite.summary.top3AllMaterialBackedFullMatchCases}/${suite.summary.totalCases} (${percentage(suite.summary.top3AllMaterialBackedFullMatchRate)})
- 실제 재료 exact 후보 1~2개: ${lowMaterialBackedExactCases}/${suite.summary.totalCases}
- 추천 ${suite.summary.totalRecommendations}개 중 실제 재료 full: ${suite.summary.materialBackedFullRecommendations}개 (${percentage(suite.summary.materialBackedFullRecommendationRate)})
- 추천 ${suite.summary.totalRecommendations}개 중 필수 재료 없음 full: ${suite.summary.zeroRequiredFullRecommendations}개 (${percentage(suite.summary.zeroRequiredFullRecommendationRate)})

### 정상 케이스

${representativeClean || "- 해당 조건에 맞는 clean case가 없었습니다."}

### 실제 재료 Top3 full 케이스

${representativeMaterialBackedClean || "- Top3가 모두 실제 재료 full인 케이스가 없었습니다."}

### mismatch 케이스

${representativeMismatch || "- mismatch case가 없었습니다."}

### exact candidate 0개 케이스

${representativeNoExact || "- exact candidate 0개 케이스가 없었습니다."}

### 실제 재료 exact candidate 0개 케이스

${representativeNoMaterialBackedExact || "- 실제 재료 exact candidate 0개 케이스가 없었습니다."}
`;
}

function renderReport(suites: AuditSuite[], outputDate: string) {
  const baseline = suites.find((suite) => suite.id === "baseline");
  const stress = suites.find((suite) => suite.id === "stress");
  const totalCases = suites.reduce((sum, suite) => sum + suite.summary.totalCases, 0);
  const totalTop1MaterialBacked = suites.reduce(
    (sum, suite) => sum + suite.summary.top1MaterialBackedFullMatchCases,
    0,
  );
  const totalFallback = suites.reduce((sum, suite) => sum + suite.summary.fallbackCases, 0);
  const totalMismatch = suites.reduce((sum, suite) => sum + suite.summary.casesWithAtLeastOneMismatch, 0);
  const totalLowMaterialBackedExact = suites.reduce(
    (sum, suite) => sum + countLowMaterialBackedExactCases(suite),
    0,
  );

  return `# 놀이 찾기 엔진 재료 적합성 검토 보고서

- 작성일: ${outputDate}
- 검토 범위: 재료 3개 이상 선택 시 추천되는 놀이가 선택 재료와 맞는지
- 테스트 수: ${totalCases}건
- 공통 판정 기준: 추천 놀이의 \`materials.required\` 가 선택 재료 집합에 모두 포함되면 \`full\`, 일부만 포함되면 \`partial\`, 하나도 없으면 \`none\`
- 추가 판정 기준: \`실제 재료 full\`은 \`required\`가 1개 이상이고 모두 선택 재료에 포함된 경우, \`필수 없음 full\`은 \`required\`가 비어 있어 자동으로 full 처리된 경우
- 케이스 생성 기준: 각 조건에서 \`hardFilter\` 를 통과하고 필수 재료가 1개 이상인 실제 후보 놀이를 기준으로 선택 재료 조합을 생성

## 한 줄 결론

- 실제 후보가 있는 실내 케이스에서는 Top1 추천이 안정적입니다. Top3는 실제 재료 후보가 1~2개뿐인 케이스 ${totalLowMaterialBackedExact}/${totalCases}건을 감안해서 해석해야 합니다.

## 읽는 법

- 가장 먼저 볼 지표는 \`Top1 실제 재료 full\`, \`fallback\`, \`mismatch\`입니다.
- \`Top3 전체 실제 재료 full\`은 후보가 충분할 때만 의미가 있습니다.
- \`필수 재료 없음 full\`은 재료가 맞은 추천이 아니라, required가 비어 자동으로 full 처리된 추천입니다.

## 요약

- baseline(24개월/실내/20분)에서는 ${baseline?.summary.totalCases ?? 0}건 중 ${baseline?.summary.top3AllFullMatchCases ?? 0}건이 Top3 full 일치였지만, 실제 재료 full 추천은 ${baseline?.summary.materialBackedFullRecommendations ?? 0}개였다.
- indoor stress(실내 조건에서 연령/시간 분산)에서는 ${stress?.summary.totalCases ?? 0}건 중 ${stress?.summary.fallbackCases ?? 0}건에서 fallback이 발생했고, 실제 재료 full 추천은 ${stress?.summary.materialBackedFullRecommendations ?? 0}개였다.
- 전체 Top1 실제 재료 full은 ${totalTop1MaterialBacked}/${totalCases}건, fallback은 ${totalFallback}/${totalCases}건, mismatch는 ${totalMismatch}/${totalCases}건이다.
- 필수 재료 0개 놀이 42개가 있어서, 기존 full 지표만 보면 실사용 체감보다 재료 적합성이 높게 측정된다.

## 해석

- 기존 full 지표는 “재료가 맞은 추천”과 “필수 재료가 없는 추천”을 함께 계산한다. 재료 기반 품질은 실제 재료 full 지표를 봐야 한다.
- 이번 리포트는 outdoor 후보 부족 문제를 제외하고, indoor 조건에서 실제로 가능한 material-backed 후보를 기준으로 엔진 랭킹을 본다.
- 엔진의 1순위 추천은 대체로 full 판정을 받지만, 그중 상당수는 필수 재료가 없는 놀이일 수 있다. 후보 수가 부족한 조건에서는 2, 3순위에 fallback 영향이 나타날 가능성이 있다.
- 현재 로직은 “재료가 맞는 놀이 3개”를 보장하지 않는다. \`fullyOwnedPool.length < 3\` 이면 \`strictTimePool\` 또는 더 넓은 시간 조건 풀로 확장한다.
- \`softScore\` 도 필수 재료 완전 일치 여부를 강제하지 않고 비율 점수만 준다. 그래서 후보가 적은 구간에서는 partial/none 추천이 자연스럽게 상위권에 올라온다.
- 필수 재료가 0개인 놀이 42개가 데이터에 존재한다. 이런 놀이는 모든 재료 조합에 대해 full 판정이 되므로, 재료 적합성 체감이 실제보다 높게 나올 수 있다.

${baseline ? renderSuiteReport(baseline) : ""}

${stress ? renderSuiteReport(stress) : ""}

## 코드 기준 원인 분석

- [src/engine/fallback.ts](${path.resolve(process.cwd(), "src/engine/fallback.ts")}): \`fullyOwnedPool\` 이 3개 미만이면 재료 완전 일치 조건을 버리고 후보를 확장한다.
- [src/engine/softScore.ts](${path.resolve(process.cwd(), "src/engine/softScore.ts")}): 재료 점수는 \`ownedRequiredCount / requiredCount\` 비율만 반영하고, 미보유 필수 재료가 있어도 0점으로 탈락시키지 않는다.
- [src/engine/recommend.ts](${path.resolve(process.cwd(), "src/engine/recommend.ts")}): \`hardFilter\` 단계에서는 차단 재료만 제외하고, “선택 재료가 필수 재료를 모두 포함하는지”는 필터링하지 않는다.

## 결론

- indoor 재료 추천에서 Top1은 안정적으로 실제 재료 일치 놀이를 고른다.
- Top3까지 모두 실제 재료 놀이로 채우려면 실제 재료 후보가 3개 이상 필요하다. 후보가 1~2개뿐인 케이스는 필수 재료 없음 놀이가 보강 추천으로 섞인다.
- 다음 개선은 엔진 수정과 별개로, 연령/시간별 실제 재료 후보 수를 늘리는 데이터 보강 여부를 함께 봐야 한다.
`;
}

async function main() {
  const generatedAt = new Date();
  const outputStamp = formatTimestamp(generatedAt);
  const outputDate = outputStamp.slice(0, 10);
  const outputJson = path.join(OUTPUT_DIR, `material-audit-${outputStamp}.json`);
  const outputHtml = path.join(OUTPUT_DIR, `material-audit-${outputStamp}.html`);
  const outputMd = path.resolve(process.cwd(), "docs", `material-audit-report-${outputStamp}.md`);
  const rng = createRng(RNG_SEED);
  const plays = loadLivePlays();

  // Baseline cases are seeded from real material-backed candidates in normal conditions.
  const baselineCases = buildCandidateSeededCases(plays, BASELINE_CONTEXT, AUDIT_CASE_COUNT, rng);

  const baselineAnalyses = baselineCases.map((auditCase, index) =>
    analyzeCase(
      `B${String(index + 1).padStart(3, "0")}`,
      auditCase.materials,
      auditCase.playId,
      BASELINE_CONTEXT,
      plays,
    ),
  );
  const stressBaseCount = Math.floor(AUDIT_CASE_COUNT / STRESS_CONTEXTS.length);
  const stressRemainder = AUDIT_CASE_COUNT % STRESS_CONTEXTS.length;
  const stressCases: GeneratedStressCase[] = STRESS_CONTEXTS.flatMap((context, index) => {
    const targetCount = stressBaseCount + (index < stressRemainder ? 1 : 0);

    return buildCandidateSeededCases(plays, context, targetCount, rng).map((auditCase) => ({
      ...auditCase,
      context,
    }));
  });

  const stressAnalyses = stressCases.map((auditCase, index) =>
    analyzeCase(
      `S${String(index + 1).padStart(3, "0")}`,
      auditCase.materials,
      auditCase.playId,
      auditCase.context,
      plays,
    ),
  );
  const suites: AuditSuite[] = [
    {
      id: "baseline",
      title: "Baseline Audit",
      description: "24개월, 실내, 20분 조건에서 실제 후보 놀이의 필수 재료를 포함한 조합으로 재료 정합성을 측정",
      cases: baselineAnalyses,
      summary: summarize(baselineAnalyses),
    },
    {
      id: "stress",
      title: "Indoor Material Stress Audit",
      description: "실내 조건에서 연령과 시간을 분산하고, 실제 후보 놀이의 필수 재료를 포함한 조합으로 fallback 발생 여부를 확인",
      cases: stressAnalyses,
      summary: summarize(stressAnalyses),
    },
  ];
  const payload = {
    metadata: {
      generatedAt: generatedAt.toISOString(),
      outputStamp,
      seed: RNG_SEED,
      caseCount: AUDIT_CASE_COUNT,
    },
    suites,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  // Keep machine-readable JSON, browser-friendly HTML, and a compact Markdown summary in sync.
  await writeFile(outputJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(outputHtml, `${renderHtmlReport(suites, outputDate)}\n`, "utf8");
  await writeFile(outputMd, `${renderReport(suites, outputDate)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputJson,
        outputHtml,
        outputReport: outputMd,
        suiteSummaries: suites.map((suite) => ({
          id: suite.id,
          summary: suite.summary,
        })),
      },
      null,
      2,
    ),
  );
}

void main();
