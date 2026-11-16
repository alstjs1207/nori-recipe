# 재료 이미지 이관 검증

기준일2026-11-16(KST). 원본 프로젝트 `/Users/msyu/study/play-recipe`의 기존 preview checkout을 사용했다. worktree/clone/전체 복사본을 만들지 않았다. 기본 소스 fixture는 원본/관리자 키/Git 없이 필요한 앱 소스와 공개 자산만 구성한 검증용이다.

## 실제 Storage와 원본 보존

- 기존 매핑71개: 승인 JPEG66개·검수 대기 브랜드5개. Git JPEG67개는 모두 고유 SHA이며 미매핑1개는 비공개만 보관한다. [수량/버전](evidence/inventory-2026-11-16.json).
- `material-originals`(비공개 JPEG)67개·`material-assets`(공개192px WebP)66개. 각16MiB·정책0개. 생성만 하는 전송으로133개 업로드 후133개 다운로드 SHA-256·바이트를 확인했다. [전송](evidence/storage-transfer-2026-11-16.json)·[공개 매니페스트](evidence/public-manifest-2026-11-16.json).
- 같은 계획의 재실행133개 재검증·신규 생성0개. 원본 없는 격리 디렉터리에67개 실제 복원·해시 일치. 원본67개 익명 공개 조회 차단, anon-key 인증 원본 조회 차단. 공개66개 익명200·WebP·CORS `*`·캐시31536000·해시 일치. [접근/복원](evidence/storage-access-2026-11-16.json).
- 무키/anon-key 업로드는400/객체 미생성. 기존 임시 시험 객체 삭제는 무키400, anon-key200/삭제0건이며 객체 목록과 바이트 유지로 차단 확인. 관리자 정리 후 목록에서 부재 확인. 삭제 후 CDN GET이 잠시 이전 응답을 반환할 수 있어 목록을 최종 기준으로 사용했다. 기존 재료/놀이 객체를 삭제하지 않았다.
- 위 원격 보존·복원·원본 없는 실제 빌드 후 검증한67개 파일만 정확한 경로별 Git 제외. 로컬 JPEG67개·놀이224개와 데이터/검수/기존 매핑·이미지 버전/DB·분석 등317개 SHA 모두 동일. [보존 결과](evidence/preservation-2026-11-16.json). 과거 Git 이력과 기존 놀이 매니페스트/객체는 보존한다.

## 빌드·브라우저

- Node24.21.0/pnpm10.33.0. `verify:local --public-images`로 기존256개와 신규10개를 포함한266개 회귀·타입·콘텐츠·명세·공개482개 빌드를 확인했다. 원본 추적 제외 후 최종 전체 재검증도 종료0이며 [검증 요약](evidence/local-verification-2026-11-16.json)에266개·공개482개·명세38요구사항/106시나리오·index270개·strict change/spec:changed 통과를 기록했다.
- 실제 익명 다운로드한 놀이416개·재료66개를 해시 검증하고, Git·놀이/재료 원본·관리자 키 없는 최소 소스 fixture에서 전체 Expo export·공유208개·소개·PWA 빌드 성공. [실제 원본 없는 빌드](evidence/source-only-build-2026-11-16.json). fixture의 온보딩/브랜드 자산은 기존 공개 자산이다.
- 실제 브라우저에서 재료192px·anonymous CORS·서비스워커 제어 확인. 실제 방문 미디어44개는200/cors이며 매니페스트 SHA와 모두 일치, 분석 요청0개. 오프라인 설정·안내·방문 재료 paper192px·처음 여는 start 기본 셸 확인. [브라우저/PWA](evidence/local-web-pwa-2026-11-16.json). 전체 선저장·미방문 이미지 보장을 추가하지 않았다.
- fixture는 누락/해시/형식/전송/export/출력 교체 실패 시 중단·직전 출력/소스 snapshot 보존, 경로 격리·중단/재개·전송 중 철회·덮어쓰기 방지·복원 충돌·CORS/opaque/redirect/오류·합계80개·선택 업데이트·키/분석 격리를 검사한다. 실기기/모든 브라우저 검증으로 확대하지 않는다.

## Preview와 한계

Vercel Preview에만 `MATERIAL_IMAGE_PUBLIC_MANIFEST`, `MATERIAL_IMAGE_PUBLIC_ORIGIN`, `MATERIAL_IMAGE_PUBLIC_BUCKET` 공개 Config3개를 추가했다. 기존 PLAY_IMAGE 공개 설정과 Production PUBLIC_ORIGIN/GA4/배포·DB/Auth는 유지했다. 관리자 키는 파일·앱·Git·CI/Vercel에 저장하지 않았으며 로그인 브라우저에서 로컬 Node24의 표준입력 파이프로만 전달했다.

구현 커밋 `0183e28359c7149596bb245c800821723ed53feb`을 preview에 푸시하고 원격 보존을 확인했다. [GitHub CI43820770194](https://github.com/alstjs1207/nori-recipe/actions/runs/43820770194)는 Node24.22.2/pnpm10.33.0 새 checkout에서266개·원본0MB·공개416+66개 검증에 성공했다. [원격 CI](evidence/remote-ci-2026-11-16.json). [Vercel Cr1LM2Kvg36vKvk37EtHAGAjrM3E](https://vercel.com/alstjs1207s-projects/nori-recipe/Cr1LM2Kvg36vKvk37EtHAGAjrM3E)는 Ready이며 [실제 Preview](https://nori-recipe-8qnkalwb3-alstjs1207s-projects.vercel.app/)의192px 재료·놀이 OG/정확한 canonical·소개 Storage URL·CORS 캐시44개 해시·분석 요청0개를 확인했다. [배포/브라우저](evidence/preview-deploy-2026-11-16.json). 로그인 보호를 유지한다. 운영의 기존 캐시버전93f47b0b481b와 main d0bb441은 변경하지 않았다.

임시4196 서버를 종료하고 원본 없는 소스 fixture를 제거했다. 고유 소스 차이·다른 심볼릭 링크 의존성0개를 확인했으며 실제 공개 다운로드·관리 계획/state·로컬 원본과 모든 영구 evidence는 원본 프로젝트에 보존했다. [정리 결과](evidence/cleanup-2026-11-16.json). main 병합·Production 배포·네이티브 전환·관리 UI 복원·놀이 전체 실제 롤백·서비스 내 제공처 고지 보강은 이번 범위가 아니다. 공개 매니페스트는 CI/Preview의 고정 입력이므로 change 폴더를 이동하지 않는다.

## 완료 문서 변경 근거

GOV-001·GOV-002·GOV-003에 따라 실제 실행한 근거와 미래 후속을 구분하고9/9 완료를 기록한다. 이번 마감 문서 커밋은 검증 보고서·라이선스 적용 범위의 위치 안내·roadmap/known-gaps를 갱신하며 앱 동작·승인·개인정보 정책을 추가 변경하지 않는다. 기존 CON-006·WEB-002·WEB-003·PRI-001~004·CAT-001/004의 실행 결과는 위 근거를 따른다.
