# 현재 명세·변경·근거·실행 검증

## Purpose

현재 코드·테스트와 기존 제품 정책을 대조한 계약이다. 검증 공백은 `openspec/known-gaps.md`, 완료 근거는 `openspec/completed-work.md`를 참고한다.

## Requirements

### Requirement: GOV-001 현재·완료·예정·공백 분리

프로젝트 MUST 현재 확인된 동작을 specs/, 새 변경을 changes/, 완료 이력을 completed-work.md와 archive/, 공백을 known-gaps.md에 구분한다. 과거 docs/plan.md의 체크박스를 현재 구현 완료 증거로 사용하지 않는다. 사용자 요청의 구현 승인은 유효하며 새 기능·커밋·배포 승인을 문서에서 추론하지 않는다.

#### Scenario: 후속 계획

- **WHEN** 계정·구독·OTA 계획을 확인한다
- **THEN** 미구현·결정 필요 상태로 읽고 현재 기능으로 쓰지 않는다.

### Requirement: GOV-002 명세와 구현·테스트 연결 검사

도구 MUST 안정적 요구사항 ID와 WHEN/THEN을 사용하고 policy-map의 파일·구현 anchor·테스트 분류와 전체 관리 소스 인덱스를 검증한다. automated는 연결된 회귀 테스트가 있다는 뜻이며 모든 시나리오 또는 UI의 검증 완료를 뜻하지 않는다. 신규 영역은 임의 기본 분류 대신 명시적으로 분류한다.

#### Scenario: 누락된 근거

- **WHEN** 요구사항 anchor 또는 소스 경로가 사라진다
- **THEN** spec:check가 실패한다.

#### Scenario: 분류 누락

- **WHEN** 알 수 없는 소스 영역을 추가한다
- **THEN** 인덱스 생성·검사가 실패해 분류 검토를 요구한다.

### Requirement: GOV-003 변경 누락 검사와 로컬 CI

프로젝트 SHALL PR의 base SHA 기준으로 영역별 변경 명세 또는 change 본문의 기존 요구사항 ID를 검사한다. preview/main 푸시와 PR CI는 고정 pnpm·OpenSpec 및 로컬 회귀를 사용한다. CI 파일 도입은 원격 branch protection 설정 완료를 뜻하지 않는다.

#### Scenario: 누락된 변경 기록

- **WHEN** 행동 코드가 바뀌었으나 영역의 명세·change 근거가 없다
- **THEN** spec:changed가 실패한다.

#### Scenario: 검증 실패

- **WHEN** 로컬 검증 단계가 실패한다
- **THEN** 후속 단계를 중단하고 실패를 반환한다.
