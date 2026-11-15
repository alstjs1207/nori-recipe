# 놀이 이미지 전체 Storage 업로드 — 2026-11-15 KST

사용자의 ‘놀이 이미지 전체 업로드’ 요청에 따라 기존 3개 파일럿에서 전체 대상으로 확장했다. 원본 프로젝트 `/Users/msyu/study/play-recipe`, 브랜치 `preview`, 기준/HEAD 및 실제 원격 preview 커밋은 `5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752`다. 기존 미커밋 작업을 유지하고 새 clone/worktree는 만들지 않았다. 업무 DB·Auth·권한 설정·배포·Git 추적은 변경하지 않았다.

## 대상과 결과

| 구분 | 개수 | 바이트 | 결과 |
| --- | ---: | ---: | --- |
| 비공개 원본 JPEG | 224 | 140,445,124 | 관리자 다운로드 전체 SHA-256·바이트 일치 |
| 승인 live의 공개 상세/썸네일 WebP | 208개 놀이 / 416개 파일 | 17,906,094 | 관리자 다운로드 및 익명 공개 GET 전체 해시·WebP 일치 |
| 합계 | 640개 객체 | 158,351,218 | 성공, 실패 0개·해시 불일치 0개 |
| 이번 실행에서 새로 생성 | 631 | — | 기존 9개는 읽어 검증 후 재사용, 덮어쓰기 없음 |

대상 프로젝트는 `nori-recipe` / `clqthwgsmumiwnnqjtbe`, origin `https://clqthwgsmumiwnnqjtbe.supabase.co`다. `play-originals` 비공개 JPEG·`play-assets` 공개 WebP, 각16MiB 제한이 기존 설정과 같은지 API로 확인했다. 설정을 다시 쓰거나 SQL/정책을 추가하지 않았다. 계정/조직·요금제·접근 정책의 선행 확인은 [파일럿 보고서](storage-pilot-2026-11-15.md)를 따른다.

전체 원본은 비공개 보관한다. 기존 승인 기준 커밋과 현재 live 상태·내용 해시·원본 바이트가 같은 208개만 공개했다. draft9개(그중 review1개), archived7개, 합계16개는 공개 후보에서 제외하고 공개 버킷의 해당 ID prefix가 전부 비어 있음을 확인했다. 게시/검수 상태와 기존 승인 해시는 변경하지 않았다.

ID별 원본 체크섬·파생 버전/해시·공개 URL·결과는 [전체 JSON 보고서](full-upload-2026-11-15.json), 검증된 공개 빌드 입력은 [공개 매니페스트](full-public-manifest-2026-11-15.json)에 보존한다. 공개 매니페스트에는 비공개 버킷/원본 경로·키·서명 URL이 없다. 이 파일을 기록한 사실만으로 기본 앱이나 배포를 전환하지 않는다.

## 실제 전송과 접근 검증

- Node **24.22.2** / pnpm **10.33.0**. 2026-11-15 **09:28:02~09:40:06 KST**에 전송/다운로드 검증을 실행했다.
- `images:storage`의 exported `main(['plan', '--baseline-ref', '<기준 SHA>', '--original-bucket', 'play-originals', '--public-bucket', 'play-assets', '--plan', '<관리 계획>', '--write'])`를 ID 제한 없이 실행했다. JPEG 전체 디코딩·기존 승인·파생 변환을 확인한 224개 계획을 사용했다.
- 기존 `supabaseStore` + `migrate(..., {write:true, statePath, publicPath})`를 실행했다. 쓰기는 `x-upsert:false`인 생성 POST만 사용했고 실제 객체를 GET해 길이·SHA-256이 같은 경우에만 완료했다. GET·생성 외 갱신/삭제 API를 실행하지 않았다.
- 기존 파일럿의 state/공개 후보를 새 실행 디렉터리에 복사하고 직전 정상 후보 사본을 별도로 보존했다. 전송 중 객체별 체크포인트와 ID 결과를 지속 저장했다. 최종 224개 ID·640개 객체가 verified이고 부분 실패·정리 후보는 모두0개다.
- 최종 버킷 목록에는 원본224개/공개208개 ID만 있으며 예상하지 못한 root는 없었다. 공개 제외16개 prefix도 별도로 검사했다. 기존 버전이나 객체를 삭제하지 않았다.
- 관리자 GET으로 존재/해시가 확인된 원본224개 전부에 대해 인증 없는 `/object/public/play-originals/<원본 경로>` 조회가 400/401/403/404 중 차단 응답인지 확인했다. 실제 결과는 모두400이다. 429·5xx는 권한 차단 증거로 허용하지 않았다.
- 기존 관리자 키는 ego 대시보드 UI에서 읽어 별도 Node 프로세스의 stdin/메모리로만 전달했다. 파일·명령 인자·로그·공개 환경·보고서에 저장하지 않았다. 일반 사용자 쓰기/삭제 정책은 변경하지 않았으며 선행 파일럿 검사 결과를 유지한다. 이번에는 임시 원격 객체도 만들지 않았다.

## 원본/관리자 키 없는 전체 웹 검증

실제 앱·전체224개 데이터와 기존 공용 자산을 사용하는 희소 소스 fixture를 만들었다. 놀이 JPEG·Git·dotenv·관리자 환경은 포함하지 않았고 다른 이미지와 node_modules만 원본 경로를 공유했다. `buildWeb({root: fixture, env: publicOnlyEnvironment, fetchImpl})`를 실제 공개 매니페스트로 실행했다.

- 공개 자산416개를 **인증 없는 GET**으로 다시 읽고 전체 바이트·SHA-256·WebP/크기를 검증했다. Origin `http://127.0.0.1:4188`의 실제 요청 응답이 모두 `Access-Control-Allow-Origin: *`임을 확인했다.
- 실제 Expo web export 성공. `originalMB:0`, `verifiedPublicAssets:416`, 공개 놀이208개, 버전 `17a789c18679`다. 원본 루트 `dist`와 소스 공개 스냅샷은 교체하지 않았다. 임시 소스 fixture는 제거하고 생성 웹만 보존했다.
- 공개 값은 `PLAY_IMAGE_PUBLIC_MANIFEST`, `PLAY_IMAGE_PUBLIC_ORIGIN`, `PLAY_IMAGE_PUBLIC_BUCKET` 및 로컬 `PUBLIC_ORIGIN`이다. 관리자 키·비공개 원본 복원 없이 재현했다. GA는 비활성화하고 실제 Vercel 환경변수는 변경하지 않았다.
- 생성 결과는 `http://127.0.0.1:4188`에서만 제공한다. 브라우저 결과는 JSON의 browser 항목에 기록하며 전체 이미지의 개별 육안 검수를 의미하지 않는다.

## 보존과 완료 경계

업로드 전후 원본·데이터·검수 결과·app/src/scripts·네이티브 매핑·분석 코드·public·기존 dist 등 **2,228개 파일의 SHA-256**을 비교해 모두 동일했다. 원본 JPEG224개·검수용 로컬 파일·기존 참조와 Git 추적을 유지한다. source 공개 스냅샷도 기본 빈 설정을 유지한다. 로컬 사용자 저장소를 지우거나 동의·찜·기록을 변경하지 않았다.

관리 계획·state·실행 계측·직전 정상 후보·생성 웹은 기존 ignore 대상 `generated/play-image-storage/full-clqthwgsmumiwnnqjtbe-2026-11-15/`에 보존한다. 관리자 매핑은 공개 웹 루트 밖에 둔다. 공개 매니페스트/ID 결과는 위 evidence 파일에 별도 보존했다. 이번 실행의 임시 관리 스크립트·fixture는 작업 후 정리하며 원본 프로젝트를 유지한다.

**4.1은 전체 Storage 보존·다운로드 무결성·공개 자산/제외 ID 검증 및 ID별 보고를 완료했다.** 해당 항목의 보존 조건에 따라 웹/PWA·공유 봇·네이티브 전체 검증이 끝날 때까지 기존 참조와 로컬 파일을 계속 유지한다. 네이티브 구현/실기기 오프라인·공유 봇·호스팅 환경은 이번 업로드 요청으로 완료됐다고 표시하지 않는다. 3.x·4.2·4.3 전체 전환·5.1은 미완료다.

CON-004·CON-005의 원본 비공개/승인 공개/무결성 계약과 WEB-001·WEB-003의 같은 공개 URL 및 공개 자산 빌드를 확인했다. CON-001~003·CAT-001/004·LOC-001/002·PRI-001/002의 데이터·승인·GA4 정책은 유지한다. 운영 DB/계정 변경·배포·커밋·푸시·Git 추적 제외·과거 이력 변경·change archive는 하지 않았다.

### 브라우저 표시·PWA 결과

ego에서 play_001/115/225의 실제 상세960px·익명 CORS·화면/OG URL 일치·로컬 canonical을 확인했다. 기존 localhost 워커의 대기 업데이트는 ‘새 버전 열기’를 선택해 적용했다. ‘전체 월령 둘러보기’에서208개 목록과320px 썸네일을 확인했으며 사용자 프로필 월령은 변경하지 않았다. 현재 `nori-web-17a789c18679-media` 캐시에 있던 실제 Storage 응답10개의 CORS/200·SHA-256이 공개 매니페스트와 일치했다. 10개는 검사 시점의 방문 캐시 수이며 전체416개 선캐시를 뜻하지 않는다. 실제 인터넷 전체 차단·공유 봇·실기기 오프라인은 이번 범위에서 시험하지 않았다.

### 마감 검사와 변경 파일

`pnpm spec:index`(260개), `pnpm spec:check`(current/active18·archive4·37요구사항/95시나리오), `pnpm spec validate migrate-play-images-to-supabase-storage --strict`, `pnpm spec:changed 5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752`, `git diff --check`가 통과했다. apply 상태도4.1 완료·전체7/12 완료로 재확인했다. 이번에는 도구/앱 소스 변경 없이 실제 실행과 문서만 추가했으므로 기존249개 통과 기록의 `verify:local` 전체를 반복하지 않았다. 실제 공개416개 검증·Expo export·브라우저/접근 검사는 별도로 수행했다.

변경 파일은 `DEVELOPMENT.md`, 이 change의 `proposal.md`·`design.md`·`tasks.md`, 현재 `content-review/spec.md`·`web-platform/spec.md`, 이 실행 보고서·`full-upload-2026-11-15.json`·`full-public-manifest-2026-11-15.json`이다. policy-map의 기존 소스/테스트 연결과 source-index260개 분류는 유지한다.

최종 검사에서 보호 파일2,228개가 동일하고 생성물/보고서236개 텍스트 파일에 실제 관리자 키 형태의 값이 없었다. 공개 웹에는 비공개 버킷 매핑이 없다. 임시 관리 스크립트4개·희소 소스 fixture를 제거했고 남은 잠금은 없다. 이전 이 채팅의3개 파일럿 서버(4187)는 종료했으며 전체 확인 서버(4188)와 ego 결과 탭만 사용자 확인용으로 유지했다. 별도 worktree/clone은 없고 원본 프로젝트와 preview/기준 커밋을 유지했다. 최종 원격 preview도 기준 SHA와 동일했다.
