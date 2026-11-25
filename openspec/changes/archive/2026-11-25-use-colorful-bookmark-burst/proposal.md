# Proposal

## Why

사용자는 기존 저장 모션을 확인한 뒤 주변 점을 요청한 예제처럼 알록달록하게 바꾸도록 요청했다. 기존 점은 보라 계열3색이라 원본의 다색 확산과 달랐다.

## What Changes

- WEB-007의8개 점을 원본 tokens.css/like.js 순서인 빨강(#ff4d6d)·주황(#ff9f0a)·노랑(#ffd23f)·초록(#34d17a)·하늘(#3ec9ff)·보라(#c69bff)·분홍(#ff6ad5)·빨강으로 변경한다.
- 북마크 모양·보라색 채움·크기와 원본 스프링·550ms 점 확산·저장 성공 조건·모션 축소·수명 정리는 유지한다.
- WEB-002/005/006, LOG-003, LOC-001/002, PRI-001/002/003/004와 저장/진입/분석 경계를 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-platform`: 저장 확산 점의 다색 팔레트.

## Impact

원본 `/Users/msyu/study/play-recipe`의 기존 preview checkout에서 public/web.css와 명세·근거만 갱신한다. 새 의존성·worktree·데이터 변경은 없으며 커밋·푸시·배포는 요청 범위에 없다.
