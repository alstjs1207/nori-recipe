# Proposal

## Why

2026-11-09 사용자 보고: 홈 화면에 등록한 화면의 위아래가 브라우저 UI로 남고, 탐색의 놀이 상세에서 뒤로가면 발견으로 이동한다. 아이 월령 선택도 49개 항목을 훑어야 한다.

## What Changes

- PWA의 iOS 전체 화면 메타데이터·안전 영역과 설치 안내를 보완한다(WEB-002).
- 상세 뒤로가기가 방문한 탭을 따르며 탐색 조건·스크롤을 보존한다(CAT-004, CAT-002).
- 웹/PWA 첫 시작·설정에서 생년월을 입력하고 기기 현재 연월로 개월수를 자동 표시한다(ONB-001, ONB-002).
- 사용자 요청에 따라 작업중 상태를 유지하고 archive하지 않는다. 기존 guestId·출생월 인덱스·찜·기록·분석 동의는 보존한다(LOC-001, PRI-001).

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-platform`: 설치 모드와 안전 영역·수동 설치 안내.
- `catalog`: 상세에서 출발한 탭으로 복귀.
- `onboarding`: 생년월 직접 입력·검증·자동 월령 표시.

## Impact

`public/index.html`, `public/web.css`, 웹 탭 레이아웃, WebInstall/WebShell, WebWelcome/settings 및 출생월 유틸. DB 스키마·서버 API·콘텐츠·추천 정책은 유지한다. 원본 `/Users/msyu/study/play-recipe`의 preview에서 작업하며 별도 작업 폴더는 만들지 않는다. 후속 사용자 요청으로 preview 커밋·푸시를 수행한다. main 병합·운영 배포·archive는 포함하지 않는다.
