# Proposal

## Why

사용자는 노리 레시피 intro 페이지에도 토스 인앱을 추가하도록 요청했고 공식 공유 링크 https://minion.toss.im/F3OAPpVy 를 제공했다. 기존 소개는 웹 시작과 PWA 설치만 안내했다.

## What Changes

- WEB-004의 상단·하단 시작 영역에 토스앱 열기 버튼을 추가한다.
- 토스 이용 안내 섹션과 메뉴, 시작 방법 및 FAQ를 추가·수정한다.
- 정식 HTTPS 공유 링크를 사용하며 웹 시작과 둘러보기를 유지한다.
- TOSS-001/002와 LOC-001, PRI-001의 기기 저장·분석 경계를 유지하고 웹·토스 간 기록 자동 공유를 약속하지 않는다. 새 SDK·분석·자동 이동은 추가하지 않는다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-platform`: WEB-004에 토스 인앱 소개와 실행 경로를 추가한다.

## Impact

원본 `/Users/msyu/study/play-recipe`의 preview checkout을 사용한다. 정적 소개 생성기와 안내·명세·policy-map만 갱신하며 별도 worktree를 생성하지 않는다. 커밋·푸시·배포는 이번 요청에 포함되지 않는다.
