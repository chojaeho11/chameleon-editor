/* canvas-template.js */

import { sb, currentUser } from "./config.js";
import { canvas } from "./canvas-core.js";
import { applySize } from "./canvas-size.js";

let selectedTpl = null;
let currentCategory = 'all';

/* canvas-template.js 의 SYNONYM_DB 부분을 이것으로 통째로 교체하세요 */

// =========================================================
// [0] 검색어 확장 데이터베이스 (종교 포함 총 110여종)
// =========================================================
const SYNONYM_DB = {
    // -----------------------------------------------------
    // [1] 인물 / 가족 (People)
    // -----------------------------------------------------
    '남자': ['남성', '맨', '아빠', '신사', 'man', 'men', 'male', 'boy', 'guy', 'father', '男性', '男', 'メンズ', 'パパ'],
    '여자': ['여성', '우먼', '엄마', '숙녀', 'woman', 'women', 'female', 'girl', 'lady', 'mother', '女性', '女', 'レディース', 'ママ'],
    '커플': ['부부', '연인', '사랑', '웨딩', '결혼', 'couple', 'love', 'wedding', 'marriage', 'romance', 'カップル', '恋人', '結婚', 'ウェディング'],
    '가족': ['패밀리', '식구', '단체', '부모님', 'family', 'parents', 'home', 'group', '家族', 'ファミリー', '家庭', '親子'],
    '아이': ['키즈', '어린이', '유치원', '초등', '아기', '돌잔치', 'kids', 'child', 'children', 'baby', 'kindergarten', '子供', 'キッズ', 'ベビー', '幼稚園'],
    '학생': ['학교', '수험생', '교복', '공부', '입시', '대학', 'student', 'school', 'study', 'exam', 'university', '学生', '学校', '勉強', '受験'],
    '노인': ['할머니', '할아버지', '실버', '경로', 'senior', 'grandma', 'grandpa', 'old', 'silver', '老人', 'おばあちゃん', 'おじいちゃん', 'シニア'],
    '직장인': ['회사원', '비즈니스', '사무실', '정장', 'office', 'business', 'worker', 'suit', 'job', '会社員', 'ビジネス', 'オフィス', '仕事'],

    // -----------------------------------------------------
    // [2] 종교 / 신앙 (Religion) ★ 새로 추가된 부분
    // -----------------------------------------------------
    '교회': ['기독교', '예수', '십자가', '성경', '예배', '목사', 'church', 'jesus', 'christ', 'bible', 'cross', 'worship', '教会', 'キリスト', '十字架', '聖書'],
    '천주교': ['가톨릭', '성당', '성모마리아', '미사', '신부', '수녀', 'catholic', 'cathedral', 'saint', 'mass', 'mary', 'カトリック', '聖堂', 'ミサ'],
    '불교': ['부처', '석가모니', '절', '사찰', '스님', '연등', '연꽃', 'buddhism', 'buddha', 'temple', 'monk', 'lotus', '仏教', 'お寺', '仏像', '蓮'],
    '종교': ['신앙', '기도', '믿음', '신', '하늘', '평화', '영혼', 'religion', 'faith', 'pray', 'god', 'peace', 'spirit', '宗教', '信仰', '祈り', '神'],

    // -----------------------------------------------------
    // [3] 음식 / 요리 (Food & Beverage)
    // -----------------------------------------------------
    '음식': ['식당', '푸드', '맛집', '요리', '메뉴', 'food', 'restaurant', 'meal', 'cook', 'menu', 'cooking', '食べ物', '料理', 'レストラン', '食事'],
    '한식': ['국밥', '비빔밥', '김치', '찌개', 'korean food', 'hansik', 'kimchi', 'bibimbap', '韓国料理', '韓食', 'キムチ'],
    '일식': ['스시', '초밥', '라멘', '돈까스', '우동', '이자카야', 'japanese food', 'sushi', 'ramen', 'udon', 'izakaya', '和食', '日本料理', '寿司', 'ラーメン'],
    '중식': ['짜장면', '짬뽕', '마라탕', '탕수육', 'chinese food', 'noodle', 'dumpling', '中華', '中華料理', 'チャジャン麺'],
    '양식': ['피자', '파스타', '스테이크', '버거', 'western food', 'pizza', 'pasta', 'steak', 'burger', '洋食', 'ピザ', 'パスタ', 'ステーキ'],
    '분식': ['떡볶이', '튀김', '김밥', '순대', 'snack', 'street food', 'kimbap', 'tteokbokki', 'トッポッキ', '粉食', '軽食'],
    '고기': ['정육', '한우', '삼겹살', '구이', '갈비', 'meat', 'bbq', 'pork', 'beef', 'steak', 'grill', '肉', '焼肉', 'サムギョプサル', '牛肉'],
    '치킨': ['통닭', '닭강정', '맥주', 'chicken', 'fried chicken', 'poultry', 'チキン', 'フライドチキン', '鶏肉'],
    '해산물': ['회', '생선', '게', '새우', '수산', 'seafood', 'fish', 'sashimi', 'crab', 'shrimp', 'ocean', '海鮮', '魚', '刺身', 'シーフード'],
    '카페': ['커피', '아메리카노', '라떼', '음료', '티', 'cafe', 'coffee', 'latte', 'tea', 'beverage', 'drink', 'カフェ', 'コーヒー', '喫茶店'],
    '디저트': ['빵', '베이커리', '케이크', '마카롱', 'dessert', 'bread', 'bakery', 'cake', 'sweet', 'デザート', 'パン', 'ケーキ', 'スイーツ'],
    '술': ['주점', '포차', '맥주', '소주', '와인', '호프', 'alcohol', 'beer', 'wine', 'pub', 'bar', 'soju', 'お酒', 'ビール', 'ワイン', '居酒屋'],
    '과일': ['사과', '딸기', '포도', '수박', 'fresh', 'fruit', 'apple', 'strawberry', 'grape', '果物', 'フルーツ', 'イチゴ'],

    // -----------------------------------------------------
    // [4] 업종 / 비즈니스 (Business Categories)
    // -----------------------------------------------------
    '부동산': ['공인중개사', '매매', '전세', '분양', '아파트', '빌라', 'real estate', 'house', 'home', 'apartment', 'property', '不動産', 'マンション', '住宅'],
    '학원': ['교육', '수학', '영어', '과외', '강의', 'academy', 'education', 'class', 'lesson', 'study', '塾', '教室', 'レッスン', '教育'],
    '병원': ['의원', '약국', '건강', '진료', '치과', 'medical', 'hospital', 'clinic', 'health', 'doctor', 'pharmacy', '病院', 'クリニック', '医療', '薬局'],
    '뷰티': ['미용', '헤어', '네일', '화장품', '에스테틱', 'beauty', 'hair', 'nail', 'salon', 'makeup', 'cosmetic', '美容', 'ヘア', 'ネイル', 'メイク'],
    '운동': ['헬스', '피트니스', '요가', '필라테스', 'gym', 'fitness', 'workout', 'yoga', 'pilates', 'sports', 'ジム', '運動', 'フィットネス', 'ヨガ'],
    '청소': ['세탁', '빨래', '이사', '정리', 'clean', 'cleaning', 'laundry', 'wash', 'housekeeping', '掃除', 'クリーニング', '洗濯'],
    '운송': ['용달', '택배', '배달', '퀵', 'delivery', 'shipping', 'transport', 'truck', '配送', '配達', '宅配', '引越し'],
    '금융': ['은행', '보험', '대출', '투자', '돈', 'finance', 'bank', 'money', 'insurance', 'loan', '金融', '銀行', '保険', 'お金'],
    '법률': ['변호사', '세무사', '법무사', '상담', 'law', 'lawyer', 'legal', 'tax', 'consulting', '法律', '弁護士', '税理士'],
    '자동차': ['정비', '세차', '중고차', '렌트', 'car', 'auto', 'vehicle', 'drive', 'wash', 'repair', '車', '自動車', '洗車', 'ドライブ'],
    '반려동물': ['강아지', '고양이', '애견', '동물병원', 'pet', 'dog', 'cat', 'puppy', 'kitten', 'animal', 'ペット', '犬', '猫', '動物'],

    // -----------------------------------------------------
    // [5] 시즌 / 행사 / 이벤트 (Event & Season)
    // -----------------------------------------------------
    '세일': ['할인', '특가', '이벤트', '프로모션', '오픈', 'sale', 'discount', 'event', 'promotion', 'open', 'offer', 'セール', '割引', 'イベント', '特化'],
    '개업': ['오픈', '확장', '이전', 'grand open', 'opening', 'launch', 'new', 'start', 'オープン', '開店', '開業'],
    '모집': ['채용', '구인', '알바', '사원', 'recruitment', 'hiring', 'job', 'wanted', 'staff', '募集', '求人', '採用', 'アルバイト'],
    '봄': ['벚꽃', '스프링', '3월', '4월', 'spring', 'cherry blossom', 'flower', 'march', 'april', '春', '桜', 'スプリング'],
    '여름': ['바다', '해변', '수영', '휴가', '썸머', 'summer', 'beach', 'sea', 'vacation', 'hot', 'swimming', '夏', '海', 'ビーチ', '水泳'],
    '가을': ['추석', '단풍', '낙엽', '10월', 'autumn', 'fall', 'maple', 'thanksgiving', 'october', '秋', '紅葉', 'オータム'],
    '겨울': ['눈', '크리스마스', '산타', '연말', '새해', 'winter', 'snow', 'christmas', 'xmas', 'holiday', 'cold', '冬', '雪', 'クリスマス'],
    '명절': ['설날', '추석', '한가위', '명절', '연휴', 'gift', 'holiday', 'lunar new year', 'thanksgiving', '正月', '旧正月', 'お盆', '名節'],
    '생일': ['파티', '축하', '기념일', '환갑', 'birthday', 'party', 'celebration', 'anniversary', 'cake', '誕生日', 'バースデー', 'パーティー', 'お祝い'],
    '여행': ['투어', '호텔', '숙박', '캠핑', '비행기', 'travel', 'trip', 'tour', 'hotel', 'camping', 'flight', '旅行', 'ツアー', 'ホテル', 'キャンプ'],

    // -----------------------------------------------------
    // [6] 자연 / 배경 / 오브젝트 (Nature & Object)
    // -----------------------------------------------------
    '꽃': ['플라워', '화분', '장미', '식물', 'flower', 'plant', 'rose', 'garden', 'nature', 'floral', '花', 'フラワー', '植物', 'バラ'],
    '나무': ['숲', '초록', '친환경', 'nature', 'tree', 'forest', 'green', 'eco', 'wood', 'leaf', '木', '森', '自然', '緑'],
    '하늘': ['구름', '태양', '우주', '별', 'sky', 'cloud', 'sun', 'star', 'space', 'blue', '空', '雲', '太陽', '星'],
    '물': ['바다', '강', '호수', '비', 'water', 'ocean', 'river', 'lake', 'rain', 'aqua', '水', '海', '川', '雨'],
    '배경': ['패턴', '텍스처', '종이', '질감', 'background', 'pattern', 'texture', 'paper', 'wallpaper', '背景', 'パターン', 'テクスチャ'],
    '프레임': ['테두리', '장식', '액자', 'frame', 'border', 'decoration', 'ornament', 'edge', 'フレーム', '枠', '飾り'],

    // -----------------------------------------------------
    // [7] 분위기 / 스타일 / 색상 (Mood & Style)
    // -----------------------------------------------------
    '심플': ['단순', '모던', '깔끔', '미니멀', 'simple', 'modern', 'minimal', 'clean', 'basic', 'flat', 'シンプル', 'モダン', 'ミニマル'],
    '화려': ['럭셔리', '고급', '골드', '블링', 'luxury', 'fancy', 'premium', 'gold', 'vip', 'elegant', '豪華', 'ラグジュアリー', '高級'],
    '전통': ['한국', '기와', '민속', '붓글씨', '한복', 'tradition', 'korea', 'culture', 'oriental', 'asian', '伝統', '韓国', '民俗'],
    '귀여운': ['큐트', '일러스트', '캐릭터', '동화', 'cute', 'lovely', 'illustration', 'character', 'cartoon', '可愛い', 'キュート', 'イラスト'],
    '레트로': ['복고', '빈티지', '옛날', '감성', 'retro', 'vintage', 'old', 'classic', 'antique', 'レトロ', 'ビンテージ', '復古'],
    '빨강': ['레드', '붉은', '핫', 'red', 'hot', 'rose', '赤', 'レッド'],
    '파랑': ['블루', '시원한', '청색', 'blue', 'cool', 'sky', '青', 'ブルー'],
    '노랑': ['옐로우', '황금', '밝은', 'yellow', 'gold', 'bright', '黄色', 'イエロー'],
    '초록': ['그린', '녹색', '자연', 'green', 'nature', 'eco', '緑', 'グリーン'],
    '검정': ['블랙', '다크', '어두운', 'black', 'dark', 'night', '黒', 'ブラック'],
    '하양': ['화이트', '백색', '밝은', 'white', 'pure', 'light', '白', 'ホワイト']
};

function expandSearchKeywords(inputText) {
    if (!inputText) return [];
    let words = inputText.split(/\s+/).filter(w => w.trim().length > 0);
    let expanded = new Set(words);
    words.forEach(word => {
        Object.keys(SYNONYM_DB).forEach(key => {
            if (word.includes(key) || key.includes(word)) {
                SYNONYM_DB[key].forEach(syn => expanded.add(syn));
            }
        });
    });
    return Array.from(expanded);
}

// =========================================================
// [1] 초기화 및 이벤트 리스너 설정
// =========================================================
export function initTemplateTools() {
    // 1. 카테고리 필터 버튼
    window.filterTpl = (type, btnElement) => {
        if (btnElement) {
            document.querySelectorAll(".tpl-cate-btn").forEach(b => b.classList.remove("active"));
            btnElement.classList.add("active");
        }
        currentCategory = type;
        const keyword = document.getElementById("tplSearchInput")?.value || "";
        searchTemplates(type, keyword);
    };

    // 2. 검색창 엔터 이벤트
    const searchInput = document.getElementById("tplSearchInput");
    if (searchInput) {
        searchInput.onkeyup = (e) => {
            if (e.key === 'Enter') searchTemplates(currentCategory, e.target.value);
        };
    }

    // 3. 템플릿 탭 (오버레이 열기)
    document.querySelectorAll(".tpl-tab").forEach((b) => {
        if (!b.getAttribute('onclick')) {
            b.onclick = () => openTemplateOverlay(b.dataset.tpl);
        }
    });

    // 4. 모달 내부 버튼 이벤트 연결 (추가/교체 선택)
    const btnReplace = document.getElementById("btnActionReplace"); 
    if (btnReplace) {
        btnReplace.onclick = () => {
            document.getElementById("templateActionModal").style.display = "none";
            processLoad('replace');
        };
    }
    
    const btnAdd = document.getElementById("btnActionAdd"); 
    if (btnAdd) {
        btnAdd.onclick = () => {
            document.getElementById("templateActionModal").style.display = "none";
            processLoad('add');
        };
    }

    // 적용 버튼
    const btnUse = document.getElementById("btnUseTpl");
    if(btnUse) btnUse.onclick = useSelectedTemplate;

    // 5. 관리자 등록 버튼
    const btnReg = document.getElementById("btnRegisterTemplate");
    if (btnReg) {
        if (currentUser) btnReg.style.display = "flex";
        btnReg.onclick = () => {
            if (!currentUser) return alert("관리자 로그인이 필요합니다.");
            document.getElementById("sellModal").style.display = "flex";
        };
    }

    // 6. 등록 확인 버튼
    const btnSellConfirm = document.getElementById("btnSellConfirm");
    if (btnSellConfirm) btnSellConfirm.onclick = registerOfficialTemplate;
}

// =========================================================
// [2] 오버레이 및 리스트 로직
// =========================================================

async function openTemplateOverlay(type) {
    const overlay = document.getElementById("templateOverlay");
    overlay.style.display = "flex";
    currentCategory = type;
    
    document.querySelectorAll(".tpl-cate-btn").forEach(btn => {
        btn.classList.remove("active");
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${type}'`)) {
            btn.classList.add("active");
        }
    });
    
    await searchTemplates(type, "");
}

// ★★★ [수정됨] 템플릿 검색 및 필터링 (검색어 확장 + 100개 제한 적용) ★★★
async function searchTemplates(category, keyword) {
    const grid = document.getElementById("tplGrid");
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">로딩중...</div>';
    selectedTpl = null;

    if (!sb) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:red;">DB 미연결</div>';
        return;
    }

    try {
        // 1. 현재 에디터의 제품 키 확인
        const currentKey = window.currentProductKey || (canvas ? canvas.currentProductKey : 'custom') || 'custom';
        
        console.log(`🔎 템플릿 검색 시작 | 카테고리: ${category} | 키워드: ${keyword}`);

        let query = sb.from('library')
            .select('id, thumb_url, tags, category, width, height, product_key, created_at')
            .order('created_at', { ascending: false })
            .limit(100); // ★ 수정됨: 50개 -> 100개로 증가

        // 2. 카테고리 필터
        if (category && category !== 'all') {
            query = query.eq('category', category); 
        }
        
        // 3. 키워드 검색 (확장 로직 적용)
        if (keyword && keyword.trim() !== '') {
            // ★ 수정됨: 검색어 확장 함수 사용
            const expandedWords = expandSearchKeywords(keyword);
            
            // Supabase .or() 구문 생성 (tags 컬럼에 대해 여러 단어 중 하나라도 포함되면 검색)
            // 예: tags.ilike.%여름%,tags.ilike.%바다%,tags.ilike.%휴가%
            const orSearchCondition = expandedWords.map(w => `tags.ilike.%${w}%`).join(',');
            
            if (orSearchCondition) {
                query = query.or(orSearchCondition);
            }
        }

        // 4. 제품 키 필터링 로직 (내 제품키 OR 공통 OR 커스텀)
        // 기존 쿼리에 .or()를 추가하면 (카테고리 AND 키워드조건 AND 제품키조건) 형태로 결합됩니다.
        const filterCondition = `product_key.eq.${currentKey},product_key.eq.custom,product_key.is.null`;
        query = query.or(filterCondition);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">
                    <i class="fa-solid fa-box-open" style="font-size:24px; margin-bottom:10px; display:block;"></i>
                    검색 결과가 없습니다.<br>
                    <span style="font-size:11px;">(키워드: ${keyword || '없음'})</span>
                </div>`;
            return;
        }

        // 5. 그리드 렌더링
        grid.innerHTML = "";
        data.forEach((item) => {
            const card = document.createElement("div");
            card.className = "tpl-item";
            const imgUrl = item.thumb_url || 'https://via.placeholder.com/300?text=No+Image';
            const displayTitle = item.tags ? item.tags.split(',')[0] : '무제';
            
            // 전용 템플릿 표시
            const isExclusive = item.product_key && item.product_key !== 'custom';
            const badgeHtml = isExclusive 
                ? `<span style="position:absolute; top:8px; left:8px; background:#6366f1; color:white; font-size:10px; padding:3px 6px; border-radius:4px; z-index:2; box-shadow:0 2px 4px rgba(0,0,0,0.2);">전용</span>` 
                : '';

            card.innerHTML = `
                ${badgeHtml}
                <img src="${imgUrl}" class="tpl-item-img" loading="lazy">
                <div class="tpl-overlay-info">
                    <span class="tpl-name">${displayTitle}</span>
                    <button class="btn-use-mini" type="button">바로 적용</button>
                </div>
            `;
            
            card.onclick = (e) => {
                document.querySelectorAll(".tpl-item").forEach((i) => i.classList.remove("selected"));
                card.classList.add("selected");
                
                selectedTpl = { 
                    id: item.id, 
                    category: item.category,
                    width: item.width || 1000, 
                    height: item.height || 1000, 
                    product_key: item.product_key || 'custom'
                };
                
                if (e.target.classList.contains('btn-use-mini')) useSelectedTemplate();
            };
            grid.appendChild(card);
        });
    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div style="text-align:center; color:red;">시스템 에러: ${e.message}</div>`;
    }
}

// =========================================================
// [3] 선택 및 로드 프로세스
// =========================================================

async function useSelectedTemplate() {
    if (!selectedTpl) return alert("템플릿을 선택해주세요.");
    
    const objects = canvas.getObjects().filter(o => !o.isBoard);
    
    if (objects.length > 0) {
        // 모달창 띄우기 (confirm 대신)
        document.getElementById("templateActionModal").style.display = "flex";
    } else {
        processLoad('replace');
    }
}

async function processLoad(mode) {
    // UI 정리
    const loadModal = document.getElementById("loadModeModal");
    if(loadModal) loadModal.style.display = "none";
    document.getElementById("templateActionModal").style.display = "none"; 
    document.getElementById("templateOverlay").style.display = "none";
    document.getElementById("loading").style.display = "flex";

    try {
        // 1. DB에서 데이터 가져오기
        const { data, error } = await sb
            .from('library')
            .select('data_url')
            .eq('id', selectedTpl.id)
            .single();

        if (error || !data) throw new Error("데이터를 불러오지 못했습니다.");

        let rawData = data.data_url;
        let finalJson = null;
        let isImage = false;
        let imageUrl = "";

        // 2. 데이터 타입 판별
        try {
            if (typeof rawData === 'object') {
                finalJson = rawData; 
            } else {
                finalJson = JSON.parse(rawData);
            }

            if (typeof finalJson === 'string') {
                isImage = true;
                imageUrl = finalJson;
            } else {
                isImage = false;
            }
        } catch (e) {
            console.log("JSON 형식이 아님 -> 이미지로 처리합니다.");
            isImage = true;
            imageUrl = rawData;
        }

        // 3. 교체 모드일 경우 기존 요소 삭제
        if (mode === 'replace') {
            const objects = canvas.getObjects().filter(o => !o.isBoard);
            objects.forEach(o => canvas.remove(o));
        }

        // 4. 타입에 따른 처리 실행
        if (isImage) {
            const cleanUrl = String(imageUrl).trim().replace(/^"|"$/g, '');

            fabric.Image.fromURL(cleanUrl, (img) => {
                if (!img || !img.width) {
                    document.getElementById("loading").style.display = "none";
                    return alert("이미지 파일을 불러올 수 없습니다.");
                }

                const board = canvas.getObjects().find(o => o.isBoard);
                const center = board ? board.getCenterPoint() : canvas.getCenter();
                
                img.set({
                    left: center.x,
                    top: center.y,
                    originX: 'center',
                    originY: 'center'
                });

                if (board) {
                    const maxW = board.getScaledWidth() * 0.5;
                    if (img.width > maxW) {
                        img.scaleToWidth(maxW);
                    }
                }

                canvas.add(img);
                img.setCoords(); 
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                document.getElementById("loading").style.display = "none";
            }, { crossOrigin: 'anonymous' }); 

        } else {
            let jsonData = finalJson;
            if(jsonData.objects) jsonData.objects = jsonData.objects.filter(o => !o.isBoard);

            fabric.util.enlivenObjects(jsonData.objects, (objs) => {
                if (objs.length === 0) { 
                    document.getElementById("loading").style.display = "none"; 
                    if(mode === 'replace') resetViewToCenter(); 
                    return; 
                }

                objs.forEach(obj => {
                    obj.set({
                        selectable: true, evented: true,
                        lockMovementX: false, lockMovementY: false,
                        lockScalingX: false, lockScalingY: false,
                        hasControls: true, hasBorders: true
                    });
                });

                const group = new fabric.Group(objs, { originX: 'center', originY: 'center' });
                
                const board = canvas.getObjects().find(o => o.isBoard);
                const boardW = board ? (board.width * board.scaleX) : 1000;
                const boardH = board ? (board.height * board.scaleY) : 1000;
                const centerX = board ? (board.left + boardW / 2) : canvas.width / 2;
                const centerY = board ? (board.top + boardH / 2) : canvas.height / 2;

                let scale = 1;
                
                if (mode === 'replace') {
                    const scaleX = boardW / group.width;
                    const scaleY = boardH / group.height;
                    scale = Math.max(scaleX, scaleY); 
                } else {
                    if (group.width > boardW * 0.6) {
                        scale = (boardW * 0.6) / group.width;
                    }
                }

                group.set({ 
                    left: centerX, 
                    top: centerY,
                    scaleX: scale,
                    scaleY: scale
                });

                canvas.add(group);

                if (group.type === 'group') {
                    group.toActiveSelection();
                }
                
                canvas.discardActiveObject(); 
                canvas.requestRenderAll();
                
                if (mode === 'replace') {
                    setTimeout(() => resetViewToCenter(), 100);
                }
                
                document.getElementById("loading").style.display = "none";
            });
        }

    } catch (e) {
        console.error(e);
        document.getElementById("loading").style.display = "none";
        alert("불러오기 실패: " + e.message);
    }
}

// =========================================================
// [4] 유틸리티
// =========================================================

function resetViewToCenter() {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    const containerW = canvas.getWidth(); 
    const containerH = canvas.getHeight();
    const boardW = board.getScaledWidth();
    const boardH = board.getScaledHeight();

    if (boardW === 0 || boardH === 0) return;

    const isMobile = window.innerWidth < 768;
    const paddingX = isMobile ? 20 : 320; 
    const paddingY = isMobile ? 120 : 100; 

    const safeWidth = Math.max(containerW - paddingX, 50);
    const safeHeight = Math.max(containerH - paddingY, 50);

    const zoom = Math.min(safeWidth / boardW, safeHeight / boardH) * 0.98;
    const safeZoom = Math.min(Math.max(zoom, 0.05), 5); 

    canvas.setZoom(safeZoom);
    
    const vpt = canvas.viewportTransform;
    vpt[4] = (containerW - boardW * safeZoom) / 2;
    vpt[5] = (containerH - boardH * safeZoom) / 2;
    
    if(isMobile) vpt[5] += 10;

    canvas.requestRenderAll();
}

async function registerOfficialTemplate() {
    const kwInput = document.getElementById("sellKw");
    const keyword = kwInput ? kwInput.value : "";
    
    let cat = prompt("카테고리를 입력하세요\n(옵션: vector, graphic, photo-bg, logo)", "text");
    if(!cat) return;
    cat = cat.toLowerCase();

    if (!sb) return alert("DB 미연결");
    if (!currentUser) return alert("관리자 로그인이 필요합니다.");

    const btn = document.getElementById("btnSellConfirm");
    const originalText = btn.innerText;
    btn.innerText = "업로드 중...";

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    const json = canvas.toJSON(['id', 'isBoard', 'fontFamily', 'fontSize', 'text', 'lineHeight', 'charSpacing', 'fill', 'stroke', 'strokeWidth']);
    const board = canvas.getObjects().find(o => o.isBoard);
    const originalVpt = canvas.viewportTransform; 
    
    let thumbUrl = "";

    try {
        if (board) {
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            thumbUrl = canvas.toDataURL({ 
                format: 'png', 
                multiplier: 3, 
                quality: 1,
                left: board.left,
                top: board.top,
                width: board.getScaledWidth(),
                height: board.getScaledHeight()
            });
        } else {
            thumbUrl = canvas.toDataURL({ format: 'png', multiplier: 3, quality: 1 });
        }

        const payload = {
            category: cat,
            tags: keyword || "제목 없음",
            thumb_url: thumbUrl,
            data_url: json,
            created_at: new Date(),
            width: board ? board.width : canvas.width,
            height: board ? board.height : canvas.height,
            product_key: canvas.currentProductKey || 'custom'
        };

        const { error } = await sb.from('library').insert([payload]);

        if (error) throw error;

        alert("👑 공식 템플릿으로 등록되었습니다!");
        document.getElementById("sellModal").style.display = "none";
        if(kwInput) kwInput.value = "";

    } catch (e) {
        console.error("등록 실패:", e);
        alert("등록 실패: " + e.message);
    } finally {
        canvas.setViewportTransform(originalVpt);
        canvas.requestRenderAll();
        btn.innerText = originalText;
    }
}

// =========================================================
// [5] 로고 대량 업로드 (다중 파일 + 자동 키워드)
// =========================================================

window.handleFileSelect = function(input) {
    const files = input.files;
    if (!files || files.length === 0) return;

    const preview = document.getElementById('previewImage');
    const removeBtn = document.getElementById('removeFileBtn');
    const dropText = document.querySelector('.upload-drop-zone .upload-text');
    const subText = document.querySelector('.upload-drop-zone .upload-sub');
    const keywordInput = document.getElementById('logoKeywordInput');

    if (files.length === 1) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            if(preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if(removeBtn) removeBtn.style.display = 'flex';
        }
        reader.readAsDataURL(file);
        
        const autoTag = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        if(keywordInput) keywordInput.value = autoTag;
    } 
    else {
        if(preview) preview.style.display = 'none';
        if(removeBtn) removeBtn.style.display = 'flex';
        
        dropText.innerHTML = `<span style="color:#6366f1; font-weight:800;">${files.length}개</span>의 파일이 선택되었습니다.`;
        subText.innerText = "업로드 버튼을 누르면 일괄 등록됩니다.";
        
        if(keywordInput) keywordInput.value = ""; 
        if(keywordInput) keywordInput.placeholder = "공통 태그 입력 (비워두면 파일명이 태그가 됩니다)";
    }
};

window.resetUpload = function(e) {
    if(e) e.stopPropagation(); 
    const fileInput = document.getElementById('logoFileInput');
    const preview = document.getElementById('previewImage');
    const removeBtn = document.getElementById('removeFileBtn');
    const dropText = document.querySelector('.upload-drop-zone .upload-text');
    const subText = document.querySelector('.upload-drop-zone .upload-sub');
    const keywordInput = document.getElementById('logoKeywordInput');

    if(fileInput) fileInput.value = "";
    if(preview) {
        preview.style.display = 'none';
        preview.src = "";
    }
    if(removeBtn) removeBtn.style.display = 'none';
    
    if(dropText) dropText.innerText = "클릭하여 파일 선택";
    if(subText) subText.innerText = "또는 파일을 여기로 드래그하세요";
    if(keywordInput) {
        keywordInput.value = "";
        keywordInput.placeholder = "예: 삼성, 로고, 심플 (쉼표로 구분)";
    }
};

window.uploadUserLogo = async function() {
    const fileInput = document.getElementById("logoFileInput");
    const keywordInput = document.getElementById("logoKeywordInput");
    const files = fileInput.files;
    const commonTag = keywordInput.value.trim();

    if (files.length === 0) return alert("이미지를 선택해주세요!");

    const btn = event.target;
    const originalText = btn.innerText;
    btn.disabled = true;

    let successCount = 0;
    let failCount = 0;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            btn.innerText = `업로드 중... (${i + 1}/${files.length})`;

            let autoTags = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            if(commonTag) autoTags = `${autoTags}, ${commonTag}`;

            const fileExt = file.name.split('.').pop();
            const timestamp = Date.now();
            const fileName = `logo_${timestamp}_${Math.floor(Math.random()*1000)}.${fileExt}`;

            const { error: uploadError } = await sb.storage
                .from('logos')
                .upload(fileName, file);

            if (uploadError) {
                console.error(`파일 업로드 실패 (${file.name}):`, uploadError);
                failCount++;
                continue; 
            }

            const { data: publicData } = sb.storage
                .from('logos')
                .getPublicUrl(fileName);

            const payload = {
                category: 'logo',
                tags: autoTags,
                thumb_url: publicData.publicUrl,
                data_url: publicData.publicUrl,
                created_at: new Date(),
                width: 500,
                height: 500,
                product_key: 'custom'
            };

            const { error: dbError } = await sb.from('library').insert([payload]);
            if (dbError) {
                console.error(`DB 등록 실패 (${file.name}):`, dbError);
                failCount++;
            } else {
                successCount++;
            }
        }

        if (failCount > 0) {
            alert(`완료! 성공: ${successCount}개, 실패: ${failCount}개`);
        } else {
            alert(`🎉 ${successCount}개의 로고가 모두 등록되었습니다!`);
        }

        window.resetUpload(null);
        document.getElementById("logoUploadModal").style.display = "none";

        if (currentCategory === 'logo') {
            searchTemplates('logo', '');
        }

    } catch (e) {
        console.error(e);
        alert("시스템 오류: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    if(dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if(files.length > 0) {
                const fileInput = document.getElementById('logoFileInput');
                if(fileInput) {
                    fileInput.files = files;
                    window.handleFileSelect(fileInput);
                }
            }
        });
    }
});

// ★ [신규] 제품 전용 고정 템플릿(칼선) 자동 로드 함수 - 오버레이 모드

// 오버레이 객체 추적용 변수
let overlayObject = null;

export function loadProductFixedTemplate(url) {
    if (!canvas || !url) return;

    console.log("🔒 특수 상품 템플릿(칼선) 로드 중:", url);
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "flex";

    // 공통 처리 함수 (이미지 또는 SVG 그룹)
    const setupSpecialOverlay = (obj) => {
        if (!obj) {
            if (loading) loading.style.display = "none";
            return;
        }

        // 1. 기존 칼선 삭제 (중복 방지)
        const oldOverlay = canvas.getObjects().find(o => o.id === 'product_fixed_overlay');
        if (oldOverlay) canvas.remove(oldOverlay);

        // 2. 대지(Board) 크기에 맞추기
        const board = canvas.getObjects().find(o => o.isBoard);
        let tLeft = 0, tTop = 0, tW = canvas.width, tH = canvas.height;

        if (board) {
            tW = board.width * board.scaleX;
            tH = board.height * board.scaleY;
            tLeft = board.left;
            tTop = board.top;
        }

        // 이미지 크기를 대지 크기에 강제로 맞춤 (비율 무시, 꽉 채움)
        const scaleX = tW / obj.width;
        const scaleY = tH / obj.height;

        obj.set({
            scaleX: scaleX,
            scaleY: scaleY,
            left: tLeft + tW / 2,
            top: tTop + tH / 2,
            originX: 'center',
            originY: 'center',
            
            // ★ 핵심 설정: 맨 위에 있지만 클릭은 통과됨
            id: 'product_fixed_overlay', 
            selectable: false,
            evented: false,              
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            hoverCursor: 'default',
            excludeFromExport: false     
        });

        // 3. 캔버스에 추가하고 맨 앞으로 가져오기
        overlayObject = obj;
        canvas.add(obj);
        canvas.bringToFront(obj); // 무조건 맨 위로
        canvas.requestRenderAll();
        
        if (loading) loading.style.display = "none";
        console.log("✅ 템플릿 오버레이 고정 완료");
    };

    // 파일 타입에 따른 로드 분기
    if (url.toLowerCase().endsWith('.svg') || url.includes('data:image/svg')) {
        fabric.loadSVGFromURL(url, (objects, options) => {
            const group = fabric.util.groupSVGElements(objects, options);
            setupSpecialOverlay(group);
        });
    } else {
        fabric.Image.fromURL(url, (img) => {
            setupSpecialOverlay(img);
        }, { crossOrigin: 'anonymous' });
    }
}