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
