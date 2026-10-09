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
├── .claude/skills/play-recipe/           # 놀이 수집 스킬 (Instagram/Aside, YouTube, 블로그)
├── .claude/skills/normalize-materials/   # 재료 표준화 스킬
├── .claude/skills/import-plays/          # plays.json 임포트 스킬
├── .claude/skills/validate-plays/        # 데이터 검증 스킬
├── .claude/skills/coverage-report/       # 커버리지 분석 스킬 (plays.json 기준)
└── .claude/skills/results-coverage/      # 수집 커버리지 분석 스킬 (results/ 기준)
```

## 기술 스택

- React Native + Expo SDK 54, TypeScript strict (실제 버전은 package.json 기준)
- pnpm

## 데이터 파이프라인

```
/play-recipe {월령/재료/후보목록}   → results/{대상}_{주제}_{ts}.json (지정 플랫폼 원문, 한글 재료)
/normalize-materials results/...  → results/normalized/..._normalized.json (slug 재료)
/import-plays [파일경로]           → data/plays.json (id, status 부여, 중복 제거)
/validate-plays                   → data/plays.json 스키마·품질 검증 (읽기 전용)
/coverage-report                  → 월령×발달영역 커버리지 매트릭스 + 수집 갭 제안 (plays.json 기준)
/results-coverage                 → 수집 파일(results/) 기준 커버리지 매트릭스 + 갭 제안
```

## 놀이 스키마

모든 단계에서 동일한 스키마 사용. 재료만 수집 시 한글 → 정규화 후 slug로 변환.

- `name`: 한글 놀이명
- `createdAt`: 최초 마스터 등록일 (`YYYY-MM-DD`, 한국 날짜). 신규 등록 시 기록하고 수정·재임포트 때 유지. 날짜 없는 기존 놀이는 `NEW` 표시에서 제외.
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
- `imageStatus`: 선택 필드. `review`이면 기존 그림을 노출하지 않음 (앱은 기본 표시, 웹은 브랜드 기본 이미지). 본문·재료·동작과 일치하는 이미지 확인 후에만 필드를 제거.

## 데이터 컨벤션

### 발달영역 (devAreas)

fine_motor, gross_motor, cognitive, language, emotional, social, sensory

### 재료 slug 마스터

**단일 소스**: `data/materials.json` — slug 추가/삭제는 이 파일만 수정합니다.

아래는 빠른 참조용 요약입니다 (`data/materials.json`과 항상 동기화):

| 카테고리 | slug |
|---------|------|
| 종이류 | paper, cardboard, tissue, sticker, cloth, blanket, paper_plate, paper_towel |
| 주방 | flour, rice_flour, water, bowl, cup, spoon, chopsticks, bottle, soft_food, salt |
| 공작 | crayon, paint, glue, tape, string, rubber_band, straw, pom_pom |
| 감각 | sand, kinetic_sand, water_bin, water_beads, bubble, balloon, slime |
| 블록/장난감 | block, magnetic_tile, ball, puzzle, book, mirror, doll, marble, bead, car_toy, animal_toy, hula_hoop |
| 조형 | clay, foam, play_corn |
| 도구 | scissors, tongs, smartphone, flashlight, mat, shape_ruler, brush |

제거된 slug: newspaper (→ paper), plastic_bag (안전 이슈)

## 규칙

### 홈 추천
- 홈 추천 관련 작업 전 `HOME_RECOMMENDATION_RULES.md`를 먼저 확인
- 홈 추천 동작은 `HOME_RECOMMENDATION_RULES.md`의 고정 규칙을 기준으로 유지

### 데이터
- 보호자에게 보이는 `steps`와 `tip`은 놀이 동작과 실용적인 팁으로 작성. ‘원문’, ‘등록본’ 등 수집·편집 과정 설명은 수집 파일의 검토 기록에 남기고, 출처는 `source`로 보존.
- `NEW`는 `createdAt`의 한국 자정부터 다음 달 같은 날짜 자정 전까지 표시. 다음 달에 같은 날짜가 없으면 말일을 만료일로 사용. 번들의 `updatedAt`이나 원문 게시일을 생성일로 대신하지 않음.
- 재료는 반드시 표준 slug 마스터에 있는 것만 사용. 승인된 등록 작업에 필요한 실제 재료 추가는 진행하고 보고하며, 범위가 불명확한 추가·대체는 사용자 확인
- 태그에 연령대 포함 금지 (ageMin/ageMax로 대체)
- 원본 재료와 다른 재료를 유사한 slug로 치환하지 않음. 식품↔공작 재료, 가루↔알갱이, 일반 공↔운동공은 별개로 검토
- 생밀가루·생반죽 직접 놀이는 `live`로 등록하지 않음. 작은 구슬·비즈·폼폼·플레이콘과 일반 슬라임은 사용 연령을 확인하고 3세 미만 추천에서 제외
- 수정 후 `pnpm check:play-content`로 스키마·재료·출처·게시 상태 검증
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
