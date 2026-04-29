# Play Recipe

육아 놀이 레시피 앱 프로젝트. 놀이 데이터 수집 → 재료 표준화 → 모바일 앱 소비 파이프라인으로 구성.
상세 계획서: `docs/plan.md`

## 프로젝트 구조

```
play-recipe/
├── docs/plan.md                          # 앱 개발 계획서 (Phase 1-3)
├── data/plays.json                       # 마스터 놀이 데이터베이스
├── data/materials.json                   # 재료 slug 마스터 (단일 소스)
├── results/                              # 수집된 놀이 JSON 파일
├── results/normalized/                   # 표준화된 놀이 JSON 파일
├── .claude/skills/play-recipe/           # 놀이 수집 스킬 (YouTube + 블로그)
├── .claude/skills/normalize-materials/   # 재료 표준화 스킬
├── .claude/skills/import-plays/          # plays.json 임포트 스킬
├── .claude/skills/validate-plays/        # 데이터 검증 스킬
├── .claude/skills/coverage-report/       # 커버리지 분석 스킬 (plays.json 기준)
└── .claude/skills/results-coverage/      # 수집 커버리지 분석 스킬 (results/ 기준)
```

## 기술 스택

- React Native + Expo SDK 51, TypeScript strict
- pnpm

## 데이터 파이프라인

```
/play-recipe {월령} {발달영역}     → results/{월령}_{영역}_{ts}.json (YouTube + 블로그, 한글 재료)
/normalize-materials results/...  → results/normalized/..._normalized.json (slug 재료)
/import-plays [파일경로]           → data/plays.json (id, status 부여, 중복 제거)
/validate-plays                   → data/plays.json 스키마·품질 검증 (읽기 전용)
/coverage-report                  → 월령×발달영역 커버리지 매트릭스 + 수집 갭 제안 (plays.json 기준)
/results-coverage                 → 수집 파일(results/) 기준 커버리지 매트릭스 + 갭 제안
```

## 놀이 스키마

모든 단계에서 동일한 스키마 사용. 재료만 수집 시 한글 → 정규화 후 slug로 변환.

- `name`: 한글 놀이명
- `ageMin/ageMax`: 월령 (0-48)
- `place`: indoor | outdoor | any
- `durationMin/durationMax`: 놀이 시간(분)
- `prepTime`: 준비 시간(분)
- `difficulty`: 1(쉬움) | 2(보통) | 3(어려움)
- `devAreas`: 발달영역 enum 배열
- `materials`: `{ required, optional, substitutes }` — slug 또는 한글(수집 직후); `substitutes`는 항상 빈 배열 `[]` (대체 재료는 재료 설명 텍스트로 처리)
- `steps`: string[] (순서 = 배열 인덱스)
- `tip`: string (선택 필드) — 놀이 팁/응용 제안
- `safetyNotes`: string[]
- `educationalEffects`: string[] (서술형)
- `tags`: string[] (연령 태그 제외)
- `source`: `{ type, url, instagramAccount }` — type: youtube | instagram | naver_blog | chaisplay | tistory | brunch | manual
- `status`: live | draft | archived

## 데이터 컨벤션

### 발달영역 (devAreas)

fine_motor, gross_motor, cognitive, language, emotional, social, sensory

### 재료 slug 마스터

**단일 소스**: `data/materials.json` — slug 추가/삭제는 이 파일만 수정합니다.

아래는 빠른 참조용 요약입니다 (`data/materials.json`과 항상 동기화):

| 카테고리 | slug |
|---------|------|
| 종이류 | paper, cardboard, tissue, sticker, cloth, blanket |
| 주방 | flour, rice_flour, water, bowl, cup, spoon, chopsticks, bottle, soft_food |
| 공작 | crayon, paint, glue, tape, string, rubber_band, straw |
| 감각 | sand, kinetic_sand, water_bin, water_beads, bubble, balloon, slime |
| 블록/장난감 | block, magnetic_tile, ball, puzzle, book, mirror, doll, marble, bead, car_toy |
| 조형 | clay, foam, play_corn |
| 도구 | scissors, tongs, smartphone, flashlight, mat, shape_ruler |

제거된 slug: newspaper (→ paper), plastic_bag (안전 이슈)

## 규칙

### 홈 추천
- 홈 추천 관련 작업 전 `HOME_RECOMMENDATION_RULES.md`를 먼저 확인
- 홈 추천 동작은 `HOME_RECOMMENDATION_RULES.md`의 고정 규칙을 기준으로 유지

### 데이터
- 재료는 반드시 표준 slug 마스터에 있는 것만 사용 (없으면 사용자 확인)
- 태그에 연령대 포함 금지 (ageMin/ageMax로 대체)
- Phase 1은 서버 없이 완전 로컬 동작 (오프라인 퍼스트)

### 테스트
- 범위: `src/engine/` 추천 엔진 단위 테스트만 필수
- 엔진 외 코드 (UI, DB, store)는 테스트 불필요
- plan.md STEP 3의 테스트 케이스 기준 준수

### 커밋/PR
- Phase 1 완료 전까지는 자유 커밋 (컨벤션 미적용)
- Phase 1 완료 후: 기능 단위 커밋, Conventional Commits (`feat:`, `fix:`, `chore:`)
- PR/브랜치 전략은 v1 출시 후 도입

### 금지
- `.env`, 크레덴셜 파일 커밋 금지
- `any` 타입 사용 금지 (TypeScript strict)
- `console.log` 디버깅 코드 커밋 금지
- `git push --force` main 브랜치 금지
