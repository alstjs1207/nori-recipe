# 토스 기존 크기 브랜드 헤더 복원

## Why

2026-11-18 사용자가 토스 상단의 허전한 공간을 확인하고, 첨부한 기존 꽃 로고·노리레시피를 축소하지 않은 크기로 다시 넣고 여백을 정리해 파일까지 만들도록 요청했다.

## What Changes

- TOSS-003의 브랜드 헤더를 기존 BrandMark·web-brand 스타일로 복원한다. 모바일 꽃32px·글자24px로 기존 크기를 유지한다.
- 상단 안전 영역을 shell에서 한 번만 적용하고 헤더 패딩13px, 본문 상단20px로 정리한다.
- 월령 단축 버튼·가족 요약·긴 소개·AI 라벨은 복원하지 않는다. TOSS-005 이용 안내 고지, CAT-003 NEW90일을 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `toss-miniapp`: TOSS-003 브랜드 헤더와 상단 여백.

## Impact

`WebShell.web.tsx`, 토스 전용 CSS와 명세·policy-map·출시 안내. TOSS-001/002/004~006, CAT-003, WEB-001~003, PRI-001~004, REC-001~003의 기존 웹·저장·분석·추천·안전 정책을 유지한다. GOV-001~003에 따라 실제 검증을 기록한다. 원본 `/Users/msyu/study/play-recipe`에서 main/preview 동일0453f12를 확인하고 기존 preview로 전환했다. 별도 worktree·clone을 만들지 않는다. 이번 요청은 로컬 구현과 `.ait` 파일 생성이며 커밋·푸시·토스 콘솔 등록·심사·공개 출시는 포함하지 않는다.
