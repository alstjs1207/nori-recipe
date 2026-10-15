---
name: generate-material-images
description: 수집한 놀이에 새로 필요한 미승인 재료의 이미지를 확인하고, 없으면 기존 3D 스타일로 실제 생성·저장해 놀이와 함께 검수하도록 연결한다. 수집·임포트 후 새 재료 이미지 준비와 미승인 재료 이미지 수정에 사용한다.
---

# 새 재료 이미지 생성

전체 수집·임포트에서는 놀이 대표 이미지에 이어 별도 요청 없이 실행한다.
[공통 이미지 흐름](../../../tools/local-review/IMAGE-WORKFLOW.md)의 새 재료 이미지 절차를 따른다.
이미지를 준비해도 재료 승인·대체·보류와 놀이 등록은 사용자가 검수 화면에서 결정한다.

## 대상과 재사용

1. 이번에 초안으로 병합한 실제 놀이 ID, 현재 `data/plays.json`, `data/materials.json`,
   해당 정규화 파일의 `meta.materialProposals`를 확인한다. 재료 이름·형태·용도와 놀이의
   실제 사용 방법을 대조한다. 재료 의미가 불명확하면 다른 재료로 추측해 그림을 만들지 않는다.
2. `pnpm review:material-images --ids <이번-놀이-ID목록>`을 실행한다. 이번 놀이의
   필수·선택 재료 중 `reviewPending`인 slug만 중복 제거되므로 같은 재료는 한 장만 만든다.
   승인된 기존 재료, 관계없는 수집 건의 재료와 사용자 보류 항목을 일괄 재생성하지 않는다.
3. `existing` 또는 `ready`는 실제 그림을 재사용한다. 브랜드 기본 아이콘은 재료 그림으로
   인정하지 않는다. `missing`만 우선 생성한다. `unlinked`는 실제 파일이 있으므로
   `review:material-image --slug <slug> --definition-hash <계획의해시> --link`로 연결한다.
   `stale`은 변경된 정의·파일을 확인해 이번 작업에서 수정한 미승인 재료만 다시 생성한다.

## 스타일과 프롬프트

- 기존 스타일은 흰 배경의 부드러운 3D 재료 아이콘이다. 놀이 대표 이미지의 색연필·수채화
  스타일을 적용하지 않는다. 실제 기준 파일 `images/material/paper_cup.jpeg`,
  `images/material/tray.jpeg`, `images/material/dropper.jpeg` 중 가까운 2개를 먼저 시각 확인한다.
  도구가 지원하는 참조 방식으로 스타일 기준을 제공하며 기준 재료 자체를 새 재료로 복사하지 않는다.
- 재료 하나 또는 자연스러운 최소 묶음을 화면 중앙에 크게 놓고, 정사각형 1024px,
  흰 배경·부드러운 스튜디오 조명·약한 접지 그림자·둥글고 단순한 3D 형태를 유지한다.
  브랜드·글자·로고·워터마크·장식 배경·아이·손·놀이 장면을 넣지 않는다.
- 실제 재료의 물성·구조·구별되는 특징을 보존한다. 종이컵과 투명 플라스틱 컵, 가루와
  알갱이, 액체풀과 고체풀을 구분한다. 원문에 없는 특정 상품·부속품·임의 크기 표시를 넣지 않는다.
- `generated/material-image-prompts/<slug>.txt`에 실제로 사용할 프롬프트를 저장한다.
  예시 구조: `Soft rounded 3D material icon of {실제 재료와 구별되는 특징}, centered,
  pure white background, subtle contact shadow, soft studio lighting, isolated object,
  square composition, no people, no text, no logos, no watermark.`

## 실제 생성과 저장

1. 현재 환경의 실제 `image_gen` 도구를 재료별로 호출한다. 전체 흐름의 자동 이미지
   제작에는 별도 요청을 기다리지 않는다. 프롬프트 파일 작성만으로 생성 완료라고 보고하지 않는다.
   이미지 도구가 없거나 실패하면 초안·프롬프트·완료 결과를 보존하고 미완료 slug와 원인을 보고한다.
   별도 API 경로 전환은 도구 지침과 사용자의 허용 범위를 따른다.
2. 도구가 반환한 실제 생성 파일을 시각 확인한다. 재료의 형태·재질·개수와 흰 배경·3D
   스타일이 맞는지 확인하고 필요하면 수정한다. 이 제작 확인은 사용자의 최종 승인이 아니다.
3. 계획에서 얻은 `definitionHash`와 저장한 프롬프트로 저장한다.

   ```bash
   pnpm review:material-image --slug new_cup --file /실제/생성결과.png --definition-hash <계획의-definitionHash> --prompt generated/material-image-prompts/new_cup.txt
   ```

   명령은 실제 디코딩·정사각형·최소 512px를 확인해 `images/material/<slug>.jpeg`로 저장하고,
   해당 slug의 앱/웹 이미지 매핑과 생성 기록을 준비한다. 등록 상태·사용자 의견은 바꾸지 않는다.
   정의 또는 매핑이 생성 중 바뀌었으면 저장이 거절되므로 최신 계획으로 다시 진행한다.
   기존 이미지의 요청받은 수정에만 `--replace`를 사용한다. 승인된 재료는 이 저장 명령의 대상이 아니다.
4. `review:material-images --ids ...`를 다시 실행해 모두 `existing` 또는 `ready`인지 확인한다.
   놀이 대표 이미지도 모두 준비됐을 때만 원래 수집·임포트 단계에서 새 `review:prepare`를 실행한다.
   기존 배치의 수정은 같은 `--batch`로 갱신한다. 실패한 항목이 남으면 새 검수 건을 먼저 만들지 않는다.
5. 실제 서버의 해당 수집 건과 재료 이미지 응답을 확인해 검수 링크를 전달한다.
   사용자에게 놀이 이미지 수, 새 재료의 생성/재사용 수와 미완료 사유를 보고한다.
   검수 화면의 재료 이미지·용도·형태 확인과 신규 추가·대체·보류는 사용자가 직접 수행한다.
