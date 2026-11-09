# 웹 분석 동의·허용 항목·소급 피드백

## Purpose

현재 코드·테스트와 기존 제품 정책을 대조한 계약이다. 검증 공백은 `openspec/known-gaps.md`, 완료 근거는 `openspec/completed-work.md`를 참고한다.

## Requirements

### Requirement: PRI-001 환경·origin·동의로 수집 제한

분석 MUST 설정된 운영 HTTPS origin과 측정 ID에서 방침 버전 3의 유효 동의 후에만 태그를 로드하고 전송한다. 네이티브·로컬·Preview는 전송하지 않는다. Preview의 동의 시뮬레이션은 별도 키·scope를 쓰며 운영 동의와 섞이지 않는다. 철회·오프라인·실패는 놀이 이용과 로컬 저장을 막지 않는다.

#### Scenario: 미동의

- **WHEN** 설정이 있어도 동의가 없다
- **THEN** 태그·이벤트를 보내지 않는다.

#### Scenario: Preview

- **WHEN** 운영 설정이 잘못 들어간 Preview에서 동의한다
- **THEN** 태그·쿠키·이벤트를 만들지 않는다.

#### Scenario: 철회 경합

- **WHEN** 태그 로드 중 동의를 철회한다
- **THEN** 이전 revision 전송을 버린다.

### Requirement: PRI-002 허용 이벤트와 URL 정리

분석 MUST 이벤트별 허용 목록만 전송하고 아이 정보·보유 재료·메모·검색어·guestId·User-ID·개별 기록 ID를 제외한다. 페이지 query/hash와 외부 referrer 경로를 제거하며 상세 play_id는 공개 콘텐츠 식별자로 구분한다. 자동 향상 측정과 수동 페이지뷰를 중복 활성화하지 않는다.

#### Scenario: 임의 항목

- **WHEN** 이벤트에 개인 입력이나 알 수 없는 매개변수를 넣는다
- **THEN** 허용된 행동 항목만 남긴다.

#### Scenario: 페이지 이동

- **WHEN** 같은 경로 화면을 중복 통지한다
- **THEN** 중복 페이지뷰를 방지한다.

### Requirement: PRI-003 동의 후 피드백 소급과 전송 영수증

분석 SHALL 허용 별점·반응을 신규 play_feedback_saved와 기존 기록 play_feedback_imported로 구분하고 로컬 기록 ID 영수증으로 중복을 줄인다. 분석 전용 행동 이벤트 큐는 저장하지 않는다. 전송 실패 기록은 영수증 없이 남아 나중에 로컬 기록에서 재시도할 수 있다. 영수증은 전송기 호출 성공이며 GA 수신 보증이 아니다. 다중 탭 잠금은 navigator.locks 지원 시에만 적용된다.

#### Scenario: 전송 실패

- **WHEN** 소급 전송이 실패한다
- **THEN** 로컬 기록을 유지하고 전송 완료 표시를 남기지 않는다.

#### Scenario: 재접속

- **WHEN** 이미 전송 영수증이 있는 기록을 다시 읽는다
- **THEN** 같은 기록의 신규·소급 중복을 막는다.

### Requirement: PRI-004 고지와 외부 운영 확인의 경계

서비스 SHALL 공통 고지에 로컬 저장·삭제·호스팅·선택 분석·안전 안내와 문의 창구를 표시한다. 저장소의 문구나 테스트만으로 실제 GA4/Vercel 설정·처리 경로·콘텐츠 이용 허락을 확인한 것으로 기록하지 않는다. 외부 미확정은 GAP-004·GAP-005로 관리한다.

#### Scenario: 고지 표시

- **WHEN** 웹과 네이티브의 개인정보 안내를 연다
- **THEN** 공통 고지 값을 사용한다.
