# 검증 — 전체 완료 후 직전 놀이 제외

2026-11-24, 원본 `/Users/msyu/study/play-recipe`의 preview 로컬 작업. Node24.21.0 / pnpm10.33.0. 기존 미커밋 홈·기록 구현을 보존하고 그 위에 이번 정책만 추가했다. 커밋·푸시·배포는 실행하지 않았다.

## 구현과 재현

기존에는3/3에서 재료를 다시 저장하면 완료 ID 제외 집합을 비워 전체 후보를 재정렬했다. 재료 적합도가 높은 직전3개가 다시 선정될 수 있었다.

이제 실제3/3 확인 후 round.ids를 받아 직전3개를 뺀 후보에서 먼저 선택한다. 적격 대안이0/1/2/3개 이상이면 직전 놀이로 최대3/2/1/0칸만 보충한다. 각 풀 내부에는 기존 추천 엔진을 적용하며 조건부 상위 월령은 합쳐서 최대1개다.0/3·1/3·2/3 경로, 실제 저장의 원자성, 누적 기록과 완료 묶음은 유지한다.

## 실행 결과

- `node --import tsx --test src/engine/homeRoundRecommendation.test.ts tests/web-home-round.test.mjs`:20개 통과.
- `pnpm verify:local`: 전체347개 통과. spec-tools8, toss7, 단위176, play-review27, image-registration12, play-image-storage15, material-image-storage8, local-review26, web68. 콘텐츠·이미지·명세 검사, typecheck, build:web 통과.
- 추천 회귀: 대안0/1/2/3/4개, 직전 놀이의 재료 적합도가 더 높아도 대안 우선, 중복 없음, 비공개/월령/제외 재료/장소/시간 부적격 제외, 조건부 상위 월령 최대1개와 준비 미확인 탈락.
- 실제 웹 세션/저장 fixture: 대안0/1/2/3개에서 새 회차 생성, 동일 재료 저장, 반복 놀이도0/3, 누적3기록·완료 묶음 유지, 저장 실패 시 이전3/3과 회차 유지 및 재시도 제외 정책 검증.
- `pnpm spec:index`, `pnpm spec:changed HEAD`, `git diff --check` 통과. 완료 change archive와 완료 기록 정리 후 최종 spec:check·spec:changed HEAD·git diff --check도 통과했다.

최초 targeted CLI 실행은 샌드박스의 tsx IPC listen 제한으로 중단돼 `node --import tsx --test`로 실행했다. 최초 전체 명세 검사는 기존 완료 change의 전체 MODIFIED 블록에 새 시나리오가 없어 실패했다. 기존 delta의 REC-004를 현재 명세와 동기화한 뒤 전체 검증을 통과했다. 과거 실행 검증 기록은 수정하지 않았다.

## 확인 범위

이번 변경은 자동 회귀·실제 세션/웹 저장 fixture·웹 번들까지 확인했다. 사용자 브라우저의 기록을 수정하거나 실제 네이티브/토스 실기기 조작을 실행하지 않았다. 기존 안전 후보0~2개 GAP-001과 실기기 확인 경계는 유지한다. 개발 서버는 사용을 위해 유지하며 http://localhost:8081 최종 HTTP200을 확인했다.
