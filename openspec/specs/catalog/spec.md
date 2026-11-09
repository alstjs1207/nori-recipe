# 공개 놀이·검색·상세·NEW

## Purpose

현재 코드·테스트와 기존 제품 정책을 대조한 계약이다. 검증 공백은 `openspec/known-gaps.md`, 완료 근거는 `openspec/completed-work.md`를 참고한다.

## Requirements

### Requirement: CAT-001 로컬 번들과 공개 상태

앱 SHALL plays.json 번들을 읽고 live만 일반 목록에 노출한다. draft·archived는 로컬 검수에서 볼 수 있으나 공개 상세 HTML과 앱 목록으로 게시하지 않는다.

#### Scenario: 초안

- **WHEN** draft 놀이가 번들에 있다
- **THEN** 일반 목록·검색·공개 상세 생성 대상에서 제외한다.

### Requirement: CAT-002 검색과 준비 완료

검색 SHALL NFKC 정규화 후 제목·태그·단계·효과·팁·발달영역·재료·장소 텍스트를 검색하고 월령·장소·시간·분류·준비 상태·제외 재료를 함께 적용한다. 준비 완료는 필수 재료 전체가 보유 목록에 있는 경우다. 검색의 시간 필터는 durationMax이며 추천의 durationMin 배수와 구분한다.

#### Scenario: 준비 완료

- **WHEN** 필수 재료가 하나라도 부족하다
- **THEN** 준비 완료 필터에서 제외한다.

#### Scenario: 검색어 없음

- **WHEN** limit을 지정하지 않고 빈 검색어로 조회한다
- **THEN** 기본 최대 24개를 반환하며 검색어가 있으면 기본 최대 30개를 반환한다.

### Requirement: CAT-003 NEW 달력 기간

서비스 SHALL createdAt의 한국 자정부터 다음 달 같은 날 한국 자정 직전까지 NEW를 표시하며 다음 달에 같은 날짜가 없으면 말일로 맞춘다. 잘못된 날짜·미기록·미래 날짜는 현재 NEW로 간주하지 않는다. 번들 updatedAt을 생성일로 대신하지 않는다.

#### Scenario: 말일

- **WHEN** 1월 31일 생성 놀이의 다음 달에 31일이 없다
- **THEN** 2월 말일 자정에 NEW가 만료된다.

### Requirement: CAT-004 상세 가이드·준비·안전·이미지

상세 SHALL 준비물·준비 조건·순서·팁·안전 안내를 제공하고 콘텐츠 안전 문구에 재료별 안내를 중복 없이 보강한다. imageStatus=review인 그림은 일반 놀이 이미지로 노출하지 않고 기본 표시를 사용한다. 안전 문구는 현재 제품 구현의 계약이며 의학적 안전 검증 완료를 뜻하지 않는다.

#### Scenario: 안전 보강

- **WHEN** 작은 부품 등 해당 재료가 있다
- **THEN** 재료별 유의사항을 기존 안내에 보강한다.

#### Scenario: 미검수 그림

- **WHEN** imageStatus가 review이다
- **THEN** 플랫폼의 기본 표시를 사용한다.
