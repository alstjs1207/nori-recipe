# 재료 이미지 Storage 이관

## Why

놀이 이미지는 이미 Supabase를 사용하지만 재료 이미지는 Git JPEG와 Vercel 파생 파일에 의존한다. 사용자의 실제 이관·Preview 배포 요청에 따라 기존 승인 바이트와 로컬 원본을 유지하면서 동일한 비공개 원본/공개 파생 경계를 재료에도 적용한다.

## What Changes

- 재료 전용 관리 계획·중단/재개·배타적 업로드·다운로드 검증·복원을 추가한다. 기존 놀이 ID 허용 범위를 넓히지 않는다.
- JPEG67개를 비공개 보존하고, 승인된 실제 재료 매핑66개만 192px WebP로 공개한다. 검수 대기5개는 브랜드 기본 표시, 미사용 JPEG1개는 비공개만 유지한다.
- 원본 없는 공개 빌드에 필수 매니페스트/내용 해시/바이트 검증과 실패 중단을 추가하고 웹·소개·PWA가 같은 불변 URL을 사용한다.
- 검증된 JPEG만 로컬에 유지/Git 제외하고 preview 커밋·푸시·Vercel Ready·실제 화면을 확인한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `content-review`: CON-006 재료 이관과 기존 CON-001~005 승인·놀이 계약 보존.
- `web-platform`: WEB-002·WEB-003에 재료 CORS 캐시·공개 빌드·기본 표시를 연결한다.

## Impact

재료 매핑·이미지 URL·웹 빌드/소개·서비스 워커·로컬 검증/CI·Storage 재료 전용 버킷에 한정한다. PRI-001~004·로컬 사용자 데이터·JSON·기존 검수 해시·놀이 공개416개/비공개224개·네이티브 소스·main/Production은 유지한다. DB/Auth 변경·관리 UI 복원·실제 전체 놀이 롤백·서비스 고지 보강은 포함하지 않는다. 원본 프로젝트의 checkout을 사용하며 별도 worktree/clone은 만들지 않는다.

GOV-001·GOV-002·GOV-003의 변경 근거/소스 분류·회귀/공개 검증 계약을 유지한다. catalog의 CAT-001·CAT-002·CAT-004는 이미지 위치만 변경하며 게시 목록·직접 상세 동작을 보존한다.
