# 검증 기록

## 범위와 재현

2026-11-18 사용자 요청. 기존 CAT-003은 한국 날짜 기준 달력 한 달이었다. 예를 들어 2026-10-09 등록 놀이는 기존 구현에서 2026-11-09 자정에 만료되어 11월 18일 NEW가 없었다. 고정 90일 정책으로 2027-01-07 한국 자정까지 NEW를 유지한다.

- 배지·탐색 신규 정렬·분석 is_new는 기존 공통 `isNewPlay`를 계속 사용한다.
- 한국 자정 시작/만료의 직전 1ms, 월말·연말·윤년, 날짜 누락·잘못된 날짜·미래 날짜 제외와 만료 후 탐색 정렬 복귀를 검사한다.
- 월령·로컬 사용자 데이터·분석 동의·콘텐츠 원본은 변경하지 않는다.

## 로컬 실행

Node24.22.2 / pnpm10.33.0.

- `pnpm spec:index`: 301개 파일. 새 관리 소스 없음.
- `pnpm spec:check`: 현재/활성/아카이브 strict 및 policy evidence 통과.
- `pnpm spec:changed 3e27f0f`: catalog·spec-governance 변경 근거 통과.
- 전체 회귀 290개·실패0, 타입 검사 통과. 전체 실행 후 30일 초과 90일 이내 사례 1개를 보강해 날짜·검색 회귀 18개 추가 실행 통과.
- `pnpm verify:local --public-images`: 종료0. 공개 놀이 이미지416개·재료66개 해시/크기/WebP 검증, 웹 번들·공개 상세208개·PWA 빌드 통과. 최종 캐시 `1c20d9ef95bf`.

## 배포

원본 `/Users/msyu/study/play-recipe`의 기존 preview checkout에서 작업하며 별도 clone/worktree는 만들지 않았다. 다른 작업의 기존 worktree는 정리 대상이 아니다. preview 확인 후 main으로 반영한다.

- 구현 커밋 `0c82ffdcfb77e386abdb4da6eef176d790ccd2c7`의 Preview 배포 `7872757284` 성공.
- 실제 URL: https://nori-recipe-nmq0wjwvw-alstjs1207s-projects.vercel.app/search
- 브라우저에서 전체 월령 탐색의 NEW32개 및 2026-10-09 등록 `play_193`의 NEW 표시를 확인했다. 변경 전 운영의 같은 탐색에서는 NEW0개였다.
- 이 기록 시점에는 main 반영 전이다. 사용자 요청에 따라 동일 구현과 이 검증 기록을 main에 반영하고, 원격 최종 커밋·CI·운영 배포 상태를 확인해 최종 보고한다.

- 구현 커밋의 GitHub Policy and regression checks 성공: https://github.com/alstjs1207/nori-recipe/actions/runs/44226609285 . 최종 사례를 포함한291개 회귀·타입·빌드가 통과했다.
