# 놀이 레시피 OpenSpec 관리

기준일: 2026-11-09. 원본 `/Users/msyu/study/play-recipe`, 패키지·저장소 이름 `nori-recipe`.
도입 기준 커밋 `4413901`의 코드·기존 정책·테스트·Git 이력을 대조했다. 앱 기능 변경 없이 관리 체계를 추가한다.

## 읽는 순서와 기준

1. 루트 `AGENTS.md` → `pnpm spec:context <domain-or-path>`.
2. 해당 `specs/<domain>/spec.md`와 `policy-map.json`의 구현·테스트 근거.
3. 관련 active change와 `known-gaps.md`. 미래 범위는 `roadmap.md`.
4. 배경이 필요할 때 `completed-work.md`, 기존 개발 문서, archive 순으로 확인한다.

- `specs/`: 확인된 현재 동작과 보존해야 할 제품 계약.
- `changes/<name>/`: 제안·미구현 작업. tasks 체크는 실제 완료 시에만 한다.
- `changes/archive/`: 완료한 변경. 최초 도입은 기존 기능의 소급 명세이며 신규 구현 이력과 구분한다.
- `completed-work.md`: 기존 기능의 근거 커밋과 현재 소스. 예전 커밋의 모든 배포·검증이 재확인됐다는 의미는 아니다.
- `known-gaps.md`: 정책 충돌·검증 부족·외부 운영 확인. 발견만으로 제품 정책을 바꾸지 않는다.
- `policy-map.json`: 요구사항 ID → 소스·문자열 anchor·회귀 테스트. `automated`는 관련 테스트 연결이며 전체 시나리오 실행·UI·실기기 보증이 아니다. `source-reviewed`는 소스 확인만 한 항목이다.
- `source-index.json`: 관리 대상 소스·설정·스킬·문서의 명세 분류. 바이너리 그림·생성 산출물은 포함하지 않으며 기존 콘텐츠·이미지 검사로 확인한다. Git에서 무시되는 로컬 조사 자료·검수 상태는 재현 가능한 필수 근거로 삼지 않는다.
- `baseline-audit.md`: 이번 도입의 조사 범위·실제 실행 결과·한계.

| 영역 | 현재 명세 |
| --- | --- |
| 게스트·월령·초기 재료 | [onboarding](specs/onboarding/spec.md) |
| 재료 우선·의도·홈 고정 | [recommendations](specs/recommendations/spec.md) |
| 공개 목록·검색·상세·NEW | [catalog](specs/catalog/spec.md) |
| 찜·완료·피드백·기록 | [play-records](specs/play-records/spec.md) |
| SQLite·브라우저 저장·초기화 | [local-data](specs/local-data/spec.md) |
| 수집·재료·이미지·승인 | [content-review](specs/content-review/spec.md) |
| 로컬 서버·복구·Codex 요청·실험실 | [local-studio](specs/local-studio/spec.md) |
| 분석 동의·허용 항목·소급 기록 | [privacy](specs/privacy/spec.md) |
| 직접 링크·공유·PWA·배포 | [web-platform](specs/web-platform/spec.md) |
| 명세·변경·근거 검사 | [spec-governance](specs/spec-governance/spec.md) |

## 일상 작업

Node 24와 프로젝트 고정 pnpm을 사용한다. CLI는 devDependency의 OpenSpec **1.15.0**으로 고정하며 인접 Lestly나 전역 설치에 의존하지 않는다.

```sh
pnpm install --frozen-lockfile
pnpm spec:context recommendations
pnpm spec:context 'src/engine/recommend.ts'
pnpm spec new change describe-the-change
pnpm spec status --change describe-the-change
pnpm spec instructions proposal --change describe-the-change
```

Codex는 `.agents/skills/openspec-*`, Claude는 `.claude/skills/openspec-*`와 `/opsx:*`를 사용한다. `openspec-propose`, `openspec-apply-change`, `openspec-sync-specs`, `openspec-archive-change` 등이 설치되어 있다. 도구 갱신은 `pnpm spec update` 후 생성 파일 차이를 검토한다.

변경에는 Why/What Changes/Capabilities/Impact, 필요한 design, 전체 요구사항 단위의 ADDED/MODIFIED/REMOVED delta, 실제 검증 tasks를 적는다. 기존 버그 수정도 요구사항 ID와 재현·검증 기록을 change에 남긴다. 순수 문서·리팩터링은 같은 정책이 유지된 이유를 기록한다. 현재 요청에 구현이 포함되면 같은 범위를 다시 승인받지 않는다.

```sh
pnpm spec:index
pnpm spec:check
pnpm test:spec-tools
pnpm spec:changed <base-sha>
pnpm verify:local
pnpm spec validate describe-the-change --strict
pnpm spec archive describe-the-change --yes
pnpm spec:check
```

archive 전에 실제 구현·검증과 tasks를 대조하고 미해결 결정은 known-gaps/roadmap에 유지한다. 현재 명세와 도입 delta가 이미 같으면 `--skip-specs`로 이중 병합을 피할 수 있지만 먼저 현재 명세와 delta가 일치하는지 확인한다. 미래 계획은 구현 전 archive하지 않는다.

## 자동 검사 범위

`spec:check`는 현재·미아카이브·아카이브 문서 구조, 요구사항 ID/시나리오/근거/분류를 검사한다.
`spec:changed <base-sha>`는 app/src/scripts/tools/data, 설정·lockfile·에이전트 규칙·스킬·CI 변경에 대해 영역별 현재 명세 변경 또는 change 본문의 해당 요구사항 ID를 요구한다. base 비교에는 새 untracked 소스도 포함한다. 삭제·이름 변경도 대상이며 내용의 정확성은 리뷰와 회귀 테스트가 필요하다. 바이너리 이미지 변경은 별도 이미지 검증 대상이다.

CI는 PR base와 preview/main 푸시에서 실행한다. PR과 main/preview 각각 이전 커밋에 대한 변경 누락 검사도 실행하며 새 브랜치 최초 푸시는 비교 가능한 이전 커밋이 없으면 해당 비교만 생략한다. 원격 required checks 설정은 별도이며 이번에 변경하지 않는다.

`verify:local`은 콘텐츠·이미지 검사, 명세·도구 테스트, 단위·검수·로컬 서버·웹 테스트, 타입, 웹 빌드를 순서대로 실행한다. 서버 테스트는 임시 fixture·loopback·가짜 Codex를 사용한다. 빌드는 generated/public/dist 및 이미지 버전 JSON을 만들 수 있다. 검수 승인·실제 Codex 채팅·공개 배포는 실행하지 않는다.

형식 근거: [OpenSpec 1.15.0 문서](https://github.com/Fission-AI/OpenSpec/blob/v1.15.0/docs/getting-started.md). 기존 `DEVELOPMENT.md`는 실행·운영, `CLAUDE.md`와 수집 스킬은 콘텐츠 작업 절차, `HOME_RECOMMENDATION_RULES.md`는 보존할 제품 규칙의 상세 참조다. 충돌 시 조용히 덮어쓰지 않고 공백에 기록한다.
