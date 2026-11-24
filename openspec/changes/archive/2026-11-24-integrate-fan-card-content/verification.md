# 검증 — 이미지와 제목을 통합한 팬 카드

2026-11-24, 원본 `/Users/msyu/study/play-recipe`의 preview, c0f9ec3 기반 미커밋 변경이다. 기존 eval 반려 수정과 팬 모션 작업을 보존했다. 새 worktree·clone·의존성을 만들지 않았다.

## 결과

사용자가 첨부한 원본처럼 이미지·순번·실제 놀이 제목을 하나의 카드 표면과 링크 안에 넣었다. 카드 외곽 item 전체가 펼쳐지고 회전·확대·상승하며 이미지와 제목은 따로 transform하지 않는다. 넓은 외곽 패널을 없애 겹친 세 카드가 하나의 묶음으로 보이게 했다. 날짜는 상단에 유지한다.

기존 질량1·220/18·420/20·420/22 스프링과 적분, 최초 한 번 펼침·모션 감소·월별 정적 배열·저장·게스트·회차·날짜는 유지한다. 카드 자연 높이와 폭을 관찰해 반응형 영역을 맞춘다.

## 실행 증거

- Node24.21.0·pnpm10.33.0의 `pnpm verify:local` 전체359개 테스트(8+13+182+27+12+15+8+26+68), 타입·콘텐츠/이미지·명세·웹 빌드 통과. 실행 로그는 evidence/verify-local.log에 보존했다.
- Ego 전용 공간113과 임시127.0.0.1:4329에서 이전 합성 게스트12기록/4묶음을 사용했다. 사용자 localhost:8081의 데이터는 수정하지 않았다.
-320·393·1280px에서 이미지·순번·제목이 동일 링크의 카드 안에 있고 세 팬이 화면 안에 들어오며 가로 넘침이 없음을 실제 좌표와 스크린샷으로 확인했다. 동작 줄이기는 즉시 펼침1이다. evidence/card-layout.json과 cards-*.png.
- 키보드 포커스 시 카드 외곽만1.0600배·z5로 강조되고 이미지/제목의 자체 transform은 none이다. 모바일 제목에 실제 touchStart/end 한 번으로 play_107 상세에 도달했다. evidence/interaction.json.
- 최초 UI 검증의 CSS 선택자가3개에 일치해 정확한 첫 링크로 수정했다. CSSOM이1.0600을1.06으로 정규화하므로 문자열 대기 대신 실제 변환 행렬의 스케일1.060003으로 확인했다. 제품 코드 결함으로 처리하지 않았다.
- 공식 SDK3.10.0 테스트·운영 .ait 빌드와 `pnpm check:toss` 통과. 각 파일 내부 ZIP의 실제 JS에서 통합 카드 클래스와 eval0개·Function생성자0개를 확인했다. evidence/toss-artifacts.json.
- 새 산출물은 `generated/toss-fan-cards-integrated/2026-11-24/{test,production}/nori-recipe.ait`다. source-provenance.json의 소스와 웹 HTML/manifest/dist 해시는 두 토스 빌드 후 동일하다. 이전 산출물을 덮어쓰지 않았다.

전용 QA 브라우저와4329 서버를 종료하고 사용자8081 서버는 유지했다. 토스 콘솔 업로드·QR실기기·광고실행·운영 배포·커밋·푸시는 수행하지 않았다. 현재 spec/delta를 동기화하고 완료 archive 후 spec:check·spec:changed HEAD·git diff --check를 실행했다.
