# Design

- AppLink/appRouter가 앞으로 여는 경로를 표시하고 공통 useScreenEntry가 공개 Navigation 상태의 focus/history를 읽어 새 진입과 복귀를 분류한다. 브라우저 history traversal은 popstate capture로 복귀를 표시한다. 웹/네이티브 Tabs는 `fullHistory`로 반복 방문을 삭제하지 않는다. `history`는 이전 같은 탭을 제거해 길이가 그대로면 링크 계층이 push 대신 replace를 수행하여 브라우저 뒤로가기가 직전 목록을 건너뛰는 문제가 있었다. 네이티브 tabPress는 명시적 새 진입, hardware back의 줄어든 history는 복귀로 판단한다. setParams만으로 입력/필터/페이지를 초기화하지 않는다.
- WebPage는 포커스한 화면만 DOM에 유지하며 새 진입은0, 복귀는 저장 위치를 적용한다. 비동기 데이터/이미지 높이에 대한 복원은 짧게 재시도하되 사용자 조작이 시작되면 중단한다. 개인정보 문단은 부모 focus effect 대신 화면 DOM을 준비한 뒤 연다.
- 네이티브 outer ScrollView는 공통 ref/onScroll/onContentSizeChange로 같은 정책을 적용한다. 내부 가로 준비물·휠 스크롤은 별개로 보존한다. 온보딩 Stack의 새 화면은 기존처럼 새로운 인스턴스이며 되돌아간 입력을 지우지 않는다.
- 초안은 Zustand의 앱 세션 메모리에 guestId/놀이 ID별로 보관한다. 현재 임시 입력의 수명을 화면 마운트/놀이 ID 변경에서 분리한다. 앱 종료/전체 새로고침을 넘는 영구 저장 기능은 추가하지 않는다. 완료 저장이 실패하면 초안은 그대로, 성공 시에도 저장 도중 바뀐 입력은 남긴다. 명시적 전체 데이터 초기화는 해당 guest의 초안도 지운다.
- 검색의 새 목적 바로가기는 reset 플래그와 함께 해당 상황/영역을 적용하고 관련 없는 과거 입력만 초기화한다. 일반 탐색 탭에서는 현재 필터를 유지하며 스크롤만 새 진입 정책을 따른다.
