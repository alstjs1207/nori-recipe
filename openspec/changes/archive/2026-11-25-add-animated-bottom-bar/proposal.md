# Proposal

## Why

사용자는 기존 하단 메뉴에 DesignBookmark Bottom bar의 선택 라벨 확장·강조 배경 추적·아이콘 팝 모션을 적용하도록 요청했다.

## What Changes

- 웹 모바일/PWA와 토스의 기존 다섯 하단 링크를 React 컴포넌트로 재구성한다.
- 실제 원본 bar.js의 라벨 300/26, 아이콘 520/14, 강조 배경 340/28 스프링과 shared/motion.js의 4회 적분·1/30초 제한을 유지한다. tokens.css의 일반 pop 프리셋 520/16과 원본 Bottom bar의 직접 값 520/14가 다르므로 해당 컴포넌트의 값을 따른다.
- 선택 메뉴의 글자만 펼치고 기존 보라색·라벤더·폰트·둥근 모서리를 사용한다. 자동 순환은 제품 내비게이션에 넣지 않는다.
- WEB-006/TOSS-003의 동일 너비 계약을 선택 메뉴 가변 너비·최소 44×56px로 갱신한다.
- WEB-005의 새 진입/복귀·기존 경로와 별칭, 상세/피드백 숨김, 안전 영역, LOC-001/002 저장, PRI-001/002/003/004 분석, TOSS-001/006 분리 빌드·eval 금지 및 GOV-001/002는 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-platform`: 모바일 하단 주 메뉴 선택 모션과 접근성.
- `toss-miniapp`: 같은 하단 컴포넌트와 안전 영역.

## Impact

원본 `/Users/msyu/study/play-recipe`의 preview checkout에서 기존 React/Expo DOM 및 CSS를 변경한다. 새 의존성·외부 실행 코드·데이터 변경·자동 경로 전환은 추가하지 않는다. 기존 큰 화면의 헤더 메뉴와 네이티브 탭은 유지한다. 이번 요청에는 커밋·푸시·배포가 포함되지 않는다.
