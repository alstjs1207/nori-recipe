# 노리 레시피 앱인토스 출시 준비

appName은 `nori-recipe`, 표시 이름은 **노리 레시피**다. 기존 웹/PWA와 별도로 로그인·결제·광고 없이 추천·탐색·상세·찜·기록·설정을 제공한다. 사용자 식별키 발급은 토스 로그인 가입을 추가하는 것이 아니다.

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
- 공통 내비게이션과 네 개의 플로팅 탭을 사용한다. 중복 뒤로가기·PWA 설치/업데이트·웹 분석 동의 유도를 표시하지 않는다.
- 토스에서는 가족 요약·월령 단축 버튼의 상단 헤더와 공통 AI 안내 문단을 표시하지 않는다. 월령은 기존 내 설정·온보딩에서 수정한다.
- 그림 위 AI 삽화 라벨은 표시하지 않고 이용 안내의 AI·안전 고지는 유지한다. 추천·안전 필터·검수 정책은 유지한다.
- 토스에서는 GA를 불러오거나 웹 분석 동의를 읽지 않으며 전용 개인정보·기기 저장 안내를 제공한다.

## 콘솔 등록과 최종 테스트

아래는 로컬 구현과 별도로 확인할 외부 작업이다. 실제 수행한 항목만 체크한다.

- [ ] 콘솔 앱 유형은 비게임, appName은 `nori-recipe`로 확인한다.
- [ ] `app-info.json`의 이름·설명·문의 이메일과 로고를 확인해 등록한다. 성인 보호자가 사용하는 서비스라는 점에 맞춰 이용 연령을 설정한다.
- [ ] 기능별 딥링크를 등록하고 미니앱에서 각 기능을 완결적으로 제공하는지 확인한다.
- [ ] 현재 소스와 보고서의 버전·해시를 확인하고 `nori-recipe.ait`를 업로드한다.
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

## 공식 근거

- [웹 SDK 연동](https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview)
- [비게임 출시 기준](https://developers-apps-in-toss.toss.im/checklist/app-nongame)
- [UI/UX](https://developers-apps-in-toss.toss.im/design/consumer-ux-guide)
- [저장소](https://developers-apps-in-toss.toss.im/documentation/common/file-storage/storage)
- [사용자 식별](https://developers-apps-in-toss.toss.im/guide/authentication/anon-key)
- [콘솔 등록](https://developers-apps-in-toss.toss.im/guide/operation/console-workspace)
- [공유](https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/share/share.createlink)
- [정책·AI 고지](https://developers-apps-in-toss.toss.im/guide/undefined)
