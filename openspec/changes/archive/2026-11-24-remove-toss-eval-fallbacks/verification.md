# 검증 — 토스 eval 반려 수정

2026-11-24, 원본 /Users/msyu/study/play-recipe, preview의 c0f9ec3 기반 로컬 수정. Node24.21.0 / pnpm10.33.0. 새 worktree/clone을 만들지 않았고 커밋·푸시·웹/콘솔 배포는 실행하지 않았다.

## 원인과 수정

기존 2026-11-24 테스트/운영 .ait의 내부 ZIP을 직접 읽어 각 eval2곳을 확인했다. Expo Modules Core3.0.30의 src/uuid/index.web.ts에서 eval('require')로 Node crypto를 읽는 서버 경로, Expo54.0.35의 src/async-require/fetchThenEvalJs.ts에서 eval(body)를 호출하는 서버/개발 경로다. 앱 자체 코드에는 eval 호출이 없었다.

토스 배포 웹 빌드에만 Babel AST 플러그인을 적용해 UUID의 Node fallback과 fetchThenEval.web의 SSR/개발 fallback을 제거했다. 실제 브라우저의 crypto.randomUUID 반환과 UUID v5/namespace·브라우저 script loader는 유지했다. 의존 그래프에서 개발 loader를 제외하므로 원래 eval 파일이 번들에 들어오지 않는다. 원본 파일의 예상 구조가 달라지면 실패한다. node_modules 직접 수정·문자열 난독화·출력 후 eval 이름 치환은 하지 않았다.

## 자동 검증

- 강화된 check:toss가 기존 dist-toss의 eval을 실제로 거부했다.
- pnpm test:toss13개 통과: 실제 설치 Expo 소스의 변환 후 UUID/DOM loader 실행, v5/namespace 보존, native/web/Devtools 분리, upstream 구조 변경 차단, 직접/간접/속성/이스케이프 eval·Function 생성자, 주석·문자열과 inline script 검사.
- pnpm verify:local 통과: 전체353개(8+13+176+27+12+15+8+26+68), 명세·콘텐츠·이미지·타입·웹 빌드.
- 테스트/운영 각각 공식 SDK3.10.0 포장 및 check:toss 통과. 공개 이미지416+66개를 해시/크기/WebP로 검증했다. 두 .ait 내부 sources/*.js에서 eval0개·Function 생성자0개를 직접 재확인했다.
- 일반 웹 build:web은 기존과 같은 entry-a2110ccdc8858fbe8ea7a72d8f4fe2c9.js를 생성했다. public/index.html·두 웹 이미지 manifest·dist/index.html은 시작 전 SHA-256과 동일하다.
- pnpm spec:index 및 spec:changed HEAD·git diff --check 통과. 완료 archive와 완료 기록 정리 후 최종 spec:check·spec:changed HEAD·git diff --check도 통과했다.

처음의 loader 실행 테스트는 DOM mock에 setAttribute가 없어 실패했고 mock을 실제 DOM API에 맞춘 뒤 통과했다. 최초 전체 명세 검사는 기존 add-toss-completion-ad의 전체 TOSS-006 delta에 새 시나리오가 없어 실패했다. 해당 delta를 현재 명세와 동기화한 뒤 전체 검증을 통과했다. 실제 과거 검증 기록은 덮어쓰지 않았다.

## 산출물과 경계

- test: generated/toss-eval-fix/2026-11-24/test/nori-recipe.ait, 3958776bytes, SHA-256 548b0a1a4bfb5b82025c7bd27ccb22884acf241fb16650a3f761b5e83ccf93be.
- production: generated/toss-eval-fix/2026-11-24/production/nori-recipe.ait, 3959205bytes, SHA-256 6d5d988de47fe97c80fdfa116c8b842b6d8a55e90c41f235339ae9ec58f9d89d.

이전 반려 대상 파일은 generated/toss-home-rounds/2026-11-24에 그대로 보존했다. 내부 압축 파일 감사 근거는 새 폴더의 packaged-code-audit.json, 소스 해시/회귀와 원본 보존은 source-provenance.json에 보존했다. 실제 토스앱 QR·광고·콘솔 검수 승인은 새 파일을 올린 뒤 확인해야 하며 이번 자동 검사 통과와 구분한다.

공식 안내: https://techchat-apps-in-toss.toss.im/t/eval/3671
