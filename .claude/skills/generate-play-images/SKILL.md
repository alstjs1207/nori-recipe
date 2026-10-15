---
name: generate-play-images
description: 놀이 ID의 대표 이미지를 기존 스타일로 실제 생성·저장하고 수집 건별 검수로 연결한다. 수집·임포트 후 자동 이미지 제작, 대표 이미지 생성·수정, 프롬프트 작성 요청에 사용한다. 프롬프트만 요청하면 실제 생성은 생략한다.
---

# 놀이 대표 이미지 생성 스킬

`data/plays.json`의 실제 놀이를 읽어 프롬프트를 만들고 이미지 생성 도구로 대표 이미지를 생성·저장합니다. 전체 수집·임포트 흐름에서는 별도 이미지 요청을 기다리지 않고 수행합니다. [실제 생성·저장·재개 절차](../../../tools/local-review/IMAGE-WORKFLOW.md)를 읽고 따릅니다. `ready`는 제작 완료이며 사용자 승인과는 별개입니다.

## 기준 파일

- 놀이 데이터: `data/plays.json`
- 재료 이름 참고: `data/materials.json`
- 베이스 프롬프트: `references/base-prompt.md`
- 실제 스타일 기준: [여아·거울 놀이](references/style-examples/style-02.png), [남아·함께 그리기](references/style-examples/style-03.png), [요리 역할놀이](references/style-examples/style-01.png)
- 일괄 출력 위치: `generated/play-image-prompts/{playId}.txt`

스타일은 여아·거울 놀이와 남아·함께 그리기를 우선 기준으로 삼습니다. 요리 역할놀이는 색감과 소품 표현을 보조합니다. 밝은 크림색 여백, 얇고 또렷한 갈색 윤곽선, 단순한 얼굴과 검은 머리 표현을 유지합니다.

## 요청 해석

- 수집·임포트 후 인계 또는 “대표 이미지 생성” 요청은 **실제 생성 모드**입니다. 이번에 부여한 ID만 처리하고, 프롬프트 파일 저장 → 실제 `image_gen` 호출 → 결과 시각 확인 → `review:image` 저장까지 완료합니다. 한 이미지에 여러 놀이를 합치지 않습니다.
- “프롬프트만”, “프롬프트 작성/파일” 요청은 **프롬프트 모드**입니다. 아래 출력 규칙만 수행하고 실제 이미지 생성·파일 등록은 하지 않습니다.
- ID 없이 전체 이미지를 요청해도 이번 수집 작업 범위 밖의 기존·등록·보류 이미지를 일괄 교체하지 않습니다. 범위를 확인하고, 전체 프롬프트 요청은 아래처럼 처리합니다.

- 단건/일부 ID 요청: `play_001`, `001`, `1번`, `1`은 모두 `play_001`로 정규화합니다. 여러 ID가 있으면 각각 처리합니다.
- 프롬프트 모드에서 ID 없이 "전체", "모든 놀이", "일괄", "파일로 만들어줘"라고 요청하면 `data/plays.json`의 `plays` 배열 전체를 대상으로 프롬프트 파일을 생성합니다.
- 프롬프트 모드의 단건 요청은 기본적으로 파일을 만들지 않고 프롬프트 본문을 답변합니다. 사용자가 파일 저장을 함께 요청한 경우에만 파일로 저장합니다.

## 프롬프트 생성 절차

1. `references/base-prompt.md`와 위 스타일 기준 그림을 확인합니다. 스타일을 글로만 추정하지 않습니다.
2. `data/plays.json`을 읽고 대상 놀이를 찾습니다.
3. `data/materials.json`을 읽어 재료 slug의 한글 표시명을 확인합니다.
4. 각 놀이에서 아래 정보를 추출합니다.
   - `name`
   - `ageMin`, `ageMax`
   - `place`
   - `steps`
   - `materials.required`, `materials.optional`, `materials.substitutes`
   - `devAreas`
   - 필요하면 `tags`, `safetyNotes`
5. 아래 규칙으로 활동 유형, setting, 상호작용 인물 필요 여부를 먼저 판단한 뒤 `[SCENE]` 문장을 만듭니다.
6. 베이스 프롬프트의 `[SCENE]`을 장면 문장으로 치환합니다.
7. 프롬프트 모드의 단건은 본문을 답변하고 일괄은 `generated/play-image-prompts/{playId}.txt`에 저장합니다. 실제 생성 모드는 단건도 이 파일에 프롬프트를 저장하고, 공통 절차의 실제 이미지 생성·JPEG 저장까지 이어서 수행합니다. 모든 신규 ID의 이미지가 완료되면 전체 수집·임포트 흐름에서는 [generate-material-images](../generate-material-images/SKILL.md)로 새 재료 이미지도 준비합니다. 놀이·새 재료 이미지가 모두 준비된 뒤 호출한 흐름으로 돌아가 새 검수 배치를 만듭니다. 대표 이미지만 요청했다면 그 범위에서 마칩니다.

## 나이대별 캐릭터 결정 규칙

베이스 프롬프트의 `CHARACTER`는 고정 toddler가 아니라 `ageMin`, `ageMax`에 맞춥니다.

- `ageMax <= 12`: `Korean infant` 또는 `Korean baby`를 사용합니다. 터미타임, 마사지, 뒤집기 준비처럼 영아 발달 놀이가 자연스럽게 보여야 합니다.
- `ageMin >= 36`: `Korean preschool child`를 사용합니다. 역할놀이, 협동놀이, 가위질, 패턴 놀이 등 만 3-4세 행동이 가능해 보여야 합니다.
- 그 외: `Korean toddler`를 사용합니다.
- `[SCENE]` 첫 문장과 `CHARACTER` 섹션 모두 같은 나이대 표현을 써야 합니다.

## 활동별 setting 결정 규칙

베이스 프롬프트의 `SETTING`은 고정 장면이 아니라 기본 가이드입니다. `[SCENE]` 안에 놀이에 맞는 setting을 반드시 명시합니다.

- 테이블 기반 놀이: 붙이기, 그리기, 꽂기, 분류하기, 책 보기, 작은 재료 조작처럼 손 중심 놀이일 때만 `light wooden table`을 사용합니다.
- 바닥 기반 놀이: 매트, 이불, 터널, 공, 걷기, 기기, 구르기처럼 몸 전체가 움직이는 놀이는 `safe open floor play area`, `soft play mat`, `cushions`를 사용합니다.
- 계단/경사 놀이: 계단, 오르내리기, 미끄럼틀, 오르기, 경사, 균형 같은 단어가 `name`, `steps`, `tags`에 있으면 테이블을 사용하지 않습니다. 더 넓은 3/4 to full-body framing을 사용합니다.
- 키워드는 실제 행동 맥락으로 판단합니다. 예를 들어 블록으로 `터널`을 만드는 놀이는 터널을 기어 통과하는 장면이 아니라 블록 구조물을 만드는 장면으로 표현합니다.
- 매트 계단: `계단`과 `mat`이 함께 있으면 실제 계단이 아니라 접은 매트를 낮은 부드러운 계단처럼 보여줍니다.
- 매트 미끄럼틀: `미끄럼틀`과 `mat`이 함께 있으면 접은 매트를 낮은 완만한 경사로 보여줍니다.
- 실제 계단 연습: `계단`이 있지만 매트가 필수 재료가 아니면 낮은 실내 계단, 난간, 미끄럼 방지 양말/신발, 아래쪽 안전 매트 같은 환경 단서를 보여줍니다.
- 보호자 도움이 안전 감독 수준으로만 필요한 놀이는 아이 1명을 유지합니다. 대신 낮고 안전한 구조, 쿠션, 난간 등으로 안전성을 표현합니다.
- 재료 위치는 활동 맥락에 맞춥니다. `on the table`은 테이블 기반 놀이에만 쓰고, 대근육/바닥/계단/매트 놀이는 `where they are actually used`, `on the floor`, `as soft steps`, `as a gentle ramp`처럼 씁니다.

## 상호작용 인물 결정 규칙

기본값은 아이 1명이 중심인 장면입니다. 다만 놀이의 핵심 행동이 보호자/상대와의 상호작용 없이는 성립하지 않으면 보호자의 존재를 최소한으로 허용합니다.

- 아이 1명 유지: 보호자가 단순히 지켜보기, 안전 감독, 시범 보이기만 하는 경우. 예: 작은 재료 삼킴 주의, 계단 옆에서 지켜보기, 먼저 보여주기.
- 보호자 부분 허용: `name`, `steps`, `tags`, `educationalEffects`에 주고받기, 차례, 마주앉기, 함께, 손잡기, 무릎 위, 부모 가슴 위, 안기, 상호작용, 역할을 바꿔, 부모자녀놀이가 핵심으로 나타나는 경우.
- 보호자를 넣을 때도 아이가 명확한 주인공이어야 합니다. 보호자는 손, 팔뚝, 무릎, 가장자리의 잘린 실루엣 정도만 허용하고 얼굴은 프레임 밖에 둡니다.
- 보호자 전체 얼굴, 여러 사람, 또래 친구는 데이터에 명시적으로 필요하지 않으면 추가하지 않습니다.
- `play_075`처럼 공 주고받기인 경우: 아이가 바닥 매트에 앉아 공을 굴리고, 프레임 가장자리의 부드러운 어른 손이 공을 받거나 다시 굴려주는 장면으로 표현합니다.

## `[SCENE]` 작성 규칙

장면은 영어 중심으로 작성하되, 놀이명과 재료의 한글 의미가 사라지지 않게 괄호로 보조합니다.

권장 형식:

```text
the Korean {childDescriptor} play activity "{name}" for a {ageMin}-{ageMax} month old child; show one calm moment where the child {actionSummary}. Use an activity-matched setting: {settingSummary}. Use the appropriate participant composition: {participantSummary}. Keep the key materials, props, or environmental cues clearly visible where they are actually used: {materialSummary}. Keep the setup visibly safe and age-appropriate.
```

`actionSummary`는 `steps`에서 핵심 동작 1-2개를 뽑아 자연스럽게 요약합니다. 모든 단계를 억지로 넣지 않습니다.

`materialSummary`는 필수 재료를 먼저 쓰고 선택 재료를 뒤에 붙입니다. 가능하면 `slug (한글 표시명)` 형태를 사용합니다.

필수/선택 재료가 없더라도 계단, 난간, 바닥 매트, 넓은 공간 같은 환경 단서가 핵심이면 `materialSummary`에 적습니다.

`participantSummary`는 기본적으로 `one Korean {childDescriptor} alone as the focal subject`를 사용합니다. 상호작용 인물이 필요한 경우 `the child remains the focal subject, with only cropped adult hands/forearms at the edge of the frame to show caregiver interaction`처럼 씁니다.

## 품질 규칙

- 최종 프롬프트에는 베이스 프롬프트의 스타일, 색감, no text, no logos 조건을 유지합니다.
- 인물의 얼굴·손·옷·재료에 읽기 쉬운 갈색 윤곽선을 남깁니다. 사실적인 피부 명암, 과도한 종이 입자, 복잡한 배경은 넣지 않습니다.
- 실제 생성 모드는 기준 그림을 먼저 시각 확인하고 도구가 지원하는 참조 방식으로 전달합니다. 스타일 참고와 기존 활동 참고를 구분합니다. 실제 생성 도구 호출·결과 저장은 이 스킬의 완료 범위입니다. 현재 도구가 없거나 실패하면 초안·프롬프트·완료한 이미지를 보존하고 미완료 ID·사유를 보고합니다. 기본 이미지나 원본 썸네일로 완료를 대신하지 않습니다.
- 생성 결과는 기준 그림과 함께 비교하고, 놀이의 핵심 동작·손 위치·재료 연결·필요한 개수를 확인합니다. 예를 들어 문어 다리는 8개, 한 광원 아래 피규어 하나의 그림자는 하나여야 합니다.
- 실제 생성 결과는 공통 절차의 `pnpm review:image`로 `images/plays/{playId}.jpeg`에 저장합니다. 앱 매핑·`plays.json`·사용자 검수 결과는 직접 수정하지 않습니다. 새 그림을 저장해도 `draft`·`imageStatus: review`는 사용자 승인까지 유지합니다.
- 일괄 생성 시 기존 프롬프트 파일이 있으면 같은 `playId` 파일은 새 내용으로 덮어씁니다.
- 일괄 생성 전 `generated/play-image-prompts/`가 없으면 생성합니다.
- 대상 ID가 없으면 가능한 ID 예시와 함께 찾을 수 없다고 답변합니다.

## 실제 생성 완료 보고

대상 ID, 실제 저장된 JPEG 경로, 완료/미완료 수를 보고합니다. 전체 흐름이면 모든 이미지가 완료된 뒤 실제 서버 검수 링크까지 이어서 전달합니다. 프롬프트만 저장한 상태를 이미지 생성 완료로 보고하지 않습니다.

## 프롬프트 모드의 단건 응답 형식

```text
play_001 빨대 꽂기 놀이

{최종 프롬프트}
```

## 프롬프트 모드의 일괄 저장 결과 형식

```text
생성 완료
- 대상: {n}개
- 출력: generated/play-image-prompts/
- 파일명: {playId}.txt
```
