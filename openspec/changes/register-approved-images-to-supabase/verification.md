# 검증 기록 — 2026-11-16

원본 `/Users/msyu/study/play-recipe`, 기존 `preview` checkout에서 구현했다. 작업 전 clean 상태였으며 별도 worktree·clone을 만들지 않았다. Node v24.21.0 / pnpm 10.33.0을 사용했다.

## 실행 결과

- `pnpm verify:local`: exit 0. spec:check, spec 도구8, 앱 단위123, 검수27, 신규 등록12, 놀이 Storage15, 재료 Storage8, 스튜디오26, 웹59로 **278개 테스트 통과**. 콘텐츠·로컬 원본 검사, 타입 검사와 웹 빌드도 통과했다.
- 웹 빌드: 공개 놀이208개, 재료66개, 소개 화면7개, 앱 셸13개. 기본 로컬 원본 모드의 검증이며 운영 배포가 아니다.
- `pnpm test:image-registration`: 공개 등록 파일의 null/손상 거부 보강 후 12개 재실행, exit 0. 선택 범위, 부분 실패·객체 재검증 재시도, 익명 읽기 실패, 기존 객체 손상, 전송 중 본문/매니페스트 외부 수정, 새 재료/소스 해시, 키 없는 저장/dry-run, CLI 양쪽 재실행, 거래 복구, 실제 어댑터의 인증 헤더/익명 GET 계약, 원본 없는 빌드 입력 병합을 검증했다.
- 최종 `pnpm spec:check`: active/current20개·archive4개, 요구사항40개·시나리오111개·소스278개 통과. `pnpm spec:changed HEAD`도 변경 근거 연결을 통과했다.
- `git diff --check`: 통과. 기존 data/plays.json·data/materials.json·놀이/재료 매핑·원본·소스 해시에 변경 없음. 공개 등록 JSON은 비어 있는 새 기록으로 추가했다.

## 검증 경계

Storage 성공 경로는 메모리 fixture와 가짜 HTTP 응답으로 검증했다. 실제 Supabase 버킷·RLS 변경이나 새 콘텐츠 승인은 하지 않았다. 로컬 환경/.env에서 네 `*_IMAGE_STORAGE_URL`/`*_IMAGE_STORAGE_SERVICE_ROLE_KEY`가 미설정임을 값 노출 없이 확인했다. 키를 로컬에 주입하고 서버를 재시작한 뒤 실제 사용자 승인에서 원격 전송을 검증해야 한다. 키를 추정·수집·기록하지 않았다. 설정은 tools/local-review/REGISTRATION.md를 따른다.

첫 sandbox 실행은 loopback listen EPERM으로 실패했고 허용된 실행에서 스튜디오 회귀를 통과했다. 전체 검증 중 기존 재료 이미지 승인 테스트의 Storage 주입 누락을 수정한 뒤 전체를 다시 실행해 통과했다. Node의 기존 typeless-package 알림은 테스트/빌드를 실패시키지 않았다.

기존 이관 evidence와 배포 환경변수는 유지한다. 새 등록 기록을 합치는 공개 빌드 입력을 원본 없는 fixture로 검증했으며 실제 원격 새 이미지 등록·Vercel 배포 성공으로 보고하지 않는다. 관리자 자동 원본 복원과 미참조 원격 객체 정리는 기존 후속 범위다. 최초 구현 당시 커밋·푸시·배포는 하지 않았다.

## preview 반영 전 재검증 — 2026-11-17

사용자가 남아 있던 이미지 등록 파이프라인과 스튜디오 가이드 변경의 preview 커밋·푸시를 요청했다. 원본 `/Users/msyu/study/play-recipe`에서 토스 커밋 `fdd99e3`과 함께 통합 검증했으며 새 worktree·clone은 만들지 않았다.

- Node24.22.1/pnpm10.33.0, `pnpm verify:local --public-images` 종료 코드0. 토스6개·단위130개·신규 이미지 등록12개를 포함해 전체 **291개 회귀 통과·실패0개**, 명세·콘텐츠·타입·실제 웹 export 통과.
- 기존 공개 매니페스트와 로컬 공개 객체 캐시를 입력으로 사용해 놀이416개·재료66개 자산의 크기·SHA-256·WebP를 검증했다. 공개 놀이208개·재료66개·소개 화면7개가 생성됐다. 관리자 키나 비공개 원본 없이 공개 빌드를 검증했다.
- 커밋 대상55개 파일에 저장된 토스 API 키·개인 키·실제 `.env`·원본 JPEG·`.ait`·생성 산출물이 포함되지 않음을 확인했다. 데이터의 공개 등록 기록은 빈 상태이며 기존 마스터와 실제 승인 상태를 변경하지 않았다.
- 이번 검증에서 실제 신규 콘텐츠 승인·Supabase 쓰기·버킷/RLS 변경·main 병합·운영 배포는 수행하지 않았다. 신규 이미지 실제 전송 검증의 기존 한계는 유지한다.
