# 검증 기록

날짜: 2026-11-13. 원본 `/Users/msyu/study/play-recipe`(작업 폴더 `nori-recipe`), 브랜치 `preview`, 시작 HEAD `617e2ca`. 별도 worktree 없음. 상태 **작업중 / Preview 확인 대기**, archive하지 않음.

## 실행 결과

- Node **24.22.3**, pnpm **10.33.0**.
- `pnpm verify:local`: exit 0. spec-tools 7, 앱 단위 123, play-review 27, local-review 26, web 33(신규 web-intro 5 포함), 총 **216개 통과**. 콘텐츠·이미지 검사, TypeScript, 웹 빌드 통과. 빌드 로그: 208개 공개 상세, 12개 셸 자산, `/intro` 놀이 208·재료 66·화면 7.
- `pnpm spec validate add-intro-landing-page --strict`: 통과.
- `pnpm spec:check`: active/current 18개, archived 3개 통과. policy evidence 34개 요구사항·78개 시나리오·246개 분류 파일.
- `pnpm spec:changed origin/preview`: 통과(web-platform change 근거). `pnpm spec:index`로 `scripts/web/intro.mjs`(web-platform), `tests/web-intro.test.mjs`(catalog·privacy·web-platform) 분류 확인.
- `git diff --check`: 통과.

## 화면 캡처

- 로컬 `pnpm build:web` + `PORT=4319 pnpm serve:web`, headless Chrome 390×844·DPR 2·모바일 터치. 테스트용 게스트 저장소(2024년 1월생, 재료 8종, 찜 4개, 완료 기록 4개)를 브라우저 컨텍스트마다 새로 주입했다. 운영 저장소·사용자 데이터 미사용.
- 저장 파일: `assets/intro/home.png`, `materials.png`, `search.png`, `detail-prep.png`, `detail-safety.png`, `favorites.png`, `record.png`.

## 브라우저 확인

- `http://127.0.0.1:4319/intro`를 1280px·390px 전체 페이지로 열어 가로 넘침 0, 콘솔 오류·실패 요청·4xx 응답 없음 확인.
- 7개 화면 WebP 모두 200 응답·naturalWidth 780 로드 확인(지연 로딩).
- 미리 찾아보기 기본값(25–36개월, 사용 빈도 상위 재료 4종)에서 결과 수·카드 3개·`/play/<id>` 링크 표시 확인.
- 실제 iPhone·Vercel Preview 확인은 미완료(tasks 3.3).

## 후속: 동작 효과 (2026-11-13)

- `pnpm verify:local`: exit 0. spec-tools 7, 앱 단위 123, play-review 27, local-review 26, web 34(web-intro 6), 총 **217개 통과**. `spec validate --strict`, `spec:check`, `spec:changed origin/preview`, `git diff --check` 통과.
- 브라우저(로컬 `/intro`): 히어로 숫자 세어 올리기 중간값(40·13·1) → 최종값(208·66·7), 준비 시간 막대 `scaleX(0)` → `scaleX(1)`·숫자 180, 끝까지 스크롤 후 등장 요소 26개 모두 불투명, 데모 월령 변경 시 개수 21 → 32 전환·`bump`·카드 `card-in` 애니메이션 확인.
- headless Chrome 390×844: `prefers-reduced-motion: reduce`에서 `js-motion` 없음·숨김 0·숫자 최종값·막대 정지·재료 띠 정지. 자바스크립트 꺼짐에서 숨김 0·숫자 최종값·막대 정지(재료 띠는 CSS 애니메이션 유지).
