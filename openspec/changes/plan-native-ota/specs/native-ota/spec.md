## ADDED Requirements

### Requirement: OTA-001 네이티브 업데이트 채널 계획

네이티브 OTA는 SHALL runtime 호환·preview/production 채널·기존 번들 보존을 확정한 뒤 도입하며 사용자 플레이를 강제 재시작으로 끊지 않는다. 의존성 설치만으로 OTA 준비 완료를 표시하지 않는다.

#### Scenario: 후속 구현의 경계

- **WHEN** 오프라인이거나 업데이트가 실패한다
- **THEN** 기존 번들로 계속 사용하며 호환되지 않는 업데이트를 적용하지 않는다.
