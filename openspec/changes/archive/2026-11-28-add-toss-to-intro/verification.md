# 검증 — 2026-11-28

- 원본 `/Users/msyu/study/play-recipe`, 기존 preview checkout에서 작업했다. 새 worktree·clone은 생성하지 않았다.
- Node24.21.0 / pnpm10.33.0의 `pnpm verify:local` 종료코드0. 명세·도구·콘텐츠·이미지 검증, 전체377개 테스트(실패0), 타입 검사, 웹 빌드를 통과했다.
- 최초 sandbox 실행은 tsx IPC listen EPERM으로 중단됐으며, 권한 확장 실행에서 전체 필수 검증을 완료했다.
- `pnpm spec:changed HEAD` 및 `git diff --check` 통과.
- ego-browser에서 로컬 웹 빌드 `/intro`를 확인했다. 320/390/860/1280px에서 document 너비가 viewport를 넘지 않았고 토스 버튼3개 모두48px 높이 및 공식 공유 링크 `https://minion.toss.im/F3OAPpVy`를 유지했다.
- 상단 ‘토스에서 이용’ 메뉴의 #toss 이동, 데스크톱/390px 모바일 안내 섹션의 화면, 설치 FAQ 펼침을 확인했다. 웹 시작2개와 /search 링크3개를 유지했다.
- 실제 토스앱 실행·공유 링크의 OS 전환은 데스크톱 UI 검증에 포함하지 않았다. 사용자 제공 링크를 그대로 사용했으며 공개 출시 상태를 새로 검증했다고 해석하지 않는다.
- 기존 정적 소개의 데이터 기반 숫자·화면 캡처·모션 축소·분석 미추가와 기기 저장 정책은 유지한다. 커밋·푸시·배포는 수행하지 않았다.
