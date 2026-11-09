# nori-recipe

## 현재 명세와 작업 시작

- 원본 프로젝트는 `/Users/msyu/study/play-recipe`이며 패키지·저장소 이름은 `nori-recipe`다. 기존 작업 폴더를 그대로 사용하며 무관한 파일을 수정하지 않는다.
- 시작 시 `git status --short --branch`와 [OpenSpec 안내](openspec/README.md)를 확인한다. Node 24, pnpm 10.33.0을 사용한다.
- `pnpm spec:context <영역 또는 소스 경로>`로 관련 명세·소스 anchor·검증 명령을 찾는다. 전체 archive·과거 감사 문서를 매번 읽지 않는다.
- 현재 동작은 `openspec/specs/`, 완료 근거는 `openspec/completed-work.md`, 예정은 `openspec/roadmap.md` 및 `openspec/changes/`, 미확정·검증 공백은 `openspec/known-gaps.md`로 구분한다.
- `docs/plan.md`·과거 감사 체크박스를 현재 완료 증거로 삼지 않는다. 현재 코드와 제품 규칙이 다르면 근거를 확인하고 공백에 기록한다. 결함을 정상 정책으로 문서화하지 않는다.
- 동작·저장·콘텐츠·분석 정책 변경과 버그 수정은 change에 관련 요구사항 ID·변경/유지 이유·재현·검증을 남긴다. 사용자 요청에 구현이 포함되면 같은 범위를 다시 승인받지 않는다.
- 구현·명세·policy-map을 함께 갱신하고 새 소스는 `pnpm spec:index` 후 분류를 확인한다. 관련 회귀와 `pnpm spec:check`를 실행하며 공통 변경/완료 준비는 `pnpm verify:local`을 사용한다.
- 검증된 작업만 완료 표시하고 완료 change만 archive한다. 명세/테스트 연결은 실행 증거를 대신하지 않는다. 커밋·푸시·병합·배포는 사용자 요청 범위에서만 수행한다.

## 보존할 정책

- 로컬 게스트 서비스다. SQLite/AsyncStorage와 기존 guestId·찜·기록·삭제 표시를 보존한다. 동기화 메타데이터는 서버 연동 완료가 아니다.
- 홈 작업은 `openspec/specs/recommendations/spec.md`와 `HOME_RECOMMENDATION_RULES.md`를 함께 따른다. 안전 필터를 무시해 3개를 채우거나 보호자 준비 확인을 재사용하지 않는다. 홈 세트 정책의 미확정 차이는 known-gaps에 남긴다.
- NEW는 한국 달력 날짜 기준 한 달, 월령은 기기 연월 기준이다. 두 시간 규칙을 임의로 통일하지 않는다.
- 미승인 콘텐츠·재료·이미지는 기존 해시·검수 도구를 통과해야 한다. JSON 가져오기·이미지 준비·서버 시작을 게시 승인으로 해석하지 않는다.
- 분석은 정확한 운영 origin과 버전 3 동의에서만 허용한다. Preview/네이티브 전송, 개인 입력·기록 식별자 전송, 원치 않는 동의 변경을 추가하지 않는다.

프로젝트 구조와 코드·콘텐츠 작업 절차는 `CLAUDE.md`, 실행·운영은 `DEVELOPMENT.md`, 서비스 소개는 `README.md`를 따른다.

놀이 수집·정규화·임포트 요청은 `.claude/skills/`의 해당 `SKILL.md`를 읽는다.
전체 흐름은 실제 놀이 대표 이미지와 이미지가 없는 새 재료의 이미지 생성·저장까지 이어서 수행하고, 이미지가 모두 준비된 뒤
수집 건별 검수 목록에 등록한다. 공통 절차는 `tools/local-review/IMAGE-WORKFLOW.md`를 따른다.

## 배포 흐름

- 개발 변경사항은 `preview` 브랜치에서 작업하고 푸시한다.
- `preview` 푸시는 Vercel의 Preview 환경에 배포하며, Vercel이 부여한 `*.vercel.app` 주소에서 확인한다.
- 미리보기에서 확인한 변경사항을 `preview`에서 `main`으로 병합하면 Production 환경에 배포되어 `https://www.nori-recipe.com`에 반영된다.
- Vercel의 Production Branch는 `main`이며, `nori-recipe.com`는 Production에 연결한다.
- `PUBLIC_ORIGIN=https://www.nori-recipe.com`는 Production 환경에만 설정한다. Preview에서는 이 변수를 비워 `VERCEL_URL`로 해당 미리보기의 공유 주소를 생성한다.
- 커밋·푸시·병합 전 기존 변경사항과 현재 브랜치를 확인하고, 위 흐름에 맞는 대상 브랜치를 사용한다.
