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
