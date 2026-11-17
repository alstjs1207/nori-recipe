# 설계

기존 sync 승인 평가기는 IO 없는 계획과 로컬 staging 검증에 재사용한다. `stage-application.mjs`는 해당 배치 입력만 임시 폴더에 복사하고 사용자가 승인한 범위를 평가한다. `image-publication.mjs`는 실제 승인된 staged 상태만 읽고 기존 Storage 어댑터의 get/create를 사용한다. 새 객체는 upsert하지 않으며 다운로드·익명 파생 읽기를 검증한다. 실패 시 어떤 로컬 상태도 활성화하지 않는다. 임시 staging은 finally에서 제거한다.

성공 시 `commitTransaction`이 원래 fingerprint를 재검사하고 상태·매핑·공개 등록 기록·재료 소스 해시와 영수증을 함께 반영한다. 프로세스 중단은 기존 prepared 거래 복구를 사용한다. 원격과 로컬은 분산 거래가 아니므로 실패 때 미참조 불변 객체가 남을 수 있다. 임의 삭제하지 않고 재시도가 객체 바이트를 다시 검증한다.

기존 이관 evidence는 당시의 고정 기록이다. 새 등록 기록은 `data/{play,material}-image-publications.json`에 public-only 메타데이터로 보관한다. 공개 빌드가 기존 입력에 병합하므로 Vercel 환경변수를 바꾸지 않고 새 버전을 소비한다. 신규 재료 원본/매핑 해시는 기존 source-hash JSON에 반영해 원본 없는 빌드의 검증을 유지한다.

로컬 `.env`는 신뢰하는 Studio/승인 CLI에서만 로드한다. 키가 없으면 읽기·저장·dry-run은 작동하고 실제 승인만 명확한 오류로 거절한다. 공개 빌드에는 관리자 키를 주입하지 않는다. 새 등록 원본 자동 복원과 미참조 원격 객체 정리는 별도 후속이다.
