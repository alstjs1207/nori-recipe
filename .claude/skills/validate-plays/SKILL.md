---
name: validate-plays
description: play-recipe의 놀이 데이터 스키마, 게시 상태, 재료 의미와 출처 일치 여부를 검증한다. 데이터 검증이나 수집 후 품질 점검 요청에 사용한다.
allowed-tools:
  - Read
  - Bash(ls *)
  - Bash(wc *)
---

# 놀이 데이터 검증 스킬

`data/plays.json`의 스키마 및 데이터 품질을 검증하여 오류 리포트를 출력합니다.
수정은 하지 않으며, 문제를 발견하고 보고하는 것이 목적입니다.

**입력**: `$ARGUMENTS` (없으면 기본값 `data/plays.json`)

---

## Step 1: 파일 읽기

`$ARGUMENTS`가 비어 있으면 `data/plays.json`을 대상으로 합니다.
`$ARGUMENTS`가 있으면 해당 파일을 대상으로 합니다.

```bash
ls data/plays.json
```

파일이 없으면:
```
data/plays.json 파일이 없습니다.
먼저 /import-plays를 실행하여 놀이 데이터를 임포트해주세요.
```

파일이 있으면 Read로 전체 내용을 읽습니다.

---

## Step 2: 구조 검증

### 2-1: 최상위 구조

- `version` 필드 존재 여부 (string)
- `updatedAt` 필드 존재 여부 (string, YYYY-MM-DD 형식)
- `plays` 필드 존재 여부 (배열)
- `plays` 배열이 비어있지 않은지

### 2-2: 각 play 항목 필수 필드 존재 여부

모든 play에 아래 필드가 존재하는지 확인합니다:

| 필드 | 타입 | 필수 |
|------|------|------|
| `id` | string (`play_NNN`) | O |
| `createdAt` | string (`YYYY-MM-DD`, 최초 마스터 등록일) | 신규 등록 시 O, 기존 항목 생략 허용 |
| `name` | string (비어있지 않음) | O |
| `ageMin` | number (0-48) | O |
| `ageMax` | number (0-48) | O |
| `place` | string | O |
| `durationMin` | number (>0) | O |
| `durationMax` | number (>0) | O |
| `prepTime` | number (>=0) | O |
| `difficulty` | number | O |
| `devAreas` | string[] (비어있지 않음) | O |
| `materials` | object | O |
| `materials.required` | string[] | O |
| `materials.optional` | string[] | O |
| `materials.substitutes` | array | O |
| `steps` | string[] (비어있지 않음) | O |
| `safetyNotes` | string[] | O |
| `educationalEffects` | string[] | O |
| `tags` | string[] | O |
| `source` | object | O |
| `source.type` | string | O |
| `status` | string | O |

---

## Step 3: 값 검증

각 play 항목에 대해 아래 규칙을 검증합니다.

### 3-1: ID 검증
- 형식: `play_` + 3자리 숫자 (예: `play_001`)
- **중복 없음**: 모든 ID가 고유해야 함

### 3-2: 연령/시간 논리
- `ageMin` <= `ageMax`
- `ageMin` >= 0, `ageMax` <= 48
- `durationMin` <= `durationMax`
- `durationMin` > 0

### 3-3: Enum 검증
- `place`: `indoor`, `outdoor`, `any` 중 하나
- `difficulty`: `1`, `2`, `3` 중 하나
- `devAreas` 각 값: `fine_motor`, `gross_motor`, `cognitive`, `language`, `emotional`, `social`, `sensory` 중 하나
- `source.type`: `youtube`, `instagram`, `naver_blog`, `chaisplay`, `tistory`, `brunch`, `manual` 중 하나
- `status`: `live`, `draft`, `archived` 중 하나
- `imageStatus`: 생략하거나 `review`. `review`인 기존 그림을 노출하지 않음
- `createdAt`: 있으면 실제로 존재하는 `YYYY-MM-DD` 날짜. 신규 등록에는 한국 날짜를 기록하고 수정·재임포트로 바꾸지 않음. 날짜 없는 기존 항목은 `NEW`에서 제외하므로 오늘 날짜를 일괄 채우지 않음

### 3-4: 재료 slug 검증

`materials.required`와 `materials.optional`의 모든 값이 표준 slug에 포함되어야 합니다.

표준 slug 목록은 `data/materials.json`의 `categories` 필드에서 읽습니다:

```
Read: data/materials.json
```

모든 카테고리 배열을 합쳐 유효 slug 집합을 구성한 뒤 검증합니다.

### 3-5: 중복 재료 검증
- `required`와 `optional` 내 중복 slug 없어야 함
- `required`와 `optional` 간 중복 slug 없어야 함

### 3-6: 이름 중복 검증
- 모든 play의 `name`이 고유해야 함
- 공백/조사 제거 후 비교하여 유사 이름도 경고 (오류가 아닌 경고)

### 3-7: 태그 검증
- 연령대 태그 포함 금지 (예: "12개월", "돌아기", "18-24개월" 등)
  - CLAUDE.md 규칙: "태그에 연령대 포함 금지 (ageMin/ageMax로 대체)"

### 3-8: source.url 검증
- `source.url`이 존재하면 `https://` 또는 `http://`로 시작하는지 확인
- 형식이 맞지 않으면 경고: "source.url 형식이 올바르지 않음: {값}"
- 실제 도메인과 플랫폼 표시가 일치해야 함. 차이의놀이·브런치·티스토리를 네이버로 표시하지 않음
- 티스토리는 맞춤 도메인도 가능하므로 원문 플랫폼 확인 후 판단 (`kidsgrowthlab.com`은 확인된 티스토리)
- YouTube 검색·채널 목록은 개별 영상 출처가 아님. 개별 원문 미확인이나 수동 재작성은 `manual`, URL은 확인된 참고 원문 또는 `null`

### 3-9: 콘텐츠 품질 경고 (오류가 아닌 경고)
- `steps`가 2개 미만: "놀이 단계가 너무 적음"
- `steps` 배열에 빈 문자열(`""` 또는 공백만)이 포함: "steps에 빈 항목이 있음 (인덱스 {i})"
- `steps` 배열에 동일 문자열 중복: "steps에 중복 항목이 있음: '{중복 텍스트}'"
- `live`의 `educationalEffects`가 비어있음: "교육적 효과 미기재". 보류·보관 항목에는 실행 효과를 쓰지 않아도 됨
- `live`의 `safetyNotes`가 비어있고 `ageMin` < 36: "3세 미만 대상 개별 안전 안내 없음". 화면의 재료별 공통 안내 존재 여부도 구분
- 이름·준비물·단계·팁·효과·태그·그림이 동일한 활동을 설명하는지 함께 확인
- 생밀가루·생반죽 직접 놀이는 `live`로 게시하지 않음
- `ageMin` < 36인 `live` 항목에 작은 구슬·비즈·워터비즈·플레이콘·일반 슬라임이 있으면 오류. 제품 연령·크기·입 탐색 조건을 추가 확인
- "무독성이므로 먹어도 안전", 특정 크기/접촉 시간이 무조건 안전하다는 단정, 수동 관절 운동·머리 흔들기·영아 얼굴 덮기 등은 내용 검토 대상으로 보고
- 재료 이름 치환만으로 안전성과 원본 일치를 보장할 수 없음. 식품↔공작 재료·가루↔알갱이·일반 공↔운동공을 구별

기본 파일의 결정적 검증은 `pnpm check:play-content`로 실행 가능. 이 검사는 영상·그림의 시각 검토나 발달 전문가 검토를 대신하지 않음.

---

## Step 4: 결과 리포트

검증 결과를 아래 형식으로 출력합니다.

### 오류 없는 경우

```
## 검증 완료: data/plays.json

총 {n}개 놀이 검증 완료 — 오류 없음

| 항목 | 값 |
|------|-----|
| 총 놀이 수 | {n}개 |
| live | {live}개 |
| draft | {draft}개 |
| archived | {archived}개 |
| 경고 | {w}건 |
```

### 오류 있는 경우

```
## 검증 결과: data/plays.json

총 {n}개 놀이 검증 — 오류 {e}건, 경고 {w}건

### 오류 (수정 필요)
| # | play ID | 놀이명 | 필드 | 오류 내용 |
|---|---------|--------|------|----------|
| 1 | play_016 | 쌀 촉감 놀이 | materials.required | "rice"는 표준 slug에 없음 |
| 2 | play_018 | — | id | ID 형식 오류: "play18" |
| 3 | play_020 | 물감 놀이 | ageMin/ageMax | ageMin(30) > ageMax(24) |

### 경고 (권장 수정)
| # | play ID | 놀이명 | 내용 |
|---|---------|--------|------|
| 1 | play_017 | 점토 놀이 | steps가 1개뿐 — 단계 보충 권장 |
| 2 | play_019 | 풍선 놀이 | 36개월 이하 대상인데 safetyNotes 없음 |

### 요약
| 항목 | 값 |
|------|-----|
| 총 놀이 수 | {n}개 |
| 오류 있는 놀이 | {err_plays}개 |
| 경고 있는 놀이 | {warn_plays}개 |
| 정상 놀이 | {ok_plays}개 |

### 수정 안내
오류 유형에 따라 아래 방법으로 수정할 수 있습니다:

| 오류 유형 | 수정 방법 |
|-----------|----------|
| 재료 slug 오류 | 원본 재료 의미를 보존. 새 slug는 사용자 확인 후 등록하고, 필수 재료 미해결 활동은 보류 |
| ID/enum/논리 오류 | `data/plays.json`을 직접 수정 |
| 콘텐츠 부족 경고 | `data/plays.json`에서 해당 play의 steps, safetyNotes 등을 보충 |
| 이름 중복 경고 | `data/plays.json`에서 놀이명을 변경하거나 중복 항목 제거 |
```

---

## 에러 처리

### 파일 오류
- JSON 파싱 실패:
  ```
  data/plays.json의 JSON 형식이 올바르지 않습니다.
  파일을 확인해주세요.
  ```

- 파일이 존재하지 않음:
  ```
  data/plays.json 파일이 없습니다.
  먼저 /import-plays를 실행하여 놀이 데이터를 임포트해주세요.
  ```
