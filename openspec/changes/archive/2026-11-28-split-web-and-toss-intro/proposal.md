# Proposal

## Why

사용자는 웹 중심의 기존 intro와 토스 광고 수익화를 위한 홍보 페이지를 분리하고 채널별로 선택해 홍보하기로 했다. 앞서 두 이용 경로를 함께 소개한 구성을 이번 요청으로 대체한다.

## What Changes

- WEB-004의 `/intro`를 기존 웹 중심 실행·FAQ로 복원한다.
- `/toss-intro`의 헤더·상단·하단·이용 안내·데모를 공식 토스 공유 링크로 연결한다. 웹 소개는 하단 보조 링크로 제공한다.
- 페이지별 제목·설명·canonical·OG URL과 Vercel rewrite를 분리한다.
- 같은 공개 데이터·해시 WebP 캡처·정적 렌더러를 재사용한다. 웹 캡처를 토스 실기기 캡처로 오표시하지 않는다.
- WEB-001/002/003, PRI-001, TOSS-001/002/005/006 경계를 유지한다. 신규 분석·광고 SDK·기록 동기화를 소개 페이지에 추가하지 않는다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `web-platform`: WEB-004의 웹·토스 소개 페이지와 실행 경로 분리.

## Impact

원본 `/Users/msyu/study/play-recipe`의 기존 preview checkout에서 작업하며 새 작업 폴더는 만들지 않는다. 기존 로컬 소개 변경을 이어서 수정한다. 정적 생성기·Vercel 설정·회귀·명세·안내에 한정하며 커밋·푸시·배포는 요청 범위가 아니다.
