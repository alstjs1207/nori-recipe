# 놀이 이미지의 Supabase Storage 이관

## Why

놀이 원본 이미지가 Git과 네이티브 번들에 포함되어 있어 코드와 시각 자산을 함께 배포·관리하고 있다. 사용량이 낮고 적극적인 홍보 전인 현재는 계정·콘텐츠 DB 전환을 미루고, 원본 비공개 보관과 서비스용 이미지 제공부터 분리한다.

## What Changes

- 상태: **웹 이관 완료 — 2026-11-15**. 원본224개·공개 파생416개 실제 검증, 웹/공유/PWA·원본 없는 CI·Git 제외·Preview/Production 배포와 사용자 링크 공유 확인을 완료했다. 재료 이관은 후속, 네이티브는 제외한다. 미구현 관리 복원 통합·실제 복원/롤백 검증·서비스 내 자산 고지는 [후속 목록](../../follow-ups/play-image-operations.md)에 보존하며 완료로 승격하지 않는다. 완료 처리 시 배포 입력인 공개 매니페스트 경로를 유지하므로 폴더는 archive로 옮기지 않는다.
- 놀이 대표 이미지에 한해 Supabase 프로젝트 하나의 Storage를 사용한다. 원본은 비공개 버킷, 승인된 서비스용 상세·썸네일은 공개 버킷으로 분리한다. 공개 이미지는 다운로드 가능하며 복사 방지를 보장하지 않는다.
- 기존 놀이 ID·원본 해시·검수 승인과 연결한 버전 매니페스트를 Git에서 관리한다. 같은 경로를 덮어쓰는 대신 내용 버전별 경로로 이미지 교체를 구분한다.
- 업로드·무결성 및 접근 권한 검증 → 웹·공유 이미지·기본 PWA 오프라인 검증 → Git의 놀이 이미지 추적 제외 순서로 전환한다. 온라인에서 셸 준비를 마친 뒤 첫 오프라인 기본 화면/안내를 제공하며 전체 이미지 선저장은 요구하지 않는다. 기존 방문 이미지80개·선택 업데이트를 유지한다.
- 로컬 검수용 원본은 유지하고 새 checkout에서도 필요한 자산을 복원할 절차를 제공한다. 기존 검수·생성·승인 도구는 원본 해시를 계속 사용한다.
- 놀이·재료 JSON, 게스트 ID, SQLite/AsyncStorage, 찜·놀이 기록, GA4 동의·전송 정책은 유지한다. DB 이관·로그인·동기화는 `plan-account-sync`의 별도 후속 계획으로 남긴다.
- 이번 이관 대상은 `images/plays/`의 놀이 대표 이미지다. 재료·온보딩·로고·아이콘 이관, 워터마크 도입, 과거 Git 이력 재작성은 포함하지 않는다.

## Capabilities

### New Capabilities

없음. 기존 콘텐츠 검수와 웹 플랫폼 영역을 확장한다.

### Modified Capabilities

- `content-review`: CON-004 원본·공개 이미지의 Storage 접근 경계, CON-005 무결성·승인 보존·단계적 이관을 추가한다. CON-001·CON-002·CON-003은 유지한다.
- `web-platform`: WEB-003의 놀이 이미지 준비를 Git 원본 의존에서 검증된 Storage 자산 참조로 변경한다. WEB-001 직접 링크·공유와 WEB-002 이미지 캐시·선택 업데이트는 보존한다.

## Impact

- `images/plays/`, `.gitignore`, `playImages.web.ts`, `playImageUrls.ts`, `playImageVersions.json` 및 새 자산 매니페스트·동기화 도구.
- `scripts/prepare-play-images.ts`, `scripts/prepare-web-assets.mjs`, `scripts/build-web.mjs`, `scripts/web/html.mjs`, `scripts/web/service-worker.mjs`: 빌드 입력·원격 URL·공유 이미지·다른 origin의 이미지 캐시 대응.
- `scripts/review/`, 이미지 준비·승인 스크립트와 `tools/local-review/`: 원본 복원과 해시 검증, 승인된 서비스용 이미지 게시 연결.
- `DEVELOPMENT.md`, CI/Vercel 설정, 이미지·웹·검수 회귀, 관련 현재 명세·policy-map·source-index는 실제 구현 시 함께 갱신한다.
- Free 플랜 사용을 우선 검토하되 계정·조직의 남은 한도, 프로젝트·버킷 이름·리전·환경별 연결은 착수 시 확인한다. 무료 여부·용량·요금은 영구 보장으로 간주하지 않는다. 관리자 자격 증명은 앱·공개 산출물·Git에 포함하지 않는다.
