# 놀이 이미지 웹 이관 최종 검증

기준일2026-11-15(KST), 구현 커밋 `1906483e2697a2713a650ed2a14f9fe5ff39079c`·`d0bb44102e71fd77a28912394eab78f2e3da8be4`. 이 문서는 로컬 검증·실제 Storage 실행·원격 CI/배포·사용자 확인을 구분한다. 현재 docs 완료 정리와 코드 배포 완료 시점을 섞지 않는다.

## 완료 범위

- 비공개 원본224개·승인 live208개 놀이의 공개 상세/썸네일416개, 총640개 객체 다운로드 SHA-256·바이트 일치. draft/review/archived16개는 공개 제외, 원본224개 익명 접근 차단. [전체 실행](evidence/full-upload-2026-11-15.md)·[ID별 결과](evidence/full-upload-2026-11-15.json).
- 원본224개 로컬 보존·Git 추적0개, 재료/기타 이미지·과거 Git 이력 보존. 원본/재료 이미지·JSON·검수·DB/store·분석·네이티브 매핑318개 파일 전후 SHA-256 일치.
- 웹·공유·소개가 같은 승인 불변 URL 사용. 기본 PWA 셸/안내·방문 미디어80개·실패 기본 표시·선택 업데이트 유지. 새 로컬 origin의 첫 오프라인 기본 화면 검증은 [별도 보고서](evidence/web-basic-offline-2026-11-15.md)의 범위와 한계를 따른다.
- 원본·관리자 키 없는 새 checkout의 공개 자산 검증 빌드, 필수 누락·해시 오류/손상 시 실패·기존 출력 보존 회귀. 원본이 필요한 관리자 로컬 흐름과 공개 CI/Vercel 경계를 분리.

## 실행 결과

| 날짜·환경/명령 | 결과·근거 |
| --- | --- |
| 2026-11-15 Node24.22.2/pnpm10.33.0 `pnpm verify:local` |256개(명세8·단위123·검수27·Storage15·로컬 검수26·웹57), 타입·콘텐츠/이미지 검사·웹/PWA 빌드 성공 |
| `pnpm spec:index`, `pnpm spec:check`, strict change validate, `pnpm spec:changed`, `git diff --check` | 구현 마감 때 모두 통과. 현재 문서 정리의 재검증은 아래에 별도 기록 |
| 원본 없는 Preview CI `verify:local --public-images` | [43669789093](https://github.com/alstjs1207/nori-recipe/actions/runs/43669789093) 성공,256개·공개416개 검증·Expo export |
| Preview Vercel | [Dib53cPESuLuUWjHyb5VG1DiqAGz](https://vercel.com/alstjs1207s-projects/nori-recipe/Dib53cPESuLuUWjHyb5VG1DiqAGz) Ready. 로그인 보호는 유지 |
| main CI `verify:local --public-images` | [43702112769](https://github.com/alstjs1207/nori-recipe/actions/runs/43702112769) 성공,256개·공개416개 검증·원본0MB |
| Production Vercel | [FuaYGqvGu2nCJ2bU65PxBzi3woVk](https://vercel.com/alstjs1207s-projects/nori-recipe/FuaYGqvGu2nCJ2bU65PxBzi3woVk) Ready, main fast-forward, 운영 [www.nori-recipe.com](https://www.nori-recipe.com), 공개208개 링크·13개 셸 자산·원본0MB |
| 실제 운영 HTTP/브라우저 | 크롤러 UA2종×놀이3개 HTML→이미지6개 체인200·canonical/OG 일치·SHA 검증, 제외/오류4개404.960px 놀이·기존 재료 이미지·새 버전 선택 후93f47b0b481b 셸과 CORS200 이미지 캐시 해시 일치. [비밀 없는 실제 결과](evidence/production-deploy-2026-11-15.json) |
| 사용자 실제 링크 공유 | 2026-11-15 사용자가 “링크 공유에도 잘 나오는거 확인했어!”라고 확인. 플랫폼·기종·앱 버전은 미수집. 공식 카카오 디버거·모든 공유 서비스 검사로 확대하지 않음 |

## 후속과 비실행 범위

[후속 목록](../../follow-ups/play-image-operations.md)에 재료 이관·관리자 복원 UI·새 checkout의 실제 전체 원본 복원/롤백·서비스 내 제공처 고지를 미완료로 유지한다. 네이티브는 사용자 결정으로 제외한다. 기존 고유 파일·업무 DB·Auth·로컬 사용자 데이터·GA4 정책을 변경하지 않는다. 이번 완료 문서 작업으로 Storage 쓰기/권한 변경·main 병합·운영 재배포를 추가 실행하지 않는다.

현재 매니페스트를 실제 CI/Vercel이 change 경로에서 읽으므로 완료 폴더는 유지하고 archive 이동은 하지 않는다. 원계획의 남은 세부 작업을 완료로 체크해 숨기지 않으며 최종 인도 범위12개와 별도 미완료 후속을 구분한다.

## 이번 완료 문서 재검증 — 2026-11-15

Node24.22.2/pnpm10.33.0의 `pnpm verify:local` 종료0:256개 테스트·타입·콘텐츠/이미지 검사·기본 로컬 웹/PWA 빌드 성공. 공개/관리 환경을 분리하는 회귀와 원본 없는 실제 전체 앱 export fixture를 포함한다. 이는 원격 배포 재실행이 아니다. `pnpm spec:index`261개, `pnpm spec:check`37개 요구사항/100개 시나리오, `pnpm spec validate migrate-play-images-to-supabase-storage --strict`, `pnpm spec:changed d0bb44102e71fd77a28912394eab78f2e3da8be4`, `git diff --check` 통과. 새 완료·후속·delta의 로컬 문서 링크가 유효함을 확인했다. 원본/재료 이미지·데이터·검수·DB/store·GA4·네이티브 매핑318개 파일의 SHA-256 동일, 로컬 원본224개 유지. CLI list의 해당 change는12/12·complete이며 후속 미완료는 별도 목록에 남아 있다.
