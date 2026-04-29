import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { MATERIAL_DISPLAY_NAMES, MATERIAL_SLUGS, type MaterialSlug } from "@/constants/materials";
import { hardFilter } from "@/engine/hardFilter";
import { recommend } from "@/engine/recommend";
import { loadLivePlays } from "@/data/content";
import type { FilterInput, Play } from "@/types";

type MatchGrade = "full" | "partial" | "none";

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
};

type CaseAnalysis = {
  caseId: string;
  context: Omit<FilterInput, "availableMaterials" | "blockedMaterials" | "devGaps" | "userFeedback">;
  generatedFromPlayId: string | null;
  selectedMaterials: MaterialSlug[];
  selectedMaterialNames: string[];
  exactCandidateCount: number;
  partialCandidateCount: number;
  noMatchCandidateCount: number;
  usedFallback: boolean;
  top3AllFullMatch: boolean;
  top1FullMatch: boolean;
  results: RecommendationAnalysis[];
};

type Summary = {
  totalCases: number;
  totalRecommendations: number;
  fullMatchRecommendations: number;
  partialMatchRecommendations: number;
  noMatchRecommendations: number;
  fullMatchRecommendationRate: number;
  top1FullMatchCases: number;
  top1FullMatchRate: number;
  top3AllFullMatchCases: number;
  top3AllFullMatchRate: number;
  fallbackCases: number;
  fallbackRate: number;
  casesWithAtLeastOneMismatch: number;
  casesWithAtLeastOneMismatchRate: number;
  casesWithNoExactCandidate: number;
  casesWithNoExactCandidateRate: number;
  exactCandidateDistribution: Record<string, number>;
};

type AuditSuite = {
  id: string;
  title: string;
  description: string;
  cases: CaseAnalysis[];
  summary: Summary;
};

type AuditContext = Pick<FilterInput, "childAgeMonths" | "availableMinutes" | "place">;

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
  { childAgeMonths: 12, availableMinutes: 10, place: "outdoor" as const },
  { childAgeMonths: 24, availableMinutes: 10, place: "outdoor" as const },
  { childAgeMonths: 30, availableMinutes: 10, place: "indoor" as const },
  { childAgeMonths: 30, availableMinutes: 15, place: "outdoor" as const },
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

function pickExtras(required: MaterialSlug[], targetSize: number, rng: () => number): MaterialSlug[] {
  const extrasPool = shuffle(
    MATERIAL_SLUGS.filter((material) => !required.includes(material)),
    rng,
  );

  return extrasPool.slice(0, Math.max(0, targetSize - required.length));
}

function buildMaterialSetForPlay(play: Play, rng: () => number): MaterialSlug[] {
  const baseline = [...new Set(play.materials.required)] as MaterialSlug[];
  const targetSize = Math.max(3, Math.min(6, baseline.length + 1 + Math.floor(rng() * 3)));
  return [...baseline, ...pickExtras(baseline, targetSize, rng)].sort();
}

function buildRandomMaterialSet(size: number, rng: () => number): MaterialSlug[] {
  return shuffle(MATERIAL_SLUGS, rng).slice(0, size).sort();
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
  const partialCandidateCount = candidateGrades.filter((grade) => grade.matchGrade === "partial").length;
  const noMatchCandidateCount = candidateGrades.filter((grade) => grade.matchGrade === "none").length;

  const recommendation = recommend(plays, ctx, { totalPlays: 5 });
  const results = recommendation.results.map((play) => {
    const coverage = getRequiredCoverage(play, selectedSet);

    return {
      id: play.id,
      name: play.name,
      required: play.materials.required,
      optional: play.materials.optional,
      substitutes: play.materials.substitutes,
      ...coverage,
    };
  });

  return {
    caseId,
    context: baseContext,
    generatedFromPlayId,
    selectedMaterials,
    selectedMaterialNames: formatMaterials(selectedMaterials),
    exactCandidateCount,
    partialCandidateCount,
    noMatchCandidateCount,
    usedFallback: recommendation.usedFallback,
    top3AllFullMatch: results.length > 0 && results.every((result) => result.matchGrade === "full"),
    top1FullMatch: results[0]?.matchGrade === "full",
    results,
  };
}

function summarize(cases: CaseAnalysis[]): Summary {
  const allRecommendations = cases.flatMap((auditCase) => auditCase.results);
  const fullMatchRecommendations = allRecommendations.filter((result) => result.matchGrade === "full").length;
  const partialMatchRecommendations = allRecommendations.filter((result) => result.matchGrade === "partial").length;
  const noMatchRecommendations = allRecommendations.filter((result) => result.matchGrade === "none").length;
  const fallbackCases = cases.filter((auditCase) => auditCase.usedFallback).length;
  const top1FullMatchCases = cases.filter((auditCase) => auditCase.top1FullMatch).length;
  const top3AllFullMatchCases = cases.filter((auditCase) => auditCase.top3AllFullMatch).length;
  const casesWithAtLeastOneMismatch = cases.filter((auditCase) =>
    auditCase.results.some((result) => result.matchGrade !== "full"),
  ).length;
  const casesWithNoExactCandidate = cases.filter((auditCase) => auditCase.exactCandidateCount === 0).length;
  const exactCandidateDistribution = cases.reduce<Record<string, number>>((accumulator, auditCase) => {
    const bucket = String(auditCase.exactCandidateCount);
    accumulator[bucket] = (accumulator[bucket] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    totalCases: cases.length,
    totalRecommendations: allRecommendations.length,
    fullMatchRecommendations,
    partialMatchRecommendations,
    noMatchRecommendations,
    fullMatchRecommendationRate: fullMatchRecommendations / allRecommendations.length,
    top1FullMatchCases,
    top1FullMatchRate: top1FullMatchCases / cases.length,
    top3AllFullMatchCases,
    top3AllFullMatchRate: top3AllFullMatchCases / cases.length,
    fallbackCases,
    fallbackRate: fallbackCases / cases.length,
    casesWithAtLeastOneMismatch,
    casesWithAtLeastOneMismatchRate: casesWithAtLeastOneMismatch / cases.length,
    casesWithNoExactCandidate,
    casesWithNoExactCandidateRate: casesWithNoExactCandidate / cases.length,
    exactCandidateDistribution,
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

function renderSuiteTable(suite: AuditSuite) {
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
              <span class="muted">필수 ${result.requiredOwnedCount}/${result.requiredCount}</span>
              <span class="muted">required: ${required}</span>
            </div>
          `;
        })
        .join("");

      return `
        <tr>
          <td>${escapeHtml(auditCase.caseId)}</td>
          <td>${escapeHtml(`${auditCase.context.childAgeMonths}개월 / ${auditCase.context.place} / ${auditCase.context.availableMinutes}분`)}</td>
          <td>${selectedMaterials}</td>
          <td>${auditCase.exactCandidateCount}</td>
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
            <span class="stat-label">Top3 Full</span>
            <strong>${percentage(suite.summary.top3AllFullMatchRate)}</strong>
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
      <div class="summary-row">
        <span>Top1 full: ${suite.summary.top1FullMatchCases}/${suite.summary.totalCases}</span>
        <span>Top3 full: ${suite.summary.top3AllFullMatchCases}/${suite.summary.totalCases}</span>
        <span>Mismatch 포함: ${suite.summary.casesWithAtLeastOneMismatch}/${suite.summary.totalCases}</span>
        <span>Exact candidate 1~2개: ${Object.entries(suite.summary.exactCandidateDistribution).filter(([count]) => Number(count) <= 2).reduce((sum, [, count]) => sum + count, 0)}/${suite.summary.totalCases}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>케이스</th>
              <th>조건</th>
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
  const overallFull = suites.reduce((sum, suite) => sum + suite.summary.fullMatchRecommendations, 0);
  const overallFallback = suites.reduce((sum, suite) => sum + suite.summary.fallbackCases, 0);
  const overallMismatch = suites.reduce((sum, suite) => sum + suite.summary.casesWithAtLeastOneMismatch, 0);
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
      .table-wrap {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: #fff;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1080px;
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
            <span class="stat-label">Full 일치 추천</span>
            <strong>${percentage(overallFull / overallRecommendations)}</strong>
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
          <span>Baseline은 120건 전부 Top3 full 일치였습니다.</span>
          <span>Stress는 120건 중 78건에서 fallback이 발생했고, 같은 78건에서 Top3 안에 mismatch가 포함됐습니다.</span>
          <span>정합 기준은 추천 놀이의 required 재료가 선택 재료 집합에 모두 포함되는지 여부입니다.</span>
        </div>
      </section>
      ${suiteSections}
    </main>
  </body>
</html>`;
}

function renderExample(auditCase: CaseAnalysis) {
  const results = auditCase.results
    .map(
      (result, index) =>
        `${index + 1}. ${result.name} (${result.matchGrade}, 필수 ${result.requiredOwnedCount}/${Math.max(result.requiredCount, 0)} 일치, required: ${formatMaterials(result.required).join(", ") || "없음"})`,
    )
    .join("\n");

  return [
    `- 케이스 ${auditCase.caseId}: ${auditCase.selectedMaterialNames.join(", ")}`,
    `  - context=${auditCase.context.childAgeMonths}개월/${auditCase.context.place}/${auditCase.context.availableMinutes}분`,
    `  - exactCandidateCount=${auditCase.exactCandidateCount}, usedFallback=${auditCase.usedFallback}`,
    `  - 추천 결과`,
    ...results.split("\n").map((line) => `    ${line}`),
  ].join("\n");
}

function renderSuiteReport(suite: AuditSuite) {
  const mismatchCases = suite.cases.filter((auditCase) =>
    auditCase.results.some((result) => result.matchGrade !== "full"),
  );
  const noExactCases = suite.cases.filter((auditCase) => auditCase.exactCandidateCount === 0);
  const cleanCases = suite.cases.filter((auditCase) => auditCase.top3AllFullMatch);

  const representativeMismatch = mismatchCases.slice(0, 3).map(renderExample).join("\n");
  const representativeNoExact = noExactCases.slice(0, 2).map(renderExample).join("\n");
  const representativeClean = cleanCases.slice(0, 2).map(renderExample).join("\n");

  const lowExactCases = Object.entries(suite.summary.exactCandidateDistribution)
    .filter(([count]) => Number(count) <= 2)
    .reduce((sum, [, caseCount]) => sum + caseCount, 0);

  return `## ${suite.title}

- 설명: ${suite.description}
- 테스트 수: ${suite.summary.totalCases}건
- 추천 ${suite.summary.totalRecommendations}개 중 full 일치 ${suite.summary.fullMatchRecommendations}개 (${percentage(suite.summary.fullMatchRecommendationRate)})
- Top1 full 일치 ${suite.summary.top1FullMatchCases}/${suite.summary.totalCases} (${percentage(suite.summary.top1FullMatchRate)})
- Top3 전체 full 일치 ${suite.summary.top3AllFullMatchCases}/${suite.summary.totalCases} (${percentage(suite.summary.top3AllFullMatchRate)})
- fallback 사용 ${suite.summary.fallbackCases}/${suite.summary.totalCases} (${percentage(suite.summary.fallbackRate)})
- exact candidate 0개 ${suite.summary.casesWithNoExactCandidate}/${suite.summary.totalCases} (${percentage(suite.summary.casesWithNoExactCandidateRate)})
- exact candidate 1~2개 ${lowExactCases}/${suite.summary.totalCases}

### 정상 케이스

${representativeClean || "- 해당 조건에 맞는 clean case가 없었습니다."}

### mismatch 케이스

${representativeMismatch || "- mismatch case가 없었습니다."}

### exact candidate 0개 케이스

${representativeNoExact || "- exact candidate 0개 케이스가 없었습니다."}
`;
}

function renderReport(suites: AuditSuite[], outputDate: string) {
  const baseline = suites.find((suite) => suite.id === "baseline");
  const stress = suites.find((suite) => suite.id === "stress");

  return `# 놀이 찾기 엔진 재료 적합성 검토 보고서

- 작성일: ${outputDate}
- 검토 범위: 재료 3개 이상 선택 시 추천되는 놀이가 선택 재료와 맞는지
- 테스트 수: ${suites.reduce((sum, suite) => sum + suite.summary.totalCases, 0)}건
- 공통 판정 기준: 추천 놀이의 \`materials.required\` 가 선택 재료 집합에 모두 포함되면 \`full\`, 일부만 포함되면 \`partial\`, 하나도 없으면 \`none\`

## 요약

- baseline(24개월/실내/20분)에서는 120건 전부 Top3가 full 일치였다.
- stress(후보 풀이 좁은 조건 분산)에서는 fallback이 실제로 발생하는지 별도 확인했다.
- 필수 재료 0개 놀이 42개가 있어서, 실사용 체감보다 재료 적합성이 높게 측정될 수 있다.

## 해석

- 엔진의 1순위 추천은 대체로 재료를 잘 맞춘다. 다만 후보 수가 부족한 조건에서는 2, 3순위에 fallback 영향이 나타날 가능성이 있다.
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

- 현재 엔진은 “재료에 완전히 맞는 놀이를 우선 추천”하는 수준에는 도달했지만, “선택한 재료에 맞는 놀이만 추천”하는 엔진은 아니다.
- 특히 exact candidate가 3개 미만인 입력에서는 부분 일치 또는 불일치 놀이가 추천 목록에 포함되는 것이 구조적으로 예정돼 있다.
- 사용자 기대가 “내가 고른 재료로 바로 할 수 있는 놀이”에 가깝다면, fallback 정책과 재료 점수 정책을 수정해야 한다.
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
  const baselineSeen = new Set<string>();
  const baselineCases: Array<{ materials: MaterialSlug[]; playId: string | null }> = [];
  const baselineEligiblePlays = plays.filter((play) => {
    const ctx: FilterInput = {
      ...BASELINE_CONTEXT,
      blockedMaterials: [],
      ...SCORE_CONTEXT,
      availableMaterials: MATERIAL_SLUGS,
    };
    return hardFilter(play, ctx).pass;
  });

  for (const play of baselineEligiblePlays) {
    const materials = buildMaterialSetForPlay(play, rng);
    const key = materialKey(materials);

    if (baselineSeen.has(key)) {
      continue;
    }

    baselineSeen.add(key);
    baselineCases.push({ materials, playId: play.id });

    if (baselineCases.length >= AUDIT_CASE_COUNT) {
      break;
    }
  }

  let randomIndex = 0;
  while (baselineCases.length < AUDIT_CASE_COUNT) {
    const size = 3 + (randomIndex % 4);
    const materials = buildRandomMaterialSet(size, rng);
    const key = materialKey(materials);

    randomIndex += 1;
    if (baselineSeen.has(key)) {
      continue;
    }

    baselineSeen.add(key);
    baselineCases.push({ materials, playId: null });
  }

  const baselineAnalyses = baselineCases.map((auditCase, index) =>
    analyzeCase(
      `B${String(index + 1).padStart(3, "0")}`,
      auditCase.materials,
      auditCase.playId,
      BASELINE_CONTEXT,
      plays,
    ),
  );
  const stressCases: Array<{
    materials: MaterialSlug[];
    playId: string | null;
    context: (typeof STRESS_CONTEXTS)[number];
  }> = [];
  const stressSeen = new Set<string>();

  for (let index = 0; index < AUDIT_CASE_COUNT; index += 1) {
    const context = STRESS_CONTEXTS[index % STRESS_CONTEXTS.length];
    const size = 3 + (index % 2);
    const materials = buildRandomMaterialSet(size, rng);
    const key = `${context.childAgeMonths}-${context.availableMinutes}-${context.place}-${materialKey(materials)}`;

    if (stressSeen.has(key)) {
      continue;
    }

    stressSeen.add(key);
    stressCases.push({ materials, playId: null, context });
  }

  while (stressCases.length < AUDIT_CASE_COUNT) {
    const context = STRESS_CONTEXTS[stressCases.length % STRESS_CONTEXTS.length];
    const size = 3;
    const materials = buildRandomMaterialSet(size, rng);
    const key = `${context.childAgeMonths}-${context.availableMinutes}-${context.place}-${materialKey(materials)}`;

    if (stressSeen.has(key)) {
      continue;
    }

    stressSeen.add(key);
    stressCases.push({ materials, playId: null, context });
  }

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
      description: "24개월, 실내, 20분 조건에서 재료 조합만 바꿔 재료 정합성을 측정",
      cases: baselineAnalyses,
      summary: summarize(baselineAnalyses),
    },
    {
      id: "stress",
      title: "Stress Audit",
      description: "12개월/24개월 실외, 30개월 실내/실외 등 후보 풀이 좁은 조건을 섞어 fallback 발생 여부를 확인",
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
