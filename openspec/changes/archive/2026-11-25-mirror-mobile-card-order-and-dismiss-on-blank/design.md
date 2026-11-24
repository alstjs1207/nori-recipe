# 앞 카드와 빈 영역 접기

모바일 펼침 기준 index를 열 방향으로 정한다. 왼쪽 열은index0(1번), 오른쪽 열은index2(3번)이며 step은 기준으로부터의 거리다. 표지도 동일 step/방향으로 쌓고 펼침 x/회전/레이어를 step으로 정해 같은 카드가 제자리를 유지한다. DOM 데이터 순서와 실제 상세 링크는 바꾸지 않고 넓은 화면은 기존2번 중심 식을 유지한다.

열린 동안 document capture click을 듣되 max-width599px에서만 빈 영역을 처리한다. 실제 a/button/form control/summary/role button·link/contenteditable 조상은 제외한다. pointerdown이나 touchmove가 아닌 click만 들어오므로 스크롤은 접기가 아니다. document Escape도 접으며 cleanup으로 listener를 제거한다. 명시적인 접기 버튼은 없애고 짧은 빈 곳 클릭 안내를 둔다. 기존 표지 포커스 복귀를 유지한다.
