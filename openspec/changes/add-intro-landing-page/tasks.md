# Tasks

상태: **작업중 / Preview 확인 대기**. 2026-11-13 사용자 요청 범위는 구현과 preview 배포까지다. 운영(main) 반영과 archive는 Preview 확인 후 별도 요청으로 진행한다.

## 1. 실제 화면 캡처

- [x] 1.1 로컬 웹 빌드를 테스트용 게스트 저장소로 열어 발견·재료 선택·탐색·상세(준비물·안전 팁)·저장·기록 화면을 390×844(DPR 2)로 캡처하고 `assets/intro/`에 저장한다(WEB-004).

## 2. 소개 페이지

- [x] 2.1 `scripts/web/intro.mjs`에 데이터 기반 수치 계산·HTML 렌더·캡처 WebP 변환을 구현하고 `build-web.mjs`에서 `/intro/index.html`을 생성한다(WEB-004, WEB-001).
- [x] 2.2 월령·재료 칩 미리 찾아보기 데모, 재료 띠, 발달영역, 놀이 가이드, 찜·기록, FAQ, 최종 CTA 섹션을 구성하고 모바일 390px·데스크톱 1280px에서 가로 넘침·콘솔 오류·실패 요청이 없는지 확인한다(WEB-004).
- [x] 2.3 Vercel `/intro` rewrite와 `/intro/media/` 장기 캐시 헤더를 추가한다(WEB-003, WEB-004).

## 2-1. 동작 효과 (2026-11-13 후속 요청)

- [x] 2.4 숫자 세어 올리기(히어로 3개·준비 시간), 준비 시간 막대 채우기, 스크롤 등장, 데모 결과 전환을 추가하고 브라우저에서 동작·동작 줄이기·스크립트 미실행을 확인한다(WEB-004).

## 3. 검증

- [x] 3.1 `tests/web-intro.test.mjs`로 동작 효과의 숨김 규칙 범위·동작 줄이기·세어 올리기 최종 값과 데이터 기반 수치·하드코딩 방지·발달영역 표시명 대조·브랜드·분석 스크립트 부재·공개 링크·검수 중 그림 제외·해시 WebP·origin 치환·로컬 서버/Vercel 경로를 검증한다(WEB-004).
- [x] 3.2 `pnpm spec:index`, `pnpm spec:check`, `pnpm spec:changed`, `pnpm verify:local`을 실행하고 결과를 [검증 기록](verification.md)에 남긴다.
- [ ] 3.3 preview 푸시 후 Vercel Preview 주소에서 `/intro`와 화면 이미지·시작 링크를 확인한다.
- [ ] 3.4 사용자 확인 후 main 반영·운영 배포, 현재 명세·policy-map 동기화와 archive를 진행한다.
