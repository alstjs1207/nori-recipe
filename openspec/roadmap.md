# 예정·보류 작업

원본의 로컬 `docs/plan.md`와 `docs/animation-plan.md`를 현재 소스에 대조해 옮긴 계획이다. 원래 docs는 Git 무시 자료이므로 이 문서와 change가 추후 clone에서도 읽을 수 있는 기준이다. 기록은 신규 기능 구현·결제·서버 생성·배포 승인이 아니다. 가격·일정·접근 정책은 확정하지 않는다.

| 우선순위/상태 | 작업 | 현재 준비 / 미구현 | 다음 문서 |
| --- | --- | --- | --- |
| 작업중 / 실기기 확인 대기 | PWA 화면·상세 복귀·생년월 입력 | 2026-11-09 웹/PWA 구현·로컬 검증 완료. 실제 iPhone 설치 확인 전까지 작업중 유지 | [태스크](changes/fix-pwa-navigation-birth-month/tasks.md) · [제안](changes/fix-pwa-navigation-birth-month/proposal.md) |
| 우선 확인 / 결정 필요 | 홈 세트 수·수명·완료 후 전환 | 엔진·고정 저장은 구현. 후보 부족 정책과 UI 회귀·다음 세트 시점은 미확인 | `changes/clarify-home-set-lifecycle/` |
| 후속 / 제안·미착수 | 계정·소셜 로그인·Supabase 동기화 | v3 메타데이터만 있음. 서버 client/auth/store·migration·업로드 구현 없음. upload.ts는 예외를 던지는 placeholder | `changes/plan-account-sync/` |
| 후속 / 정책 충돌·미착수 | 발달 리포트·구독 | 로컬 영역 통계는 있음. report/subscribe 라우트·subscriptionStore·결제 SDK 없음. 구 계획의 '로그인만 필요'와 '구독 전용'이 충돌 | `changes/plan-reports-subscriptions/` |
| 후속 / 제안·미착수 | 네이티브 EAS/OTA | expo-updates 의존성은 있음. eas.json·runtimeVersion/update URL·checkUpdate 유틸 없음. 웹 SW 업데이트와 별개 | `changes/plan-native-ota/` |
| 보류 / 필요 시 재검토 | 공유 요소 전환·제스처 시트·추가 모션 | animations/motion·MotionPressable은 있음. 과거 animation-plan의 Next phase는 완료로 승격하지 않음 | 새 구현 요청 시 플랫폼·동작 줄이기·상호작용 기준을 확정 |
| 지속 운영 / 수집 요청별 | 월령·영역 공백 콘텐츠·원문·이미지 검수 | 파이프라인과 게시 검증은 구현. 추가 수집/게시 승인은 요청별 현재 해시 기준 | content-review 명세·수집 스킬 |
| 검증 공백 / 변경 때 보강 | 저장 마이그레이션·UI 통합·외부 운영 설정 | 일부 source-reviewed 또는 실환경 확인 필요 | known-gaps.md |

과거 계획의 5,900원/월·주차·전환율·리텐션 목표는 당시 제안값이다. 확정 정책이나 측정된 성과로 표시하지 않는다. 별도 관리자 사이트 계획은 이미 로컬 스튜디오·HTML 검수로 대체되어 신규 예정 작업에서 제외한다.
