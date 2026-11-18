# Proposal

## Why

사용자가 메인 놀이 도장의 위치·각도가 움직인다고 보고했다. 좁은 화면의 `.featured-card:hover > img`가 새 도장까지 선택해 transform을 none으로 덮어썼다. 기본 표시만 확인한 이전 검증에 포인터 진입·이탈이 빠져 있었다.

## What Changes

- REC-004: 대표 이미지용 CSS3곳에서 `.completion-stamp`를 제외해 도장의 translate/rotate를 유지한다.
- WEB-002: 반응형 화면에서도 포인터 진입·이탈 시 도장 위치를 유지한다. 이미지·저장·추천·캐시 정책은 유지한다.
- LOG-001/003, LOC-001/002, PRI-001/002/003/004, WEB-001/003, TOSS-002/007은 변경하지 않는다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `recommendations`: 완료 도장의 포인터 반응 고정.

## Impact

원본 `/Users/msyu/study/play-recipe` preview의 앞선 미커밋 작업을 보존한다. CSS만 수정하며 별도 작업 폴더·커밋·푸시·배포는 없다. 실제 로컬 브라우저에서 좁은 화면과 넓은 화면의 hover 전후를 비교한다.
