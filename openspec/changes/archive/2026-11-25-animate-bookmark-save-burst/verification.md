# Verification — 2026-11-25

원본 `/Users/msyu/study/play-recipe`의 기존 preview checkout에서 작업했다. 별도 worktree/clone은 만들지 않았다. 시작 시 작업 트리는 깨끗했고 기존 로컬 커밋2개가 origin/preview보다 앞서 있었다. 기존 커밋을 변경하거나 푸시하지 않았다.

## 자동 검사

- Node24.21.0, pnpm10.33.0에서 `pnpm verify:local` exit0.
- 376개 테스트: spec-tools8 + Toss13 + TypeScript199 + play-review27 + image-registration12 + play-image-storage15 + material-image-storage8 + local-review26 + web68. 모두 실패0.
- 신규 스프링 회귀6개:30/60/120fps 수렴·overshoot·idle 정지, 빠른 저장/취소, reduced-motion finish, 긴 프레임 cap,8개 점의 반경·축소·550ms 소멸.
- 콘텐츠·이미지·타입·웹 빌드 통과.208개 공개 놀이 경로, cache5658e00bc706. 빌드의 임시 이미지 manifest는 정상 복원됐으며 콘텐츠와 공개 매니페스트에 최종 변경은 없다.
- 신규3개 소스를 `pnpm spec:index`로 web-platform에 분류했다. `pnpm spec:changed HEAD`와 `git diff --check` 통과.

## 실제 브라우저

Ego TaskSpace133에서 원본을 읽고 최종 정적 빌드를 `http://127.0.0.1:4331`로 실행했다. 이 새 로컬 origin의 QA 게스트만 사용했으며 사용자 기존/운영 저장소는 변경하지 않았다.

- 탐색의 저장 클릭 후 aria-pressed=true, 기존 bookmark SVG path 유지, 버튼44×44px, 페이지 이동 없음.8개 점을 확인했다.
- 새로고침 뒤 저장 상태 유지·초기 로딩에서 점0개.
- Enter로 취소, Space로 저장. 취소 실제 프레임에서 y scale .85→1.08475→1 및 채움100%→0%, 점0개 확인. `cancel-samples.json`.
- 실제 상세 저장50프레임·서로 다른 transform32개, 점 최대8개·최종 scale(1,1)/fill100%/점0개 확인. `save-samples.json`. 프레임 기록은 브라우저 백그라운드 제한을 포함하므로 기록 전체 벽시계 길이를 애니메이션 지속 시간으로 해석하지 않는다. 원본 적분 시간 cap을 유지한다.
- 393px 상세 스크린샷을 직접 확인했다. 기존 북마크·보라색·44px 원형 버튼 유지, 점의 body portal·기존 detail-art overflow:hidden을 함께 확인했다. `mobile-saved.png`는 실제 저장 중 화면이다.
- 320px 탐색 가로 넘침 없음·버튼44×44px 확인. 데스크톱 탐색에서도 기존 레이아웃·북마크 유지.
- prefers-reduced-motion=reduce에서 Space 저장 후 즉시 scale(1,1)/fill100%/점0개.
- QA localStorage의 favorites 쓰기만 일시 실패시키고 취소 클릭: aria-pressed=true 유지·점0개·기존 실패 안내 확인. 즉시 원래 Storage.prototype.setItem으로 복구했다.
- 저장 목록에서 취소해 카드가 사라진 뒤 북마크 버튼0개·portal0개. 최종 상세는 미저장 상태로 돌려 사용자가 직접 클릭할 수 있게 했다.

## 인계와 경계

로컬 결과 상세 탭과4331 서버는 사용자 확인용으로 유지한다. 기존 서버/다른 채팅 작업은 변경하지 않았다. 커밋·푸시·외부 배포·새 .ait 생성은 수행하지 않았다. 기존 웹/PWA/토스 공통 DOM에 적용했으며 실제 토스 호스트·네이티브 실기기 검증으로 표시하지 않는다.

완료 change의 WEB-007 delta와 현재 명세가 일치하는지 확인한 뒤 `pnpm spec archive animate-bookmark-save-burst --skip-specs --yes`로 보존했다. archive 후 `pnpm spec:check`·`pnpm spec:changed HEAD`·`git diff --check`도 통과했다.
