# Verification — 2026-11-25

원본 `/Users/msyu/study/play-recipe`, preview checkout. 별도 clone/worktree를 만들지 않았다. 커밋·푸시·배포·토스 콘솔 업로드는 수행하지 않았다.

## 자동 검사

- Node24.21.0, pnpm10.33.0, `pnpm verify:local` exit0.
- 370개 테스트: spec-tools8 + Toss13 + TypeScript 단위193 + play-review27 + image-registration12 + play-image-storage15 + material-image-storage8 + local-review26 + web68. 모두 실패0.
- 새 스프링 회귀6개는 30/60/120fps 수렴·아이콘 overshoot·빠른 선택/재선택·자동 순환 없음·즉시 finish·긴 프레임1/30초 제한을 검사했다.
- 콘텐츠/이미지 검사, 타입 검사, 웹 빌드 통과. 마지막 CSS 안전 영역 보완 후 동일 verificationEnvironment로 `pnpm build:web`를 다시 실행해 exit0 확인. 최종 웹 cache `98705faf8312`, 208개 공개 놀이 경로.
- WEB-006/TOSS-003 현재 명세·활성 토스 delta·policy-map 동기화. source-index의 신규3개 파일은 공통 웹 컴포넌트 분류인 web-platform으로 생성·확인했다. 토스 정책 근거에도 공통 소스/스프링 테스트를 연결했다.

## 실제 브라우저

Ego-browser TaskSpace130에서 원본을 먼저 읽고 확인한 뒤 임시 `127.0.0.1:4329`의 실제 최종 웹 번들을 검사했다. 기존 QA guest fixture를 사용했으며 사용자 데이터 초기화나 테스트 로그 추가는 하지 않았다.

| 확인 | 결과 |
| --- | --- |
| 393px 메뉴 선택 모션 | 마이 선택 중30개 샘플에서27개 움직이는 프레임·17개 서로 다른 라벨 너비, 아이콘 scale .827771→1.14054→1 확인. 강조 배경은 선택 링크 위치·너비에1px 이내로 수렴하고 프레임 정지. [샘플](motion-samples.json) |
| 실제 다섯 링크 | 발견/탐색/저장/기록/마이페이지 이동, aria-current·접근성 이름·선택 라벨 일치 |
| 복귀·재선택 | 브라우저 뒤로 저장/앞으로 마이 선택 복원. 기록 재선택 시 실제 스크롤200→0. Enter로 탐색 이동 확인 |
| 별칭 | /settings→마이페이지, /history→기록, /start→발견 선택 |
| 상세 숨김 | /play/play_013에서 하단 메뉴 없음 |
| 반응형 | 320px에서 최소45.95×56px·가로 넘침 없음. 800px 하단 표시/헤더 숨김, 801·1280px 하단 숨김/기존 헤더 표시. 각 폭에서 document 너비 일치 |
| 모션 축소 | reduce에서 선택 라벨만32.2344px, 나머지0, 모든 아이콘 scale1, data-animating=false, 색상 transition0s |
| 토스 CSS 안전 영역 모의 | 320px + 좌12/우16/하단34px: 바292px, 최소45.14×56px, 하단34px, 링크/문서 넘침 없음. [측정](safe-area.json) |
| 개발 서버 | 기존 localhost:8081/record에서 새 하단 바·5개 링크·기록 선택을 확인. 기존 서버는 유지 |

최종 [320px 화면](mobile-320.png)과 [1280px 화면](desktop-1280.png)을 시각 확인했다. 브라우저 작업 공간은 종료하고 직접 실행한4329 임시 서버만 종료했다.

## 검증 경계

토스의 CSS/안전 여백은 일반 브라우저에서 모의 적용했다. 실제 토스 호스트·QR iOS/Android·콘솔/심사 결과로 표시하지 않는다. 이번 변경의 새 .ait 파일 생성이나 업로드는 하지 않았다. 기존 토스 eval 제거·빌드 가드와 관련13개 회귀는 유지된다. 일반 웹의 서버 UUID/개발 로더 분기를 변경하지 않는다.

완료 검사: `pnpm spec:changed HEAD`, `pnpm spec:check`, `git diff --check` 통과. 현재 명세와 두 delta의 전체 요구사항 일치를 확인한 뒤 `pnpm spec archive add-animated-bottom-bar --skip-specs --yes`로 완료 change를 보존했다.
