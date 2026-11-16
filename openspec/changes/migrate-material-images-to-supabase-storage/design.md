# Design

## Context

매핑71개: JPEG66개와 검수 대기 브랜드5개. JPEG 파일67개 중1개는 미매핑이다. 기존 놀이 전송 어댑터의 객체 경로는 play ID 전용이며 변경하지 않는다. Node24/pnpm10.33.0, 기존 웹 원자적 출력 교체·매니페스트 주입·Storage CORS 정책을 유지한다.

## Goals / Non-Goals

공개 대상은 현재 기준 커밋의 승인 재료와 동일한 정의/매핑/이미지다. 앱 JSON·승인 상태·AsyncStorage/SQLite·찜/기록·PRI-001~004는 바꾸지 않는다. 네이티브 번들·DB/Auth·main 배포와 다른 후속은 제외한다.

## Decisions

- 별도 material-originals(비공개 JPEG)/material-assets(공개 WebP),16MiB·MIME 제한·쓰기 정책 없음. 기존 놀이 버킷에 섞는 대신 재료 전용 경로 검증을 둔다.
- 원본은 originals/<전체 SHA>/original.jpeg, 공개는 materials/<승인 slug>/<전체 불변 버전>/icon.webp. 원본67개 파일 매핑은 관리자 계획에만 남긴다. 공개66개는 정의 해시·원본 해시·192px inside q65 변환 해시를 포함한다.
- 기존 Git 기준의 이미지 바이트를 신뢰 근거로 사용한다. 원본 Git 제외 이후의 재실행도 이 기준 커밋을 유지한다. 공개 빌드는 관리자 계획·Git·원본 없이 고정 공개 snapshot과 현재 정의/매핑/해시를 대조한다.
- dry-run은 쓰기/전송 없음. 관리 상태는 generated/material-image-storage 내 잠금·체크포인트. 실제 객체를 매번 GET·검증하고 생성만 허용한다. 실패·취소는 객체를 남겨 재개하며 원격 삭제는 없다. 폐기/변경된 후보와 부분 객체는 정리 후보만 기록한다.
- 공개 웹 snapshot은 export 동안만 주입하고 finally 복구한다. 소개와 웹은 동일 URL. PWA는 놀이와 재료를 별도 허용 경로로 검사하고 합계80개·선택 업데이트·기본 셸을 유지한다.

## Risks / Trade-offs

- Git 없는 빌드는 새 이미지 승인을 판단할 수 없음 → 검증 완료한 공개 매니페스트만 입력하며 원본/정의/매핑 고정 해시를 대조한다.
- 전송 도중 승인 변경/부분 응답 → IO 전후 원본·정의 재검증, stale 후보 제거와 정리 후보 기록, 배타적 생성·실제 GET 재검증.
- 서비스 장애 → 빌드 실패·기존 dist 보존, 런타임 기본 표시. 전체 이미지 선저장 없음.

## Migration Plan

기준 해시 보존 → fixture → 버킷 최소 구성 → 실제 업로드/다운로드·권한·복원 → 원본 없는 소스 빌드 → Git 추적 제외(로컬 유지) → 전체 공개 verify → preview push → Ready/실제 웹·CORS/PWA 확인. 직전 놀이 매니페스트·원본·불변 객체를 유지한다. 재료 설정을 제거한 이전 커밋/배포가 복구 경로이며 실제 롤백·운영 배포는 실행하지 않는다.
