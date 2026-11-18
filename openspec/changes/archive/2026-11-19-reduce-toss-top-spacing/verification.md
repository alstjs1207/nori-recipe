# 검증 — 토스 상단 여백 축소 및 파일 생성

## 요청과 범위

2026-11-19 사용자는 실기기 캡처의 큰 상단 빈 공간을 줄이고 새 .ait 파일만 만들도록 요청했다. 업로드는 사용자가 직접 한다. 원본 `/Users/msyu/study/play-recipe` preview134b72e를 사용하며 별도 worktree/clone은 없다.

현재 설정은 토스 불투명 공통 네비게이션이다. WebView shell에서 SDK top inset을 상단padding으로 다시 더하는 처리를 제거하고 --safe-top/상단padding을0으로 했다. SDK 값의 수신 자체·하단/좌우 inset은 유지한다. 기존 꽃32px·글자24px를 유지하면서 브랜드 상하padding을13→0px, 홈 링크 터치 높이를44px로 지정하고 본문 상단20→8px로 줄였다. 일반 웹CSS/코드·저장/추천/광고·하단5개 메뉴는 변경하지 않았다.

## 자동 검증

Node24.21.0·pnpm10.33.0의 verify:local 종료0. 명세·콘텐츠/이미지,307개 회귀(명세 도구8·토스7·단위145·검수27·등록12·놀이 저장15·재료 저장8·로컬 검수26·웹59), 타입·웹 빌드 통과. 공식 SDK3.10.0의 build:toss/check:toss도 종료0. .ait 3,950,568bytes, 비압축7,449,373bytes/458파일이며 SHA-256은 `f924a97a504f5fef77ceef793f8d8e99479ef9688393c4320cde8ff6cc29d90d`다. 공개 놀이 파생416개·재료66개를 기존 공개 객체 캐시에서 해시/크기/WebP로 확인했다. 모의 SDK·기밀·PWA를 제외한 번들 검사와 웹dist/index.html 보존을 확인했다.

## 모의 화면 검증

공식 Devtools localhost4194의 새 가상34개월 프로필에서 확인했다. 실제 토스 네이티브 네비게이션 영역을 화면 안에 중복 합성하지 않았으며 좌표는 WebView 내부 기준이다. 실기기에서 이미 정상화됐다고 해석하지 않는다.

- 320/393/768px × CSS inset top0/54/100의9가지 조합 모두 shell 상단padding0·헤더y0·높이45px. 브랜드 padding0, 홈 링크44px, 꽃32px·글자24px, 본문padding8px. 가로 넘침 없음. [측정](evidence/layout.json).
- 모든 조합에서5개 하단 메뉴 높이56px, bottom34px 조건의 메뉴 하단y818/viewport852로 유지됐다. 별도320px/left12/right8/top100 조건에서도 좌우12/8px·메뉴 하단818·헤더y0을 확인했다. [측정](evidence/side-bottom-insets.json).
- 마이로 이동한 후 브랜드 홈 링크를 실제 눌러 홈 복귀를 확인했다. [모의 화면](evidence/compact-home.png)은 SDK AIT 개발 버튼이 있는 QA용이며 콘솔 제출 스크린샷으로 쓰지 않는다.
- 브라우저 공간7은 keep:[]로 종료했고 모의4194 서버는 정상 종료했다. public/index.html과 놀이/재료 웹 manifest, 일반 public/web.css의 SHA-256이 시작 전과 같게 복원됐다.

## 산출물과 인계 경계

이전 콘솔20261118-6 파일은 generated/toss-home-navigation/test/에 유지한다. 새 파일은 테스트 광고 ID를 유지하고 별도 경로에 보존한다. 이번에는 콘솔 업로드·테스트 QR 생성·심사·출시를 수행하지 않으며 사용자가 업로드 후 실제 토스 화면을 확인한다. 이전 실기기 캡처의 공백이 새 버전에서 해소됐다는 실기기 검증은 미완료다. 원본 프로젝트/로컬4327 서버는 유지한다.

업로드 대상: `generated/toss-top-spacing/2026-11-19/test/nori-recipe.ait`. 루트 파일도 같은 SHA-256이다. SDK packaging deploymentId는 `01a1f0f8-4f6b-7889-b18d-244e36eeb71e`이며 콘솔 등록 버전/실행 QR을 생성한 것은 아니다. [빌드 보고서](evidence/build-report.json) · [소스 해시](evidence/source-provenance.json). 커밋·푸시·업로드는 수행하지 않았다.
