# 검증 기록

날짜: 2026-11-09. 원본 `/Users/msyu/study/play-recipe`, `preview`, 시작 HEAD `1a0d243`. 별도 worktree/clone 없음. 기존 roadmap 및 다른 3개 change 보존. 상태 **작업중**, archive하지 않음.

## 실행 결과

- Node **24.21.0**, pnpm **10.33.0**.
- `pnpm verify:local`: exit 0. spec-tools 7, 앱 단위 121(생년월 회귀 4 포함), play-review 27, local-review 26, web 28, 총 **209개 통과**.
- 명세·해시·콘텐츠·이미지 검사, TypeScript, 웹 빌드 통과. 208개 공개 상세와 12개 셸 자산 생성.
- `pnpm spec:check`: active/current 18개 및 archived 2개 통과. policy evidence 34개 요구사항·72개 시나리오·242개 분류 파일.
- `pnpm spec:changed 1a0d243`, `git diff --check`: 통과. 신규 소스는 spec:index 반영.
- 최초 sandbox의 tsx CLI는 IPC listen EPERM으로 실행되지 않았다. `node --import tsx --test`로 신규 4개 회귀 통과 후, 전체 검증은 loopback/IPC 사용을 허용한 실행에서 정상 완료했다.

## 브라우저 회귀

Ego Browser 전용 TaskSpace 59, 테스트 origin `http://127.0.0.1:4187`. 실제 운영 저장소는 접근·변경하지 않았다. 자동화의 month fill은 React 상태 이벤트를 반영하지 않아 실제 키보드 조작 또는 native value setter + input/change 이벤트로 검증했다.

- 첫 시작: 생년월 입력 → 22개월 자동 표시 → 저장 → 발견 이동 확인.
- 설정: 생년월 변경 → 10개월 표시·저장 → 새로고침 후 `2026-01` 복원 확인.
- 미래 `2027-01`: 이번 달까지 입력 안내 및 저장 비활성 확인. 범위 밖 `2022-01`도 저장 비활성 확인. 빈 값·잘못된 월·0/48개월 경계·연말/월말은 날짜 유틸 회귀로 검증.
- 기존 저장값 `2020-01`: **82개월**로 표시, HTML validity 통과, 이름만 저장해도 출생월 인덱스 **24240** 유지. 테스트 guestId·찜 저장값 보존 확인.
- 탐색: `종이`, 시간 `30분 이하`, scrollTop **300** → play_081 상세 → 화면 뒤로가기 → `/search`, 검색어·필터·scrollTop **300** 보존.
- 브라우저 history.back: 동일 검색어·시간 필터 보존. 링크 클릭 때 브라우저가 스크롤한 실제 출발 위치(scrollTop **494**)로 복원.
- 저장 탭 → play_081 → 뒤로가기 → `/favorites` 복귀 확인.
- 새 탭 상세 직접 방문 → 화면 뒤로가기 → `/` 확인.
- iOS `navigator.standalone=true` + pageshow 에뮬레이션: 설치 완료 상태 표시 확인. 실제 iPhone 설치와 구분한다.
- 빌드 HTML: viewport-fit=cover, apple-mobile-web-app-capable=yes, 상태 표시줄 black-translucent 확인. manifest standalone 유지.
- 세로 **390×844**, 상단 59px·하단 34px 에뮬레이션: shell top=0/bottom=844, nav top=744/bottom=844, nav link bottom=802. 가로 넘침 없음.
- 가로 **844×390**, 좌우 59px·하단 21px 에뮬레이션: 입력 필드 left=116/right=728. 가로 넘침 없음. 스크린샷 시각 확인.

## 확인 한계와 남은 작업

- 실제 iPhone 홈 화면 설치·상태 표시줄 가독성·회전·네이티브 생년월 입력은 실기기에서 확인해야 한다. tasks 4.2를 미완료로 유지한다.
- Chromium의 설치 버튼은 브라우저 설치 흐름으로 진입하여 Safari 수동 안내 분기는 이 환경에서 화면 검증하지 않았다. 수동 안내 문구는 소스에서 Safari 공유 메뉴·홈 화면에 추가·웹 앱으로 열기·홈 화면 아이콘 실행을 확인했다.
- 첨부 이미지에는 브라우저 주소창과 하단 도구막대가 보인다. 이 UI는 CSS로 제거할 수 없으며 웹 앱 모드로 설치·실행해야 한다. 기존 데이터 삭제를 요구하지 않는다.
- 배포·iPhone 재설치는 이번 작업에서 수행하지 않았다. 기존 서비스 워커의 선택 업데이트 정책을 유지한다.

근거: [Apple 설치 안내](https://support.apple.com/en-az/guide/iphone/iphea86e5236/26/ios/26), [Apple 전체 화면 상태 표시줄 메타데이터](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html).

## 화면 근거

- [탐색 복귀](verification/search-restored.png)
- [세로 안전 영역·기존 출생월](verification/safe-portrait.png)
- [가로 안전 영역](verification/safe-landscape.png)

브라우저 전용 작업 공간은 finish({keep:[]})로 종료했다. 이 작업에서 실행한 4187 포트 검증 서버(PID 89029)는 종료했고 포트 해제를 확인했다. 원본 폴더는 유지한다. 초기 구현·검증은 커밋·푸시 없이 마쳤으며, 2026-11-09 후속 사용자 요청에 따라 검증된 변경을 preview에 커밋·푸시한다. 실제 iPhone 확인 전까지 작업중 상태를 유지하며 main 병합·운영 배포·archive는 수행하지 않는다.


## 년·월 휠 후속 수정 — 2026-11-09

사용자 요청으로 기존 native month 입력을 년·월 두 개의 웹 휠로 변경했다. 원본 preview에서 진행하며 DB 저장 형식·월령 계산·기존 데이터 보존 규칙을 유지한다.

- 44px 행, 세로 5개·높이 500px 이하 화면 3개 행, 중앙 선택 강조. 터치 관성 스크롤과 CSS scroll-snap, 행 누르기, 방향키·PageUp/Down·Home/End, listbox/option 접근성 제공.
- 년·월 중 하나만 고른 동안 저장 비활성. 선택 완료 후 월령 즉시 계산.
- 당해 미래 월 및 48개월 이전 신규 월을 선택 목록에서 제외. 년도 변경 때 기존 월이 범위를 벗어나면 가장 가까운 유효 월로 맞춘다. 저장된 오래된 년·월은 복원한다.
- 날짜·휠 유틸 **6개 회귀 통과**. 년·월 양쪽 선택 순서, 0/48개월 경계, 기존 출생월 예외, 미래 월 보정을 검증했다.
- `pnpm verify:local` exit 0: spec-tools 7, 앱 단위 123, play-review 27, local-review 26, web 28, 총 **211개** 통과. TypeScript·콘텐츠·이미지·명세 검사·웹 빌드 통과.
- 높이가 낮은 화면에서 휠을 3행으로 줄이는 CSS 보완 후 `pnpm build:web` 재실행 통과. 최종 빌드의 320px 화면에서 년·월 선택 및 가로 넘침 없음 확인.
- Ego Browser 전용 TaskSpace 60, `127.0.0.1:4188` 및 `localhost:4188` 테스트 origin 사용. 운영 저장소는 변경하지 않았다.
- 390×844: 년도만 2024년 선택 → 저장 비활성. 12월 선택 → **23개월**. 마우스 휠로 9월 선택 → **26개월**. 2026년 선택 → 미래 12월은 목록에 없음.
- CDP touch 제스처로 월 9→7월 선택 → **4개월**, 바깥 페이지 scrollTop **414** 유지. 저장 후 설정에서 **2026년·7월**, 휠 scrollTop **44·308** 복원.
- 기존 저장값 **2020-03(80개월)** 표시, 이름만 저장해도 출생월 인덱스 **24242** 유지. 년도를 2022년으로 바꾸면 **11월(48개월)**로 보정.
- 844×390 가로 화면은 두 휠 clientHeight **132px**(3행), 가로 넘침 없음. 320×780 작은 화면에서 월을 먼저 12월 선택 → 저장 비활성, 년도를 2026년 선택 → 현재 월 **11월·0개월**로 보정.
- 전용 브라우저 작업 공간은 finish({keep:[]})로 종료. 실제 iPhone 관성·VoiceOver·PWA 설치 확인은 미완료(tasks 4.2)이며 작업중 상태를 유지한다.

화면 근거: [첫 시작 390px](verification/wheel-mobile.png), [설정](verification/wheel-settings.png), [가로 3행 휠](verification/wheel-landscape.png), [작은 320px 화면](verification/wheel-small.png).

휠 검증용 4188 포트 임시 서버(PID 3623)는 종료했고 포트 해제를 확인했다. 별도 작업 폴더는 만들지 않았으며 원본 폴더를 유지한다.


## 탐색 월령 휠 후속 수정 — 2026-11-09

탐색은 생년월로 바꾸지 않고 개월 단위를 유지했다. 상단 월령 버튼을 누르면 모바일 하단 시트·데스크톱 가운데 선택창에서 0~48개월 단일 휠과 전체 월령·우리 아이 바로가기를 제공한다. 공용 WheelPicker로 기존 생년월 휠을 재사용하며 저장 형식·추천·분석 정책을 유지한다.

- 선택창 draft를 조작하는 동안 기존 탐색 월령은 그대로 유지하며 `월령 적용`에서만 검색 state를 갱신한다. 취소·닫기·Escape는 기존 검색을 유지한다.
- HTML dialog의 모달 포커스 제한과 닫기 후 버튼 포커스 복원을 사용한다. 저장 프로필이 48개월을 넘으면 기존 월령도 옵션으로 복원한다.
- `pnpm verify:local` exit 0: spec-tools 7, 앱 단위 123, play-review 27, local-review 26, web 28, 총 **211개 통과**. 타입·콘텐츠·이미지·명세 검사·웹 빌드 통과.
- Ego Browser TaskSpace 61, 로컬 테스트 origin `127.0.0.1:4189`에서 확인했다. 운영 데이터는 변경하지 않았다.
- 프로필 없는 첫 탐색은 전체 월령. 휠을 24개월로 바꿔도 적용 전 버튼은 전체 월령 유지. 취소하면 전체 유지·버튼으로 포커스 복원. 재진입 선택값 전체·scrollTop 0.
- 24개월 적용 후 재진입: 선택값 24개월·scrollTop **1100** 복원. 25개월로 바꾼 뒤 Escape → 적용값 24개월 유지.
- 추출한 공용 휠로 첫 시작에서 **2024년·11월 → 24개월** 선택·저장 확인. 탐색 기본 월령·선택창·우리 아이 바로가기 모두 **24개월**로 표시.
- 터치 제스처로 24→27개월을 선택해도 적용 전 탐색은 24개월. 이후 36개월 적용 시 검색 결과 변경 확인.
- `종이`·시간 `30`·월령 `36개월`, scrollTop **300**에서 상세 방문 후 뒤로가기 → 동일 검색어·시간·월령·scrollTop **300** 유지. 프로필 JSON이 적용 전과 완전히 동일함을 확인했다.
- 우리 아이 바로가기: draft 24개월·scrollTop **1100**으로 이동하며 적용 전 기존 필터 36개월 유지. 적용 시 24개월. 전체 월령 바로가기 적용 시 전체로 전환. 휠 Home+ArrowDown은0개월, End는 48개월 표시.
- 390×844 모바일 하단 시트·1200×900 데스크톱 가운데 선택창을 시각 확인. 320×780 및844×390 가로에서도 가로 넘침 없음·하단 취소/적용 버튼 접근 확인. 가로에서 선택창 본문은 스크롤할 수 있다.
- 320px 안전 영역 에뮬레이션 중 기존 모바일 공통 dialog-footer 스타일이 하단 여백을 덮는 것을 발견해 선택창 footer 선택자 우선순위를 보완했다. 해당 CSS 보완 후 최종 웹 빌드를 재실행했다. 실제 iPhone 설치·회전·VoiceOver 확인은 기존 tasks 4.2 미완료로 유지한다.
- Ego의 모달 취소 버튼 DOM click은 화면 밖이라고 잘못 판정했다. 스크린샷에서 버튼 위치를 확인하고 실제 마우스 클릭으로 취소를 확인했으며 이후 적용/취소 회귀는 포커스·Enter로 검증했다.
- 전용 브라우저 작업 공간은 finish({keep:[]})로 종료했다.

화면 근거: [모바일 탐색 월령 시트](verification/search-age-sheet.png), [데스크톱 선택창](verification/search-age-desktop.png).

탐색 휠 검증용 4189 포트 서버(PID 7162)를 종료하고 포트 해제를 확인했다. 원본 `/Users/msyu/study/play-recipe`에서만 작업했으며 별도 작업 폴더는 만들지 않았다.
