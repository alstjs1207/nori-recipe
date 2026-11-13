# Design

## Context

웹은 Expo Router SPA를 `expo export`로 내보내고, `build-web.mjs`가 live 놀이별 `/play/<id>/index.html`과 서비스 워커를 생성한다. 루트 `/`는 프로필이 없으면 첫 시작, 있으면 발견으로 이동한다. 서비스 워커는 탐색 요청을 네트워크 우선으로 처리하고 실패 시 같은 경로 캐시 → 앱 셸 순으로 대체한다. 참고 사이트는 섹션별로 핵심 질문형 제목, 휴대폰 목업, 칩 기반 미니 데모, FAQ, 최종 CTA를 갖춘 구조다. 구조와 말투만 참고하고 문구·디자인은 노리 레시피 웹 테마(보라 `#5846E8`, 배경 `#FAFAFE`)로 새로 작성한다.

## Goals / Non-Goals

- 목표: 앱 동작을 바꾸지 않는 정적 소개 페이지, 데이터 기반 수치, 실제 서비스 화면, 모바일 우선 반응형, 접근성(건너뛰기 링크·aria-pressed 칩·aria-live 결과·동작 줄이기).
- 비목표: 루트 교체, 앱 내부 링크 추가, 스토어 배지(네이티브 앱 미배포), 분석·추적, 새 프레임워크·런타임 의존성.

## Decisions

- **위치**: `/intro` 정적 HTML. 사용자가 검토안의 추천(루트 유지)을 선택했다. Expo 앱 번들을 불러오지 않아 가볍고, 기존 SPA rewrite 목록과 충돌하지 않는다. Vercel은 `/intro` → `/intro/index.html` rewrite를 명시해 trailingSlash=false에서도 확실히 제공한다. 로컬 `serve-web`은 디렉터리 index를 이미 제공한다.
- **생성 방식**: `scripts/web/intro.mjs`의 순수 함수 `collectIntroData`(데이터 → 수치)와 `renderIntroPage`(HTML 문자열), 파일 쓰기 `writeIntroPage`로 분리해 단위 테스트한다. `build-web.mjs`는 prepareWebAssets가 반환한 live 놀이·이미지 버전과 재료 이미지 버전으로 호출한다. canonical·OG는 기존 `__NORI_ORIGIN__` 치환(WEB-001)을 사용한다.
- **수치**: 공개 놀이 수, 준비 5분 이내(기준 상수 `QUICK_PREP_MINUTES`), 필수 재료 없는 놀이 수, 재료 수(categories − reviewPending, 앱 `MATERIAL_SLUGS`와 같은 기준), 재료 분류 수, 월령 최소·최대, 12개월 구간·발달영역별 놀이 수를 모두 계산한다. 발달영역 표시명은 `src/constants/devAreas.ts`와 테스트로 대조한다.
- **데모**: live 놀이의 최소 필드(이름·월령·준비/놀이 시간·필수 재료·썸네일)를 JSON으로 포함하고, 월령 구간과 겹치며 필수 재료가 모두 선택된 놀이를 필수 재료 수(많은 순)·준비 시간 순으로 3개 보여 준다. 기본 재료는 필수 재료 사용 빈도 상위 4개(데이터 계산). 이는 소개용 미리보기이며 홈 추천 엔진(REC-*)의 결과나 규칙을 대체·주장하지 않는다. imageStatus=review 놀이는 브랜드 아이콘을 쓴다.
- **화면 캡처**: 2026-11-13 `preview` 기준 로컬 `pnpm build:web` + `serve-web`을 headless Chrome(390×844, DPR 2, 모바일 터치)으로 열어 캡처했다. 브라우저 저장소에 테스트용 게스트(2024년 1월생, 재료 8종, 찜 4개, 기록 4개)를 넣어 실제 화면을 렌더링했고 운영 저장소·사용자 데이터는 사용하지 않았다. 대상: 발견, 재료 선택 창, 탐색, 상세(준비물·안전 팁), 저장, 기록. 캡처 도구(puppeteer-core)는 프로젝트 의존성에 추가하지 않았다. 빌드는 원본 PNG를 780px WebP로 바꾸고 내용 해시 파일명을 붙인다.
- **동작 효과**(후속 요청 1~4번): `<head>`의 짧은 스크립트가 `prefers-reduced-motion: no-preference`이고 IntersectionObserver를 지원할 때만 `<html>`에 `js-motion`을 붙인다. 처음에 숨기는 CSS(투명·0 너비 막대)는 모두 `.js-motion` 아래에만 두어 스크립트가 없거나 동작 줄이기에서는 내용이 그대로 보인다. 숫자는 서버 렌더 최종 값을 유지하고 `data-count-to`로 0부터 세어 올리며 화면 낭독기용 최종 값을 별도로 둔다. 데모는 결과가 바뀔 때 개수를 짧게 전환하고 카드를 70ms 간격으로 등장시킨다. 섹션 등장은 한 번만 실행하고 관찰을 해제한다.
- **스타일**: 인라인 CSS, 시스템 한글 폰트(앱 웹과 동일), 외부 요청 없음. 라이트 테마만 제공(앱 `userInterfaceStyle: light`와 일치). 재료 띠 애니메이션은 `prefers-reduced-motion`에서 정지하고 중복 항목을 숨긴다.

## Risks / Trade-offs

- 캡처는 시점의 화면이라 앱 UI가 바뀌면 낡는다 → 캡처 조건을 여기와 DEVELOPMENT.md에 기록하고, UI 변경 시 다시 캡처한다. 캡처 안의 놀이·날짜는 그 시점 데이터다.
- 정적 페이지는 서비스 워커 precache 대상이 아니므로 오프라인 최초 방문은 보장하지 않는다(방문 후 네트워크 우선 캐시는 기존 동작).
- 데모 결과는 홈 추천과 다를 수 있다 → 문구에서 ‘미리 찾아보기’로 한정하고 추천 결과라고 표시하지 않는다.

## Migration Plan

로컬 검증 후 사용자 요청에 따라 preview에 커밋·푸시해 Vercel Preview에서 확인한다. main 병합·운영 배포는 별도 요청 시 진행한다. 되돌리기는 rewrite·빌드 호출 제거로 충분하며 저장소·데이터 migration은 없다.
