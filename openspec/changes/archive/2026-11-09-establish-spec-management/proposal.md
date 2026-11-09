# 놀이 레시피 OpenSpec 관리 도입

## Why

완료된 서비스 기능과 오래된 Phase 계획, 콘텐츠 검수 정책이 혼재한다. Lestly 관리 방식을 참고해 기준 커밋 4413901의 현재 동작·완료 근거·미구현 계획과 실제 검증을 분리한다.

## What Changes

- 현재 계약 10개 영역·33개 요구사항과 구현·테스트 연결 및 소스 인덱스를 작성한다.
- 완료 이력, 예정 작업 4개 change, 미확정/검증 공백을 구분한다.
- 고정 OpenSpec, Codex/Claude 스킬, 명세/변경 검사·회귀 실행·CI를 도입한다.
- 루트 에이전트·운영 문서의 진입점을 갱신한다.

## Capabilities

### New Capabilities

기존 동작을 최초 명세화하는 영역이며 기능을 새로 구현했다는 의미가 아니다.

- `onboarding`: ONB-001, ONB-002.
- `recommendations`: REC-001, REC-002, REC-003, REC-004, REC-005.
- `catalog`: CAT-001, CAT-002, CAT-003, CAT-004.
- `play-records`: LOG-001, LOG-002, LOG-003.
- `local-data`: LOC-001, LOC-002.
- `content-review`: CON-001, CON-002, CON-003.
- `local-studio`: STU-001, STU-002, STU-003, STU-004.
- `privacy`: PRI-001, PRI-002, PRI-003, PRI-004.
- `web-platform`: WEB-001, WEB-002, WEB-003.
- `spec-governance`: GOV-001, GOV-002, GOV-003.

### Modified Capabilities

없음. OpenSpec 최초 도입이다.

## Impact

문서·스킬·개발 도구·의존성·CI만 변경한다. 서비스 로직·사용자 기록·콘텐츠 승인·운영 배포는 변경하지 않는다. 미구현 후속 기능을 이번 범위에 포함하지 않는다.
