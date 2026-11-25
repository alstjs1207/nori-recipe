# Design

구현 전에 제공된 index.html, like.css, like.js와 shared/tokens.css, base.css, motion.js를 읽었다. 원본의 unit mass·semi-implicit Euler·4회 substep·1/30초 cap·아이콘520/13·채움300/26·초기 x=.6/v=9 및 취소 x=.85/v=3·550ms cubic-out 점 공식을 유지한다. 자동 데모와 숫자 카운터는 제외한다.

기존 BookmarkButton이 요청 표시를 남기고 saved prop의 실제 변경에서만 재생한다. 초기 조회는 즉시 상태만 동기화하고 저장 실패는 기존 오류 안내를 유지한다. 같은 공통 버튼을 쓰는 홈/탐색/상세/저장 목록에 적용한다. 취소로 항목이 사라지면 즉시 unmount 정리한다.

아이콘은 기존 SVG path를 유지하며 fill만 기존 violet로 보간한다. 8개 점은 body portal에 pointer-events:none/aria-hidden으로 표시해 카드의 overflow와 모서리를 바꾸지 않는다. 위치는 움직이는 아이콘의 실제 중심을 매 프레임 따른다. 안정 시 rAF를 멈추며 모션 축소·문서 숨김·unmount에서 정리한다.

엔진 회귀와 실제 웹 브라우저 확인을 구분한다. 토스는 공통 DOM을 사용하지만 실제 토스앱/네이티브 실기기 검증을 추정하지 않는다.
