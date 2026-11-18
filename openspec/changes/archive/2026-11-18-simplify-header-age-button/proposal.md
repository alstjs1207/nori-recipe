# Proposal

## Why

사용자가 검토안대로 우측 상단 월령 버튼의 사람 아이콘·흰색 원을 제거하고 월령·화살표만 표시하되 클릭과 터치 영역은 유지하도록 요청했다.

## What Changes

- WEB-006: 웹/PWA 상단 월령 버튼의 아바타/이름 첫 글자 표시를 제거하고 기존 연보라색 배경·월령 문구·화살표를 유지한다.
- 기존31px 아바타·8px 간격·17px 좌우 padding 합계56px을 좌우28px으로 대체해 문구별 너비를 유지한다. 높이는 기존41px을 유지한다.
- WEB-005의 프로필 진입 상단·키보드/클릭·접근성 이름은 그대로 유지한다. LOC-001/002, ONB-001/002, PRI-001/002/003/004, REC-004, LOG-001, TOSS-002의 저장·이름·월령·추천·기록·동의 정책을 유지한다. 토스의 별도 헤더는 바꾸지 않는다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-platform`: 아이콘 없는 월령 버튼.

## Impact

원본 `/Users/msyu/study/play-recipe` preview의 기존 미커밋 변경을 보존하고 WebShell/CSS만 수정한다. 새 이미지·패키지·저장 변경·작업용 폴더·커밋·푸시·배포는 없다.
