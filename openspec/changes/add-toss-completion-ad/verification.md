# 검증 — 2026-11-18

원본 `/Users/msyu/study/play-recipe`, preview. 별도 worktree·clone 없음. 아래 구현 검증 시점에는 커밋·푸시·콘솔 업로드·공개 출시를 수행하지 않았다.

## 근거와 구현

[공식 광고 정책](https://developers-apps-in-toss.toss.im/guide/monetization/in-app-ad), [전면형 SDK·테스트 ID](https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/interstitial-rewarded-ad)를 확인하고 SDK3.10.0 타입과 대조했다. 지원 여부는 공식 `isSupported()`에 맡긴다. 개발/기본 빌드는 `ait-ad-test-interstitial-id`, 운영 모드는 사용자 제공 `ait.v2.live.b6af39a4123a41ae`다. 운영 ID로 광고 노출·클릭을 테스트하지 않았다.

REC-004의 고정 추천·기존 완료 이력·축하 효과를 유지한다. 새 기록을 제외하면 미완료였던 세트에만 노출한다. 일일 초기화·새 세트 자동 생성·리워드를 추가하지 않는다. SDK에는 광고 그룹 ID만 보내며 기록은 메모리에서 로컬 비교한다. 추가 저장 키·DB 마이그레이션은 없다.

## 자동 검증

- Node24.21.0/pnpm10.33.0. `verify:local --public-images`의 명세·콘텐츠·298개 회귀·타입 단계 통과. spec-tools8, toss7, 앱136(신규 광고6 포함), play-review27, image-registration12, play-image-storage15, material-image-storage8, local-review26, web59 = **298개**, 실패0.
- 최초 네트워크 웹 빌드는 검증 가능한 기존 공개 객체 캐시로 전환하며 직접 중단했다. 캐시 재실행도 모든 테스트·타입 단계를 통과했으나 중단한 빌드의 잠금으로 마지막 웹 빌드가 실패했다. 해당 프로세스 종료·잠금 미사용·빈 staging을 확인한 뒤 이번에 생성한 `generated/web-build-8jugEO`와 `generated/play-image-storage/web-output.lock`만 정리했다. 이후 같은 `verificationEnvironment`로 `pnpm build:web` 종료 코드0. **verify:local 단일 실행 전체 성공으로 기록하지 않는다.**
- 웹 빌드는 공개 놀이208개·놀이 파생416개·재료66개의 SHA-256·크기·WebP를 검증했다. 일반 웹 번들에 토스 저장 prefix·운영/테스트 광고 ID가 없음을 확인했다.
- 공식 SDK 테스트 번들 **3,944,198 bytes**, SHA-256 `5c94386f10dda967012fed267d675ed6505a3fea47f314bded56d41afbde6c51`. [테스트 보고서](evidence/test-build-report.json).
- 운영 번들 **3,943,775 bytes**, SHA-256 `125d48bacdecdc2acc8e07a5a84b6156e3004afd846ef48bd1c1bb75d47f09a7`. 비압축 **7,431,631 bytes**,457개 파일. 실제 운영 ID가 있고 테스트 ID는 없다. [운영 보고서](evidence/production-build-report.json).
- 두 모드는 `generated/toss-completion-ad/test/nori-recipe.ait`와 `generated/toss-completion-ad/production/nori-recipe.ait`에 각각 보존한다. 루트 `nori-recipe.ait`와 `dist-toss`는 운영 모드다. 처음 테스트 번들을 `toss-release` 내부에 보관해 운영 빌드 교체로 사라지는 문제가 있어, 최종 두 번들을 교체 대상 밖에서 다시 빌드·보존하고 해시를 검증했다.
- `pnpm check:toss`, `pnpm spec:check`, `pnpm spec:changed HEAD`, `git diff --check` 통과. 외부 검증이 남아 change는 archive하지 않는다.

## 모의 화면

공식 Devtools 새 localhost4203에서 가상 보호자와 추천 `play_013`, `play_213`, `play_010`을 사용했다. 실제 사용자 저장소·운영 광고 요청은 사용하지 않았다.

- 실제 피드백 양식에서 평점 선택 후 저장: 첫째/둘째 기록1개/2개, 광고0회.
- 셋째 저장 후 홈 복귀: 기록3개·광고1회·기존 완료 메시지·축하 파티클20개. 호출은 같은 테스트 그룹으로 `load → show → load`. [호출 근거](evidence/mock-completion.json).
- 탐색 후 홈 복귀에서도 광고1회 유지. 새로고침 후 광고0회, 완료 메시지 유지.
- 393×852 [완료 화면](evidence/completed-home.png)을 시각 확인했다. AIT 개발 버튼이 포함된 QA 화면이며 실제 네이티브 광고 재생 증거는 아니다.
- 가상 테스트 키9개·브라우저 공간31·직접 띄운 개발 서버를 정리했다. HTML과 두 이미지 snapshot의 SHA-256이 시작 전과 같게 복원됐다. 임시 staging은 제거됐고 두 번들은 최종 산출물로 유지한다.

## 외부 확인

실제 광고는 샌드박스가 아니라 콘솔 QR의 토스앱에서 테스트 ID로 확인해야 한다. 테스트 번들 업로드/QR iOS·Android에서 로드·표시·닫기·클릭 후 복귀·뒤로가기·실패 시 기록 유지 검증은 미수행이다. 콘솔 사업자·정산·그룹 유형도 미확인이다. ID 연결·운영 빌드를 실제 송출·심사·공개 출시 완료로 해석하지 않는다.

## preview 반영

2026-11-18 사용자가 이번 광고 작업의 preview 커밋·푸시를 요청했다. 최신 원격 preview는 `9fb9b5f`로 로컬 HEAD와 같음을 fetch·ls-remote로 확인했다. 검증 이후 앱 소스는 바꾸지 않았고 커밋 전 명세·변경 근거·diff를 다시 확인한다. 원본 checkout을 사용하므로 정리할 별도 worktree·clone은 없다. 최종 테스트/운영 `.ait`는 기존 산출물 경로에 유지하고 Git에는 소스·명세·검증 근거만 포함한다. main 병합과 토스 콘솔 업로드는 이 요청 범위에 포함하지 않는다.
