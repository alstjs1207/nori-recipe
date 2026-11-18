# 검증 — 2026-11-18

## 실제 구현·범위

원본 `/Users/msyu/study/play-recipe` preview에서 이전 미커밋 개선을 보존했다. 새 worktree/clone·패키지·DB 마이그레이션·원격 작업은 없다. 앞선 [전수 감사](/Users/msyu/study/output/play-recipe-scroll-audit-20261118/report.md)의 원인을 공통 이동 정책으로 수정했다.

AppLink/appRouter는 새 진입, 화면 뒤로가기와 브라우저 이력은 복귀로 분류한다. 네이티브 Tabs는 history를 사용하고 외곽 ScrollView에 같은 복원 규칙을 적용했다. parameter-only 업데이트는 새 진입으로 처리하지 않는다. 초안을 guest/놀이 ID별 앱 세션 저장소로 분리해 ID별 재마운트나 화면 이동에서 지우지 않는다. 성공한 제출 버전만 정리하며 실패·저장 중 새 입력·다른 놀이 초안은 보존한다. 영구 임시저장·앱 종료/새로고침을 넘는 복구·서버 동기화는 추가하지 않았다.

## 자동 검증

- Node24.21.0/pnpm10.33.0, 1차 `pnpm verify:local` 종료0. spec-tools8+toss7+단위144+play-review27+image-registration12+play-image-storage15+material-image-storage8+local-review26+web59 = **306개 통과**. 콘텐츠·이미지·명세·타입·웹 빌드 통과. 로그 `/tmp/play-recipe-entry-verify.log`.
- 1차 신규 회귀8개: 동일 상세 fresh/reset, 실제 목록 back 복원, 동일 탭 재누르기, 전환 중 출발 화면 관찰, history shrink, 복수 hook/파라미터 업데이트 중복 방지, 경로 정규화, guest/놀이 초안 격리·제출 버전/진행 중 편집·명시적 전체 초기화.
- 첫 직접 tsx CLI 호출은 sandbox의 IPC pipe 제한으로 실행되지 않았다. 같은 신규8개는 `node --import tsx --test ...`로 통과했고 전체 verify:local도 loopback 허용 실행으로 통과했다.
- 마지막 변경은 네이티브 spread prop 들여쓰기 정리이며 동작 변경이 없다. 이후 diff/check·spec:changed를 확인한다.

## 1차 빌드 실제 브라우저

별도 로컬 origin4330에 테스트 프로필을 만들고 최종 정적 빌드를 검증했다.4327 사용자 프로필·원본 저장소·운영 데이터는 건드리지 않았다.4330에만 완료/찜 fixture를 UI로 준비했다. 합계20개 1차 상태를 [JSON](evidence/browser-results.json)에 보존한다. DOM과 URL 전환이 끝난 뒤 뒤로가기를 수행했다.

| 경로 | 결과 |
| --- | --- |
| 같은 상세 안전 팁/300px → 홈 → 같은 추천 |0px·놀이 방법 |
| A4점·반응1개·메모 → B 입력/성공 저장 → A 재진입 | A4점·반응·메모 유지, 폼0px |
| A 저장 성공 후 A 폼 재진입 |0px·빈 별점/반응/메모. B 저장은 A 초안을 지우지 않음 |
| 검색어 종이·시간30·200px → 상세 → 화면 뒤로 | 검색어/시간/200px 유지 |
| 같은 결과를 다시 열기 | 상세0px |
| 같은 조건에서 브라우저 뒤로 | 검색어/시간/200px 유지 |
| 홈 상황 새 검색 |0px·상황 적용, 과거 검색어/시간 해제 |
| 기록 소근육 새 검색 |0px·소근육 적용 |
| 찜6개 목록 → 상세 → 뒤로 |249px →249px |
| 기록 목록 → 상세 → 뒤로 |321px →321px |
| 홈에서 프로필 재진입, 같은 프로필 버튼 재누르기 | 각각0px |
| 모바일390×844 같은 상세 재진입 |0px·놀이 방법 |
| 모바일 미저장3점/메모 재진입 | 폼0px,3점/메모 유지 |
| 개인정보 목적 직접 링크 | 개인정보 열림·해당 문단 이동(y1391.5) |
| 개인정보 방문 후 일반 이용 안내 새 진입 |0px·privacy 파라미터 제거·접힌 개인정보 |
| 모바일 탐색 → 상세 → 브라우저 뒤로 |600px →600px |
| 모바일 현재 탐색 탭 재누르기 |0px |

[새 기록 폼](evidence/mobile-fresh-form.png)과 [목록 위치 복원](evidence/mobile-list-restored.png)을 실제로 열어 제목·선택값·모바일 메뉴와 복원 위치를 확인했다. 실제 iOS/Android 네이티브·설치형 Safari·토스앱 검증은 수행하지 않았다. 네이티브는 공통 분류 회귀/타입과 소스 검토까지이며 실기기 확인은 남긴다.

## 인계·보존

최종 빌드는 원래4327 서버에 반영됐다. 검증4330 서버와 검증 브라우저는 작업 마무리에서 종료한다. 원본 checkout과 기존 미커밋 작업을 유지하므로 제거할 별도 작업용 폴더가 없다. 커밋·푸시·배포는 실행하지 않는다.

## 반복 방문 후 복합 필터 추가 보완

여러 탭을 왕복한 뒤 복합 필터에서 browser back을 누르는 경로에서 기존 history 모드가 이전 동일 탭을 제거하여 브라우저 URL이 push 대신 replace되는 원인을 추가로 확인했다. 설치된 React Navigation TabRouter의 공개 fullHistory 모드를 웹/네이티브에 적용하고 실제 TabRouter로 반복 방문→즉시 출발 목록 복귀 회귀1개를 추가했다. 뒤로 복귀한 과거 reset 플래그는 새 진입일 때만 입력을 초기화하도록 처리했다. 1차 결과와 최종 재검증은 구분하며 아래 최종 결과를 추가한다.

## 최종 재검증 — 반복 방문 보완 포함

- `pnpm verify:local` 최종 종료0: spec-tools8+toss7+단위145+play-review27+image-registration12+play-image-storage15+material-image-storage8+local-review26+web59 = **307개 회귀 통과**. 명세·콘텐츠/이미지·타입·웹 빌드 통과. 로그 `/tmp/play-recipe-entry-final-verify.log`.
- 설치된 React Navigation의 실제 TabRouter를 사용한 신규 회귀를 포함한다. React Navigation `TabRouter.tsx`의 fullHistory 모드가 반복 route key와 params를 보존하고, `useLinking.tsx`가 history 길이 증가를 pushState로 연결하는 것을 로컬 설치 소스로 확인했다. 패키지/lockfile은 변경하지 않았다.
- 최종 번들 `entry-4dc37083e3266b25dcb4a6f07e426bc5.js`, 셸 `e2ac3d68681f`. 별도4330 프로필에서 새 번들을 로드해 추가7개 핵심 상태를 검증했다. [최종 측정값](evidence/final-browser-results.json).
- 모바일390×844에서 이미 방문한 상세→홈→탐색→같은 상세 등 이력이 쌓인 상태로 `소근육/종이/30분/250px` 복합 조건을 적용했다. 브라우저 뒤로가기를2회 반복해 조건과250px 모두 보존했다.
- 최종 찜 목록250→250px, 기록 목록454→454px(검증용 기록이 추가된 뒤의 높이), 프로필0px, 새 상황 검색0px·과거 입력 해제·요청 상황 적용을 확인했다.
- A4점·`최종 검증 초안 A`를 입력하고 B를 성공 저장한 뒤 A에 다시 진입해도 폼0px·4점·메모가 유지됐다. [최종 초안 화면](evidence/final-draft-preserved.png).
- `spec:changed HEAD`와 `git diff --check` 통과.307개 전체 검증 뒤에는 실행 코드 변경 없이 검증 문서와 완료 이력만 정리한다.

- 마무리 확인: 검증 브라우저2개와4330 서버를 종료했다.4330 LISTEN 없음,4327 `/health`는 `status: ok`. 최종 초안 화면도 직접 열어4점 선택·폼 상단 표시를 확인했다.
