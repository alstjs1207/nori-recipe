# 토스 배포 번들의 eval 제거와 포장 전 검사

## Why

2026-11-24 사용자가 앱인토스 검토에서 외부 코드 실행 eval 발견으로 반려됐다고 보고했다. 기존 c0f9ec3 토스 번들에서 실제 eval2곳을 확인했다. Expo Modules Core3.0.30 UUID의 서버 require와 Expo54.0.35 분할 번들 로더의 서버/개발 fallback이다. 기존 TOSS-006 검사는 동적 코드 실행을 탐지하지 않아 통과했다.

## What Changes

- TOSS-006: 토스 배포용 웹에서만 Expo의 서버·개발 fallback을 Babel AST 단계에서 제거한다. 실제 crypto.randomUUID·UUID v5와 브라우저 로더를 유지한다. 예상한 원본 구조가 바뀌면 실패한다.
- TOSS-006: 최종 JS·HTML 인라인 스크립트를 구문 분석해 eval 참조와 Function 생성자를 차단한다. 실제 호출 경로에 도달하지 않아도 배포 번들에 남으면 실패한다.
- WEB-003: 일반 웹의 Babel 처리·자산 검증·빌드 출력 교체 정책을 유지하며 토스 조건일 때만 새 플러그인을 적용한다.
- TOSS-001/002/003/004/005/007: 일반 웹/네이티브·Devtools, 사용자/회차 저장과 ID 생성, 내비게이션·공유·분석·광고 시점 및 ID는 유지한다.
- 테스트/운영 광고 두 종류의 새 .ait를 준비한다. 이전 반려 대상 파일은 보존하며 콘솔 업로드·심사·출시는 이번 요청에서 실행하지 않는다.

## Capabilities

### Modified Capabilities

- `toss-miniapp`: TOSS-006 동적 코드 실행을 포함하지 않는 빌드와 재발 검사.

## Impact

원본 /Users/msyu/study/play-recipe의 preview에서 작업한다. babel.config.js, scripts/toss/babel-static-web.cjs, scripts/toss/check.mjs와 회귀·명세·출시 안내를 변경한다. 라이브러리/SDK 버전과 node_modules는 직접 수정하지 않는다. 커밋·푸시·웹/콘솔 배포를 포함하지 않는다.

공식 앱인토스 안내: https://techchat-apps-in-toss.toss.im/t/eval/3671 — 실제 사용 여부와 관계없이 라이브러리에 포함된 eval도 반려될 수 있다.
