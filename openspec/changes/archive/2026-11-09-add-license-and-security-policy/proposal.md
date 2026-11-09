# Apache 2.0과 보안 정책 추가

## Why

사용자가 play-recipe에 Apache 라이선스와 security 문서 추가를 요청했다. 코드 라이선스와 비공개 취약점 제보 안내가 없으며 기존 시각 에셋은 전용 라이선스다.

## What Changes

- 공식 Apache 2.0 원문 LICENSE, 범위·저작권 NOTICE, package license와 README 링크를 추가한다.
- 기존 에셋 라이선스를 보존하고 수집 콘텐츠·데이터셋·제3자 자료의 별도 권리를 명시한다.
- 기존 문의 이메일을 사용하는 SECURITY.md에 지원 범위·제보 정보·공개 조율을 안내한다.
- GOV-001·GOV-002·GOV-003의 관리 절차에 따라 GOV-004와 근거·인덱스를 갱신한다. WEB-003의 서비스 에셋·배포 경계는 유지한다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `spec-governance`: GOV-004 라이선스 범위와 비공개 보안 제보 정책.

## Impact

라이선스·정책 문서, 패키지 메타데이터와 명세 분류 도구가 변경된다. 서비스 동작·에셋 파일·사용자 데이터는 바꾸지 않는다. 커밋·푸시·원격 보안 기능 설정은 이번 요청에서 수행하지 않는다.
