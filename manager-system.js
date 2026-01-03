// manager-system.js
// 전담 매니저 및 평점 관리 시스템

// 1. 초기 매니저 데이터 (기본값)
const initialManagers = [
    { name: '은미', score: 4.8, count: 120 },
    { name: '성희', score: 4.6, count: 98 },
    { name: '지숙', score: 4.6, count: 85 },
    { name: '가현', score: 4.4, count: 62 },
    { name: '미선', score: 4.2, count: 45 }
];

// 현재 상태 변수
let managers = [...initialManagers]; // 데이터 복사
let currentTargetManager = null;     // 현재 평가하려는 매니저
let currentSelectedScore = 5;        // 현재 선택한 별점

// ===============================================
// [기능 1] 채널톡 기본 버튼 숨기기 & 커스텀 열기
// ===============================================

// 채널톡 로드 시 옵션 설정 (기존 설정을 덮어쓸 수 있도록 시도)
if (window.ChannelIO) {
    // 이미 로드된 경우 hide 호출
    window.ChannelIO('hideChannelButton');
} else {
    // 로드 전이라면 설정 객체에 옵션 추가 (index.html 수정이 어려운 경우 대비)
    window.ChannelIOInitialized = false; 
    // *가장 확실한 방법은 index.html의 ChannelIO('boot', ...) 안에 "hideChannelButtonOnBoot": true를 넣는 것입니다.
}

// 커스텀 상담 버튼 클릭 리스너
document.addEventListener('DOMContentLoaded', () => {
    const btnChat = document.getElementById('btnOpenConsultChat');
    if(btnChat) {
        btnChat.addEventListener('click', () => {
            if (window.ChannelIO) {
                window.ChannelIO('showMessenger');
            } else {
                alert("채널톡이 로딩되지 않았습니다. 잠시 후 다시 시도해주세요.");
            }
        });
    }
});


// ===============================================
// [기능 2] 매니저 리스트 렌더링
// ===============================================

function renderManagerList() {
    const grid = document.getElementById('managerGrid');
    if (!grid) return;

    grid.innerHTML = ''; // 초기화

    managers.forEach(mgr => {
        // 별 아이콘 생성
        let starsHtml = '';
        const full = Math.floor(mgr.score);
        const half = (mgr.score - full) >= 0.5;

        for (let i = 0; i < full; i++) starsHtml += '<i class="fa-solid fa-star"></i>';
        if (half) starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
        
        // 카드 요소 생성
        const div = document.createElement('div');
        div.className = 'manager-card';
        div.onclick = () => openRatingModal(mgr.name);

        div.innerHTML = `
            <div class="mgr-avatar">${mgr.name.substring(0,1)}</div>
            <div class="mgr-info">
                <h4>${mgr.name} 매니저</h4>
                <div class="mgr-stars">
                    ${starsHtml}
                    <span class="mgr-score-text">${mgr.score}</span>
                </div>
                <div class="mgr-review-count">상담 후기 ${mgr.count}건</div>
            </div>
        `;
        grid.appendChild(div);
    });
}


// ===============================================
// [기능 3] 별점 평가 시스템
// ===============================================

// 모달 열기
function openRatingModal(name) {
    currentTargetManager = name;
    currentSelectedScore = 5; // 리셋
    
    const title = document.getElementById('ratingModalTitle');
    const modal = document.getElementById('managerRatingModal');
    const comment = document.getElementById('ratingComment');
    
    if(title) title.innerText = `'${name}' 매니저님 칭찬하기`;
    if(comment) comment.value = '';
    if(modal) modal.style.display = 'flex';
    
    updateStarUI(5);
}

// 별점 UI 업데이트
function updateStarUI(score) {
    currentSelectedScore = score;
    const stars = document.querySelectorAll('#starContainer i');
    const scoreDisplay = document.getElementById('selectedScoreDisplay');
    
    if(scoreDisplay) scoreDisplay.innerText = score + ".0점";
    
    stars.forEach(star => {
        const s = parseInt(star.getAttribute('data-score'));
        if (s <= score) {
            star.classList.add('active');
            star.style.color = '#f59e0b';
        } else {
            star.classList.remove('active');
            star.style.color = '#e2e8f0';
        }
    });
}

// 평가 제출 처리 (핵심 로직)
function submitRating() {
    if (!currentTargetManager) return;

    // 대상 매니저 찾기
    const targetIndex = managers.findIndex(m => m.name === currentTargetManager);
    if (targetIndex === -1) return;
    
    const target = managers[targetIndex];

    // 가중 평균 계산: ((기존점수 * 횟수) + 새점수) / (횟수 + 1)
    // toFixed(1)은 문자열을 반환하므로 다시 parseFloat 해줍니다.
    const newTotalScore = (target.score * target.count) + currentSelectedScore;
    const newCount = target.count + 1;
    const newAverage = parseFloat((newTotalScore / newCount).toFixed(1));

    // 데이터 업데이트
    managers[targetIndex].score = newAverage;
    managers[targetIndex].count = newCount;

    // UI 반영
    alert(`소중한 평가 감사합니다!\n${target.name} 매니저님의 평점이 ${newAverage}점으로 업데이트 되었습니다.`);
    document.getElementById('managerRatingModal').style.display = 'none';
    
    renderManagerList(); // 리스트 새로고침
}

// ===============================================
// [기능 4] 이벤트 리스너 연결
// ===============================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 초기 렌더링
    renderManagerList();

    // 2. 별점 클릭 이벤트
    const stars = document.querySelectorAll('#starContainer i');
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const s = parseInt(this.getAttribute('data-score'));
            updateStarUI(s);
        });
    });

    // 3. 평가 완료 버튼
    const btnSubmit = document.getElementById('btnSubmitRating');
    if(btnSubmit) {
        btnSubmit.addEventListener('click', submitRating);
    }
});