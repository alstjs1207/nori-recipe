# 검증 — 최신 개선 토스 번들 및 업로드

## 범위

2026-11-18 사용자 요청으로 preview da5f30c의 추천 묶음·완료 도장/hover 고정·전체 화면 폭죽·새 진입/복귀·미저장 기록·마이/월령 안내를 토스 번들에 담고 노리공방의 nori-recipe에 업로드한다. 원본 `/Users/msyu/study/play-recipe`를 사용했고 새 worktree/clone은 만들지 않았다.

토스 전용 플로팅 메뉴는5등분 grid·56px 높이로 보완했다. 통합 검증에서 대표 이미지의 초기 높이가 비어 있어 목록 복귀가533→886px로 밀리는 것도 재현해1:1 공간을 로딩 전에 확보했다. 비활성 화면의 스크롤 저장도 차단한다. 추천 순위/고정 ID·기록·보호자 조건·광고 시점/모드는 유지한다.

## 자동 검증

- Node24.21.0/pnpm10.33.0. 최초 및 통합 보완 후 최종 verify:local 모두 종료0.307개 회귀(8+7+145+27+12+15+8+26+59), 명세·콘텐츠/이미지·타입·웹 export 통과.
- 공식 SDK3.10.0의 build:toss와 check:toss 종료0. 공개 놀이208개/파생416개·재료66개를 기존 공개 객체 캐시에서 해시/크기/WebP로 검증했다. 관리자 키·원본 JPEG는 입력하지 않았다.
- 테스트 광고 ID `ait-ad-test-interstitial-id`. 비압축7,449,268bytes/458파일, .ait3,950,505bytes. SHA-256 `a8ad0f433c01f6f40572dc6f4910faf745a3f0671b0407952be9a4f5b2055d5e`.
- SDK packaging deploymentId `01a1ee4d-83c5-7f68-b1b5-56ac7f64ada9`. 이전 운영 번들은 `generated/toss-completion-ad/production/nori-recipe.ait`에 그대로 보존하고 최신 테스트는 `generated/toss-home-navigation/test/nori-recipe.ait`에 해시 대조 복사했다.
- 토스 빌드 전/후 dist/index.html이 동일하며 dev:toss 종료와 최종 빌드 후 public/index.html·놀이/재료 웹 manifest도 시작 전 SHA-256과 동일하다. 임시 추적 코드는 최종 소스에서 제거했다.
- spec:changed는 빌드 중 일시 manifest 치환 상태를 대상으로 실행한1회가 content-review 근거 누락을 보고했다. 빌드 종료 후 원본 복원 상태에서 다시 확인해 recommendations/web-platform 근거 검사를 통과했다. 콘텐츠 변경으로 오인해 근거를 추가하거나 데이터를 수정하지 않았다.

## 공식 모의 SDK 화면

localhost4193, 가상34개월 프로필에서 확인했으며 실제 토스앱/광고 노출 증거가 아니다.

- 320px: 각52.39~52.41×56px,393px: 각63.80×56px. 가로 넘침 없이5개 메뉴가 보인다. 꽃32px/브랜드24px, 홈34개월 안내 유지, 마이 /mypage 진입·선택 표시. [측정](evidence/mock-ui.json).
- 놀이A(play_162)의4점·메모를 남기고337px 아래에서 홈으로 진입하면0px. B(play_107)의 폼0px·빈 메모, 하단 메뉴 숨김 확인. B 저장 후1/3 도장1개. A 재진입0px에 기존4점·메모가 유지됐다.
- 이미지 지연 복귀 보완 후4회 모두533→533px. 일시 진입 추적에서 저장 값533이 유지되어도 이미지 로드 후DOM이886px로 밀리는 것을 확인하고 이미지의 공간을 확보했다. [최종 반복](evidence/back-restoration.json).
- A 저장 후2/3, C(play_016) 저장 후3/3·도장3개·BODY 포털393×852/x0/y0·72입자·pointer-events:none, 플랫폼 오류 없음. 자동 제거 후 배너 유지. [측정](evidence/mock-completion.json) · [화면](evidence/completed-home.png).
- 모의 서버를 정상 종료했고4193 listener가 남지 않았다. 실기기 iOS/Android·실제 광고·심사/공개 출시는 확인하지 않았다.

## 콘솔 등록

기존 노리공방 → 노리 레시피 → 앱 출시에서 버전 등록하기로 위 해시 파일을 선택했다. SDK3.10.0·기존 클립보드 쓰기 권한을 확인했다. 처음 메모130자는 콘솔100자 검증으로 거절되어 네트워크 업로드 전에82자로 줄였다. 그 뒤 등록은1회 실행했고20261118-6이 생성되어 서버 빌드 중 상태를 확인했다. 새로고침 후 SDK3.10.0·검토 필요·테스트 버튼을 확인했고,20261118-6 테스트 창의 QR과 packaging deploymentId가 일치함을 확인했다. 콘솔 업로드·서버 빌드는 완료이며 실제 토스 기기/광고 검증을 완료 처리하지 않는다. 테스트 푸시는 보내지 않았다. 심사 요청·공개 출시 버튼은 실행하지 않았다.

## 정리와 보존

토스 모의4193 서버는 정상 종료했고 HTML·두 이미지 snapshot 및 기존 웹 dist 보존을 검증했다. 브라우저 공간42는 테스트 QR의p1만 남기고 finish했다. 실제 토스에서 사용자가 확인할 수 있도록 QR 창을 유지한다. 새 worktree/clone은 없고 원본·최신 테스트/이전 운영 .ait를 보존한다. 이 요청의 소스 보정과 검증 기록도 기존 preview 흐름에 함께 보존한다.
