# Proposal

## Why

2026-11-13 사용자 요청: 서비스를 처음 접한 보호자에게 노리 레시피의 가치와 사용 흐름을 한 페이지로 보여줄 소개 랜딩 페이지가 필요하다. 현재 웹 루트(`/`)는 곧바로 앱(첫 시작 또는 발견)이므로, 앱 동작을 바꾸지 않는 별도 경로가 필요하다.

## What Changes

- 웹 빌드가 정적 소개 페이지 `/intro`를 생성한다(WEB-004 신규). 기존 앱 경로·루트 리다이렉트·온보딩은 그대로 둔다.
- 페이지 숫자(공개 놀이 수, 준비 5분 이내 놀이 수, 재료 수·분류 수, 월령 범위, 월령 구간·발달영역별 놀이 수)는 빌드 시점의 `data/plays.json` live 놀이와 `data/materials.json`(검수 대기 재료 제외)에서 계산한다. 하드코딩하지 않는다.
- 화면 이미지는 실제 서비스 웹을 로컬 빌드해 모바일 크기에서 캡처한 원본(`assets/intro/*.png`)을 사용하고, 빌드 시 내용 해시 WebP(`/intro/media/`)로 변환한다.
- 월령·재료 칩으로 실제 공개 놀이를 미리 찾아보는 클라이언트 데모를 제공한다. 결과는 공개 상세 링크(`/play/<id>`, WEB-001)로 연결하며 검수 중 그림(imageStatus=review)은 노출하지 않는다(CAT-004 유지).
- 브랜드명은 사용자 결정에 따라 ‘노리 레시피’로 표기한다.
- 2026-11-13 후속 요청: 히어로·준비 시간 숫자 세어 올리기, 준비 시간 막대 채우기, 스크롤 등장, 데모 결과 전환(카드 순차 등장·개수 변화) 동작 효과를 추가한다. 외부 라이브러리 없이 CSS와 IntersectionObserver를 쓰며 동작 줄이기·스크립트 미실행에서는 적용하지 않는다.
- 분석 스크립트·서비스 워커 등록·외부 폰트/CDN을 추가하지 않는다(PRI-001 유지). 기존 서비스 워커의 네트워크 우선 탐색 정책(WEB-002)을 바꾸지 않는다.
- Vercel `/intro` rewrite와 `/intro/media/` 장기 캐시 헤더를 추가한다. 배포는 preview→Vercel Preview 경계(WEB-003)를 따른다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-platform`: 정적 서비스 소개 페이지 `/intro`와 데이터 기반 수치·실제 화면 캡처 요구사항 추가(WEB-004).

## Impact

`scripts/web/intro.mjs`(신규), `scripts/build-web.mjs`, `vercel.json`, `assets/intro/*.png`(신규 캡처), `tests/web-intro.test.mjs`(신규), DEVELOPMENT.md, roadmap. 앱 소스(app/src)·추천 엔진·콘텐츠·저장소·분석 정책은 변경하지 않는다. 2026-11-13 사용자 요청 범위에 preview 커밋·푸시(Vercel Preview 배포)가 포함되며 main 병합·운영 배포는 포함하지 않는다. 앱 안에서 `/intro`로 이동하는 링크 추가도 이번 범위가 아니다.
