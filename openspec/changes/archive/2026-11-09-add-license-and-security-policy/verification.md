# 실행 검증

2026-11-09, 기준 커밋 0df9212. 소스 라이선스·보안 제보 문서와 관리 분류만 추가했다.

- Apache 공식 원문 `https://www.apache.org/licenses/LICENSE-2.0.txt`를 받아 LICENSE와 cmp 바이트 비교 성공.
- LICENSE SHA-256: cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30.
- README·SECURITY의 로컬 링크 존재, package license=Apache-2.0 확인.
- pnpm spec:index: 관리 파일 239개.
- pnpm spec:check: 현재/미아카이브 15개 + 기존 archive 1개 strict 성공. 34개 요구사항·65개 시나리오 근거 확인.
- pnpm test:spec-tools: 7/7 성공. LICENSE/NOTICE/SECURITY/ASSET-LICENSE의 분류와 변경 근거 누락 방지까지 확인.
- pnpm spec:changed HEAD 및 git diff --check 성공.
- 현재 명세의 GOV-004와 delta 전체가 동일하고 기존 GOV-001~003은 유지됨을 확인했다. --skip-specs로 중복 병합을 피한다.

확인 범위는 라이선스 원문·정책 문서·관리 도구다. 서비스 동작·데이터·이미지·외부 운영 설정은 변경하지 않아 전체 앱 회귀·웹 빌드를 반복하지 않았다. 커밋·푸시·원격 보안 기능 활성화는 수행하지 않는다.

참고: [Apache 공식 라이선스](https://www.apache.org/licenses/LICENSE-2.0.txt). GitHub의 비공개 제보 기능은 [저장소별 설정](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)이 필요하므로 문서 작성만으로 활성화됐다고 안내하지 않는다.

보관 후 재검사: `pnpm spec:check` 현재/미아카이브 14개와 archive 2개 모두 성공. 34 요구사항·65 시나리오·239 파일 근거 검사, `pnpm spec:changed HEAD`, `git diff --check`도 성공했다.

## 후속 요청: preview 커밋·푸시와 main 병합 준비

2026-11-09 사용자가 preview 커밋·푸시 및 main 병합·푸시를 추가로 요청했다. 위 미수행 기록은 최초 문서 추가 요청의 범위이며, 이번 후속 요청에서는 두 브랜치 반영을 수행한다.

최신 origin을 fetch해 main이 preview의 조상임을 확인했다. Node 24.22.2 / pnpm 10.33.0에서 `pnpm verify:local` 전체 실행 종료 코드 0: 명세/근거 검사, 테스트 205개(7+117+27+26+28) 성공·실패/skip 0, 콘텐츠 224개 오류/경고 0, 필수 이미지 223개 및 기존 fallback 1개, 타입 검사, 공개 상세 208개·precache 12개 웹 빌드 성공. 서비스 소스·데이터·이미지 원본에 Git 변경이 없음을 확인했다.
