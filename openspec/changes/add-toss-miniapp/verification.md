# 토스 미니앱 로컬 검증 — 2026-11-17

최초 구현은 원본 `/Users/msyu/study/play-recipe`의 기존 `preview` checkout에서 수행했으며 별도 clone/worktree를 만들지 않았다. 사용자가 지정한 appName은 `nori-recipe`다. 기존 미커밋 이미지 검수·등록 변경을 유지하며 커밋·푸시·공개 배포는 수행하지 않았다.

## 실행 결과

- Node **24.22.1**, pnpm **10.33.0**.
- `pnpm verify:local --public-images`: 종료 코드 0. 명세·인덱스·콘텐츠, 토스, 단위, 검수·등록, 놀이/재료 Storage, 로컬 스튜디오, 웹 회귀 **291개 통과·실패 0개**, 타입 검사와 실제 전체 웹 export 통과.
- 검증에는 기존 공개 매니페스트와 이미 다운로드한 `generated/material-image-storage/public-objects`를 두 이미지 종류의 `PUBLIC_ASSET_DIR`로 지정했다. 놀이416개·재료66개의 SHA-256·크기·WebP를 검증하며 관리자 키/원본 JPEG/우회 네트워크를 사용하지 않았다.
- `pnpm build:toss`: 실제 Expo export와 **공식 SDK 3.10.0 `ait build`** 성공. 첫 실행에서 실제 공개482개 다운로드/무결성 확인 뒤 번들 검사에서 Expo 폰트의 정상 자산 경로가 과도하게 거부되는 것을 발견했다. 폰트/이미지에 한정해 경로 검사를 보완하고 이후 기존 공개 객체 캐시로 동일 무결성 검사를 거쳐 재빌드했다.
- `pnpm check:toss`: 비압축 **7,429,967 bytes**, **457 files**, JS1개, 100MB 이하. mock·소스맵·PWA·기밀 파일 검사 통과.
- `nori-recipe.ait`: **3,943,616 bytes**, SHA-256 `dd19c39af38202a2d652615411a6616e67f22c917cc2465d950bb523898249db`. 전체 웹 검증 후에도 실제 파일과 보고서 해시가 일치한다.
- 일반 웹 export에는 `nori-recipe/toss/v1/` 런타임이 없고 PWA 등록이 유지된다. `/intro`는208개 놀이·66개 재료·실제 화면7개로 정상 생성됐다.
- 개발 서버 종료 후 원래 `public/index.html`과 공개 이미지 snapshot 두 파일이 원래 바이트로 복원됐고 임시 잠금이 남지 않았다.
- `pnpm spec:changed HEAD`, `git diff --check`: 통과. 변경 명세에 기존 정책 보존 이유와 초기화 실패 재현·검증을 기록했다.

## 토스 Devtools 화면 검증

공식 `@apps-in-toss/devtools` 3.10.0의 모의 SDK와 localhost:4189를 사용했다. 실제 토스 브릿지·계정·외부 공유 앱의 성공으로 해석하지 않는다.

- 첫 방문·탐색208개·직접 상세·월령 저장(테스트용34개월)·추천·설정 확인.
- 찜, 완료 기록5점·선택 반응·테스트 메모 저장 후 새로고침으로 복원 확인.
- 공유창에서 공개 놀이 ID만 포함하는 `intoss://nori-recipe/play/play_022` 기반 모의 공유 링크 생성·복사 성공 안내 확인. 링크 생성 후 창이 닫히던 focus dependency 문제를 수정하고 재확인했다.
- 토스 전용 기기 저장/개인정보 안내, 설치·분석 유도 및 중복 상세/기록 뒤로가기 제거, AI 고지·삽화 라벨 확인.
- 해당 세션의 Google 태그 **0개**, 서비스 워커 등록 **0개**, 중복 상세 뒤로가기 버튼 **0개** 확인.
- 테스트 데이터를 서비스의 전체 초기화 UI로 삭제하고 월령 미설정·기록0개·테스트 메모 미표시 확인. 실제 운영 사용자 저장소를 수정하거나 브라우저 저장소 전체를 삭제하지 않았다.
- 개발 패널을 숨긴 참고 캡처 `evidence/01-home.png`, `02-search.png`, `03-play.png`: 각각 **636×1048 PNG**, 시각 검사 완료. 실제 토스 공통 내비게이션을 합성하지 않았다.
- `generated/toss-release/logo-600.png`: **600×600**, 알파 채널 없는 PNG. 기존 자체 브랜드 심벌을 사용했다.
- 브라우저 공간과 본 작업에서 실행한 개발 서버를 종료했다.

## 남은 외부 확인

[출시 체크리스트](../../../docs/toss-miniapp.md)의 콘솔 등록 내용·콘텐츠 이용 권한 최종 확인, `.ait` 업로드, QR iOS/Android 실기기, 실제 사용자 전환·버전/기기별 저장·외부 공유·키보드/홈 영역, 심사와 정식 출시는 미실행이다. 관련 보고서의 `consoleUploadVerified`, `tossDeviceVerified`, `productionReleased`는 모두 false다. 로컬 준비 완료를 출시 승인으로 표시하지 않는다.

## preview 커밋 범위 분리 검증 — 2026-11-17

사용자의 커밋·푸시 요청에 따라 기존 이미지 등록·스튜디오 미커밋 작업을 제외했다. 공통 package/명세/검증 설정에는 토스에 필요한 변경만 포함했다. 검증용 Codex 관리 worktree `/Users/msyu/.codex/worktrees/toss-preview-check/play-recipe`를 사용했으며 원본의 다른 작업을 보존했다.

- 고정 pnpm lockfile의 오프라인 설치와 `pnpm verify:local --public-images` 종료 코드0. 회귀 **279개 통과·실패0개**, 명세·타입·실제 웹 export 통과. 기존 이미지 등록 작업의12개 테스트는 이번 커밋 범위에 포함하지 않았다.
- 최초 worktree 검증의 의존성 심볼릭 링크는 Expo fixture의 경로 해석 오류를 일으켰다. worktree에 독립 의존성을 설치한 후 같은 검증을 끝까지 다시 실행해 통과했다. 앱 코드를 변경해 우회하지 않았다.
- 해당 소스만으로 공식 SDK `pnpm build:toss` 성공: 비압축 **7,429,815 bytes**, `.ait` **3,943,799 bytes**, SHA-256 `a86afd904164f8d8235443d2b60d151d86ce9b521165e6758ac69936887042b0`. [커밋 범위 빌드 보고서](evidence/preview-build-report.json). 기존 원본의 `.ait`는 유지하고 이번 산출물은 원본 `generated/toss-release/preview-commit/`에 보존한다.
- 기존 웹은 `build:web`·`dist`·AsyncStorage·PWA를 유지하며 토스 대상만 별도 SDK 런타임을 사용한다. Production/main과 실제 토스 공개 출시는 이번 요청 범위에 포함하지 않는다.
- 사용자는 콘솔 테스트를 시도했으나 토스앱 계정 연결 인증 후 테스트 진입이 완료되지 않았다. 실제 토스앱 핵심 동작 검증은 여전히 남아 있다.
