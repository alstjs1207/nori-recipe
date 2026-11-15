# 실제 Storage 3개 이미지 검증 — 2026-11-15 KST

사용자가 지정한 프로젝트의 Storage 설정·승인 이미지 1~3개 업로드·로컬 웹 확인만 실행했다. 업무 DB·Auth·배포·Git 추적은 변경하지 않았다. 원본 프로젝트 `/Users/msyu/study/play-recipe`의 `preview`를 사용했으며 HEAD와 실행 전후 실제 원격 preview는 `5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752`였다. 기존 미커밋 변경을 보존했고 clone/worktree는 만들지 않았다.

## 프로젝트·한도·설정 — 1.1

- 프로젝트: **nori-recipe**, ref `clqthwgsmumiwnnqjtbe`, 조직 **alstjs1207** (`pyrxoupdliycqfoylymj`), Free, 서울 `ap-northeast-2`. 대시보드 환경 표시는 `main / PRODUCTION`이다. 실제 배포 환경변수는 바꾸지 않았다.
- Free의 활성 프로젝트 한도는 2개이며 조직 프로젝트도 2개다([공식 안내](https://supabase.com/docs/guides/platform/billing-on-supabase)). 대시보드의 2026-11-05~12-05 사용량 표시는 Storage **0.006 / 1 GB**, egress **0.25 / 5 GB**, cached egress **0.005 / 5 GB**였다. 사용량은 최대 1시간 지연되므로 업로드 직후 정확한 잔량으로 해석하지 않는다. 다른 프로젝트는 변경하지 않았다.
- 전체 로컬 원본 **224개 / 140,445,124바이트**, 기존 승인 공개 후보 **208개**, 파생 상세 **15,362,308바이트**·썸네일 **2,543,786바이트**. 현재 변환 규격의 전체 계획 합계는 **158,351,218바이트**다. 전체 업로드를 실행한 수치가 아니다.
- 처음에는 대상 프로젝트 Storage 버킷이 없었다. 대시보드에서 아래 두 버킷만 만들었다. 전역 50MB 제한은 그대로 두고 버킷 제한을 각각 **16,777,216바이트(16MiB)**로 설정했다.

| 버킷 | 공개 읽기 | 허용 MIME | 정책 |
| --- | --- | --- | --- |
| `play-originals` | 비공개 | `image/jpeg` | 일반 사용자용 Storage 정책 없음 |
| `play-assets` | 공개 | `image/webp` | 공개 객체 읽기, 일반 사용자용 쓰기·삭제 정책 없음 |

Storage Policies 화면에서 두 버킷 및 기타 `storage.objects` 정책이 모두 비어 있음을 확인했다. 별도 SQL·RLS 정책 생성이나 해제는 하지 않았다. 기본 제한과 공개 버킷의 읽기 제공을 사용한다. [공식 버킷 정책](https://supabase.com/docs/guides/storage/buckets/fundamentals), [접근 제어](https://supabase.com/docs/guides/storage/security/access-control)와 대조했다.

## 실제 전송·복원 — 4.1의 일부

| ID | 놀이 | 결과 |
| --- | --- | --- |
| `play_006` | 뚜껑 돌려 닫기 놀이 | 원본·상세·썸네일 업로드/다운로드 SHA-256 일치 |
| `play_013` | 끼적이기 (자유화) | 원본·상세·썸네일 업로드/다운로드 SHA-256 일치 |
| `play_076` | 의자 사이 통로 놀이 | 원본·상세·썸네일 업로드/다운로드 SHA-256 일치 |

3개 모두 기준 커밋의 live 상태·현재 내용·원본 바이트와 승인 해시가 같았다. 총 **9개 객체 / 1,532,918바이트**를 불변 버전 경로로 생성했다. 상세 960px 이내/q72, 썸네일 320px/q66 WebP이며 Supabase 유료 이미지 변환 기능은 사용하지 않았다. ID별 전체 해시·버전·공개 URL·실제 응답 결과는 [JSON 결과](storage-pilot-2026-11-15.json)에 기록했다. 비공개 원본 경로·키·서명 URL은 공개 매니페스트에 넣지 않았다.

`migrate`를 같은 입력으로 다시 실행해 9개를 읽어 재검증했고 **추가 생성 0개**였다. 원본 없는 별도 임시 복원 fixture에서 `restore`로 3개를 새로 생성해 원본 SHA-256·JPEG 디코딩을 검증한 뒤 fixture를 제거했다. 프로젝트 원본을 삭제/이동하여 검증하지 않았다. 최종 감사에서도 9개 모두 해시가 일치했다. 최종 ID 실패·정리 후보는 없다.

## 관리자·비인가 접근

기존 관리자 키와 anon 키를 대시보드 UI에서 읽어 프로세스 메모리·stdin으로만 전달했다. 키를 생성/교체하거나 파일·명령 인자·로그·Git·웹 빌드에 기록하지 않았다. ego 프로세스는 native sharp 모듈 로드를 제한하므로 실제 이관 모듈은 Node 24 자식 프로세스에서 실행했다.

각 버킷에 직접 생성한 `_permission-probe/<UUID>` 객체에만 쓰기·삭제 검사를 수행했다. 실제 이관 객체를 수정/삭제하지 않았다.

| 작업 | 관리자 | 키 없는 요청 | anon 키 요청 |
| --- | --- | --- | --- |
| 비공개 원본 읽기 | 200·해시 일치 | 400·차단 | 400·차단 |
| 공개 이미지 읽기 | 200 | 200 | 200 |
| 객체 목록 | 최종 감사로 대상 확인 | 400·차단 | 200·빈 배열 |
| 생성·수정 | 생성 200 | 400·차단 | 400·차단 |
| 삭제 | 200·실제 제거 | 400·차단 | 200·영향 0개 |

anon 삭제의 HTTP 200은 권한 허용을 뜻하지 않는다. 응답은 빈 배열이며 관리자 재조회로 검사 객체의 바이트가 그대로임을 확인했다. 관리자의 삭제 후에는 새 query nonce GET이 400으로 실패하고 목록이 비어 있음을 확인했다. 기존 URL은 삭제 직후 캐시된 200을 잠시 반환하여 처음 검사 기대값이 실패했다. 따라서 CDN 캐시와 실제 객체 존재를 구분해 최종 검증했다. 공개 버킷은 `/object/public/` 외 일반 객체 읽기 경로도 익명 200이므로 해당 응답을 비공개 실패와 혼동하지 않는다. 모든 검사 객체는 삭제됐고 두 버킷의 검사 prefix 잔여 객체는 **0개**다.

새 Auth 사용자를 만들지 않았으며 일반 로그인 사용자 JWT는 별도로 시험하지 않았다. 비인가 검사 주체는 키 없는 요청과 anon 역할이다. Storage의 공개 읽기 제공 외에 권한 정책은 추가하지 않았다.

## 로컬 웹·공유·PWA

- `buildWeb`에 3개만 담은 희소 앱 소스 fixture와 실제 공개 후보를 제공했다. 각 놀이 객체의 내용은 변경하지 않고 나머지 ID만 이 fixture에서 제외했다. 원본 `data/plays.json` 224개는 그대로다. 전체 앱에 불완전한 3개 매니페스트를 적용하거나 필수 누락 검사 계약을 완화하지 않았다.
- `.git`·놀이 JPEG·관리자 키·dotenv가 없는 fixture에서 **실제 익명 공개 GET 6개**의 해시/바이트/WebP를 검사하고 Expo web export 성공. `originalMB: 0`, `verifiedPublicAssets: 6`, 빌드 버전 `738a50bdebb6`이다. 재료·브랜드·온보딩 자산과 node_modules는 기존 경로를 공유했다. fixture 소스는 제거하고 생성 웹만 보존했다. 기존 루트 `dist`는 교체하지 않았다.
- ego에서 3개 상세 이미지 **960px**, 탐색 썸네일 **320px**, `crossOrigin: anonymous`를 확인했다. 각 상세의 OG 이미지와 실제 화면 이미지 URL이 같다. canonical은 `http://127.0.0.1:4187/play/<id>`다. 월령 필터로 샘플이 숨겨질 때는 ‘전체 월령 둘러보기’를 선택한다. 원래 사용자 월령·찜·기록을 바꾸지 않았다.
- 기존 로컬 워커에 대기 업데이트가 있어 ‘새 버전 열기’를 선택한 뒤 실제 Storage 이미지 **6개가 현재 media 캐시에 CORS/200 응답으로 저장**되고 SHA-256이 공개 후보와 같은 것을 확인했다. 이번 실제 환경 단계에서 인터넷 전체 차단·실기기 오프라인은 시험하지 않았다. 이전 fixture의 오프라인·80개·실패/opaque/업데이트 회귀와 구분한다.
- 로컬 서버: `http://127.0.0.1:4187`. 사용자가 확인할 탐색 탭과 서버를 남겼다. 관리 탭은 정리했다. 서버는 `scripts/serve-web.mjs`의 `createWebServer`로 생성 웹 디렉터리만 제공한다. 이는 Preview/Production 배포가 아니다.

## 실행·보존·남은 범위

실행 환경은 **Node 24.22.2 / pnpm 10.33.0**, 실행일은 **2026-11-15 KST**다. 명령/호출은 다음과 같다.

1. `images:storage`의 exported `main(['plan', '--ids', 'play_006,play_013,play_076', '--baseline-ref', '5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752', '--original-bucket', 'play-originals', '--public-bucket', 'play-assets', '--plan', 'generated/play-image-storage/live-clqthwgsmumiwnnqjtbe/admin-plan.json', '--write'])` — 성공.
2. `supabaseStore` + `migrate(..., {write:true, statePath, publicPath})` — 3개 성공, 동일 입력 재실행 성공·추가 생성 0개. `restore`의 원본 없는 임시 fixture — 3개 성공.
3. 전체 ID `planMigration`의 읽기 전용 용량 계산 — 224개/공개 후보 208개 성공. 전체 원격 업로드는 하지 않음.
4. 직접 만든 임시 객체의 Storage POST/GET/PUT/list/DELETE와 최종 GET 감사 — 최종 통과. 실제 이관 객체는 GET/생성만 사용. wire contract는 [공식 SDK](https://github.com/supabase/storage-js/blob/master/src/packages/StorageFileApi.ts)를 대조.
5. `buildWeb({root: sparseFixture, env: publicOnlyEnvironment})` — 실제 6개 공개 자산 검증·Expo export 성공. 최초 시도는 로컬 HTTP에 `VERCEL_ENV=preview`를 함께 지정해 HTTPS origin 검사에서 정상 중단됐다. 실제 호스팅 설정을 바꾸지 않고 로컬 전용 env로 재실행했다.
6. ego 상세 3개·썸네일 3개·canonical/OG·캐시 6개 해시 — 성공. 회원/기록/분석 전송을 시험하거나 초기화하지 않음.

이미지·콘텐츠 JSON·DB/store·분석 코드·네이티브 매핑 중 Git 추적 **318개 파일**을 HEAD 바이트와 직접 비교해 모두 같음을 확인했다. JPEG 224개와 Git 추적을 유지했다. 소스 공개 스냅샷은 기본 빈 설정 그대로다. 체크포인트·관리 계획·공개 후보·생성 웹은 기존 ignore 대상 `generated/play-image-storage/live-clqthwgsmumiwnnqjtbe/`에 보존했다. 관리용 일회성 스크립트와 임시 복원/빌드 fixture는 정리했다.

CON-004·CON-005의 실제 원본/파생 분리와 다운로드 무결성, WEB-001·WEB-003의 3개 URL 소비/공개 빌드, WEB-002의 실제 CORS 캐시를 확인했다. CON-001~003·CAT-001/004·LOC-001/002·PRI-001/002의 데이터/승인/GA4 정책은 변경하지 않았다.

1.1만 추가 완료로 표시한다. **4.1은 3개 부분 검증**이며 전체 224개·공유 봇·네이티브·실기기 검증은 남았다. 3.x·4.2·4.3 전체 전환·5.1 전체 실환경 검증은 완료로 표시하지 않는다. DB·Auth 변경, 배포·커밋·푸시·원본 삭제·Git 추적 제외·과거 이력 변경·change archive는 수행하지 않았다.

### 마감 검사

- Node 24.22.2에서 `pnpm spec:index` — 260개 파일 분류 성공.
- `pnpm spec:check` — current/active 18개·archive4개·37개 요구사항·95개 시나리오 연결 통과.
- `pnpm spec validate migrate-play-images-to-supabase-storage --strict` — 통과.
- `pnpm spec:changed 5f6f23e25a2b5dd4c902e17d82e1746fe6ef7752`, `git diff --check` — 통과.
- 생성 웹·관리 산출물·보고서 24개 텍스트 파일에서 실제 키 형태의 값이 없음을 확인. 관리용 임시 스크립트2개 제거, 남은 state 잠금 없음.
- 이번 추가 변경은 실제 Storage 작업과 문서/근거 기록이다. 앱·도구 소스는 수정하지 않아 `verify:local` 전체를 반복하지 않았다. 이전 2.3 단계의249개 테스트 통과 기록과 이번 실제 접근/전송/로컬 빌드 결과를 구분한다. 5.1 전체 완료로 표시하지 않는다.
