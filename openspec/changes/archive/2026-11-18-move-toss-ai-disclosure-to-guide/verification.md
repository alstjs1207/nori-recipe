# 토스 AI 삽화 안내 위치 변경 검증 — 2026-11-18

## 사용자 요청과 구현

이미지별 AI 라벨을 제거하고 이용 안내의 AI·안전 설명은 유지한다. 사용자가 이 변경과 토스 콘솔의 새 버전 등록을 명시했다. NEW90일은 기존 CAT-003을 그대로 포함한다. 정책의 정적 삽화 적용 범위나 심사 승인을 확정하는 기록이 아니다.

원본 `/Users/msyu/study/play-recipe`의 기존 preview checkout에서 작업했다. 별도 worktree·clone은 만들지 않았고 기존 타 작업 worktree는 사용하지 않았다.

## 로컬 검증

- Node24.22.2/pnpm10.33.0.
- `pnpm spec:index`: 301개, 새 관리 소스 없음. `spec:check`, `spec:changed abd7629`, `git diff --check` 통과.
- `pnpm verify:local --public-images`: 종료0, 전체291개 회귀·실패0, 타입·명세·웹 export 통과. 공개 놀이416개·재료66개 해시/크기/WebP 검증. 검증된 로컬 공개 객체 캐시를 사용했다.
- `pnpm build:toss`, `pnpm check:toss`: 종료0. 공식 SDK3.10.0, 비압축7,427,885bytes/457개 파일, `.ait` 3,942,616bytes. SHA-256 `3575d507d7c99f038cd44e4ae4d2716cee8fd15f4278e7516afcdda18198d76d`.
- localhost4192 공식 모의 SDK의 탐색208개에서 AI 라벨0개·카드 AI문구 없음, NEW32개·2026-10-09 등록 `play_193` NEW 표시를 확인했다.
- `/settings`의 이용 안내를 실제 펼쳐 AI 삽화·참고 이미지·보호자 안전 설명이 유지됨을 확인했다. 사용자 저장 설정·기록은 수정하지 않았다.
- 검증 서버를 정상 종료했다. `public/index.html`, 공개 이미지 snapshot 두 파일의 SHA-256은 시작 전과 같고 localhost4192 listener가 남지 않았다.

## 콘솔 등록

대상은 `노리공방 → 노리 레시피`, 새 테스트 버전 등록이다. 최종 등록 결과는 아래 재시도 완료 기록과 `evidence/console-registration.json`에 보존했다. 실기기·심사·정식 출시는 별도이며 이 로컬 검증으로 완료 처리하지 않는다.

### 최초 등록 시도 결과

사용자의 명시 요청에 따라 로그인된 콘솔의 `노리공방 → 노리 레시피 → 앱 출시 → 버전 등록하기`에 위 해시의 번들을 선택하고 변경 메모를 입력한 뒤 등록하기를 실행했다. 콘솔이 `Failed to fetch (s3.ap-northeast-2.amazonaws.com)`를 반환했고 버전 목록은 기존20261117-2/1 그대로다. 새 버전 등록·심사 요청·공개 출시는 성공하지 않았다.

동일 S3 호스트의 curl은 인증서 발급자 체인 오류, Node24 시스템 CA 사용 요청은 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`다. TLS에 제시된 공개 인증서 발급자는 Fortinet이며, 인증서 검증을 끄거나 네트워크 설정·신뢰 저장소를 변경하지 않았다. 다른 네트워크 전환 후 재시도 또는 사용자의 수동 업로드가 필요하다.

업로드 대상 파일은 원본 `nori-recipe.ait`에 보존했다. 이 파일은 앱 번들 산출물이며 Git에는 포함하지 않는다. `evidence/build-report.json`의 파일 크기·SHA-256으로 대조할 수 있다.

### 네트워크 전환 후 재시도 완료

2026-11-18 사용자가 네트워크 전환과 재로그인을 완료한 뒤 등록 재개를 요청했다. S3 TLS 연결이 정상화된 것을 확인하고 동일 SHA-256의 번들을 다시 업로드했다. 새 버전 **20261118-4**가 생성됐고 토스 서버 빌드 완료 후 SDK3.10.0·상태 **검토 필요**·테스트 버튼을 확인했다. 최신 버전의 테스트 창에 QR과 해당 deploymentId를 포함한 실행 주소가 표시됨을 확인했다.

- source: `30483e26167503e981c01b1e2f4385b73548829d`, deploymentId: `01a1ecbd-f8cb-77d6-b110-0687a3a5c204`.
- 콘솔 등록 및 서버 빌드는 성공했다. 기존 TLS 실패는 이 재시도로 해소됐으며 인증서 검증·보안 설정을 우회하지 않았다.
- 등록 메모에 NEW90일·이미지 AI라벨 제거·이용 안내 AI고지 유지·토스 상단 정리·preview30483e2를 명시했다.
- 실제 토스 기기 실행·심사 요청·정식 공개 출시·테스트 푸시는 수행하지 않았다. 해당 항목은 기존 출시 체크리스트에 남긴다.
- 구현 커밋의 GitHub Policy and regression checks 성공: https://github.com/alstjs1207/nori-recipe/actions/runs/44232463553 .
- 사용자 확인을 위해 최신 테스트 QR 콘솔 화면만 남기고 브라우저 작업을 종료했다.
