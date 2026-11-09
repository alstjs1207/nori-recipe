# 최초 OpenSpec 분석·검증 기록

일자: 2026-11-09 (Asia/Seoul). 기준 커밋: `4413901`.
원본: `/Users/msyu/study/play-recipe` (패키지 `nori-recipe`).
시작은 main, main/preview가 같은 커밋임을 확인하고 기존 preview로 전환했다. 별도 clone/worktree/전체 복사본은 만들지 않았다. 커밋·푸시·배포는 이번 범위에 포함하지 않았다.

## 조사 범위와 판단

- AGENTS·CLAUDE·README·DEVELOPMENT·HOME_RECOMMENDATION_RULES, 현재 app/src/scripts/tools/tests/data와 관련 스킬, Git 이력, 로컬의 과거 docs/plan·animation-plan을 대조했다.
- Lestly의 stable ID·policy-map·source-index·context/check/changed·로컬 회귀/CI 구조를 참고하고 npm/SQL 전제를 pnpm/Expo/로컬 저장·콘텐츠 검수에 맞게 변경했다.
- 현재 명세 10개 영역·33개 요구사항·63개 시나리오를 작성했다. 요구사항 25개는 관련 자동 회귀를 연결했고 8개는 소스 검토 근거만 있다. 자동 연결도 모든 시나리오나 실기기·UI 전체를 증명하지 않는다.
- 관리 소스·설정·스킬·문서 236개를 영역별 분류했다. 바이너리 에셋·빌드 결과·캐시·Git 무시 로컬 결과는 인덱스에서 제외한다.
- 데이터는 총 224개: live 208, draft 9, archived 7. 재료 slug 71개, reviewPending 5개. 데이터 상태·콘텐츠 승인·이미지 원본은 변경하지 않았다.
- 완료된 기존 기능은 completed-work의 실제 커밋 근거로 보존했다. 과거 체크박스를 일괄 완료로 바꾸거나 과거 실행 결과를 새로 만들지 않았다.
- 미래 작업 4개는 모두 0/4 구현 tasks인 제안 상태다. 홈 계약 확인, 계정/동기화, 리포트/구독, 네이티브 OTA다. 모션 후속과 지속 콘텐츠 운영은 roadmap에 남겼다.
- 홈 3개 보장과 적격 후보 부족, 고정 세트 전환/개수 변경, 저장 검증, 운영 외부 설정, 원문/권리, 시간대, 분석 전송 한계는 known-gaps에 분리했다. 이 공백을 기능 구현 완료나 승인된 새 정책으로 옮기지 않았다.

## 실제 실행 결과

최종 실행 환경: **Node 24.22.2, pnpm 10.33.0, OpenSpec 1.15.0**, macOS.
호스트 기본 Node는 25.9.0이므로 npm 임시 도구 캐시의 Node 24로 아래 전체 명령을 실행했다.

```sh
npm exec --yes --package=node@24 -- pnpm verify:local
```

| 단계 | 결과 |
| --- | --- |
| spec:check | 현재 명세 10개 + change 5개 strict 검증 성공. 도구 근거 검사 33 requirements / 63 scenarios / 236 files 성공 |
| test:spec-tools | 7/7 성공. anchor·테스트 근거·경로/심볼릭 링크·고아 ID·stale index·신규 영역·변경 누락·실행 환경 분리 검사 |
| check:play-content | 224개 검증, 오류 0·경고 0 |
| check:play-images | 필수 이미지 223개 확인, 1개는 기존 review fallback 사용 |
| test | 추천·온보딩·검색·NEW·안전 안내·피드백·분석 등 117/117 성공 |
| test:play-review | 27/27 성공 |
| test:local-review | 26/26 성공. 임시 fixture·loopback·가짜 Codex 사용 |
| test:web | 28/28 성공. 메타데이터·404·오프라인·업데이트·캐시 포함 |
| typecheck | tsc --noEmit 성공 |
| build:web | 성공. 공개 상세 링크 208개, precache 12개. 캐시 버전 9cd45872031e |

합계 자동 테스트 **205개 성공, 실패·skip 0**. 웹 빌드는 detail 15.36MB / thumbnail 2.54MB를 생성했다. 이는 이번 빌드 값이며 고정 예산이나 미래 빌드 동일 해시 보장이 아니다.

추가 확인: `pnpm spec:changed 4413901` 성공, `pnpm spec:context src/engine/recommend.ts`가 해당 요구사항·근거를 반환, `git diff --check` 성공. 각 도입 delta의 모든 요구사항/시나리오 본문이 현재 명세와 정확히 같음을 대조했다.

## 실패와 수정 기록

- 초기 샌드박스 실행은 tsx IPC `listen EPERM`에서 중단됐다. 테스트에 필요한 IPC/loopback 권한으로 재실행했다.
- 새 verify 실행기에서 빌드용 PUBLIC_ORIGIN이 서버 fixture로 전달되어 직접 링크 기대값이 달랐다. 빈 문자열도 서버에서 유효 origin으로 취급하지 않으므로, 테스트에서는 변수를 제거하고 build:web에만 안전한 테스트 origin을 전달하도록 수정했다. 환경 분리 회귀를 추가하고 Node 24 전체 검증을 통과했다. 기존 서비스 서버·테스트 기대값은 변경하지 않았다.

## 보존과 검증 한계

- 기존 untracked `assets/nori-share-cover-20261105*`, `assets/nori-welcome-hero-boy-20261106*`, `public/og/nori-recipe-20261105.jpg`는 건드리지 않았다. 기존 무시된 results·docs·설정도 유지한다.
- 생성된 dist/public media·이미지 버전 파일은 기존 빌드 절차의 산출물이다. 최종 Git 차이에서 서비스 소스·데이터·이미지 원본 변경이 없음을 확인했다.
- 실제 사용자 저장소 초기화, 콘텐츠 승인/게시, 실제 Codex 검수 채팅, GA4 전송·외부 계정 설정·Vercel 배포·원격 branch protection은 수행하지 않았다.
- 네이티브 실기기/스토어, 실제 운영 HTTPS·PWA 설치·분석 수신·법적/콘텐츠 권리 확인은 이 로컬 검증의 범위 밖이다. 저장/화면 source-reviewed 공백은 그대로 유지한다.

## 보관 후 최종 확인

도입 change는 `openspec/changes/archive/2026-11-09-establish-spec-management/`에 보관했다. 8/8 tasks 완료, 현재 명세와 delta 10개가 이미 일치하므로 `--skip-specs`로 중복 병합을 피했다. CLI가 큰 최초 baseline에 대해 변경 분리 권고를 출력했지만 strict 검증은 성공했다. 후속 변경은 영향 영역별로 작게 만든다.

보관 후 `pnpm spec:check`는 현재/미아카이브 14개와 아카이브 1개 모두 통과했고 근거 검사도 10영역·33요구사항·63시나리오·236파일로 통과했다. `pnpm spec:changed 4413901`·`git diff --check`도 통과했다. 미착수 change 4개는 각 0/4 tasks로 유지했다.

최종 Git 차이는 안내 문서·개발 의존성/lockfile·추가된 OpenSpec/스킬/검사기/CI다. app/src/data/images/assets/tools의 기존 추적 파일은 변경되지 않았고 기존 untracked 작업 파일도 유지됐다. 원본 폴더를 그대로 사용했으므로 정리할 별도 작업 폴더는 없다.

## 후속 요청: 미사용 시안 정리와 preview 커밋

2026-11-09 사용자가 사용 중인 이미지를 제외한 불필요한 생성 이미지 삭제와 preview 커밋을 요청했다. 위 '기존 untracked 보존' 기록은 최초 도입 시점의 상태다. 후속 요청에서는 현재 코드·빌드·웹 테스트의 참조를 확인하고 아래 미추적 시안만 정리했다. WEB-003의 현재 에셋·원본 보존 계약은 그대로 유지한다.

삭제 대상은 이미지 7개와 짝이 되는 프롬프트 6개, 총 13개(약 15.48 MiB)다. 모두 기존 Git 미추적 파일이므로 Git의 추적 파일 삭제 diff는 생기지 않는다.

- `assets/nori-share-cover-20261105.png`
- `assets/nori-share-cover-20261105.prompt.txt`
- `assets/nori-welcome-hero-boy-20261106.png`
- `assets/nori-welcome-hero-boy-20261106.prompt.txt`
- `assets/nori-welcome-hero-boy-20261106-v2.png`
- `assets/nori-welcome-hero-boy-20261106-v2.prompt.txt`
- `assets/nori-welcome-hero-boy-20261106-v3.png`
- `assets/nori-welcome-hero-boy-20261106-v3.prompt.txt`
- `assets/nori-welcome-hero-boy-20261106-v4.png`
- `assets/nori-welcome-hero-boy-20261106-v4.prompt.txt`
- `assets/nori-welcome-hero-boy-20261106-v5.png`
- `assets/nori-welcome-hero-boy-20261106-v5.prompt.txt`
- `public/og/nori-recipe-20261105.jpg`

서비스에서 사용하는 공유 이미지 v2 원본·프롬프트·OG JPEG, 시작 화면 v6 원본·프롬프트는 보존했으며 삭제 전후 SHA-256이 같음을 확인했다. 그 밖의 기존 이미지·원본 콘텐츠·무시된 로컬 자료는 정리 범위에 포함하지 않았다. 이번 요청 범위는 로컬 preview 커밋이며 푸시·배포는 수행하지 않는다.

정리 후 검증: `pnpm spec:check`, `pnpm test:spec-tools`(7/7), `pnpm check:play-content`(오류·경고 0), `node --import tsx scripts/prepare-play-images.ts --verify-only`(필수 이미지 223개 및 기존 fallback 1개), Node 24.22.2의 `node --test tests/web-content.test.mjs`(15/15), `pnpm spec:changed 4413901`, `git diff --check`를 통과했다.
