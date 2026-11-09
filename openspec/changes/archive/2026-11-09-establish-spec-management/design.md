# 관리 체계 설계

## Context

Lestly의 stable ID·policy-map·source-index·context/changed/check·verify:local 패턴을 참고한다. 이 프로젝트는 npm/서버 SQL 중심 Lestly와 달리 pnpm·Expo·로컬 저장·콘텐츠 검수를 사용한다.

## Goals / Non-Goals

현재 동작을 찾기 쉽고 검증 가능하게 만들며 과거 계획을 미래 기능과 구분한다. 앱 동작 변경·콘텐츠 재승인·외부 운영 설정·커밋·배포는 포함하지 않는다.

## Decisions

- 현재 명세는 10개 영역, 33개 ID로 나눈다. 소스 anchor·테스트 파일 존재를 검사하되 의미적 정확성은 리뷰한다.
- 완료된 옛 기능은 실제 커밋 표에 연결한다. 가짜 과거 tasks나 실행 결과를 만들지 않는다.
- 예정 작업은 4개 active change, 모션/지속 수집은 roadmap, 구현 차이는 known-gaps에 둔다.
- 관리 소스 전체를 명시 분류한다. 새 기능 디렉터리를 catch-all로 자동 승인하지 않는다.
- 바이너리와 무시된 결과·개인 설정·빌드 캐시는 인덱스에서 제외하고 기존 콘텐츠·이미지 검증을 이용한다.
- CLI·스킬은 프로젝트에 고정한다. 검사기는 Node 표준 라이브러리만 사용한다.

## Risks / Trade-offs

연결된 테스트가 모든 시나리오를 증명하지 않는다. DB/store·UI는 source-reviewed로 표시하고 호스트/실기기/외부 환경 검증 한계를 audit에 기록한다. 안전 기준을 완화해 추천 수를 맞추거나 미확정 가격·권한을 확정하지 않는다.

## Migration Plan

기존 AGENTS/CLAUDE/운영 문서에서 OpenSpec 진입점을 연결한다. 기존 수집·승인·배포 규칙과 사용자 작업 파일은 보존한다. 최초 명세와 delta 일치를 검사한 뒤 도입 change만 archive한다.

## Open Questions

known-gaps의 홈 세트 계약, 저장 통합 검증과 외부 운영 확인은 이번 명세 도입과 분리해 유지한다.
