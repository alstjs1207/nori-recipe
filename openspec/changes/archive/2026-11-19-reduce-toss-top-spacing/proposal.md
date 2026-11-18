# Proposal

## Why

사용자가 토스 QR 실기기 캡처에서 공통 네비게이션 아래 큰 빈 공간을 보고했다. 토스의 불투명 네비게이션을 사용하는 WebView에 SDK top inset을 다시 padding으로 적용하고, 브랜드 상하13px와 본문20px까지 더한 현재 코드를 확인했다. 사용자 요청대로 토스 상단을 최대한 줄여 새 파일만 만들고 업로드는 사용자에게 맡긴다.

## What Changes

- TOSS-003: 현재 불투명 토스 호스트가 확보한 상단 영역을 앱 shell에서 다시 더하지 않는다. SDK top 값은 그대로 수신하되 CSS --safe-top/상단padding은0으로 한다. 하단/좌우 inset은 유지한다.
- 기존 꽃32px·글자24px를 유지하며 브랜드 상하padding을0, 홈 링크의 최소 터치 높이를44px로 한다. 본문 상단 여백은20→8px로 줄인다.
- TOSS-006/007: 이전20261118-6과 같은 테스트 광고 ID로 새 .ait를 만들고 해시/크기를 별도 경로에 보존한다. 이번 요청에서 콘솔 업로드·심사·출시는 수행하지 않는다.
- TOSS-001/002/004/005, REC-004, WEB-005/006, LOG-001/002/003의 웹/PWA 출력·브랜드·하단5개 메뉴56px·추천·도장·폭죽·스크롤·초안·기기 저장·공유·고지 정책은 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `toss-miniapp`: 토스 호스트 아래 상단 여백 최소화와 사용자 업로드용 번들 생성.

## Impact

원본 `/Users/msyu/study/play-recipe` preview checkout을 사용한다. 새 worktree/clone은 없다. 토스 CSS만 변경하며 기존 업로드 파일을 별도로 보존한다. 이전 모의 검증이 native 호스트 밖 영역을 확인하지 못한 한계를 구분하고 실기기 결과는 새 번들을 사용자가 올린 뒤 확인한다. 콘솔/기기 설정을 변경하지 않는다.
