# Design

## Context

웹은 React Navigation Tabs 안에 상세를 함께 등록하며 기본 뒤로가기는 첫 탭을 따른다. WebPage가 비활성 DOM을 제거하고 scrollTop을 복원한다. 출생월은 year * 12 + month - 1 정수로 이미 저장된다. public/index.html에 standalone/viewport-fit=cover는 있지만 iOS 상태 표시줄이 default다.

## Goals / Non-Goals

웹/PWA에서 생년월 입력과 기존 저장 호환성을 제공한다. 네이티브 월령 휠·추천·콘텐츠·분석·DB 스키마는 변경하지 않는다.

## Decisions

- 탭 backBehavior=history를 사용해 상세의 기존 router.back()이 출발한 탭을 복원한다. 상세를 별도 Stack으로 옮겨 탐색을 재마운트하는 방식은 피한다.
- 공용 BirthMonthField에서 년·월을 분리한 두 개의 scroll-snap 휠로 생년월을 선택한다. 44px 행과 중앙 선택 영역을 사용하고 터치 관성 스크롤이 멈춘 후 선택한다. 행 클릭·방향키·Home/End·PageUp/Down과 listbox/option 접근성을 제공한다. 플랫폼마다 모양이 다른 native month/select 대신 웹/PWA에서 같은 휠을 제공한다. 포맷/파싱/범위 검증은 순수 유틸로 분리하며 유효값에서 기존 출생월 인덱스를 직접 저장한다. 연령으로 재변환해 저장하지 않아 기존 48개월 초과 프로필도 보존한다.
- iOS black-translucent 메타데이터, dynamic viewport, 가산 안전 영역을 사용한다. 설치 여부는 display-mode 및 iOS navigator.standalone을 확인한다. 브라우저 도구막대는 CSS로 숨길 수 없어 수동 안내에서 웹 앱으로 열기를 명시한다.
- 기본 신규 입력 범위 0–48개월은 유지하되, 이미 저장된 오래된 생년월은 그대로 표시·저장할 수 있다. 생년월 원문을 분석에 추가하지 않는다.

## Risks / Trade-offs

- 실제 iPhone의 설치·상태 표시줄은 데스크톱 에뮬레이션으로 확정할 수 없다 → 로컬 검증과 iPhone 설치 확인을 구분하고 후자를 미완료로 남긴다.
- 년도 변경으로 월이 범위를 벗어나는 경우 → 해당 년도의 유효 월만 제공하고 가장 가까운 월로 맞춘다. 두 값이 모두 선택되기 전에는 저장하지 않는다.
- 기본 0–48개월 밖 기존 데이터 → 현재 저장값을 예외로 허용하고 변경 시 신규 범위 검증을 적용한다.

## Migration Plan

로컬 코드·검증 후 후속 사용자 요청에 따라 preview에 커밋·푸시한다. 운영 배포 요청 시 preview 검증 후 main 순서를 따른다. DB migration은 없으며 되돌려도 기존 출생월 인덱스를 읽을 수 있다. 서비스 워커 업데이트는 사용자 선택 적용을 유지한다.
