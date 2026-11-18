# 신규 배지 90일 연장

## Why

2026-11-18 사용자가 신규 배지를 30일에서 90일로 늘리고 preview와 main에 반영하도록 요청했다. 기존 구현은 고정 30일이 아닌 달력 한 달이다.

## What Changes

- CAT-003의 NEW 기간을 생성일 한국 자정부터 고정 90일로 변경한다.
- 공통 판정을 사용하는 배지·신규 정렬·분석 신규 여부에 함께 적용한다.
- 생성일 누락·잘못된 날짜·미래 날짜 제외, 기존 콘텐츠와 사용자 저장 데이터는 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `catalog`: CAT-003 NEW 표시와 만료 경계.

## Impact

`src/play/newPlay.ts`와 날짜·검색 회귀, 현재 명세·policy-map·에이전트 규칙을 갱신한다. 원본 `/Users/msyu/study/play-recipe`의 preview에서 작업하며 별도 작업 폴더는 만들지 않는다. 검증 후 preview 푸시와 미리보기 확인, main 병합·푸시 및 운영 배포를 수행한다. GOV-001~003에 따라 현재 명세·회귀·변경 근거를 함께 관리한다. 월령 계산·콘텐츠 승인·저장·분석 동의 정책은 유지한다.
