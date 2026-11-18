# Proposal

## Why

사용자가 완료 표시를 참 잘했어요 도장처럼 만들고 내부에 서비스 로고를 넣도록 요청했다. 기존 직사각형 CSS 도장을 실제 투명 SVG 이미지로 교체한다.

## What Changes

- REC-004: 기존 꽃 로고의 ellipse5개를 그대로 재사용한 브랜드 보라색 원형 도장 이미지. 위쪽 `참 잘했어요`, 아래쪽 `놀이 완료`, 잉크 질감을 사용한다.
- 추천 큰 카드와 나머지 추천 카드만 SVG 도장으로 교체한다. 일반 탐색·기록 카드의 완료 배지는 유지한다.
- WEB-002: 새 도장을 기본 셸 캐시에 포함해 첫 오프라인 완료 화면에서도 이미지를 표시한다.
- LOG-001/003, LOC-001/002, PRI-001/002/003/004, WEB-001/002/003, TOSS-002/007의 저장·추천 순위·완료 판정·분석·공유·광고 정책은 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `recommendations`: 브랜드 로고가 들어간 완료 도장.

## Impact

원본 `/Users/msyu/study/play-recipe` preview checkout에서 앞선 미커밋 개선을 보존하고 추가한다. `public/completion-stamp-v1.svg`와 공통 표시 컴포넌트를 추가하며 DB/스토리지 변경은 없다. 기존 SVG 로고 시스템을 정확히 재사용하므로 생성 모델로 로고를 다시 그리지 않는다. 폰트 대체 시에도 한글을 지원하는 시스템 글꼴을 사용한다. 새 worktree·커밋·푸시·배포는 요청 범위가 아니다.
