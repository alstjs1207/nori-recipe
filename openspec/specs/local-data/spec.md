# 로컬 저장·마이그레이션·초기화

## Purpose

현재 코드·테스트와 기존 제품 정책을 대조한 계약이다. 검증 공백은 `openspec/known-gaps.md`, 완료 근거는 `openspec/completed-work.md`를 참고한다.

## Requirements

### Requirement: LOC-001 플랫폼별 로컬 저장과 동기화 메타데이터

서비스 MUST 네이티브 사용자 데이터를 SQLite, 웹 사용자 데이터를 AsyncStorage에 저장하고 놀이 콘텐츠는 번들에서 읽는다. DB 버전 3의 updated_at·deleted_at·sync_state는 향후 동기화 대비 메타데이터이며 서버 동기화가 아니다. 웹 번들에 SQLite/WASM을 넣지 않는다.

#### Scenario: 웹 저장

- **WHEN** 웹이 기록 저장소를 사용한다
- **THEN** 브라우저 저장소를 사용한다.

#### Scenario: 기존 DB

- **WHEN** 네이티브의 낮은 스키마 버전을 연다
- **THEN** 순차 마이그레이션하며 기존 시간을 백필한다.

### Requirement: LOC-002 활동 초기화와 전체 삭제 구분

서비스 MUST 활동 초기화는 활성 로그·발달 로그·찜에 삭제 표시를 남기는 방식으로 수행하고 전체 로컬 데이터 초기화는 해당 게스트 사용자 데이터를 물리 삭제하고 프로필·추천·동의를 초기화한 뒤 새 guestId를 만든다. 브라우저 저장소 삭제로 소실된 기록의 계정 복원은 제공하지 않는다.

#### Scenario: 활동 초기화

- **WHEN** 기록 초기화를 선택한다
- **THEN** 삭제 표시 후 활성 조회에서 제외한다.

#### Scenario: 전체 초기화

- **WHEN** 전체 로컬 데이터 초기화를 선택한다
- **THEN** 사용자 데이터와 세션 설정·동의를 지우고 새 게스트로 시작한다.
