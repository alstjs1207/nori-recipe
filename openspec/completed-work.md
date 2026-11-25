# 완료된 기능과 근거

2026-11-09 기준 `4413901`의 현재 코드와 Git 이력으로 대조한 목록이다. 원래 작업을 이번에 새로 수행했다는 의미가 아니며 과거의 운영 배포·실기기·테스트 성공을 추정하지 않는다. 해당 기능의 현재 계약은 specs/, 이번 재실행 결과는 baseline-audit.md에서 확인한다. 커밋은 `git show <sha>`로 조회한다.

| 완료 범위 | 이력 근거 | 현재 코드·명세 |
| --- | --- | --- |
| 로컬 게스트·월령/재료 온보딩, 찜·완료·기록 | `229ff2c`, `8dcf914` 이전 MVP와 후속 보강 포함. 특정 최초 완료일은 추정하지 않음 | sessionStore, db/queries, app/(onboarding), onboarding/play-records/local-data |
| 서버 동기화 대비 메타데이터·소프트 삭제 | `e67be72` (2026-06-25) | db/schema의 migration 3, queries의 활성 조회·tombstone. 서버 동기화는 미완료 |
| 공개 콘텐츠 저장소 포함·웹/PWA·개별 공유 | `5b92666`, `c23b336` (2026-10-07) | build-web, web/html, service-worker, web-platform |
| 모바일 웹 디자인과 이미지 표현 | `6c80ab7`, `8283721` (2026-10-08) | components/web, app의 .web.tsx, web-platform/catalog |
| 콘텐츠 정리·NEW·캐시 해시 | `eb96279`, `7ca05ae`, `42b2c5c` (2026-10-10~13) | play/newPlay, prepare-web-assets, content-review/catalog |
| 별도 동의 GA4·동의 안내·Preview 시뮬레이션 | `d0579e3`, `cc5fe37`, `779af5d`, `a2a6345` (2026-10-10~14) | analytics/client·policy·invitation·adapter, privacy |
| 별점·선택 반응·동의 후 기존 피드백 소급 | `5006fa4` (2026-10-15) | analytics/feedback, play/feedbackSignals, privacy/play-records |
| 수집·정규화·이미지 준비·HTML 검수·로컬 스튜디오 | `8310d3e`, `f0bd89c` (2026-10-15) | scripts/review, tools/local-review, .claude/skills, content-review/local-studio |
| 검수 승인 콘텐츠 추가 | `3b12f17` (2026-10-17) | data/plays.json과 review-batches. 전체 현황 숫자는 baseline-audit의 현재 계산값 사용 |
| 준비 완료 재료 의도·조건부 상위 월령 | `ca8ba0e` (2026-10-18) | engine/intentRecommendation·intentSignals·intentCatalog, recommendations |
| 추천 실험실·사용안함·검수 정리 | `ea458a2` (2026-10-22) | tools/local-review/recommendation-model·service, local-studio |
| PWA 설치를 설정으로 이동 | `c2246f7` (2026-10-22) | WebInstall, settings.web, web-platform |
| 서비스 소개 README·대표 공유 이미지·www 운영 도메인 | `74bdf17`, `2335559`, `46e3a7d`, `b71e73d` (2026-10-28~11-06) | README, scripts/web/html, vercel, web-platform |
| 최신 시작 화면 그림 | `4413901` (2026-11-06) | assets/nori-welcome-hero-boy-20261106-v6.png, welcomeImageVersion, web-platform |

OpenSpec 최초 도입 자체의 완료 작업·검증은 `changes/archive/2026-11-09-establish-spec-management/`에 보존한다. 기존 기능별 가짜 과거 change나 당시 검증 결과를 만들지 않는다.

## 후속 완료 기록

### 2026-11-10 PWA 화면·상세 복귀·생년월 및 탐색 월령 휠

첫 방문의 공통 하단 메뉴와 iOS 안전 여백 보완, 상세에서 원래 탭으로 복귀, 생년월의 년·월 휠과 개월수 자동 계산, 탐색의 독립 월령 휠을 구현했다. `23a391e`·`98f98b6`·`4c35b10`·`6f6da68`을 거쳐 preview·main과 운영 배포를 마쳤다. 로컬 211개 회귀·타입·빌드, preview/main CI 및 배포 확인에 더해 2026-11-10 사용자가 실제 iPhone 앱의 상하단·회전·설치 모드·입력·뒤로가기 정상 동작을 확인했다.

사용자 완료 요청으로 기존 작업중 지정을 해제했다. [완료 태스크](changes/archive/2026-11-10-fix-pwa-navigation-birth-month/tasks.md) · [검증 기록](changes/archive/2026-11-10-fix-pwa-navigation-birth-month/verification.md). 실기기 근거는 사용자 보고이며 기종·iOS 버전은 별도로 수집하지 않았다.

### 2026-11-13 서비스 소개 페이지 `/intro`

앱과 분리된 정적 소개 페이지를 웹 빌드에서 생성한다. 놀이·재료·월령·발달영역 수치는 빌드 시점 데이터에서 계산하고, 화면은 실제 서비스 웹 캡처를 해시 WebP로 제공한다. 월령·재료 미리 찾아보기 데모와 숫자 세어 올리기·막대 채우기·스크롤 등장·데모 결과 전환 효과(동작 줄이기·스크립트 미실행 시 미적용)를 포함한다. `b1a84cf`·`4dd31f2`를 preview에 반영하고 사용자 Preview 확인 후 main fast-forward로 운영 배포했다. 로컬 217개 회귀·타입·빌드, preview/main CI·배포, 운영 `/intro` 응답과 headless Chrome 확인을 마쳤다.

[완료 태스크](changes/archive/2026-11-13-add-intro-landing-page/tasks.md) · [검증 기록](changes/archive/2026-11-13-add-intro-landing-page/verification.md). Preview 화면 확인 근거는 사용자 보고다.

### 2026-11-15 놀이 이미지 Supabase Storage 웹 이관

원본224개를 비공개 보존하고 승인 live208개 놀이의 상세/썸네일416개를 공개 자산으로 제공한다. 다운로드 SHA-256·접근 제어를 검증했고 로컬 원본은 유지하면서 Git 추적만 제외했다. 웹·공유·소개는 같은 매니페스트의 버전 URL을 사용한다. 기본 PWA 셸·CORS 방문 이미지 캐시80개·선택 업데이트와 사용자 로컬 데이터·기존 승인·GA4 정책을 유지했다.

구현 커밋1906483·d0bb441, preview/main의 원본 없는 CI256개 테스트·공개416개 검증과 Vercel 운영배포FuaYGqvGu2nCJ2bU65PxBzi3woVk Ready를 확인했다. 운영 HTTP6개 공유 체인·제외/오류4개404, 이미지960px·canonical/OG·새 버전 선택 후 실제 CORS 캐시 해시를 검증했다. 사용자가2026-11-15 실제 링크 공유의 정상 표시를 확인하고 완료 정리를 요청했다. 플랫폼·기종은 수집하지 않았다.

[완료 태스크](changes/migrate-play-images-to-supabase-storage/tasks.md) · [최종 검증](changes/migrate-play-images-to-supabase-storage/verification.md) · [관리·재료 후속](follow-ups/play-image-operations.md). 관리 복원 UI·전체 실제 복원/롤백·서비스 내 추가 제공처 고지는 미완료 후속으로 유지하고 네이티브는 사용자 결정으로 제외한다. 공개 매니페스트가 실제 빌드 입력이므로 이번에는 change 경로를 유지하며 archive 이동은 하지 않는다.


### 2026-11-16 재료 이미지 Supabase Storage 이관 — Preview 완료

실제 JPEG67개를 비공개 보존하고 승인 매핑66개만192px WebP로 공개한다. 미매핑1개는 비공개만, 검수 대기5개는 브랜드 기본 표시를 유지한다.133개 업로드/다운로드 SHA와 원본 전체 복원·재실행 신규 생성0개·공개66개 CORS/익명 GET·원본67개 차단·임시 객체로 익명 쓰기/삭제 차단을 확인했다. 검증 JPEG67개만 Git 제외하고 로컬 놀이224개/재료67개·데이터/검수/매핑·DB/분석 등317개 해시를 보존했다.

구현0183e28을 preview에 푸시했다. 로컬 Node24.21.0·원격 CI Node24.22.2/pnpm10.33.0에서266개 회귀·타입·원본 없는 실제 공개482개 빌드 성공, Vercel Cr1LM2Kvg36vKvk37EtHAGAjrM3E Ready·실제 재료 표시/공유OG/소개·CORS 캐시44개 해시/분석 미전송을 확인했다. 오프라인 방문 재료와 기본 start/설정 안내는 로컬 실제 브라우저에서 검증했다. 임시 서버·최소 소스 fixture를 정리했다. 기존 놀이 동작·main d0bb441/운영93f47b0b481b는 유지한다.

[태스크9/9](changes/migrate-material-images-to-supabase-storage/tasks.md) · [검증](changes/migrate-material-images-to-supabase-storage/verification.md). CI/Preview가 공개 매니페스트를 change 경로에서 읽으므로 archive 이동은 하지 않는다. main 병합/운영 배포·네이티브·기존 관리 UI 복원/전체 놀이 롤백·서비스 고지 후속은 이번 완료에 포함하지 않는다.

### 2026-11-16 승인 이미지의 Supabase 등록 파이프라인 — 로컬 구현

스튜디오 선택 승인과 CLI `--write`가 기존 검수 평가 후 비공개 JPEG·공개 WebP를 전송하고 다운로드 해시·익명 공개 읽기를 검증한 뒤 등록 상태·공개 등록 기록·재료 소스 해시를 같은 복구 가능한 거래로 반영한다. 전송 실패·동시 변경에는 초안을 보존한다. 기존 이관 기록은 유지하고 새 등록 기록을 공개 빌드에서 합친다. 수집/이미지 스킬과 로컬 키·재시도 문서를 갱신했다.

Node24/pnpm10.33.0에서 전체278개 회귀·타입·웹 빌드를 통과했다. 실제 키가 미설정이므로 새 원격 등록·배포를 검증한 것은 아니다. 최초 구현 당시 커밋·푸시·배포는 하지 않았다. [구현/태스크](changes/register-approved-images-to-supabase/tasks.md) · [검증과 한계](changes/register-approved-images-to-supabase/verification.md).

### 2026-11-16 스튜디오 신규 놀이 사용 가이드

사이드바의 사용 가이드(`/guide`)에 수집 요청 → 검수 화면 → 새 재료 검수 → 놀이 승인과 Supabase 업로드 → Preview/운영 반영을 안내한다. 사용자 요청으로 일회성 키 설정을 제외하고 수정 요청·이미지 준비·실패 재개 방법과 메뉴 바로가기를 제공한다. 데스크톱·모바일 화면과 메뉴/도움말 동작, 전체278개 회귀·타입·웹 빌드를 확인했다. 기존 스튜디오 프로세스는 유지했으며 재시작 후 새 메뉴가 반영된다. [태스크](changes/add-studio-registration-guide/tasks.md) · [검증](changes/add-studio-registration-guide/verification.md). 최초 구현 당시 커밋·푸시·배포는 하지 않았다.


### 2026-11-17 토스 미니앱 핵심 기능 출시 준비

기존 웹/PWA·저장 키·배포 흐름을 유지하면서 사용자 지정 appName `nori-recipe`의 독립 WebView SDK3.10.0 런타임·사용자별 기기 저장·토스 공유·내비게이션/안전 영역·플로팅 탭·AI 및 개인정보 고지를 구현했다. 로그인·결제·광고·서버 백업은 추가하지 않았다.

Node24.22.1/pnpm10.33.0에서 기존 작업과 함께291개, 토스 커밋 범위만 분리한 상태에서279개 회귀·타입·웹 빌드 및 실제 토스 `.ait` 빌드를 통과했다. 비압축7.43MB·아티팩트3.94MB, 승인 공개 이미지482개 무결성을 확인했다. 공식 모의 SDK에서 월령·추천·찜·기록 저장/복원·공유 링크 생성/복사·전체 초기화를 확인하고 로고·콘솔 입력 정보·636×1048 참고 화면3장을 준비했다. 실제 토스앱 핵심 동작·심사·출시는 미검증이다. [태스크](changes/add-toss-miniapp/tasks.md) · [검증](changes/add-toss-miniapp/verification.md) · [출시 안내](../docs/toss-miniapp.md). 운영 배포는 하지 않았다.

### 2026-11-17 이미지 등록·스튜디오 가이드 통합 검증

사용자의 preview 커밋·푸시 요청에 따라 앞서 로컬에 남겨 둔 승인 이미지 Supabase 등록 파이프라인과 신규 놀이 가이드의55개 파일을 반영 대상으로 확인했다. 원본 checkout에서 Node24.22.1/pnpm10.33.0으로 토스 기능을 포함한 전체291개 회귀·명세·타입·공개482개 자산 검증·실제 웹 빌드를 통과했다. API 키·실제 .env·원본 이미지·빌드 산출물을 제외했다. 실제 신규 이미지 승인/전송과 운영 배포는 수행하지 않았다. [등록 검증](changes/register-approved-images-to-supabase/verification.md) · [가이드 검증](changes/add-studio-registration-guide/verification.md).

### 2026-11-18 토스 공통 상단 정리

사용자 요청으로 토스 대상의 가족 요약·월령 단축 버튼과 공통 AI 안내 문단을 제거했다. 그림 AI 라벨과 설정 고지, 하단 내 설정을 통한 월령 수정, 일반 웹 헤더와 저장 데이터는 유지했다. Node24.22.1/pnpm10.33.0에서 전체291개 회귀·타입·웹/토스 빌드와 공식 모의 SDK 화면 확인을 통과했다. 새 테스트 업로드는 네트워크 인증서 오류로 미완료이며 실제 기기 확인은 남아 있다. [태스크](changes/simplify-toss-top-area/tasks.md) · [검증](changes/simplify-toss-top-area/verification.md). 최초 UI 수정 시점에는 커밋·푸시·공개 출시를 하지 않았다.

### 2026-11-18 NEW 배지 90일 연장

CAT-003을 생성일 한국 자정부터 고정90일로 변경했다. 배지·신규 우선 정렬·분석 신규 판정은 공통 유틸을 사용한다. 전체290개 회귀와 타입·공개482개 이미지 검증·웹 빌드, 추가 사례를 포함한 날짜·검색18개 회귀 및 Preview NEW32개 표시를 확인했다. 사용자 요청에 따라 preview와 main에 반영한다. [변경 및 검증](changes/archive/2026-11-18-extend-new-play-badge-to-90-days/verification.md).

### 2026-11-18 토스 이미지 AI 라벨 제거와 버전 등록

사용자 요청으로 이미지별 AI 라벨을 제거하고 이용 안내의 AI·안전 설명을 유지했다. NEW90일이 포함된 구현30483e2의 전체291개 회귀·타입·웹/토스 빌드와 모의 화면을 확인했다. 네트워크 전환·재로그인 후 버전20261118-4를 콘솔에 등록했고 서버 빌드 완료·검토 필요 상태·테스트 QR/실행 주소를 확인했다. 실제 토스 기기·심사 요청·정식 출시는 별도다. [검증 기록](changes/archive/2026-11-18-move-toss-ai-disclosure-to-guide/verification.md).

### 2026-11-18 토스 기존 크기 브랜드 헤더 복원 — 로컬 파일 생성

사용자 요청으로 꽃 로고·노리레시피를 기존 크기(모바일32px/24px)로 복원하고 상단 안전 영역의 중복을 피하면서 본문 여백을20px로 맞췄다. 전체291개 회귀·타입·웹/토스 빌드와393×852 모의 화면·일반 웹 크기 대조를 통과했다. `.ait`와 미리보기를 output에 보존했다. 2026-11-18 후속 요청에 따라 동일 변경과 검증 기록을 preview에 커밋·푸시한다. [실행 검증](changes/archive/2026-11-18-restore-toss-brand-header/verification.md).

### 2026-11-18 홈 추천 묶음·완료 표시·기록 스크롤 — 로컬 검증 완료

웹/토스 공통 홈의 추천 큰 카드와 작은 카드2개를 공통 제목·완료 개수 아래 연속 배치하고, 상황별 탐색을 세트 뒤로 이동했다. 완료 추천은 흐린 그림과 `놀이 완료` 도장으로 구분한다. 놀이 ID별 기록 스크롤 컨테이너를 새로 구성한다. 추천 순위·고정 세트·로컬 완료 이력은 유지하며 같은 재료의 완료 놀이 재등장도 현재 보충 규칙으로 확인했다.

Node24·pnpm10.33.0에서 verify:local의298개 회귀·타입·웹 빌드 통과. 실제 로컬 브라우저에서390px/1512px 배치,1/2/3개 완료·축하·고정ID, 다른 놀이 기록의416.5px→0px 개선을 확인했다. 네이티브 실기기·실제 토스앱·운영 배포는 포함하지 않는다. 원본 checkout에서 작업했으며 커밋·푸시하지 않았다. [완료 태스크](changes/archive/2026-11-18-improve-home-recommendation-feedback/tasks.md) · [검증 기록](changes/archive/2026-11-18-improve-home-recommendation-feedback/verification.md).

### 2026-11-18 꽃 로고 완료 도장 — 로컬 검증 완료

사용자 요청으로 추천 카드의 완료 표시를 꽃 로고·참 잘했어요·놀이 완료가 들어간 투명 원형 SVG 도장으로 교체했다. 기존 로고 도형을 그대로 재사용하며 브랜드 보라색과 작은 잉크 질감을 사용한다. 기본 오프라인 셸에 도장을 포함했다. 추천/기록/광고 정책은 유지한다. 전체298개 회귀·타입·웹 빌드, 최종 캐시 변경 후 웹59개 재검증 및390px/1512px 실제 브라우저 확인을 완료했다. 커밋·푸시·배포 없이 로컬 서버4327을 유지한다. [검증 기록](changes/archive/2026-11-18-add-brand-completion-stamp/verification.md).

### 2026-11-18 대표 추천 도장 hover 이동 수정 — 로컬 검증 완료

사용자 보고로 좁은 화면의 대표 이미지 hover CSS가 도장까지 선택해 transform을 해제하는 결함을 재현했다. 이미지 전용 선택자3곳에서 도장을 제외했다. 실제390/700/800/801/1512px에서 각3회 포인터 진입·이탈의 상대 위치·크기·transform 일치와 상세 링크 동작을 확인했다. 전체298개 회귀·타입·웹 빌드 통과. 커밋·푸시·배포 없이 로컬 서버4327을 유지한다. [검증 기록](changes/archive/2026-11-18-fix-featured-stamp-hover/verification.md).

### 2026-11-18 새 진입 상단·목록 복귀·미저장 초안 보존 — 로컬 완료

전수 감사 후 사용자 승인 기준으로 웹/PWA/토스 공용 화면과 네이티브 외곽 스크롤에 진입 의도를 적용했다. 새 링크/탭 진입은 상단, 뒤로 목록 복귀는 검색 조건과 위치를 유지한다. 상세의 새 진입은 기본 탭이며 미저장 기록은 guest/놀이별 앱 세션 초안으로 분리해 이동·다른 놀이 저장에 지워지지 않는다. 성공한 제출 버전만 정리하고 실패/진행 중 새 입력은 보존한다. 프로필·개인정보 목적 위치도 DOM 준비 후 처리한다.

반복 방문을 지우던 Tabs history가 브라우저 URL을 replace해 직전 목록을 건너뛰는 원인도 확인해 fullHistory로 전환했다. 설치된 실제 TabRouter의 반복 방문 회귀를 포함한307개 테스트·타입·웹 빌드를 통과했다. 모바일 복합 필터/250px 복귀2회, 찜250px·기록454px 복귀, 설정/새 검색0px, 다른 놀이 저장 후 A 초안 유지 등을 최종 빌드에서 확인했다. 네이티브는 공통 분류/타입/소스 확인이며 실기기는 미검증이다. 영구 초안/서버 동기화는 추가하지 않았다. 커밋·푸시·배포 없이 원본 checkout·4327 서버를 유지했고 검증4330 서버/브라우저는 종료했다. [완료 태스크](changes/archive/2026-11-18-clarify-screen-entry-scroll/tasks.md) · [최종 검증](changes/archive/2026-11-18-clarify-screen-entry-scroll/verification.md).

### 2026-11-18 상단 월령 버튼 아바타 제거 — 로컬 완료

사용자 승인대로 일반 웹/PWA 상단 월령 버튼의 사람 아이콘·이름 첫 글자·흰색 원을 제거하고 월령 문구/화살표만 유지했다. 여백과 최소 높이를 조정해23개월 버튼의 변경 전/후120.90625×41px 및 모바일 터치 영역이 동일하다. 빈 여백 클릭·키보드 Enter의 설정 이동, 미설정 월령 문구를 실제 확인했다. 전체307개 회귀·타입·웹 빌드를 통과했고4327 서버에 반영했다. 기존 프로필 데이터·토스 헤더·네이티브는 유지하며 커밋·푸시·배포하지 않았다. [검증 기록](changes/archive/2026-11-18-simplify-header-age-button/verification.md).

### 2026-11-18 마이5번째 메뉴·홈 월령 안내 — 로컬 완료

사용자 승인으로 상단 월령 버튼을 제거하고 발견·탐색·저장·기록·마이5개 주 메뉴로 정리했다. 모바일 하단 오른쪽/데스크톱의 마이는 기존 설정으로 연결되며 /settings에서도 선택 표시한다. 홈 제목 아래 실제 월령을 표시하고 네이티브 기존 메뉴도 마이로 줄였다.320px에서 각60×56px,360px에서68×56px,390px에서74×56px로 겹침/가로 넘침 없이 배치됨과5개 탭·여백 클릭·키보드·미설정 첫 방문·상세/피드백 하단 숨김을 실제 확인했다. 전체307개 회귀·타입·웹 빌드를 통과했고4327 서버에 반영했다. 기존 데이터·추천 정책을 유지하며 커밋·푸시·배포하지 않았다. [검증 기록](changes/archive/2026-11-18-move-profile-to-main-navigation/verification.md).

### 2026-11-18 추천 전체 완료의 화면 전체 폭죽 — 로컬 완료

완료 배너에 갇히던 폭죽을 document.body의 고정 포털로 옮겨72개 입자를 화면 전체에 분산했다. 약3.3초 후 자동 제거하며 홈 이탈·동작 줄이기 전환에 정리하고 포인터/키보드 조작을 막지 않는다. 완료 배너·도장·고정 추천·기록·광고 정책은 유지한다. 전체307개 회귀·타입·웹 빌드 통과 후 입자 분포/접근성 CSS 최종 조정의 타입·빌드도 통과했다. 별도4330 origin에서 실제 마지막 추천 저장,390×844/1512×900 전체 범위,600px 스크롤·마이 클릭·자동 종료·동작 줄이기를 확인했다. 최종4327 빌드를 유지하고 테스트4330 서버·브라우저는 종료했다. 원본 checkout을 사용했고 커밋·푸시·배포하지 않았다. [검증 기록](changes/archive/2026-11-18-fullscreen-completion-confetti/verification.md).

### 2026-11-18 홈·완료·화면 이동 개선 일괄 preview 반영

후속 사용자 요청으로 이번 대화의 로컬 완료 변경 전체를 preview에 커밋·푸시한다. 추천3개 묶음·로고 도장·hover 고정·화면 전체 폭죽, 새 진입 상단/뒤로 목록 위치 복구, 앱 세션의 미저장 피드백 보존, 상단 월령 제거·하단 마이와 홈 월령 안내 및 각 명세·검증 근거를 포함한다. 원격 preview6f8e461과 로컬 기준이 일치함을 fetch/ls-remote로 확인했고 Node24.21.0·pnpm10.33.0의 verify:local307개 테스트·타입·웹 빌드를 다시 통과했다. spec:changed origin/preview·git diff --check도 통과했다. 실제 Vercel Preview 결과는 이번 푸시의 GitHub 배포 상태에서 확인하며 main/Production은 변경하지 않는다. 기존 원본 checkout을 재사용했고 정리 대상 worktree/clone은 만들지 않았다.

### 2026-11-18 최신 개선 토스 .ait·콘솔20261118-6 등록

사용자 요청으로 preview da5f30c의 홈·도장·전체 화면 폭죽·화면 진입/복귀·미저장 기록·마이 개선을 토스 테스트 번들로 패키징해 노리공방/nori-recipe에 업로드했다. 토스5개 플로팅 메뉴는 동일 너비·56px 높이로 보완했고 통합 검증에서 발견한 대표 이미지 지연 로드의533→886px 복귀 밀림은1:1 공간 확보로 수정해4회533px 복귀를 확인했다. 비활성 화면의 스크롤 저장도 차단한다.

최종 verify:local307개·타입·웹 빌드와 공식 SDK3.10.0 토스 빌드/검사 통과. .ait3,950,505bytes, SHA-256 a8ad0f433c01f6f40572dc6f4910faf745a3f0671b0407952be9a4f5b2055d5e. 콘솔 버전20261118-6의 서버 빌드·검토 필요·테스트 QR 및 deploymentId01a1ee4d-83c5-7f68-b1b5-56ac7f64ada9 일치를 확인했다. 테스트 광고 ID이며 실기기·실제 광고·심사 요청·공개 출시는 미수행이다. 원본 checkout과 최신 테스트/이전 운영 번들을 보존하며 모의4193 서버는 종료했고 QR 콘솔만 남겼다. [검증·등록 근거](changes/archive/2026-11-18-prepare-updated-toss-upload/verification.md).

### 2026-11-19 토스 상단 여백 최소화 — 업로드용 파일 생성

사용자 실기기 캡처와 요청에 따라 불투명 토스 호스트 아래 shell의 SDK top inset/padding 중복을 제거했다. 기존 꽃32px·글자24px를 유지하면서 브랜드 상하padding0·홈 링크 터치44px·본문 상단8px로 줄였고 하단/좌우 inset과5개 메뉴56px는 유지한다. Node24 verify:local307개·타입·웹 빌드, 공식 SDK3.10.0 토스 빌드/검사를 통과했다. 모의320/393/768px×top0/54/100의9가지 모두 헤더y0·높이45px이며 마이→브랜드 홈 이동·하단34px·좌우12/8px도 확인했다.

새 .ait3,950,568bytes/SHA-256 f924a97a504f5fef77ceef793f8d8e99479ef9688393c4320cde8ff6cc29d90d를 generated/toss-top-spacing/2026-11-19/test/에 보존했다. 이전20261118-6은 별도 경로에 유지한다. 테스트 광고 ID이며 사용자 요청대로 파일만 생성하고 콘솔 업로드·심사·출시·커밋·푸시는 수행하지 않았다. 실기기 확인은 사용자 업로드 후 남아 있다. 임시4194 서버/브라우저를 종료하고 원본·정상4327 서버·snapshot을 보존했다. [검증 기록](changes/archive/2026-11-19-reduce-toss-top-spacing/verification.md).

2026-11-19 후속 요청으로 상단 여백 축소 코드·명세·빌드 보고서·모의 검증 근거를 preview에 로컬 커밋한다. 기존307개 회귀·타입·웹/토스 빌드 통과 후 실행 소스는 바꾸지 않았고, 보존된 .ait의 SHA-256과 현재 소스 해시 일치를 재확인했다. 이번 요청은 커밋까지만이며 푸시·콘솔 업로드·배포는 수행하지 않는다.


## 2026-11-19 — 혼합 추천 안내 제거와 완료 축하 반복 수정

선택 재료 활용 놀이가 일부인 추천의 개수 안내를 제거했다(REC-002). 마지막 미완료 추천의 성공한 저장 이벤트를 한 번 소비해3개 전체 완료로 바뀐 직후에만 폭죽을 실행한다(REC-004). 탐색/마이페이지 후 홈 복귀·재기록·새로고침에서는 완료 배너/도장만 유지한다. Node24 전체313개 테스트·콘텐츠/이미지·명세·타입·웹 빌드와 별도4333 origin의 실제 마지막 저장/재진입/재기록/새로고침 검증을 통과했다. 테스트 브라우저/4333 서버를 정리하고 기존4327 서버와 원본 checkout·기존9fd8ea9를 유지했다. 커밋·푸시·배포하지 않았다. [검증 기록](changes/archive/2026-11-19-fix-home-completion-replay/verification.md).


## 2026-11-19 — 홈 안내의 작은 보조 문장과 보호자 도움 카드

일반 재료 안내를 배경·인용 세로선 없는 정보 아이콘과12px 보조 문장으로, 상위 월령 안내를 ‘함께 도와주세요’ 제목·보호자 아이콘·둥근 라벤더 카드로 변경했다(REC-002/003). 제목·본문은 모두12px이며 기본 월령·놀이명·도움 조건과 추천/완료 정책은 유지한다. Node24 전체313개 테스트·콘텐츠/이미지·명세·타입·웹 빌드, 별도4334 origin의390px/1512px 화면·computed style·가로 overflow 확인을 통과했다. 테스트 브라우저/4334 서버를 정리하고 기존4327과 원본 checkout을 유지했다. 커밋·푸시·배포하지 않았다. [검증 기록](changes/archive/2026-11-19-restyle-home-recommendation-notices/verification.md).


## 2026-11-19 — 추천 회차별 완료·새 추천0/3 정책

홈의 도장·진행·완료 배너·단발 축하를 누적 이력에서 이번 추천 회차로 분리했다(REC-004). 기존2/3·3/3은 최초 회차로 호환 이전하며 다음 날·재실행에도 유지한다. 명시적 새 추천은 같은 재료/놀이 ID여도0/3이며 과거 배지는 표시하지 않는다. 같은 놀이의 중복 기록은 회차에서1개만 세고 새 회차의 세 번째 완료는 다시 한 번 축하한다. 누적 기록·찜·프로필·SQLite v3는 보존한다(LOC-001/002·LOG-001). Storage의 회차 참조와 실제 활성 DB 기록을 대조해 실패/중단의 유령 도장을 막고, 직렬 큐·회차 ID로 오래된 쓰기를 거부한다. 토스 광고도 동일 회차 기준이다(TOSS-007).

Node24 전체324개 테스트·콘텐츠/이미지·명세·타입·웹 빌드를 통과했고, 참조 필드 정리 후 관련14개·타입·최종 빌드도 통과했다. 별도4335 origin에서 기존 어제2/3 이전·재실행·동일3개 새 회차0/3·재완료/중복·회차마다 축하1회·왕복 탐색·저장 실패/재시도·기록 화면 누적7회 보존을 확인했다. 테스트 브라우저/4335 서버를 정리하고 원본 checkout·기존4327·기존9fd8ea9와 이전 미커밋 작업을 유지했다. 커밋·푸시·배포하지 않았다. [검증 기록](changes/archive/2026-11-19-implement-home-round-progress/verification.md). 실기기와 안전 후보0~2개 경계는 GAP-001/002/003에 남긴다.

### 2026-11-21 재료 변경 시 완료 보존·놀이 도전·달성 기록

사용자가 확정한 최종 시안과0/1/2/3 재료 변경 정책을 원본 preview의 로컬 변경으로 구현했다. 부분 완료는 완료 칸·도장·참조를 유지하고 미완료 후보만 교체하며,3개 완료 후 명시적 재료 저장은 새 회차0/3이다. 재료·진행·추천을 원자 저장하고 이전 pin을 거부한다. 최종3개의 실제 활성 완료 기록을 달성 날짜의 이미지 묶음으로 보존하며 기록 기본 최근3묶음·개별 놀이·월별 전체 보기,7개 발달영역 요약/접기/탐색을 구현했다.

단위168개·전체 고유335개 회귀·타입·명세·웹 빌드·토스 SDK 번들 빌드와 실제 웹의2/3 유지→A/B/D 완료→단발 축하→같은 재료 새 회차/기록 보존,390/320px 화면을 확인했다. 실제 SQLite/토스앱 QR·광고는 미확인이며 커밋·푸시·배포를 수행하지 않았다. [완료 태스크](changes/preserve-completed-plays-on-material-change/tasks.md) · [검증](changes/preserve-completed-plays-on-material-change/verification.md). 완료 change는 현재 경로에 유지한다.

### 2026-11-24 전체 완료 후 다음 회차의 직전 놀이 제외

REC-004의 전체3개 완료 후 다음 추천은 직전3개를 제외한 적격 대안을 먼저 선택하고 부족한 칸만 적격 직전 놀이로 보충한다. REC-002 재료 순위는 각 후보 풀 안에서 유지하고 합친 조건부 상위 월령은 최대1개다. 부분 완료·새 회차0/3·누적 기록/묶음을 보존했다. Node24 전체347개 회귀·명세·타입·웹 빌드를 통과했다. preview 로컬 변경이며 커밋·푸시·배포와 실제 기기 검증은 실행하지 않았다.

[완료 태스크](changes/archive/2026-11-24-avoid-previous-completed-home-round/tasks.md) · [검증 기록](changes/archive/2026-11-24-avoid-previous-completed-home-round/verification.md).

### 2026-11-24 토스 eval 반려 수정과 재발 검사

반려 대상 테스트/운영 번들의 Expo eval2곳을 추적하고 토스 배포 웹에서만 서버·개발 fallback을 제외했다. 실제 브라우저 UUID·v5·로더와 일반 웹/네이티브·Devtools를 보존하며, 포장 전에 JS/inline script의 eval 참조·Function 생성자를 구문 분석해 차단한다. 전체353개·명세·타입·웹/토스 빌드를 통과했고 새 두 .ait 내부도 eval0개를 확인했다. preview 로컬 수정으로 커밋·푸시·콘솔 업로드·심사·실제 토스 기기 검증은 포함하지 않았다.

[완료 태스크](changes/archive/2026-11-24-remove-toss-eval-fallbacks/tasks.md) · [검증 기록](changes/archive/2026-11-24-remove-toss-eval-fallbacks/verification.md).

### 2026-11-24 최근 완성 묶음 Fan cards

웹/PWA/토스 기록 기본 보기의 최근3묶음에 원본 스프링 수치를 유지한 사진 팬 모션을 적용했다. 날짜·제목 고정, 터치/키보드 상세 이동, 모션 감소와 rAF 정리를 제공하며 월별 전체 보기는 기존3열이다. 별도 테스트 origin의320/393px·데스크톱 입력/월별 보기와 최종 전체359개·타입·웹/토스 빌드를 확인했다. 새 테스트/운영 .ait 내부eval0개와 이전 웹 출력 보존을 확인했다. preview 로컬 변경이며 사용자 기록·커밋·푸시·운영/콘솔 배포는 포함하지 않았다.

[완료 태스크](changes/archive/2026-11-24-add-completed-play-fan/tasks.md) · [검증 기록](changes/archive/2026-11-24-add-completed-play-fan/verification.md).

### 2026-11-24 팬 카드 이미지·제목 통합

사용자 원본 이미지 정정에 맞춰 최근 완성 묶음의 이미지·순번·제목을 한 카드 안에 넣고 카드 전체를 움직이도록 수정했다. 넓은 외곽 패널을 없애고 반응형 높이를 연결했다. 전체359개·타입·웹 및 토스 두 모드 빌드,320/393/1280px 실제 카드 배치·키보드 강조·모바일 제목 탭과 .ait 내부 eval0개를 확인했다. preview 로컬 변경이며 커밋·푸시·콘솔/운영 배포는 하지 않았다.

[완료 태스크](changes/archive/2026-11-24-integrate-fan-card-content/tasks.md) · [검증 기록](changes/archive/2026-11-24-integrate-fan-card-content/verification.md).

### 2026-11-24 마우스 호버로 완성 카드 펼침

최근 완성 묶음은 마우스 사용 시 기본 겹침으로 표시하고 호버·키보드 포커스에서 펼치며 모두 이탈하면 다시 접는다. 터치/동작 줄이기는 세 링크 접근을 위해 펼친다. 전체360개·타입·웹 빌드와 실제 마우스 진입/이탈·키보드·모바일 제목 탭을 확인했다. preview 로컬 변경이며 커밋·푸시·배포·토스 파일 재생성은 하지 않았다.

[완료 태스크](changes/archive/2026-11-24-hover-completed-play-fan/tasks.md) · [검증 기록](changes/archive/2026-11-24-hover-completed-play-fan/verification.md).

### 2026-11-24 최근 완성 묶음 두 열

사용자가 모바일도 두 열을 선택해 최근3묶음을 날짜와 함께 두 열로 표시했다.600px 미만은 접힌 표지 버튼·선택 묶음 전체 행 펼침·접기와 포커스 복귀를 제공한다. 넓은 화면은 기존 팬 호버를 유지하고 월별 전체 보기는 기존 날짜별3열이다. 전체360개·최종 타입/웹 빌드와320/393/1280px 실제 배치·터치 상세 이동·접기·옆 묶음 침범 없음·월별 배열을 확인했다. preview 로컬 변경이며 커밋·푸시·배포·토스 파일 재생성은 하지 않았다.

[완료 태스크](changes/archive/2026-11-24-show-completed-bundles-in-two-columns/tasks.md) · [검증 기록](changes/archive/2026-11-24-show-completed-bundles-in-two-columns/verification.md).

### 2026-11-24 두 열을 유지한 카드 겹침 펼침

모바일에서 펼친 묶음이 행 전체를 차지하며 재배치되던 동작을 바꿔 두 열·날짜·다음 행 위치를 유지하고 실제 카드만 옆 묶음 위로 겹쳐 펼친다. 양쪽 열의 가장자리 정렬·선택 묶음 레이어·포인터 통과/카드 선택을 연결했다. 전체360개·타입·웹 빌드와320/393/599px 양쪽 열6경우의 위치 불변·겹침·잘림 없음·접기, 실제 상세 터치 및1280px 기존 배열을 확인했다. preview 로컬 변경이며 커밋·푸시·배포·토스 파일 재생성은 하지 않았다.

[완료 태스크](changes/archive/2026-11-24-overlay-completed-fan-within-two-columns/tasks.md) · [검증 기록](changes/archive/2026-11-24-overlay-completed-fan-within-two-columns/verification.md).

### 2026-11-25 모바일 원래 자리 펼침과 행 간격 축소

모바일에서 선택한 카드가 중앙으로 옮겨지던 원인을 없애고 표지의 가운데 카드와 실제 카드 크기/위치를 고정한 채 옆 카드만 이웃 열 방향으로 펼친다. 자동 스크롤과340~430px 행 높이 예약을 제거했다. 전체362개·타입·웹 빌드와320/393px 터치·551px 마우스 양쪽 열에서 기준 카드 위치/크기 변화0px, 행 간격333px·잘림 없음·세 카드 선택 영역·접기, 모션 감소와 실제 바깥 카드 상세/1280px 호버를 확인했다. preview 로컬 변경이며 커밋·푸시·배포·토스 파일 재생성은 하지 않았다.

[완료 태스크](changes/archive/2026-11-25-anchor-mobile-fan-and-tighten-rows/tasks.md) · [검증 기록](changes/archive/2026-11-25-anchor-mobile-fan-and-tighten-rows/verification.md).

### 2026-11-25 모바일 앞 카드 순서와 빈 영역 접기

작은 화면의 왼쪽은1번·오른쪽은3번을 앞 표지/펼침 기준으로 두고 순서를 거울처럼 맞췄다. 접기 버튼을 제거해 빈 화면 click·Escape로 닫고 카드/버튼 선택과 스크롤은 구분한다. 전체363개·타입·웹 빌드와320/393px 터치·551px 마우스 양쪽 열에서 앞 카드/위치 변화0·빈 곳 접기·터치 스크롤 유지, 버튼 전환·Esc 포커스 복귀·실제 카드 상세 이동을 확인했다. preview 로컬 변경이며 커밋·푸시·배포·토스 파일 재생성은 하지 않았다.

[완료 태스크](changes/archive/2026-11-25-mirror-mobile-card-order-and-dismiss-on-blank/tasks.md) · [검증 기록](changes/archive/2026-11-25-mirror-mobile-card-order-and-dismiss-on-blank/verification.md).

### 2026-11-25 강조 카드 뒤 겹침 순서 보정

모바일 강조 카드만 올리던 식 대신 전체 레이어를 가까운 번호 순으로 정해 왼쪽3번은3/2/1, 오른쪽1번은1/2/3으로 겹친다. 강조 해제는 기본 열 순서로 돌아간다. 전체364개·타입·웹 빌드와393/551px 실제 호버·551px 키보드/해제 복원·빈 곳 접기를 확인했다. preview 로컬 변경이며 커밋·푸시·배포·토스 파일 재생성은 하지 않았다.

[완료 태스크](changes/archive/2026-11-25-reorder-fan-stack-on-highlight/tasks.md) · [검증 기록](changes/archive/2026-11-25-reorder-fan-stack-on-highlight/verification.md).

### 2026-11-25 큰 화면 기록 영역과 카드 확대

1024px 이상에서 기록 최대 폭1000px, 카드 약190~200px와 비례 이미지/높이·제목14~15px로 확대했다. 두 열과 기존 호버를 유지하고1024px 미만은 기존 크기/모바일 동작을 유지한다. 전체364개·타입·웹 빌드와393/1023/1024/1280/1440px 실제 크기·큰 화면 바깥 카드 호버의 잘림/이웃 카드 겹침 없음·모바일 제자리 펼침/빈 곳 접기를 확인했다. preview 로컬 변경이며 커밋·푸시·배포·토스 파일 재생성은 하지 않았다.

[완료 태스크](changes/archive/2026-11-25-enlarge-record-fan-on-wide-screens/tasks.md) · [검증 기록](changes/archive/2026-11-25-enlarge-record-fan-on-wide-screens/verification.md).


### 2026-11-25 하단 메뉴 Bottom bar 모션

기존 웹 모바일/PWA·토스 하단의 발견·탐색·저장·기록·마이를 React Bottom bar로 재구성했다. 선택 라벨 확장·라벤더 강조 배경 추적·아이콘 팝은 원본의300/26·340/28·520/14 스프링과4회 적분을 사용한다. 실제 AppLink·경로 별칭·뒤로/앞으로·재선택 스크롤·상세 숨김·접근성 이름을 유지하고 reduced-motion에서는 즉시 전환한다. 320px에서 좌우/하단 안전 영역을 적용해도44×56px 이상 터치 영역을 보존하며 큰 화면의 기존 헤더는 유지한다.

`pnpm verify:local`370개 회귀·타입·웹 빌드, 마지막 CSS 보완 뒤 웹 빌드 및 실제 브라우저 검증, spec:changed HEAD/spec:check/diff 검사를 통과했다. 현재 localhost:8081에서 확인했으며 직접 실행한4329 QA 서버와 브라우저 공간은 정리했다. 원본 preview checkout을 사용했으며 커밋·푸시·배포는 이번 요청 범위에 포함되지 않았다. 토스 안전 여백은 CSS 모의 검증이며 새 .ait/QR·실기기 검증과 구분한다. [변경·검증 근거](changes/archive/2026-11-25-add-animated-bottom-bar/verification.md).

### 2026-11-25 북마크 저장 Like burst 모션

기존 공통 북마크에 원본 아이콘520/13·채움300/26 스프링과8개 점 확산을 적용했다. 하트·숫자 카운터·자동 반복 없이 기존 보라색·44px 버튼·모서리·저장 경계를 유지한다. 실제 저장 상태 변경에서 재생하고 모션 축소·숨김·unmount를 정리한다. 카드 clipping을 유지한 body portal로 점을 표시한다.

`pnpm verify:local`376개 회귀·타입·웹 빌드와 실제 웹 저장/취소·새로고침 유지·키보드·저장 실패·모션 축소·320/393px·portal 정리를 확인했다. 원본 preview checkout을 사용하고 커밋·푸시·배포는 수행하지 않았다. 사용자 확인용4331 로컬 서버와 상세 탭을 유지한다. [검증 기록](changes/archive/2026-11-25-animate-bookmark-save-burst/verification.md).

### 2026-11-25 저장 확산 점의 다색 팔레트

사용자의 후속 요청에 따라 점8개를 원본의 빨강·주황·노랑·초록·하늘·보라·분홍·빨강으로 바꿨다. 북마크의 보라색과 모양·44px 크기·기존 스프링과 저장 조건은 유지한다. 전체376개 회귀·타입·웹 빌드와393px 실제 저장 시 점8개·7색 및 가로 넘침 없음을 확인했다. 기존4331 로컬 서버에 반영했으며 커밋·푸시·외부 배포는 하지 않았다. [검증 기록](changes/archive/2026-11-25-use-colorful-bookmark-burst/verification.md).
