# 놀이 이미지 Storage 웹 이관 — 완료

2026-11-14 계획 등록. 2026-11-15 사용자는 1.2·1.3의 로컬 도구, 2.1·2.2의 웹·공유·PWA 연결에 이어 2.3의 원본/관리자 키 없는 웹 빌드를 로컬 fixture 기준으로 요청했다. 제안 계약은 CON-004·CON-005·WEB-003이며 CON-001~003·WEB-001·WEB-002·LOC-001·LOC-002·PRI-001·PRI-002를 보존한다. 작업별 구현·검증이 실제 끝난 항목만 체크하고 실제 Storage 설정·업로드·권한·배포 완료와 구분한다.


**최종 상태 — 2026-11-15:** 사용자가 운영 링크 공유의 정상 표시를 직접 확인하고 완료 정리·Preview 커밋/푸시를 요청했다. 아래 체크박스는 실제 인도한 웹 이관 범위다. 원계획3.2와4.2/4.3의 미구현·미검증 하위 범위는 [후속 목록](../../follow-ups/play-image-operations.md)에 원문/경계를 보존하며 완료로 체크하지 않는다. 재료 이미지는 사용자 지정 후속, 네이티브는 제외다. 원래 단계별 기록과 당시 미완료 설명은 이력으로 유지하고 현재 상태는 이 최종 정리와 [검증 기록](verification.md)을 따른다.

현재 공개 매니페스트 경로를 CI/Vercel이 참조하므로 폴더는 유지한다. 완료 체크는 archive 이동·후속 기능 완료를 의미하지 않는다.

## 1. Storage와 버전 매니페스트

- [x] 1.1 대상 계정/조직의 한도·파일 총량·프로젝트·환경·버킷을 확정하고 원본 비공개/서비스 자산 공개 정책을 구성한다. 관리자·비인가 요청으로 조회/쓰기/삭제 허용 여부를 확인하고 비밀을 제외한 설정·결과를 기록한다.
- [x] 1.2 ID별 원본/상세/썸네일 체크섬과 버전 경로를 기록하는 매니페스트·이관 도구를 구현한다. dry-run, 누락·손상·부분 성공 재개·다른 원본 덮어쓰기 방지·동일 파일 재실행 fixture로 검증하고 명령/관리 환경변수를 DEVELOPMENT.md에 문서화한다.
- [x] 1.3 원본 업로드·다운로드 복원 검증과 승인된 live 이미지의 파생 업로드를 구현한다. draft/archived/review의 공개 게시 차단, 기존 승인 해시 보존, 변경 시 재검수, 비공개 전환 정리 대상 생성 회귀로 검증하고 CON-004·CON-005의 실제 소스·테스트 근거를 기록한다.

## 2. 웹·공유·PWA 연결

- [x] 2.1 웹 이미지와 공유 HTML이 동일 매니페스트의 공개 상세/썸네일 URL을 사용하도록 연결한다. 버전 교체·기본 이미지·잘못된 ID·비공개 이미지 제외·Preview/Production의 canonical 및 OG URL을 이미지 단위/웹 회귀로 검증하고 빌드 설정을 문서화한다.
- [x] 2.2 허용된 Storage origin/공개 버킷의 CORS 이미지 캐시와 실패 기본 표시를 구현한다. 방문 후 오프라인·미방문 실패·404/5xx·opaque 응답·무관한 origin 제외·80개 상한·선택 업데이트를 웹 오프라인 회귀로 검증하고 WEB-002 보존 근거를 남긴다.
- [x] 2.3 비공개 원본과 관리자 자격 증명 없이 공개 자산으로 웹 배포용 빌드를 재현한다. 새 checkout/fixture에서 필수 자산 누락·잘못된 해시의 빌드 중단과 기존 배포 보존을 확인하고 CI/Vercel 및 로컬 검증 경계를 문서화한다.

- [x] 2.4 운영 HTTPS의 익명 크롤러 형태 요청으로 정적 OG·canonical·공개 이미지 해시와 비공개/오류 ID 제외를 검증하고 사용자의 실제 링크 공유 정상 표시 확인을 기록한다. 자동 HTTP 검사와 사용자 확인을 구분하며 확인하지 않은 플랫폼·공식 디버거 실행을 주장하지 않는다.

## 3. 기본 PWA 오프라인과 로컬 검수 호환

- **3.1 제외 — 2026-11-15 사용자 결정:** 네이티브 빌드·번들 연결·실기기 검증은 이번 change에서 수행하지 않는다. 기존 네이티브 코드·원본 매핑은 보존하며 완료로 체크하지 않는다.
- **3.2 후속 이관 — 미구현:** 관리자 원본 복원의 이미지 준비·생성·검수 UI 통합과 승인/실패 보존 회귀는 [후속 목록](../../follow-ups/play-image-operations.md)에 유지한다. 수동 복원 도구 구현과 구분하며 완료로 체크하지 않는다.

- [x] 3.3 온라인 준비 뒤 첫 오프라인 실행에서 기본 화면·설정/이용 안내가 열리는지 새 로컬 origin에서 검증한다. 준비 중/완료/실패를 구분하고 실패 설치·이전 활성 셸·선택 업데이트를 회귀로 확인한다. 전체 이미지 선저장은 추가하지 않고 기존 방문 이미지80개·기본 표시·사용자 데이터를 유지한다.

## 4. 실제 이관과 Git 추적 전환

- [x] 4.1 대상 놀이 이미지의 비공개 원본 보존·다운로드 해시·공개 파생 자산을 실제 환경에서 검증한다. ID별 결과와 부분 실패를 비밀 없는 보고서에 남기며 웹/PWA·공유 봇 검증이 끝날 때까지 기존 참조와 로컬 파일을 유지한다.
- [x] 4.2 검증된 놀이 원본224개를 로컬에 유지하며 Git 추적에서 제외하고 생성 이미지/캐시 ignore를 유지한다. 원본/관리자 키 없는 새 checkout CI·웹 빌드와 실패 출력 보존 fixture를 검증하고 직전 정상 매니페스트/객체 버전·복구 절차를 보존한다. 실제 관리자 전체 복원·호스팅 롤백 실행은 후속으로 구분하고 다른 이미지·과거 이력은 변경하지 않는다.
- [x] 4.3 실제 인도한 범위로 현재 명세·delta·policy-map·source-index·DEVELOPMENT.md·자산 제공처 문서와 완료/후속 목록을 정리한다. spec:index/check와 놀이 JSON·로컬 데이터·GA4 정책 보존 근거를 확인한다. 서비스 내 추가 제공처 고지는 미구현 후속으로 명시한다.

## 5. 통합 검증

- [x] 5.1 Node 24/pnpm 10.33.0에서 `pnpm verify:local`과 `pnpm spec validate migrate-play-images-to-supabase-storage --strict`를 실행한다. 웹/PWA·공유 미리보기 및 실제 접근 권한 결과와 함께 실행 날짜·명령·성공/실패·미확인 범위를 이 change에 기록한다. 로컬 테스트 성공을 업로드·운영 배포 완료로 간주하지 않는다.

## Workflow follow-up

- 실제 구현·검증이 끝난 뒤에만 완료 change를 archive한다. 현재 계획 등록은 커밋·푸시·병합·배포 요청이 아니다.

## 계획 등록 검증 — 2026-11-14

- `pnpm spec validate migrate-play-images-to-supabase-storage --strict`: 통과.
- `pnpm spec:check`: 현재 명세·active change 18건, archive 3건 및 정책 근거 검사 통과.
- `pnpm verify:local`: 최초 샌드박스 실행은 tsx 임시 소켓의 `EPERM`으로 중단. 샌드박스 밖 재실행은 종료 코드 0으로 완료했고 콘텐츠·이미지 검사, 테스트 211개, 타입 검사와 웹 빌드가 통과했다.
- 실행 환경은 Node 25.9.0/pnpm 10.33.0이다. 프로젝트 지정 Node 24에서의 검증은 이번 계획 등록에서는 수행하지 않았다. 실제 구현 완료 시 5.1의 지정 환경 검증을 별도로 수행한다.
- 위 결과는 기존 코드와 계획 문서의 검증이며 Storage 구현·원격 생성·업로드·접근 권한·네이티브 실환경·공개 배포 완료 증거가 아니다. 구현 체크박스는 모두 미완료로 유지한다.

## 로컬 도구 구현 검증 — 2026-11-15

이 단계에서는 사용자가 선택한 1.2·1.3만 구현·검증했고 진행은 **2/12 완료**였다. 1.1·2.x·3.x·4.x·5.1은 이 단계 당시 미완료였다. 도구 작성과 fixture 검증을 실제 Storage 이관·접근 권한·공개 배포 완료로 간주하지 않는다. 후속 상태는 아래 웹·공유·PWA 검증 기록과 현재 체크박스를 따른다.

실행 환경: Node **24.21.0**, pnpm **10.33.0**, 원본 `/Users/msyu/study/play-recipe`, 브랜치 `preview`. 시작 시 HEAD와 실제 `git ls-remote origin refs/heads/preview` 모두 대시보드 기준 `5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752`와 일치했고 기존 Git 변경은 없었다. 별도 worktree·clone은 만들지 않았다.

| 명령/검사 | 결과와 범위 |
| --- | --- |
| `pnpm test:play-image-storage` | 최종 fixture 15개 통과. 임시 Git/JPEG/디렉터리 저장소·가짜 HTTP 응답만 사용. dry-run 무변경, 누락·손상, 불변 경로 충돌, 부분 성공·응답 유실 후 재개, 동일 파일 재실행, 공개 상태·승인 해시·복원·정리 후보·비밀 제외 확인 |
| 실제 224개에 `images:storage plan` 로직 실행, `--write` 없음 | 통과. 원본 140,445,124바이트, 기존 승인 기준과 일치하는 공개 후보 208개·비공개 전용 16개. 변환·해시를 메모리에서 검증했고 파일·Storage 객체는 쓰지 않음 |
| `pnpm spec:index` | 252개 관리 파일 분류. 새 관리 도구·fixture는 content-review |
| `pnpm spec:check` | 현재/active 18개·archive 4개 및 37개 요구사항 근거 연결 통과 |
| `pnpm spec:changed 5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752` | content-review·web-platform·spec-governance 변경 근거 통과 |
| `pnpm verify:local` | 첫 샌드박스 실행은 `check:play-images`의 tsx IPC 소켓 `EPERM`으로 중단. 권한 있는 로컬 환경에서 같은 명령 재실행은 종료 코드 0. 테스트 **232개**(명세 도구 7·단위 123·검수 27·이관 15·로컬 검수 서버 26·웹 34), 콘텐츠·이미지 검사·타입 검사·웹/PWA 빌드 통과 |
| `pnpm spec validate migrate-play-images-to-supabase-storage --strict` | 통과 |
| `git diff --check` | 통과 |

CON-004·CON-005의 실제 구현·테스트 근거는 `scripts/play-image-storage/{manifest,migration,stores,files}.mjs`, `scripts/migrate-play-images.mjs`, `tests/play-image-storage.test.mjs`와 현재 명세·policy-map에 연결했다. 현재 명세는 **로컬 관리 도구 계약만** 담고, active delta의 최종 서비스 계약과 구분했다. GOV-002·GOV-003의 분류·검증 경계와 WEB-003의 기존 Git 원본 기반 빌드를 유지했다.

원본·놀이/재료 데이터·검수 의견/영수증·DB/store·분석 코드 등 **751개 파일**의 전체 SHA-256 목록을 합친 검증 전후 digest는 동일했다(`0eeabbca4374315752a58476ccaf089fbb24d7f8bd7ee8d8db1747bfdf51b918`). 실제 사용자 로컬 DB·브라우저 저장소에는 접근하거나 초기화하지 않았다. CON-001~003·LOC-001/002·PRI-001/002 정책과 원본/기존 승인 결과를 보존했다.

미확인/미실행: 실제 Supabase 프로젝트·한도·버킷·RLS/비인가 접근·실제 업로드/다운로드·CORS, 원격 URL을 소비하는 웹/PWA·공유 봇, 원본 없는 네이티브 export·실기기 오프라인, 새 checkout 배포 빌드·롤백·Git 추적 제외. 실제 Storage 설정·업로드·권한 변경·배포·커밋·푸시는 하지 않았다. 생성된 공개 후보를 앱에 연결하지 않았고 change를 archive하지 않는다.

## 웹·공유·PWA 로컬 fixture 구현 검증 — 2026-11-15

이 단계에서는 후속 사용자 요청으로 **2.1·2.2만 추가 완료**, 진행은 **4/12 완료**였다. 위 1.2·1.3 기록은 당시 상태로 보존한다. 1.1·2.3·3.x·4.x·5.1 및 실제 이관·권한·배포는 이 단계 당시 미완료였다. 작업 위치는 같은 원본 `preview`이며 시작 시 원격 preview와 HEAD가 계속 `5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752`임을 `git ls-remote`로 확인했다. 이전 미커밋 변경은 보존했다. 후속 진행은 아래 2.3 기록과 현재 체크박스를 따른다.

구현 근거: `src/constants/playImageManifest.ts`, `playImageUrls.ts`, `playImageWebManifest.json`, `scripts/web/play-images.mjs`와 HTML/소개/빌드 연결은 같은 정제된 공개 URL 스냅샷을 사용한다. 웹 놀이 이미지 소비처는 `PlayImage.web.tsx`로 연결했다. `scripts/web/service-worker.mjs`와 `tests/web-offline.test.mjs`는 WEB-002의 합계 80개·선택 업데이트를 유지하면서 허용 Storage CORS 이미지 캐시·실패 기본 표시를 검증한다. 빌드 변수·원본/비공개 정보 제외·기본 모드·검증 경계는 `DEVELOPMENT.md`에 기록했다.

| 실행/검사 | 결과 |
| --- | --- |
| 실행 환경 | Node **24.21.0**, pnpm **10.33.0** |
| `node --test tests/web-play-images.test.mjs tests/web-content.test.mjs tests/web-offline.test.mjs` | 33개 통과. 같은 상세/썸네일/OG/소개 버전, 기본 표시·잘못된 ID·draft/archived/review 제외, Preview/Production canonical과 Storage OG 보존, 실패 시 JSON 복원·비밀 제외 확인 |
| `pnpm spec:index`, `pnpm spec:check` | 관리 소스 257개, 현재/active 18개·archive 4개, 37개 요구사항/93개 시나리오 연결 통과. 최초 문서 검사의 긴 Requirement 경고는 조건을 Scenario로 옮겨 해결 |
| `pnpm spec:changed 5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752` | 관련 영역의 변경/유지 근거 통과 |
| `pnpm spec validate migrate-play-images-to-supabase-storage --strict` | 통과 |
| `pnpm verify:local` | 권한 있는 로컬 환경에서 종료 코드 0. 테스트 **242개**(명세 도구 7·단위 123·검수 27·기존 이관 15·로컬 서버 26·웹 44), 타입·콘텐츠/이미지 검사·웹/PWA 빌드 통과. 앞선 부분 회귀의 loopback `EPERM`은 샌드박스 제한이며 실제 서버가 필요한 검증은 권한 있는 환경에서 수행 |
| Storage 모드의 `pnpm build:web` | localhost의 임시 공개 후보·원본에서 기존 도구로 만든 파생 이미지 fixture 사용. 관리자 키·비공개 Storage 접속 없이 실제 Expo 웹 export 성공. 웹과 OG가 동일 상세 URL을 사용하고 JSON은 기본 소스로 복원됨 |
| ego-browser의 localhost 검증 | 익명 CORS 로드(960px)·canonical/OG 일치 확인. 서비스 워커 제어 후 실제 미디어 캐시 확인. 캐시와 구별되는 실패 URL에서 404·503·CORS 실패 시 기본 아이콘(150px)과 본문 유지, 정상 URL로 복구 확인. 두 임시 서버를 실제 종료한 뒤 새로고침해도 캐시된 본문·960px 이미지를 재표시. 첫 제어권 획득 전 요청은 재방문 후 캐시됨 |
| 미방문·opaque·허용 경계·80개·업데이트 | VM 기반 워커 회귀에서 미방문 기본 표시와 기본 아이콘 직접 요청의 오프라인 셸 캐시 조회, 404/503·opaque/opaqueredirect·HTML·redirect 미캐시와 재시도, 다른 origin/버킷/원본/인증/query/자격 증명 포함 요청 제외, 병렬 로컬+Storage 90개 요청의 최종 합계 80개, SKIP_WAITING은 사용자 메시지 뒤에만 적용됨을 확인. 최종 셸 캐시 보완 뒤 전체 verify:local을 재실행 |
| `git diff --check`·데이터 보존 | 통과. 원본/재료 이미지·놀이/재료 JSON·검수 결과·DB/store/분석 코드·네이티브 이미지 매핑 등 **820개 파일**의 합산 SHA-256은 전후 동일(`90438e36e7c349a53655a9fdb88fd7bf5e494ec14ee73556ad958f7b9c8b5850`). 기존 승인과 사용자 저장소를 변경하지 않음 |

실제 Storage 요청·설정·업로드·권한 변경·배포·커밋·푸시는 실행하지 않았다. 브라우저 테스트는 별도 localhost origin의 fixture만 사용했고 원래 사용자 사이트 저장소는 열거나 초기화하지 않았다. 임시 서버·fixture 폴더·스크립트·검증 탭을 정리했다. 최종 `dist/`는 전체 검증이 만든 기본 로컬 이미지 빌드이며, Storage fixture origin이나 공개 설정을 소스에 남기지 않았다.

제한: 실제 Supabase 공개 접근/CORS·공유 봇·운영/Preview HTTPS 배포·실기기 PWA·원본 없는 웹 빌드(2.3)·네이티브(3.x)는 미확인이다. 이번에는 필수 후보 누락을 기본 표시로 처리하며 필수 자산 실패 시 배포 빌드 중단은 2.3에서 다룬다. 원본 파일·Git 추적·네이티브 참조를 유지하고 실제 전환과 archive를 수행하지 않는다.

## 비공개 원본·관리자 키 없는 웹 빌드 검증 — 2026-11-15

이 단계에서 사용자가 선택한 **2.3 추가 완료**, 당시 **5/12 완료**였다. 앞 단계의 후보 누락 기본 표시·원본 대조·2.3 미완료 기록은 당시 상태다. 공개 모드의 필수 후보 누락은 이제 실패이며 놀이 원본을 읽지 않는다. 나머지 1.1·3.x·4.x·5.1과 실제 환경 확인은 이 단계 당시 미완료였다.

원본 `/Users/msyu/study/play-recipe`의 `preview`를 그대로 사용했다. 시작 시 실제 `git ls-remote origin refs/heads/preview`와 HEAD 모두 대시보드 기준 `5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752`와 일치했다. 기존 미커밋 변경·원본·데이터를 유지하고 새 작업용 clone/worktree를 만들지 않았다. 테스트용 희소 소스 fixture만 임시 생성·정리했다.

| 명령/검사 | 실행 결과와 경계 |
| --- | --- |
| 환경 | Node **24.21.0**, pnpm **10.33.0** |
| `node --test tests/web-build.test.mjs` | 최종 fixture 7개 통과. 필수 후보/파일 누락·해시·WebP·크기·심볼릭 링크 거부, 익명 GET·오류/redirect/opaque 처리, export/후처리/출력 교체 실패 보존·복원 실패 시 백업 경로/바이트 유지 확인 |
| 실제 앱의 깨끗한 소스 fixture export | `.git`·`images/plays`·관리자 환경변수가 없는 fixture에서 실제 전체 앱 Expo web export 성공. 현재 공개 대상 208개/상세·썸네일 416개 합성 WebP를 로컬 자산 디렉터리에서 검증. 외부 fetch를 거부하는 주입 함수로 네트워크 우회가 없음을 확인. 기존 재료·온보딩·브랜드 자산은 유지하고 놀이 JPEG는 복사/복원하지 않음 |
| 필수 실패와 기존 출력 보존 | 누락/해시 오류 시 exporter가 호출되기 전에 실패. export/후처리 실패·교체 실패 시 이전 `dist`의 전체 파일 해시 동일. 강제로 복원도 실패시킨 fixture에서는 이전 출력이 보고된 백업 경로에 그대로 남음. 공개 JSON 스냅샷은 정상/실패 모두 복원 |
| `pnpm spec:index`, `pnpm spec:check` | 관리 파일 260개, 현재/active 18개·archive 4개, 37개 요구사항·95개 시나리오 근거 연결 통과 |
| `pnpm spec:changed 5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752` | 관련 변경/보존 근거 통과 |
| `pnpm spec validate migrate-play-images-to-supabase-storage --strict` | 통과 |
| `pnpm verify:local` | 권한 있는 로컬 환경에서 종료 코드 0. 테스트 **249개**(명세 도구 7·단위 123·검수 27·기존 이관 15·로컬 서버 26·웹 51), 타입·콘텐츠/이미지 검사·기본 웹/PWA 빌드 통과. 웹 51개에 실제 원본 없는 전체 앱 export fixture 7개 회귀가 포함됨 |
| 데이터/정리 확인 | 원본·데이터·검수·DB/store·분석 코드·네이티브 이미지 매핑 등 820개 파일의 합산 SHA-256이 전후 동일(`90438e36e7c349a53655a9fdb88fd7bf5e494ec14ee73556ad958f7b9c8b5850`). 기존 놀이 버전 JSON/원본 추적 변경 없음. 실제 실행의 임시 출력·잠금과 소스 fixture를 정리했고 소스 공개 설정은 기본 빈 스냅샷으로 복원 |

구현/근거: `scripts/web/public-image-assets.mjs`, `scripts/web/build-output.mjs`, `scripts/web/play-images.mjs`, `scripts/prepare-web-assets.mjs`, `scripts/build-web.mjs`, `tests/web-build.test.mjs`. WEB-003의 필수 공개 자산 검증·실패 보존과 GOV-002/GOV-003의 검증 경계를 현재 명세·policy-map·source-index·DEVELOPMENT.md에 연결했다. WEB-001/002/004·CON-001~005·CAT-001/004·LOC-001/002·PRI-001/002는 유지한다.

CI는 기존 Node 24/pnpm 및 `verify:local` 명령으로 이 회귀를 실행할 수 있으나 실제 원격 CI 결과를 이번 로컬 실행으로 대신하지 않는다. Vercel의 `pnpm build:web`/`dist` 설정은 유지하며 실제 변수·권한·배포를 바꾸지 않았다. 관리자 키·dotenv·원본 없이 재현하는 것은 **공개 모드**이며, 최종 top-level `dist`는 기존 기본 로컬 이미지 빌드다. 일반 기본 빌드와 개발 서버의 원본 의존 제거, 네이티브 전환은 별도 단계다.

실제 Storage GET·설정·업로드·권한 변경·배포·커밋·푸시는 실행하지 않았다. 익명 HTTP 검증은 가짜 응답만 사용했다. 실제 Supabase 한도/접근/CORS·실제 서비스 자산/공유 봇·네이티브·운영/Preview 배포·호스팅 롤백은 미확인이다. 원본 삭제·Git 추적 제외·과거 이력 변경·계정/DB/로컬 사용자 데이터 변경·change archive는 하지 않는다.

## 실제 Storage 설정·3개 이미지 검증 — 2026-11-15

후속 사용자 요청은 대상 프로젝트 확인·실제 Storage 설정·승인 이미지 1~3개 업로드·로컬 웹 표시까지로 확대됐다. DB 변경·배포는 여전히 제외한다. **1.1 추가 완료, 현재 6/12 완료**다. 앞의 ‘실제 실행 없음’ 기록은 각 단계 당시 상태로 보존한다.

[실제 검증 보고서](evidence/storage-pilot-2026-11-15.md)와 [ID별 해시·URL·응답 JSON](evidence/storage-pilot-2026-11-15.json)에 한도·전체 용량 계획·프로젝트·환경·버킷 및 실행 결과를 기록했다. `clqthwgsmumiwnnqjtbe`에 비공개 `play-originals`/공개 `play-assets`를 구성했다. 관리자 생성·읽기·삭제와 키 없는/anon 요청의 공개 읽기·원본 차단·쓰기/삭제 무효를 검사하고 임시 객체를 정리했다. 승인된 `play_006`, `play_013`, `play_076`의 9개 객체를 전송/다운로드 검증했으며 동일 파일 재실행·빈 fixture 복원도 성공했다.

실제 공개 GET 6개로 원본/키 없는 3개 샘플 Expo 웹 빌드를 만들고 ego에서 상세960px·썸네일320px·OG 일치·실제 CORS 캐시6개 해시를 확인했다. 루트 원본·224개 데이터·318개 추적 대상 파일 바이트·기존 dist·기본 공개 스냅샷을 보존했다. 일회성 관리 스크립트와 희소 소스 fixture는 정리하고 사용자가 확인할 생성 웹/로컬 서버와 결과 탭을 남겼다.

전체 이관이 아니므로 **4.1은 계속 미완료**다. 3.x·4.2·4.3 전체 전환·5.1의 네이티브/실기기/전체 실제 환경 검증도 미완료다. 전체 인터넷 차단·공유 봇·호스팅 배포는 이번에 시험하지 않았다. 업무 DB·Auth·배포 설정·커밋·푸시·원본 삭제·Git 추적 제외·archive는 수행하지 않았다.

마감: Node24.22.2/pnpm10.33.0에서 `pnpm spec:index`(260개), `pnpm spec:check`(current/active18·archive4·37요구사항/95시나리오), strict change validate, `pnpm spec:changed <기준 SHA>`, `git diff --check`가 모두 통과했다. 소스 변경 없이 실제 Storage 실행/문서만 추가했으므로 전체 `verify:local`은 이번에 반복하지 않았고 이전2.3의249개 통과 기록과 구분한다. 관리 스크립트2개와 임시 fixture를 정리했으며 필요한 계획/state/공개 후보·생성 웹·결과 탭/서버만 보존했다.

## 전체 Storage 업로드·검증 — 2026-11-15

사용자의 전체 업로드 요청으로 **4.1 완료, 현재7/12 완료**다. 기존 3개 파일럿 기록은 당시 결과로 보존한다. [전체 실행 보고서](evidence/full-upload-2026-11-15.md), [ID별 JSON](evidence/full-upload-2026-11-15.json), [공개 매니페스트](evidence/full-public-manifest-2026-11-15.json)에 근거를 기록했다.

Node24.22.2/pnpm10.33.0에서 기준 커밋과 원본/승인 해시가 맞는 전체 계획을 실행했다. 원본224개·공개 대상208개의 파생416개, 총640개 객체의 다운로드 SHA-256·바이트가 일치했다. 신규631개·기존9개 재사용이며 실패/충돌/정리 후보는0개다. 비공개 원본224개 익명 조회는 모두400으로 차단됐다. draft9(그중review1)·archived7은 공개 후보에서 제외하고 해당16개 공개 prefix가 비어 있음을 확인했다. 공개416개는 별도 익명 GET·CORS·해시·WebP 검사와 원본/관리자 키 없는 실제 전체 앱 Expo 웹 export를 통과했다.

4.1의 보존 조건을 따라 원본·기존 참조·Git 추적을 유지하며, 업로드 전후 원본/데이터/검수/app/src/scripts/분석/기존public/dist 등2,228개 파일이 동일했다. 기본 웹/네이티브 참조와 루트 dist는 전환하지 않았다. 전체 이관 공개 후보는 별도 파일이며 로컬 확인 웹만 생성했다. 업무 DB·Auth·버킷 정책·배포 설정·커밋·푸시는 변경하지 않았다.

전체 소비 경로의 네이티브·공유 봇·실기기/호스팅 검증은 남아 있으므로3.x·4.2·4.3 전체 전환·5.1은 미완료다. 네이티브 검증이 없다는 이유로 원본/참조를 먼저 제거하지 않는다. 이번 완료는4.1의 Storage/ID별 보고와 보존 조건에 한하며 전체 change 완료/배포를 뜻하지 않는다.

마감: 실제 전체 웹208개 export와 ego 상세/OG3개·전체 목록208개·썸네일·현재 CORS 캐시10개 해시 검증이 성공했다. spec:index/check·strict validate·spec:changed·diff 검사는 통과했고 apply CLI에서7/12 완료를 확인했다. 임시 스크립트4개·소스 fixture·이전 파일럿 서버를 정리하고 전체 확인 서버/탭만 유지했다. 소스 변경이 없어 verify:local 전체는 반복하지 않았으며5.1은 계속 미완료다.

## 웹 전용 범위와 첫 오프라인 기본 화면 — 2026-11-15

후속 사용자 결정으로 네이티브3.1을 제외하고3.3 기본 PWA 오프라인·2.4 실제 공유 미리보기 검증을 추가했다. 사용자가 선택한 범위는 ‘온라인 준비 후 첫 오프라인 실행에서 앱 기본 화면과 안내만’이며 전체 이미지 선저장은 하지 않는다. 기존 네이티브 코드/매핑·원본·데이터와 방문 미디어80개·선택 업데이트를 유지한다. ONB-001·ONB-002의 입력/월령·LOC-001/002·PRI-001/002도 유지한다.

3.3은 새 origin에서 온라인/settings 준비→검사 서버 중단→브라우저 offline→처음 여는 홈/설정·이용 안내 표시를 검증해 완료했다. 셸 준비 중/완료/실패 안내·오프라인 재등록 실패 시 기존 셸 유지·환영 이미지 실패 기본 표시를 보완했다. WEB-002의 기본 셸과 이미지 캐시 경계를 구분한다. 관련 회귀24개와 타입 검사가 통과했다. 전체 이미지 첫 오프라인·실기기 홈 화면 설치를 검증했다고 보고하지 않는다.

2.4의 로컬 HTTP 크롤러 형태 검사는 공개6개 연결(HTML→실제 OG 이미지)·제외/오류8개 경로가 통과했다. 실제 카카오톡 미리보기는 외부 HTTPS와 카카오 공식 도구 로그인이 필요하다. 기존 배포 제외 요청을 유지하므로 실제 서비스 검증은 미완료로 남긴다. [실행 보고서](evidence/web-basic-offline-2026-11-15.md)를 따른다.

마감 검증: Node24.22.2/pnpm10.33.0의 `verify:local`에서255개 테스트·타입·기본 웹/PWA 빌드 통과. 별도 공개416개 모드 export와 새 origin의 기본 오프라인 홈/안내 검증도 성공했다. spec:index261개·spec:check37요구사항/97시나리오·strict validate·changed/diff 검사를 통과했다.2.4 실제 공유 확인은 승인한 외부 HTTPS/사용자 로그인 전까지 미완료다.

## Preview 배포 승인·준비 — 2026-11-15

사용자가 ‘preview 배포 해줘’로 이전 배포 제외 범위를 Preview 커밋·푸시·Vercel 배포까지 확장했다. 기존 원격 preview는 기준5f6f23e, main/Production은4dd31f2임을 확인했다. Vercel nori-recipe의 Preview에 공개 매니페스트·Storage origin·공개 버킷 Config 변수3개를 저장하고 새로고침 후 Preview 전용임을 재확인했다. Production 변수·DB·Storage 권한은 변경하지 않았다. 로컬255개 테스트·타입/웹 빌드와 spec/check/strict 검증은 통과한 상태이며 실제 배포/CI 완료와 구분한다. 실제 카카오 도구 로그인·최종 미리보기 확인은2.4 미완료로 유지한다.

## 놀이 원본 Git 제외·Preview 재배포 — 2026-11-15

사용자가 ‘일단 놀이이미지를 gitignore에 추가해 preview에 배포’하도록 요청했다. spec-driven 진행은8/13 완료이며, 이번 범위는4.2의 Git 추적 제외·웹/CI 연결에 한한다. 실제 공유 봇·새 checkout의 관리자 원본 복원 통합·실제 버전 롤백까지 완료한 것이 아니므로4.2 전체 체크박스는 미완료로 유지한다. 나머지 미완료 항목을 자동 구현하지 않는다.

시작 시 원격 preview와 HEAD는1906483e2697a2713a650ed2a14f9fe5ff39079c, main은4dd31f2980497f8945f64713a6fcc6e64153950f다. 별도 worktree/clone 없이 원본 `/Users/msyu/study/play-recipe`를 사용한다. 이전 Preview 배포4HCRzSHHS3h1NFXqfyud6tQHyqW3는Ready이며 공개416개 검증·이미지/OG/CORS 캐시·기본 셸 준비를 확인했다. Vercel 로그인 보호로 실제 공유 봇은 미완료다.

전체 업로드 보고서의224개 ID와 추적 파일 집합·원본 SHA-256·크기·다운로드 검증 결과를 대조한 뒤 `git rm --cached`로 인덱스에서만 제외했다. `/images/plays/`를 ignore하고 로컬224개 JPEG와 재료/기타 이미지·기존 승인·내용·DB/store·GA4·네이티브 매핑은 보존한다. 기존 generated/public/dist 캐시 ignore를 유지한다. 과거 Git 이력·Storage 객체·DB·권한·Production은 변경하지 않는다.

WEB-003/GOV-003: CI는 공개 설정3개와 `verify:local --public-images`를 사용한다. 이 명시적 모드만 원본 존재 검사 대신 전체 공개 이미지 해시·크기·WebP 빌드를 수행하며 다른 회귀/타입/명세 검사·실패 중단·분석 차단은 유지한다. 공개 입력은 빌드에만 전달하고 관리자 변수는 제거하며 설정 누락 시 검사 전 실패한다. 플래그 없는 로컬 검증·원본 검사는 보존한 관리자 파일로 계속 실행할 수 있다. CON-005·WEB-001/002/004·LOC-001/002·PRI-001/002의 기존 승인·게스트 데이터·공유/PWA/GA4 계약은 유지한다.

직전 정상 커밋/공개 매니페스트/객체 버전은 보존하고 DEVELOPMENT.md에 새 checkout 공개 명령·관리 복원 경계·직전 배포 복구 절차를 기록했다. 실제 관리자 복원·호스팅 롤백은 이번에 수행하지 않으며 전체4.2 완료로 보고하지 않는다. 검증·새 Preview 결과는 실제 성공 후 별도로 기록한다.

로컬 마감: Node24.22.2/pnpm10.33.0에서 `pnpm verify:local` 종료0. 명세 도구8·단위123·검수27·Storage15·로컬 검수26·웹57, 총256개와 타입·기본 웹/PWA 빌드 통과. 원본/재료 이미지·JSON·검수·DB/store·분석·네이티브 매핑318개 파일의 전후 SHA-256 일치, 로컬 JPEG224개 유지와 Git 추적0개·재료 이미지 비제외를 확인했다. 원본 없는 전체 앱 fixture의 성공/필수 누락·해시 오류 실패 보존과 공개 CI 환경 격리 회귀가 포함된다. strict change validate·spec:index(261개)·spec:changed·diff 검사를 통과했다. 최초 명세 길이 경고는 Scenario로 구분해 수정 후 전체 검증을 재실행했다. 새 원격 CI/Preview의 최종 결과는 로컬 성공과 구분한다.

## 최종 완료 정리 — 2026-11-15

사용자 원문: “링크 공유에도 잘 나오는거 확인했어! 재료 이미지는 후속 작업으로 두고 openspec에 작업 완료 처리해서 preview에 커밋앤 푸쉬해줘”. 실제 공유 표시의 근거는 사용자 보고이며 플랫폼·앱 버전·기종은 수집하지 않았다. 카카오 공식 디버거 로그인이나 모든 플랫폼 검증을 했다고 확대하지 않는다.

웹 이관은 원본224개/공개416개 실제 Storage 검증, 원본 로컬 보존·Git 추적 제외,208개 놀이 웹/공유·PWA 연결과 원본/키 없는 CI·Preview/Production 배포를 완료했다. 코드 커밋은1906483·d0bb441, 운영배포는FuaYGqvGu2nCJ2bU65PxBzi3woVk, 운영 CI는43702112769(256개 테스트·공개416개 검증 성공)다. 실제 HTTP6개 공유 체인과 제외/오류4개404·운영 PWA 선택 업데이트·CORS 캐시 해시를 확인했다.

완료 범위12개 체크와 별도 미완료 후속을 구분한다.3.2·원래4.2의 전체 관리자 복원/실제 롤백·원래4.3의 서비스 내 제공처 고지는 후속에 남기며 해당 기능을 새로 구현하지 않는다. 재료 이미지 이관도 후속이다. 기존 놀이/재료 JSON·검수 승인·원본 바이트·DB/store·GA4·네이티브 매핑은 보존한다. 이번 요청은 문서 정리와 Preview 커밋/푸시이며 main 병합·운영 재배포·DB/Storage 변경은 실행하지 않는다.
