# Proposal

## Why

사용자는 Like burst의 클릭 반응을 기존 저장 버튼에 적용하고 하트 대신 북마크를 유지하도록 요청했다.

## What Changes

- WEB-007: 공통 React 북마크에 성공한 저장의 팝·채움·8개 점 확산과 취소의 작은 딥을 적용한다.
- 원본 like.js의520/13·300/26을 따른다. tokens.css의 일반 pop520/16과 구분한다. 숫자 롤링260/20은 제품에 저장 개수가 없어 이식하지 않는다.
- 기존 보라색·브랜드 보조 보라색·폰트·버튼 모서리와44px 영역을 유지한다. 점만 portal로 표시해 카드 이미지 clipping을 보존한다.
- WEB-002/005/006·LOG-003·LOC-001/002·PRI-001/002/003/004·TOSS-003의 저장·실패·진입/복귀·주 메뉴·동의·플랫폼 경계를 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-platform`: 공통 북마크 저장 모션.

## Impact

원본 `/Users/msyu/study/play-recipe`의 preview checkout에서 작업한다. 별도 worktree/clone·의존성·외부 실행 스크립트·자동 저장을 추가하지 않는다. 네이티브 화면은 변경하지 않는다. 이번 요청에는 커밋·푸시·배포가 포함되지 않는다.
