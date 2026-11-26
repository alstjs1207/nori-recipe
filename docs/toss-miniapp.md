# 노리 레시피 앱인토스 출시 준비

appName은 `nori-recipe`, 표시 이름은 **노리 레시피**다. 기존 웹/PWA와 별도로 로그인·결제 없이 추천·탐색·상세·찜·기록·설정을 제공한다. 사용자 식별키 발급은 토스 로그인 가입을 추가하는 것이 아니다.

## 실행과 산출물

Node 24와 pnpm 10.33.0을 사용한다.

```sh
pnpm install --frozen-lockfile
pnpm test:toss
pnpm typecheck
pnpm build:toss
pnpm check:toss
```

- `nori-recipe.ait`: 공식 SDK 3.10.0 CLI로 만든 업로드 대상.
- `dist-toss/`: 토스 전용 정적 export. 일반 브라우저에는 실제 토스 브릿지가 없으므로 화면 확인은 아래 Devtools를 사용한다.
- `generated/toss-release/build-report.json`: 비압축 용량·파일 수·아티팩트 SHA-256·이미지 검증 수와 외부 확인 상태.
- `generated/toss-release/logo-600.png`: 기존 자체 브랜드 심벌로 만든 불투명 600×600 PNG.
- `generated/toss-release/app-info.json`: 콘솔에 옮길 이름·부제·설명·문의 이메일·기능별 딥링크.

토스용 화면 참고 PNG 3장은 `openspec/changes/add-toss-miniapp/evidence/01-home.png`, `02-search.png`, `03-play.png`에 있다. 636×1048 크기이며 모의 SDK의 테스트 설정으로 캡처했다. 개발 패널을 제외한 앱 화면으로, 실제 토스 공통 내비게이션을 합성하지 않았다. 콘솔 제출 전 실제 기기 표시를 대조한다.

기본 이미지 입력은 `scripts/toss/config.mjs`의 기존 승인 매니페스트와 Supabase 공개 버킷이다. `PLAY_IMAGE_PUBLIC_*`, `MATERIAL_IMAGE_PUBLIC_*`로 다른 검증된 공개 입력을 지정할 수 있다. 공개 파일 전체를 익명 GET으로 받아 SHA-256·크기·WebP를 확인하므로 네트워크가 필요하다. 받은 공개 객체를 `PUBLIC_ASSET_DIR`에 버킷/객체 경로대로 준비하면 같은 검사를 오프라인으로 실행할 수 있다. 관리자 키나 원본 JPEG는 토스 빌드에 제공하지 않는다.

`TOSS_APP_NAME` 변경 시 콘솔 값도 맞춰야 한다. 기본값은 사용자가 지정한 `nori-recipe`다. 번들 검사는 모의 SDK·소스맵·PWA 등록·기밀·원본 JPEG와 100MB 초과를 거부한다. export·SDK 포장·검사가 끝난 뒤 디렉터리·아티팩트·보고서를 함께 교체하며 실패하면 직전 출력을 복원한다. 복원 자체가 실패하면 오류가 알려주는 staging 경로를 보존한다.

토스 배포 빌드는 Expo의 서버 UUID와 서버·개발 번들 로더 fallback을 제외한다. 실제 브라우저 crypto.randomUUID·UUID v5와 브라우저 로더 구현은 유지하며 일반 웹/네이티브·Devtools에는 적용하지 않는다. 최종 JS 및 HTML inline script를 구문 분석해 eval 참조·Function 생성자가 있으면 공식 SDK 포장 전에 실패한다. 라이브러리의 예상 분기가 바뀌어도 변환을 중단한다. build-report.json의 dynamicCodeChecked=true는 이 로컬 검사 통과이며 콘솔 검수 승인을 뜻하지 않는다. [공식 eval 반려 안내](https://techchat-apps-in-toss.toss.im/t/eval/3671).

기존 `pnpm build:web`, `dist`, Vercel 배포 흐름은 유지한다. 커밋·푸시·배포는 위 명령에 포함되지 않는다. 토스 빌드는 GA·Vercel·dotenv·관리자 변수를 export/포장 프로세스에 전달하지 않는다.

## 브라우저 화면 확인

```sh
pnpm dev:toss
```

기본 주소는 `http://localhost:4189`다. 포트는 `PORT=4190 pnpm dev:toss`로 바꾼다. 공식 `@apps-in-toss/devtools`의 모의 SDK와 패널을 사용한다. 실제 계정·기기·공유 앱 검증을 대신하지 않는다. 서버를 종료한 뒤 다른 빌드나 웹 개발 서버를 실행한다.

실행 중에는 공개 이미지 매니페스트와 HTML을 토스용으로 잠시 적용하고 정상 종료 시 원래 바이트로 복원한다. 강제 종료 후에는 `git diff`로 `public/index.html`, `src/constants/playImageWebManifest.json`, `src/constants/materialImageWebManifest.json`을 확인한다. 변경 내용을 모르는 상태에서 `git checkout`으로 덮어쓰지 않는다.

## 데이터와 화면 정책

- 일반 웹·네이티브의 기존 키와 guestId를 유지한다.
- 토스 SDK Storage는 사용자 식별키별로 분리한다. 식별 실패 때 다른 저장소로 우회하지 않고 재시도를 제공한다.
- 사용자 변경을 감지하면 이전 상태의 쓰기를 막고 재시작한다. 전체 초기화는 현재 사용자 공간의 서비스 키만 제거한다.
- 웹·QR 테스트·정식 출시·다른 기기의 기록은 자동 공유·백업되지 않는다. 식별키가 같아도 삭제한 앱이나 다른 기기의 기록을 복구하지 않는다.
- 공유는 `intoss://nori-recipe/play/play_001`에서 SDK 링크를 만든다. 공개 놀이 ID만 포함하며 개인 정보·재료 query·테스트 스킴은 포함하지 않는다.
- 공통 내비게이션과 발견·탐색·저장·기록·마이5개의 플로팅 탭을 사용한다. 작은 화면에서도5칸을 같은 너비로 배치하고 각 터치 높이를56px 이상 유지한다. 중복 뒤로가기·PWA 설치/업데이트·웹 분석 동의 유도를 표시하지 않는다.
- 토스에서는 기존 꽃 로고·노리레시피 브랜드 헤더를 원래 크기로 표시한다(모바일 꽃32px·글자24px). 불투명 토스 호스트 아래 WebView에서는 상단 inset을 다시 더하지 않는다. 브랜드의 상하padding은0·홈 링크 터치 높이는44px 이상, 본문 상단 여백은8px로 줄인다. 하단/좌우 안전 여백은 유지한다. 가족 요약·월령 단축 버튼과 공통 AI 안내 문단은 표시하지 않는다. 월령은 기존 내 설정·온보딩에서 수정한다.
- 그림 위 AI 삽화 라벨은 표시하지 않고 이용 안내의 AI·안전 고지는 유지한다. 추천·안전 필터·검수 정책은 유지한다.
- 토스에서는 GA를 불러오거나 웹 분석 동의를 읽지 않으며 전용 개인정보·기기 저장 안내를 제공한다.

## 다음 놀이 시작 광고

2026-11-26 로컬 검증: 루트 `nori-recipe.ait`는 다음시작 지면의 테스트 ID 번들(3,967,073bytes)이다. [검증/보고서](../openspec/changes/move-toss-ad-to-next-round/verification.md). 이전 `generated/toss-completion-ad/`의 파일은 완료 직후 광고 동선의 과거 산출물이므로 이번 QR 확인에 사용하지 않는다.

추천3개 완료와 기록 저장 후 홈 복귀는 축하로 마친다. 홈의 **‘다음 놀이 3개 시작’** 버튼을 누르면 광고와 실제 표시 후24시간 무광고를 안내하는 팝업을 열고, **‘확인’**을 누른 뒤 준비된 **전면형 광고**를 표시한다. ‘취소’·뒤로가기는 기존3/3을 유지하며,24시간 안에는 팝업과 광고 없이 바로 진행한다. 닫힌 뒤 현재 재료의 다음 회차0/3으로 진행한다. 재료 선택창을 열거나0~2개 완료 상태에서 재료를 저장할 때는 광고가 없다.3개 완료 후 홈/설정의 재료 저장으로 새 묶음을 시작할 때는 같은 확인 팝업·광고·24시간 제한을 적용한다. 안내를 취소하면 편집 초안을 유지한 재료창으로 돌아가고 기존3/3·기록·재료 설정은 유지한다.

실제 SDK `show` 시각부터 **연속24시간**은 새 추천을 몇 번 시작해도 광고가 없다. 시각은 현재 토스 사용자별 기기에만 저장하고 재접속에 복원하며 전체 로컬 초기화 시 삭제한다. 자정·로드·표시 요청·`impression`은 기준이 아니다. 미준비/실패는 바로 추천하고 나중에 광고를 띄우지 않는다. 표시 콜백이 없으면5초, 닫힘 콜백이 없으면 앱 복귀 또는 표시 후60초에 다음 추천을 준비한다. SDK 광고 자체를 강제로 닫지 않는다. 닫힘 이벤트 누락은 공식 문서의 Android토스5.255.0 사례에 대비한 처리다.

```sh
# 기본은 테스트 광고. 개발 실행도 운영 환경변수를 무시하고 테스트 ID만 사용한다.
pnpm build:toss
# 공개 출시용: 콘솔의 전면형 그룹 ID를 명시한다. dotenv는 읽지 않는다.
TOSS_AD_MODE=production pnpm build:toss
# 광고를 끈 번들이 필요한 경우
TOSS_AD_MODE=disabled pnpm build:toss
```

이번 완료 광고 작업의 QR 테스트용 번들은 `generated/toss-completion-ad/test/nori-recipe.ait`, 운영 ID 번들은 `generated/toss-completion-ad/production/nori-recipe.ait`에 보존했다. 테스트는 반드시 전자의 테스트 ID 번들로 진행한다.

기본 테스트 ID는 `ait-ad-test-interstitial-id`다. 운영 모드는 사용자가 전달한 `ait.v2.live.b6af39a4123a41ae`를 사용하며 `TOSS_COMPLETION_AD_GROUP_ID`로 명시적으로 바꿀 수 있다. `generated/toss-release/build-report.json`의 `ads.mode`, `adGroupId`, `placement`, `format`을 확인한다. 테스트 번들을 운영 광고 연결 완료로 표시하지 않는다. 콘솔에서 사업자·정산·약관 상태와 전면형 광고 그룹을 확인해야 한다. 그룹 생성 후 반영에는 최대 2시간이 걸릴 수 있다.

공식 Devtools는 UI 모의 검증용이며 실제 광고는 샌드박스에서 지원하지 않는다. 테스트 ID 번들을 콘솔 QR로 열어 iOS·Android에서 1·2·3개 완료와 기록 저장 무광고, 홈 다음시작에서만 노출, 광고 닫기·뒤로가기·닫힘 누락 복귀, 미준비/실패 즉시 추천, 재접속/자정/24시간 제한를 확인한다. 실제 광고 클릭·노출을 자동화하지 않는다.

## 콘솔 등록과 최종 테스트

아래는 로컬 구현과 별도로 확인할 외부 작업이다. 실제 수행한 항목만 체크한다.

- [ ] 콘솔 앱 유형은 비게임, appName은 `nori-recipe`로 확인한다.
- [ ] `app-info.json`의 이름·설명·문의 이메일과 로고를 확인해 등록한다. 성인 보호자가 사용하는 서비스라는 점에 맞춰 이용 연령을 설정한다.
- [ ] 기능별 딥링크를 등록하고 미니앱에서 각 기능을 완결적으로 제공하는지 확인한다.
- [ ] 최신 상단 여백 수정 번들을 업로드한다. 이전20261118-6의 서버 빌드·QR은2026-11-18 확인했으며,2026-11-19 새 파일 업로드는 사용자가 직접 진행한다.
- [ ] 테스트 ID로 광고 로드·다음시작 노출·닫기/누락·실패·24시간 제한를 QR 실기기에서 확인하고 출시 직전 운영 그룹을 지정해 다시 빌드한다.
- [ ] QR로 iOS·Android에서 홈·상세·검색·설정을 열고 직접 진입·최초 종료·시스템 뒤로가기·대화상자 닫기를 확인한다.
- [ ] 월령·재료·찜·완료 기록·평점·반응·메모를 저장하고 종료·재접속·버전 업데이트 후 복원되는지 확인한다.
- [ ] 다른 사용자에게 기록이 보이지 않는지, 전체 초기화가 현재 사용자 데이터만 지우는지 확인한다.
- [ ] 공유·복사 성공/거부/실패/재시도를 확인한다. 정식 `intoss://`는 출시 뒤 확인하며 출시 전에는 콘솔 QR/테스트 스킴으로 경로를 테스트한다. 테스트 스킴을 사용자용으로 배포하지 않는다.
- [ ] 작은 화면·키보드·홈 인디케이터에서 입력·탭·완료 버튼이 가리지 않는지 확인한다.
- [ ] 이미지 오류·단절·저장 실패에서 기록이 유실되거나 성공으로 오표시되지 않는지 확인한다.
- [ ] 개인정보·AI 고지·그림 표시·콘텐츠 출처와 이용 권한·브랜드 정보를 확인한다.
- [ ] 선택 스크린샷은 실제 토스용 화면으로 세로 636×1048 PNG 3장 이상 또는 가로 1504×741 PNG 1장 이상을 준비한다. 개발 패널·가상 내비게이션·개인 정보를 포함하지 않는다.
- [ ] 검토 요청·피드백 반영·승인 후 출시와 정식 공유 링크를 확인한다.

콘솔 토큰 등록·실제 업로드·심사 요청·공개 출시를 자동 수행하는 명령은 추가하지 않았다.

## 최신 등록 — 2026-11-18

- 콘솔 버전 **20261118-6**, SDK3.10.0, 상태 **검토 필요**, 테스트 QR 제공.
- 파일: `generated/toss-home-navigation/test/nori-recipe.ait` (3,950,505bytes). 이전 등록 파일의 보존 경로이며 루트 파일은 이후 빌드로 교체될 수 있다. 이전 운영 광고 ID 번들은 `generated/toss-completion-ad/production/`에 보존했다.
- 테스트 광고 ID이며 QR 실기기·실제 광고·심사 요청·정식 출시는 미확인이다. 최신 홈/완료/스크롤/초안/마이 개선과 토스5칸56px 메뉴·그림 로딩 복귀 보정을 담았다.
- [업로드·해시 근거](../openspec/changes/archive/2026-11-18-prepare-updated-toss-upload/verification.md).

## 업로드 대기 파일 — 2026-11-19

- 상단 SDK inset 중복을 제거하고 브랜드 상하padding0·홈 링크44px·본문 상단8px로 줄였다. 로고 크기와 하단/좌우 안전 여백은 유지한다.
- `generated/toss-top-spacing/2026-11-19/test/nori-recipe.ait` (3,950,568bytes). 루트 `nori-recipe.ait`도 같은 새 번들이다. 이전20261118-6 파일은 위 보존 경로에 유지한다.
- 기존과 같은 테스트 광고 ID다. 사용자 요청으로 파일만 생성했으며 콘솔 업로드/QR·실기기 확인은 사용자 진행 후 확인한다.
- [검증·빌드 보고서](../openspec/changes/archive/2026-11-19-reduce-toss-top-spacing/verification.md).

## eval 반려 수정 파일 — 2026-11-24

- 이전 2026-11-24 테스트/운영 번들의 Expo 서버·개발용 eval2곳을 제거했다. 새 경로는 `generated/toss-eval-fix/2026-11-24/test/nori-recipe.ait`와 `production/nori-recipe.ait`다.
- 두 파일 내부 ZIP의 JS에서 eval0개·Function 생성자0개를 확인했고 전체353개 회귀·타입·웹/토스 빌드·강화된 번들 검사를 통과했다. 일반 웹 출력과 원본 manifest를 보존했다.
- 이전 `generated/toss-home-rounds/2026-11-24/` 파일은 반려 원인 재현용으로 보존한다. 재제출에는 새 파일을 사용한다. 콘솔 업로드·실기기·최종 검수 승인은 이번에 실행하지 않았다.

## 공식 근거

- [웹 SDK 연동](https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview)
- [비게임 출시 기준](https://developers-apps-in-toss.toss.im/checklist/app-nongame)
- [UI/UX](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide)
- [저장소](https://developers-apps-in-toss.toss.im/documentation/common/file-storage/storage)
- [사용자 식별](https://developers-apps-in-toss.toss.im/guide/authentication/anon-key)
- [콘솔 등록](https://developers-apps-in-toss.toss.im/guide/operation/console-workspace)
- [공유](https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/share/share.createlink)
- [정책·AI 고지](https://developers-apps-in-toss.toss.im/guide/undefined)

- [공식 인앱 광고 정책](https://developers-apps-in-toss.toss.im/guide/monetization/in-app-ad)
- [공식 전면형 SDK·테스트 ID·QR 테스트 안내](https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/interstitial-rewarded-ad)
