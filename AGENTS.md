# nori-recipe

프로젝트 구조와 코드·콘텐츠 규칙은 `CLAUDE.md`, 실행·검증 방법은 `README.md`를 따른다.

## 배포 흐름

- 개발 변경사항은 `preview` 브랜치에서 작업하고 푸시한다.
- `preview` 푸시는 Vercel의 Preview 환경에 배포하며, Vercel이 부여한 `*.vercel.app` 주소에서 확인한다.
- 미리보기에서 확인한 변경사항을 `preview`에서 `main`으로 병합하면 Production 환경에 배포되어 `https://nori.lestly.io`에 반영된다.
- Vercel의 Production Branch는 `main`이며, `nori.lestly.io`는 Production에 연결한다.
- `PUBLIC_ORIGIN=https://nori.lestly.io`는 Production 환경에만 설정한다. Preview에서는 이 변수를 비워 `VERCEL_URL`로 해당 미리보기의 공유 주소를 생성한다.
- 커밋·푸시·병합 전 기존 변경사항과 현재 브랜치를 확인하고, 위 흐름에 맞는 대상 브랜치를 사용한다.
