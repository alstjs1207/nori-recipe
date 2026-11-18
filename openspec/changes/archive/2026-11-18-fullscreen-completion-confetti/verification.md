# 검증 기록 — 전체 화면 완료 축하

## 범위와 재현

원본 `/Users/msyu/study/play-recipe`, preview의 기존 미커밋 변경을 유지했다. 이전 구현은 HomeRedesign의 완료 배너 내부 `.confetti`가 position:absolute이고, 부모 overflow:hidden과160px 낙하 때문에 배너 안에서만 보였다. 전체 완료 여부·고정 추천 ID·기록·광고 정책은 바꾸지 않았다.

웹/PWA/토스 공통 홈에서 document.body 포털로72개의 입자를 분산 배치한다. position:fixed/inset:0으로 현재 viewport를 덮으며 약3.3초 후 DOM을 제거한다. pointer-events:none·aria-hidden으로 조작과 안내를 방해하지 않고 홈 이탈 시 정리한다. 동작 줄이기에서는 생성하지 않으며 실행 중 전환에는 CSS display:none과 미디어 변경 listener로 숨기고 제거한다. 네이티브용 스텁은 React DOM을 불러오지 않고 기존 네이티브 완료 배너를 유지한다.

## 자동 검증

- Node24.21.0·pnpm10.33.0 verify:local 통과. 명세 검사, 콘텐츠/이미지 검사,307개 테스트(명세 도구8·토스7·단위145·놀이 검수27·등록12·놀이 저장15·재료 저장8·로컬 검수26·웹59), 타입·웹 빌드 포함.
- 이후 입자의 시작 위치만 화면 전체로 분산하고 동작 줄이기의 CSS 숨김을 추가했다. 최종 타입 검사·웹 빌드도 별도로 통과했다. 새 런타임 패키지는 없으며 @types/react-dom19.1.11 개발 타입과 lockfile의 관련 peer 연결만 추가했다.
- spec:index는314개 소스를 분류하며 새 컴포넌트2개는 web-platform으로 연결한다. REC-004 policy-map은 기존 source-reviewed로 유지한다. 실제 브라우저 수동 검증을 자동 회귀로 표기하지 않는다.

## 실제 브라우저

Ego Chromium의 별도4330 origin에 남아 있던 테스트 프로필(23개월)에서 검증했다. 사용자4327 origin의 프로필·기록은 건드리지 않았다.

- 초기 추천 play_010/081/003 중2/3 완료였다. 마지막 play_081을 열고5점 선택·실제 기록 저장 후3/3 완료, 카드3개의 도장, 기존 추천 ID 유지, 완료 배너를 확인했다.
- 모바일390×844: 포털의 x/y=0/0, width/height=390/844, 부모 BODY,72입자, pointer-events:none, aria-hidden=true. 완료 배너는 별도350×125.8px이므로 효과의 기준 영역이 배너에 제한되지 않는다.
- 마지막 입자 분포 변경 후 모바일 실제 입자 범위 top=-62.2px~bottom789.4px, 데스크톱1512×900의 범위 top=-65px~bottom842px를 확인했다. 최종 모바일 스크린샷에서 헤더·본문·하단 메뉴에 걸쳐 입자가 보인다.
- 홈 scroller를600px 이동해도 overlay의0/0·390×844가 유지됐다. effect 중 하단 마이 중심의 elementFromPoint는 /mypage 링크였다. 실제 마이 클릭·이동 후 overlay가 제거됐다.
- 자동 종료 관찰3286ms 후 overlay가 제거되고 완료 배너는 유지됐다. 최종 분포 변경 뒤에도 자동 제거를 재확인했다.
- 동작 줄이기 설정 후 재진입은 완료 배너만 있고 입자가 없다. 실행 중 reduce 전환에도 제거되며 배너는 유지된다. 최종 CSS 재빌드에서 reduce=true 전환 직후 hiddenImmediately=true·bannerRemains=true를 확인해 listener 처리 전에도 정적 입자가 보이지 않는다.
- 설치 PWA·실제 토스앱·네이티브 실기기는 검증하지 않았다. 웹 공통 코드·화면과 네이티브 분기의 타입 검증이며 실제 토스 광고 동작을 검증한 것으로 해석하지 않는다.

## 인계

커밋·푸시·배포하지 않았다. 원본4327 서버에 최종 dist(cache149bda96fe13)를 반영했다. 테스트4330 서버는 SIGINT·exit130으로 종료했고 Ego task40은 keep:[]로 정리했다. 새 worktree/clone/전체 복사본은 만들지 않았다.
