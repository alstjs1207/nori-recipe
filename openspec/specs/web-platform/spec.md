# 웹·PWA·공유·배포

## Purpose

현재 코드·테스트와 기존 제품 정책을 대조한 계약이다. 검증 공백은 `openspec/known-gaps.md`, 완료 근거는 `openspec/completed-work.md`를 참고한다.

## Requirements

### Requirement: WEB-001 공개 상세·공유 메타데이터·origin

웹 빌드 SHALL live 놀이마다 직접 링크와 공유 메타데이터를 생성하며 사이트 대표 이미지와 버전된 놀이 이미지를 사용한다. 운영 기준 주소는 https://www.nori-recipe.com이며 Preview는 해당 VERCEL_URL을 사용한다. 직접 상세는 온보딩 없이 열리며 존재하지 않는 자산·놀이 경로는 404를 반환한다.

#### Scenario: 직접 링크

- **WHEN** 처음 방문한 사용자가 /play/play_001을 연다
- **THEN** 온보딩 없이 해당 공개 상세를 본다.

#### Scenario: 미리보기

- **WHEN** Preview 빌드에 VERCEL_URL이 있다
- **THEN** 해당 주소로 메타데이터를 만든다.

### Requirement: WEB-002 설정의 설치·오프라인·선택 업데이트

PWA SHALL 설정의 앱처럼 이용하기에서 설치 또는 수동 안내를 제공하고 설치 후 상태를 표시한다. 버전별 앱 셸·방문 이미지 캐시를 사용하고 이미지 캐시는 최대 80개로 제한한다. 새 버전은 사용자의 새 버전 열기 선택으로 적용하며 모든 미방문 화면·이미지의 오프라인 제공을 보장하지 않는다. 설치된 웹 앱은 standalone 모드와 전체 화면 viewport를 사용하고 상하좌우 안전 영역에 조작부가 가려지지 않아야 한다. iPhone 수동 안내는 웹 앱으로 열기 선택을 포함한다.

#### Scenario: 오프라인

- **WHEN** 이미 방문한 앱을 오프라인으로 연다
- **THEN** 캐시된 셸·미디어를 사용한다.

#### Scenario: 업데이트

- **WHEN** 새 서비스 워커가 대기한다
- **THEN** 사용자 동작 후 SKIP_WAITING으로 적용한다.

#### Scenario: 설치 화면 영역

- **WHEN** iPhone 홈 화면에서 독립 웹 앱으로 연다
- **THEN** 앱 배경이 화면을 채우며 헤더·하단 메뉴·상세 하단 버튼은 안전 영역 안에 표시된다.

#### Scenario: 브라우저 바로가기

- **WHEN** 브라우저 모드에서 설치 안내를 연다
- **THEN** Safari 공유 메뉴·홈 화면에 추가·웹 앱으로 열기 및 홈 화면 실행을 안내하며 저장소를 삭제하도록 요구하지 않는다.

### Requirement: WEB-003 에셋 준비와 브랜치 배포 경계

빌드 SHALL 원본 JPEG를 보존하고 웹 WebP·썸네일·재료·아이콘·내용 해시 CSS를 생성한다. 개발은 preview→Vercel Preview, 확인한 preview의 main 병합은 Production으로 구분한다. PUBLIC_ORIGIN 운영 값은 Production에만 설정한다. 로컬 검증 명령은 커밋·푸시·공개 배포를 수행하지 않는다.

#### Scenario: 에셋 교체

- **WHEN** 같은 재료 또는 환영 그림을 바꿔 빌드한다
- **THEN** 내용 해시 주소를 갱신해 이전 캐시와 구분한다.

#### Scenario: 검증 실행

- **WHEN** verify:local을 실행한다
- **THEN** 로컬 테스트·빌드까지만 실행한다.
