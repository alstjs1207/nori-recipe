# 최근 완성 묶음의 Fan cards

## Why

2026-11-24 사용자가 Fan cards 예제를 검토한 뒤 구현을 요청했다. 완성한3개를 추억 카드 한 묶음으로 보여주면서 날짜·제목·상세 이동의 가독성을 유지한다.

## What Changes

- LOG-004: 웹/PWA/토스 기록 기본 보기의 최근3묶음에 사진만 움직이는 React Fan cards를 적용한다. 화면 진입 후 묶음별 한 번 펼치고 월별 전체 보기는 기존3열이다.
- LOG-004: 원본 fan.js의 펼침220/18·띄움420/20·확대420/22와 질량1,4회 적분·dt상한을 보존한다. 마우스/포커스 강조·터치 즉시 상세·동작 줄이기 정적 표시를 적용한다. 반복 자동재생·화면 밖/안정 후 무한 rAF는 추가하지 않는다.
- LOG-001/003·LOC-001/002·REC-004: 날짜별 묶음·저장/회차/누적 기록·홈 완료와 추천 정책을 유지한다. WEB-002: 기존 웹/PWA와 동작 줄이기 정책을 보존한다. TOSS-003/006: 기존 토스 화면 영역·정적 번들·eval 검사를 유지한다.
- 공통 페이지 스타일·테마/전역 저장 키·외부 스크립트/글꼴을 복사하지 않고 기존 흰색·연보라·한글 폰트와15px/9px 모서리를 사용한다. 네이티브 기록 화면은 기존 배열을 유지한다.

## Capabilities

### Modified Capabilities

- `play-records`: LOG-004 최근 묶음의 모션·조작·접근성.

## Impact

원본 /Users/msyu/study/play-recipe의 preview에서 기존 eval 반려 수정 로컬 변경을 보존하며 구현한다. 새 의존성은 추가하지 않는다. 기록 웹 화면·Fan 컴포넌트·국소 스프링 계산·CSS와 회귀/명세를 변경한다. 사용자 기록으로 검증 데이터를 만들지 않고 별도 테스트 origin에서 실제 화면을 검증한다. 커밋·푸시·배포·토스 콘솔 업로드는 포함하지 않는다.

참조: https://designbookmark.com/motion-src/fan-cards/index.html · fan.css · fan.js, https://designbookmark.com/motion-src/shared/tokens.css · base.css · motion.js를 먼저 읽고 검토했다. 실제 fan.js는 공통 프리셋 대신 위 개별 수치를 사용한다.
