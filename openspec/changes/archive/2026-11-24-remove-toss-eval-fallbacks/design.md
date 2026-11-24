# Design

토스 .ait는 output=single인 Expo 웹 export다. 반려 대상의 eval2개는 서버/개발 경로가 의존 그래프에 포함되어 생겼다. 토스 웹의 배포 빌드에서만 Babel 플러그인을 적용한다. Expo uuidv4의 마지막 crypto.randomUUID 반환과 v5/namespace는 그대로 두고 앞의 Node fallback만 제거한다. fetchThenEval.web의 첫 SSR/개발 fallback을 제거해 fetchThenEvalJs가 의존 그래프에 들어오지 않게 한다. 브라우저 script loader의 기존 구현은 유지한다. 토스 Devtools와 일반 웹/네이티브는 기존 Babel 경로를 쓴다.

대상을 파일 suffix·함수 이름·예상 분기 구조로 한정하고 구조가 다르면 실패한다. 생성된 번들을 문자열 치환하거나 eval 이름을 숨기지 않는다. 최종 산출물도 TypeScript JS parser로 검사해 실행 토큰/참조와 주석·문자열을 구분한다. eval의 직접/간접/속성/유니코드 형태, Function 직접/간접 생성과 inline script를 차단하고 구문 분석 실패도 허용하지 않는다. 기존 검사 시점(공식 SDK 포장 전)과 실패 시 출력 복원은 유지한다.

검수 통과 여부는 새 파일의 콘솔 재제출 후 별도 확인한다. 자동 검사 통과는 실제 토스앱/광고 및 심사 승인 증거가 아니다.
