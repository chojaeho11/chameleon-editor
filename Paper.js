function addProportionalStandBase(originalOutlinePath) {
    // 1. 현재 캐릭터 외곽선의 경계(Bounds) 정보 가져오기
    var bounds = originalOutlinePath.bounds;
    
    // 캐릭터의 가로, 세로 크기
    var charWidth = bounds.width;
    var charHeight = bounds.height;

    // -------------------------------------------------------
    // [요청하신 비율 계산]
    // 너비: 캐릭터 가로 크기의 2/3 (약 66.6%)
    // 높이: 캐릭터 세로 크기의 1/5 (20%)
    // -------------------------------------------------------
    var baseWidth = charWidth * (2 / 3);
    var baseHeight = charHeight * (1 / 5);

    // -------------------------------------------------------
    // [위치 계산]
    // X축: 캐릭터의 정중앙(center.x)에서 받침대 절반만큼 왼쪽으로 이동
    // Y축: 캐릭터의 맨 아래(bottom)에서 살짝 위로 올려서 겹치게 함
    // -------------------------------------------------------
    var startX = bounds.bottomCenter.x - (baseWidth / 2);
    
    // [중요] 겹침(Overlap) 처리
    // 두 도형이 합쳐지려면 최소한의 겹치는 영역이 있어야 합니다.
    // 여기서는 3px 정도 위로 올려서 확실하게 붙게 만듭니다.
    var overlap = 3; 
    var startY = bounds.bottomCenter.y - overlap;

    // 2. 받침대 사각형 생성 (메모리 상에서만 생성, insert: false)
    // 모서리를 둥글게 하려면 radius 옵션 추가 (예: radius: 5)
    var standRect = new Path.Rectangle({
        point: [startX, startY],
        size: [baseWidth, baseHeight],
        insert: false, 
    });

    // 3. [핵심] 외곽선과 받침대 합치기 (Boolean Union)
    // unite를 해야 두 도형 사이의 경계선이 사라지고 '하나의 덩어리'가 됩니다.
    var mergedPath = originalOutlinePath.unite(standRect);

    // 4. (선택사항) 기존 패스는 제거하고 합쳐진 패스만 남길 경우
    // originalOutlinePath.remove(); 
    
    // 합쳐진 결과 반환
    return mergedPath;
}