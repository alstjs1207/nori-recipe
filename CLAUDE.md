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
/import-plays [파일경로]           → data/plays.json (신규 ID, draft, 중복 제거) + 검수 HTML
/validate-plays                   → data/plays.json 스키마·품질 검증 (읽기 전용)
/coverage-report                  → 월령×발달영역 커버리지 매트릭스 + 수집 갭 제안 (plays.json 기준)
/results-coverage                 → 수집 파일(results/) 기준 커버리지 매트릭스 + 갭 제안
```

### 콘텐츠 운영 기본 흐름

- 수집 스킬 → 재료 정규화 → 초안 병합·ID 부여 → 놀이 대표 이미지·없는 새 재료 이미지 자동 생성·저장 → 새 검수 배치 등록 → 로컬 서버 링크 전달 → 사용자가 UI에서 승인한 항목만 로컬 반영을 기본으로 함. 이미지 생성은 별도 요청을 기다리지 않고 수집 작업에서 이어서 수행. 조사·정규화·프롬프트만 지정한 요청은 그 범위에서 완료.
- 대표 이미지 생성과 재개는 [이미지 생성 절차](tools/local-review/IMAGE-WORKFLOW.md)와 `.claude/skills/generate-play-images/SKILL.md`를 따름. `review:images`로 대상·현재 내용 해시를 확인하고 실제 `image_gen` 결과를 `review:image`로 저장. 새 검수 배치는 모든 이미지와 생성 기록이 준비돼야 생성되며 실패 시 초안·완료 이미지를 보존하고 미완료 ID를 보고.
- 새 재료는 `.claude/skills/generate-material-images/SKILL.md`를 이어서 수행. `review:material-images --ids ...`로 이번 놀이가 쓰는 미승인 재료만 확인하고 실제 기존 이미지는 재사용. 이미지가 없으면 실제 생성 후 `review:material-image`로 JPEG·매핑·생성 기록을 준비. 놀이·새 재료 이미지가 모두 준비돼야 새 배치를 등록하며, 재료 이미지도 사용자 검수 대상 해시에 포함. 이미지 준비만으로 `reviewPending`을 해제하지 않음.
- `pnpm review:local`로 실행한 서버에서 놀이 목록·내용은 `/catalog`, 재료 라이브러리는 `/materials`, 수집 건별 검수 목록은 `/reviews`, 개별 검수는 `/reviews/<batchId>`에서 확인. 검색·월령·발달영역·상태 필터와 재료별 사용 놀이를 제공. `pnpm catalog:build`의 정적 HTML과 JSON/CLI 방식도 대안으로 유지.
- 실제 신규 ID와 현재 존재하는 정규화 파일로 `pnpm review:prepare --ids <ID목록> --source <정규화파일> --title <제목>`을 실행. 반환된 배치 파일은 이후 `--batch`로 재사용하며, 전체 현황과 해당 수집 건의 검수 HTML을 함께 갱신. 신규 ID가 없으면 빈 배치를 만들지 않음.
- 새 재료는 의미가 확인되면 임시 정의와 `reviewPending`으로 준비해 HTML에서 함께 검수. 정규화 완료만으로 신규 놀이를 `live`로 전환하지 않음.
- 이미 등록된 항목은 등록 완료로 구분해 재승인을 요구하지 않음. 내용·이미지가 바뀐 초안은 다시 검수하며 승인 결과를 임의로 만들지 않음.
- 스킬의 배치 생성·서버 실행·실제 검수 URL 확인은 [공통 서버 인계 절차](tools/local-review/README.md#수집-스킬에서-검수로-넘기기)를 따름. JSON/CLI 대안은 [README](README.md#놀이-현황과-html-검수-흐름) 참고. 로컬 승인 반영 후 배포는 별도 요청 범위에서 진행.
- 로컬 관리 화면은 `pnpm review:local`로 실행. 기존 HTML을 localhost에서 제공하고 검수 상태·의견을 `results/local-review/state.json`에 저장. UI의 승인·재료 결정은 선택한 항목만 기존 검증 모듈을 거쳐 로컬 반영하며 JSON 가져오기만으로 게시하지 않음.
- 개별 화면의 `Codex에 검수 요청`은 의견을 저장한 뒤 현재 수집 건 전체를 새 로컬 Codex 채팅으로 요청하고 해당 링크를 반환. 동일한 내용의 반복 클릭은 이미 만든 채팅을 재사용하며 다른 수집 건·변경된 의견은 새 채팅으로 분리. 요청 파일의 현재 해시·의견을 대조하고 수정 요청 범위만 보완하며, 등록 완료·승인·보류와 사용자 재승인 절차를 유지. 버튼 요청을 자동 승인·등록·커밋·배포 허가로 해석하지 않음.
- 서버·파일 저장·HTTP API·브라우저 연결 코드는 `tools/local-review/`에 분리. 스킬/CLI가 데이터·이미지·배치를 수정한 뒤 화면을 새로고침하며, 충돌 시 오래된 화면의 승인을 재사용하지 않음. 실행·복구는 `tools/local-review/README.md` 참고.

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
- `preparationNotes`: string[] (선택 필드) — 준비물의 사용 연령·설치 조건 등 시작 전 확인할 구체적인 조건. 앱과 웹의 준비물 영역에 표시.
- `steps`: string[] (순서 = 배열 인덱스)
- `tip`: string (선택 필드) — 놀이 팁/응용 제안
- `safetyNotes`: string[]
- `educationalEffects`: string[] (서술형)
- `tags`: string[] (연령 태그 제외)
- `source`: `{ type, url, instagramAccount }` — type: youtube | instagram | naver_blog | chaisplay | tistory | brunch | manual
- `status`: live | draft | archived
- `imageStatus`: 선택 필드. `review`이면 기존 그림을 노출하지 않음 (앱은 기본 표시, 웹은 브랜드 기본 이미지). 본문·재료·동작과 일치하는 이미지를 사용자 검수에서 승인한 뒤 승인 반영 도구로 제거.

## 데이터 컨벤션

### 발달영역 (devAreas)

fine_motor, gross_motor, cognitive, language, emotional, social, sensory

### 재료 slug 마스터

**단일 소스**: `data/materials.json` — slug 추가/삭제는 이 파일만 수정합니다.

아래는 빠른 참조용 요약입니다 (`data/materials.json`과 항상 동기화):

| 카테고리 | slug |
|---------|------|
| 종이류 | paper, cardboard, tissue, sticker, cloth, blanket, paper_plate, paper_towel, cardboard_tube, paper_cup |
| 주방 | flour, rice_flour, water, bowl, cup, spoon, chopsticks, bottle, soft_food, salt, tray, plate, colander, food_coloring, transparent_cup |
| 공작 | crayon, paint, glue, tape, string, rubber_band, straw, pom_pom, marker, pencil, cotton_pad |
| 감각 | sand, kinetic_sand, water_bin, water_beads, bubble, balloon, slime, plant_material |
| 블록/장난감 | block, magnetic_tile, ball, puzzle, book, mirror, doll, marble, bead, car_toy, animal_toy, hula_hoop, large_lid_container |
| 조형 | clay, foam, play_corn |
| 도구 | scissors, tongs, smartphone, flashlight, mat, shape_ruler, brush, chair, dropper, basket, cotton_swab |

제거된 slug: newspaper (→ paper), plastic_bag (안전 이슈)

## 규칙

### 홈 추천
- 홈 추천 관련 작업 전 `HOME_RECOMMENDATION_RULES.md`를 먼저 확인
- 홈 추천 동작은 `HOME_RECOMMENDATION_RULES.md`의 고정 규칙을 기준으로 유지

### 데이터
- 보호자에게 보이는 `steps`와 `tip`은 놀이 동작과 실용적인 팁으로 작성. ‘원문’, ‘등록본’ 등 수집·편집 과정 설명은 수집 파일의 검토 기록에 남기고, 출처는 `source`로 보존.
- `NEW`는 `createdAt`의 한국 자정부터 다음 달 같은 날짜 자정 전까지 표시. 다음 달에 같은 날짜가 없으면 말일을 만료일로 사용. 번들의 `updatedAt`이나 원문 게시일을 생성일로 대신하지 않음.
- 재료는 반드시 표준 slug 마스터에 있는 것만 사용. 새 재료는 임시 정의·reviewPending으로 검수 준비하고, 의미가 불명확하거나 활동 자체를 바꾸는 대체는 사용자 확인
- 태그에 연령대 포함 금지 (ageMin/ageMax로 대체)
- 원본 재료와 다른 재료를 유사한 slug로 치환하지 않음. 식품↔공작 재료, 가루↔알갱이, 일반 공↔운동공은 별개로 검토
- 생밀가루·생반죽 직접 놀이는 `live`로 등록하지 않음. 작은 구슬·비즈·폼폼·플레이콘과 일반 슬라임은 사용 연령을 확인하고 3세 미만 추천에서 제외
- 수정 후 `pnpm check:play-content`로 스키마·재료·출처·게시 상태 검증
- Phase 1은 서버 없이 완전 로컬 동작 (오프라인 퍼스트)

### 테스트
- 범위: `src/engine/` 추천 엔진 단위 테스트만 필수
- 엔진 외 코드 (UI, DB, store)는 테스트 불필요
- plan.md STEP 3의 테스트 케이스 기준 준수

### 웹 분석
- GA4는 웹/PWA의 정확한 운영 origin에서 이용자의 별도 분석 동의 후에만 활성화. 개발·미리보기·네이티브는 전송하지 않음.
- 이벤트별 허용 목록을 사용하며 아이 정보·재료·평가·반응·메모·검색어·guestId/User-ID를 분석에 전송하지 않음. URL query/hash와 외부 referrer 경로도 제거.
- 자동 향상된 측정과 수동 페이지뷰를 함께 켜지 않음. 실패·오프라인·철회는 놀이 사용을 막지 않으며 이벤트를 로컬에 보관하지 않음.
- 공개 활성화 전 README의 GA4 설정과 개인정보 고지 미확정 항목을 확인. 수집 목적·항목 변경 시 동의 버전을 갱신.

### 커밋/PR
- Phase 1 완료 전까지는 자유 커밋 (컨벤션 미적용)
- Phase 1 완료 후: 기능 단위 커밋, Conventional Commits (`feat:`, `fix:`, `chore:`)
- 개발 변경사항은 `preview` 브랜치에 반영하고 Vercel Preview의 `*.vercel.app` 주소에서 확인
- 확인한 `preview`를 `main`에 병합하면 Vercel Production의 `https://nori.lestly.io`에 배포
- Vercel의 Production Branch는 `main`, 운영 도메인 `nori.lestly.io`는 Production에 연결
- `PUBLIC_ORIGIN=https://nori.lestly.io`는 Production에만 설정하고 Preview는 `VERCEL_URL` 사용

### 금지
- `.env`, 크레덴셜 파일 커밋 금지
- `any` 타입 사용 금지 (TypeScript strict)
- `console.log` 디버깅 코드 커밋 금지
- `git push --force` main 브랜치 금지
