# 승인 후 Supabase 이미지 등록

수집·이미지 생성·검수 준비까지는 기존 로컬 흐름을 유지한다. 사용자 놀이 승인과
재료 **신규 추가**가 업로드를 시작한다. 서버 시작·조회·의견 저장·JSON 가져오기와
CLI dry-run은 원격 전송을 하지 않는다. 미승인 항목을 대신 승인하지 않는다.

## 로컬 설정

Node 24, pnpm 10.33.0을 사용한다. `.env.example`의 네 설정을 Git에서 제외되는 루트
`.env`에 넣거나 프로세스 환경에 주입한다. 세 명령은 `.env`를 읽으며 기존 환경을
우선한다. 설정 후 이미 실행 중인 서버는 재시작한다.

```dotenv
PLAY_IMAGE_STORAGE_URL=https://clqthwgsmumiwnnqjtbe.supabase.co
PLAY_IMAGE_STORAGE_SERVICE_ROLE_KEY=<로컬 관리자 키>
MATERIAL_IMAGE_STORAGE_URL=https://clqthwgsmumiwnnqjtbe.supabase.co
MATERIAL_IMAGE_STORAGE_SERVICE_ROLE_KEY=<같은 프로젝트의 로컬 관리자 키>
```

키를 대화·검수 JSON·프롬프트·Git·CI·Vercel·`EXPO_PUBLIC_*`에 넣지 않는다.
서비스 origin은 고정한다. 버킷 생성·정책 변경·DB 변경·원격 삭제·덮어쓰기는 하지 않는다.

## 승인 순서

1. 수집·정규화 → draft ID → 놀이·새 재료 JPEG 생성·확인 → 검수 배치를 준비한다.
2. 재료 **신규 추가**는 실제 매핑된 JPEG를 디코딩하고
   `material-originals/originals/<원본 SHA-256>/original.jpeg`와
   `material-assets/materials/<slug>/<불변 버전>/icon.webp`를 생성한다.
   아이콘은 기존 이관과 같은 192px inside/q65 WebP다.
3. 놀이 **승인**은 현재 본문·재료·이미지 확인을 검증한 뒤
   `play-originals/<ID>/<원본 SHA-256>/original.jpeg`와
   `play-assets/<ID>/<불변 버전>/{detail,thumbnail}.webp`를 생성한다.
   상세는 960px inside/q72, 썸네일은 320px cover/q66이다.
4. 원본·파생 모두 다운로드한 바이트 수와 전체 SHA-256을 검증한다. 공개 파생은
   인증 없는 URL에서도 같은 바이트를 읽을 수 있어야 한다. 기존 경로의 다른 바이트는
   덮어쓰지 않는다. 전송 중 본문·이미지·매핑·등록 기록이 바뀌면 최종 반영은 409다.
5. 전송 성공 후 기존 거래 백업으로 등록 상태·앱 매핑·공개 등록 매니페스트를 함께
   반영한다. 재료는 `reviewPending`만 해제하며 놀이를 게시하지 않는다.
   재료 소스 해시도 같은 거래에 보관한다. 원본 JPEG는 로컬에도 유지한다.

스튜디오는 클릭한 한 항목만 처리한다. JSON/CLI는 승인 결과를 같은 배치로 검증하며
`--write`에서 동일 파이프라인을 사용한다. 기본은 쓰기 없는 dry-run이다.

```sh
pnpm review:materials /path/to/material-results.json --batch data/review-batches/<batch>.json --write
# 재료 변경 후 최신 검수 화면에서 놀이를 재확인한 결과 사용
pnpm review:apply /path/to/play-results.json --batch data/review-batches/<batch>.json --write
```

## 실패·재개와 배포

- 키 누락·전송 실패·손상·익명 공개 읽기 실패에는 등록 상태와 공개 매니페스트를
  변경하지 않는다. 초안·원본·완료 객체를 보존한다. 설정/연결을 고치고 다시 승인하면
  기존 객체를 재검증하고 없는 객체만 생성한다. 부분 공개 객체가 남을 수 있으나
  등록 기록에는 포함되지 않으며 자동 삭제하지 않는다.
- 409는 외부 수정을 보존하고 최신 화면에서 재검수한다. revision만 교체해 우회하지
  않는다. 로컬 반영 중 중단은 기존 `pnpm review:local --recover <거래ID>`로 상태와
  매니페스트를 함께 복구한다.
- 공개 등록 기록은 `data/play-image-publications.json`과
  `data/material-image-publications.json`이다. 저장소의 빈 기록부터 시작하며 Git 추적 대상이다.
  재료 승인의 `src/constants/materialImageSourceHashes.json`과 마스터·매핑·배치 변경도
  함께 보존한다. JPEG는 Git에서 제외되는 로컬 검수 입력이다.
- 공개 빌드는 기존 `PLAY_IMAGE_PUBLIC_*` / `MATERIAL_IMAGE_PUBLIC_*` 설정의 이관
  매니페스트에 새 등록 기록을 합친다. 배포 환경변수 변경 없이 다음 빌드에 포함된다.
  같은 ID/slug는 새 승인 버전이 우선한다. 본문·매핑 해시와 공개 자산을 다시 검증하고
  비공개·삭제 항목은 기존 노출 규칙으로 제외한다.
- 로컬 등록과 공개 배포는 별개다. 커밋·푸시·배포는 사용자 요청 범위에서 한다.
  기존 이관/수동 복원 도구는 유지한다. 새 원본 경로는 위 규칙과 등록 기록의
  `sourceHash`로 결정되며 관리자 자동 복원 통합은 후속이다.

검증: `pnpm test:image-registration`, `pnpm test:local-review`, `pnpm test:web`.
메모리 fixture 성공과 실제 Supabase 권한 검증 완료는 구분한다.
