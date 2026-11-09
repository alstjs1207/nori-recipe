# 계정과 로컬 데이터 동기화 계획

## Why

과거 plan STEP 8의 방향을 보존한다. LOC-001·LOC-002는 로컬 서비스다. sync_state는 준비 메타데이터이고 scripts/upload.ts는 placeholder다.

## What Changes

- 과거 예정 작업을 추적 가능한 미구현 change로 정리한다.
- 상태: **제안·미착수 / 결정 필요**. 이번 도입에서 기능을 구현하지 않는다.

## Capabilities

### New Capabilities

- `account-sync`: 이 change의 후속 계약 (ACC-001). 기존 현재 명세는 그대로 유지한다.

### Modified Capabilities

없음. 현재 구현에 대한 정책 결정과 실제 변경은 후속 요청 때 확정한다.

## Impact

계정과 로컬 데이터 동기화 계획의 조사·정책 결정·호환 검증이 필요하다. 기존 데이터·서비스·승인 상태를 변경하지 않는다. 예정 업무의 기록은 신규 기능이나 운영 변경 승인이 아니다.
