# 검증 — 최근 완성 묶음 Fan cards

2026-11-24, 원본 /Users/msyu/study/play-recipe의 preview, c0f9ec3 기반 미커밋 변경이다. 기존 eval 반려 수정은 보존했다. 새 worktree/clone·의존성을 만들지 않았고 커밋·푸시·운영/콘솔 배포는 하지 않았다.

## 구현

기록 기본 보기의 실제 완료한 최근3묶음에만 React CompletedPlayFan을 연결했다. 원본 Fan cards의 단위 질량과220/18·420/20·420/22,4substep·1/30dt cap을 유지한다. 사진만 transform하며 날짜·세 제목은 고정된 기존 링크로 제공한다. 월별 전체 보기는 기존3열이다. 마우스/키보드는 마지막으로 조작한 카드를 강조하고 터치는 한 번에 상세로 이동한다.

기록 화면의 로컬 Set으로 같은 묶음의 재등장(탭/전체 보기)에 진입을 반복하지 않는다. IntersectionObserver·visibility·motion media query로 보일 때만 필요한 rAF를 예약하고 안정·뷰 밖·해제에 중단한다. 동작 줄이기는 즉시 정적 펼침이며 설정 변경에도 진입을 반복하지 않는다. 저장·회차·묶음 조회와 날짜 기준은 변경하지 않았다. 일반 웹/PWA/토스 공통 웹 화면이며 네이티브 기록 배열은 유지한다.

## 자동 검증

- Node24.21.0/pnpm10.33.0. 최종 pnpm verify:local359개(8+13+182+27+12+15+8+26+68)·명세·콘텐츠/이미지·타입·웹 빌드 통과.
- 신규 fanSpring6개:30/60/120Hz의 오버슈트 후 수렴과 idle 종료, 강조 전환/복귀, 동작 줄이기의 즉시 종료, 긴 background dt상한을 확인했다.
- 공식 SDK3.10.0의 테스트/운영 .ait와 check:toss 통과. 공개 이미지416+66개 검증. 실제 .ait 내부 ZIP의 JS에서 fanComponent와 eval0개·Function 생성자0개를 확인했다. evidence/toss-artifacts.json 및 generated/toss-fan-cards/2026-11-24에 해시/광고 모드·소스/빌드 근거를 보존했다.
- 토스 빌드 전후 public/index.html·놀이/재료 웹 manifest·웹 dist SHA-256은 동일하다. 이전 eval 수정 파일은 별도 기존 경로에 보존했다.

## 실제 웹 브라우저

Ego의 별도 작업 공간과127.0.0.1:4329를 사용했다. 사용자 localhost:8081·운영 기기 저장소를 수정하지 않았다. evidence/ui-fixture.json의 합성 guest·실제 공개 놀이12기록/4묶음을 준비했다.

-393×852와320×760: 최근3팬, 가로 넘침0, 사진이 묶음 안에 있고 제목과 겹치지 않음을 실제 좌표로 확인했다. 터치 이벤트 한 번으로 play_162 상세와 기록 복귀를 확인했다. mobile-393.json·mobile-320.json과 PNG에 보존했다.
-1280×900: 호버와 키보드 Tab의1.06배/-22px 강조, focus-visible, 키보드 후 포인터의 다른 카드 강조와 정착을 확인했다. Enter로 play_107 상세·복귀를 확인했다. 날짜/제목 위치를 이동시키지 않는다. desktop-interactions.json·fan-desktop.png.
- 동작 줄이기 초기값과 실시간 변경에서3개 모두 펼침1·움직임 없음·확대1을 확인했다. 감소 해제에도 진입을 반복하지 않았다. reduced-motion.json.
-1280×500에서 첫 팬이 viewport 위(bottom=-452.625px)로 나가면 프레임 정지. 월별 전체 보기에는 팬0/기존3열3묶음,10월 선택에는10월18일의1묶음. 기본 보기 복귀의 진행 샘플은 모두1.0000으로 재진입 모션이 없었고12기록을 유지했다. archive-lifecycle.json.

최초 타입 검사는 Expo LinkProps가 pointer 이벤트를 제공하지 않아 실패했고, DOM wrapper에서 입력을 처리하도록 수정했다. 실제 화면에서 Expo 링크의 relative 기준 때문에 사진이 묶음을 벗어나는 것을 확인해 해당 링크만 static으로 고정했다. 겹친 transform의 enter/leave 영향은 실제 pointer movement와 고정된 팬 경계의 leave로 한정했다. 브라우저 CSS 숫자 정규화 때문에 문자열 비교가 실패한 검증은 실제 변환 행렬로 확인했다. 자동화의 비활성 창 rAF 지연은 프레임/입력 로그로 구분하고 전면 활성화·실제 노출 영역과 대기시간으로 재확인했다. 이 보완 후 최종 전체359개를 다시 통과했다.

visibility change/해제 이벤트의 자원 정리는 코드와 회귀를 대조했다. OS의 실제 백그라운드·토스앱 QR/광고·네이티브 기기 검증을 완료한 것으로 해석하지 않는다. QA 브라우저/4329 임시 서버는 종료하고 사용자8081 개발 서버는 유지한다.

## 명세와 출처

LOG-004·현재 spec/delta·policy-map·source-index를 동기화했다. 완료 archive와 완료 기록 정리 후 최종 spec:check·spec:changed HEAD·git diff --check도 통과했다. 기존 eval 반려 수정과 타 active change의 과거 검증 기록은 변경하지 않는다.

원본: https://designbookmark.com/motion-src/fan-cards/fan.js · fan.css 및 /motion-src/shared/tokens.css · base.css · motion.js. 원본 코드의 개별 팬 스프링 값을 확인했고 공통 전역 테마·저장·외부 폰트·반복 autoplay는 가져오지 않았다.
