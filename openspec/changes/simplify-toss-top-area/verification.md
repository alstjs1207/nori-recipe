# 토스 상단 정리 검증 — 2026-11-18

원본 `/Users/msyu/study/play-recipe`의 preview checkout에서 작업했다. 새 worktree·clone을 만들지 않았으며 기존 보관 worktree는 사용하지 않았다.

- Node24.22.1/pnpm10.33.0, `pnpm verify:local --public-images` 종료 코드0. 전체291개 테스트·명세·콘텐츠·타입·실제 웹 빌드 통과. 공개 놀이416개·재료66개 이미지의 SHA-256·크기·WebP를 검증했다.
- `pnpm build:toss` 종료 코드0. 공식 SDK3.10.0 `.ait` **3,942,936 bytes**, SHA-256 `1cc835e4e5558270092ed1589cc78a6b3c8a30d737edade0d21539b35032cbc2`. 비압축 **7,429,022 bytes**, 457개 파일. [빌드 보고서](evidence/build-report.json). 원본 `generated/toss-release/top-area-change/nori-recipe.ait`에도 보존했다.
- 공식 모의 SDK localhost4191에서 공통 헤더0개·상단 프로필 버튼0개·공통 AI 안내0개, 요청 문구 미표시, 그림 AI 라벨4개와 하단 내 설정 링크를 확인했다. [393×852 모의 토스 화면](evidence/toss-home.png)을 시각 검사했다. 실제 토스 네이티브 내비게이션을 합성하지 않았고 모의 도구 버튼만 캡처에서 숨겼다.
- 하단 내 설정을 눌러 `/mypage`에 진입하고 기존 생년월 필드와 아이 설정 저장 버튼을 확인했다. 개인정보 안내를 펼쳐 AI 삽화·안전 고지가 유지됨을 확인했다. 사용자 설정·찜·기록은 수정하지 않았다.
- localhost4175의 실제 웹 export를1280px에서 확인했다. 웹 헤더1개·프로필 버튼1개이며 토스 shell이 없었다. 기존 웹 브랜드·탐색·월령 단축 버튼을 시각 대조했다.
- 개발 서버 두 개와 브라우저 검증 공간24를 종료했다. 개발 중 임시 적용한 public/index.html과 공개 이미지 snapshot 두 파일의 SHA-256이 시작 전과 동일하게 복원됐고 해당 포트의 서버가 남지 않았다.

## 외부 확인과 한계

토스 테스트 API 업로드는 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`로 실패했다. 시스템 인증서를 사용하는 HTTPS 요청으로도 S3 인증서 검증에 실패해 검증을 해제하거나 임의 인증서를 신뢰시키지 않았다. 새 테스트 링크는 아직 발급되지 않았으며 이전 링크는 변경 전 번들을 가리킨다. 네트워크 전환 후 재업로드와 실제 토스 기기 확인은 남아 있다. 최초 UI 수정·검증 시점에는 공개 출시·main 병합·커밋·푸시를 수행하지 않았다.

## preview/main 병합 전 확인 — 2026-11-18

사용자가 현재까지 작업을 preview와 main에 반영하도록 요청했다. 최신 원격 main은65d52a4, preview는f3bdf06이며 main은 preview의 조상으로 충돌 없이 fast-forward할 수 있다. 기존 토스·이미지 등록·스튜디오 가이드의 원격 CI는 성공했다. 위291개 회귀·웹/토스 빌드 및 화면 확인 이후 앱 코드를 추가로 변경하지 않았으며, 병합 전 `spec:check`, `spec:changed origin/main`, diff 검사를 다시 통과했다. 키·원본 이미지·생성 번들은 Git에서 제외하며 토스 콘솔의 공개 출시와 웹 운영 배포를 구분한다.
