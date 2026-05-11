// 디자이너 패턴 컬렉션을 카멜레온프린팅 에디터 DB(library, category='graphic')의 PNG로 재구축
//
// 동작 흐름:
//   1. user_patterns 전체 삭제 (소프트하게 — RLS DELETE 정책 없으면 경고만 띄우고 진행)
//   2. library 테이블에서 category='graphic' + PNG 썸네일이 있는 row 전부 가져옴
//   3. 각 row를 user_patterns에 INSERT — thumb_url/original_url은 library의 URL 그대로 재사용
//   4. 작가명은 KR 30% / JP 30% / EN 30% / 기타 10% 분포
//   5. 작품명은 library.tags를 그대로 사용 (#NN 접미사로 중복 회피)
//
// 사용법:
//   node seed_patterns_from_library.mjs               (실제 삽입)
//   node seed_patterns_from_library.mjs --dry         (확인만, 삽입 없음)
//   node seed_patterns_from_library.mjs --keep        (기존 user_patterns 유지, 새 것만 추가)
//
// 사전 조건:
//   - ai_pattern_generator/.env 의 SUPABASE_SERVICE_KEY (또는 동등한 anon 키) 필요
//   - RLS: anon이 user_patterns INSERT/DELETE 가능해야 함 (이미 기존 스크립트가 동작 중이므로 OK)

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env 직접 로드 (dotenv 없이)
function loadEnv() {
    const envPath = path.join(__dirname, 'ai_pattern_generator', '.env');
    if (!fs.existsSync(envPath)) return {};
    const out = {};
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
        if (m) out[m[1]] = m[2];
    });
    return out;
}
const env = loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL || 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const KEEP = args.includes('--keep');

// ────────────────────────────────────────────────
// 작가명 풀 — KR/JP/EN 약 30% / 30% / 30% / 10% 혼합
// ────────────────────────────────────────────────
const KR_DESIGNERS = [
    '로하 스튜디오', '문라이트 디자인', '하늘 패턴', '코튼 아뜰리에', '플로라 디자인', '모카 스튜디오',
    '뮤즈 디자인', '살구나무', '세이지 패턴', '은하수 스튜디오', '오로라 아뜰리에', '아카시아 디자인',
    '소나기 스튜디오', '아쿠아 패턴', '벨벳 디자인', '코코 아뜰리에', '핑크 살롱', '레인보우 스튜디오',
    '단풍나무', '보태닉 디자인', '미스티 스튜디오', '레몬트리 디자인', '카카오 패턴', '한지 디자인',
    '백조 스튜디오', '바람결 디자인', '청명 패턴', '솔잎 아뜰리에', '연꽃 디자인', '담쟁이 스튜디오',
    '봄날 디자인', '여름밤 패턴', '가을빛 스튜디오', '겨울숲 아뜰리에', '햇살 디자인', '구름결 패턴'
];

const JP_DESIGNERS = [
    'Yuki Works', 'Sakura Atelier', 'Nori Studio', 'Hoshi Design', 'Kyo Pattern Lab',
    'Aoi Studio', 'Hana Works', 'Mizu Atelier', 'Kuma Design', 'Sora Pattern',
    'Tsuki no Mori', 'Komorebi Studio', 'Wabi Atelier', 'Hinata Design', 'Asagiri Works',
    'Momiji Studio', 'Yuzu Pattern Lab', 'Kira Atelier', 'Niji Design', 'Suzume Works',
    'Tsumiki Design', 'Hibiki Studio', 'Akane Atelier', 'Shinrin Pattern', 'Mochi Works',
    'Iroha Studio', 'Sumire Design', 'Kasumi Atelier', 'Yamato Pattern'
];

const EN_DESIGNERS = [
    'Studio Aria', 'Olive Design', 'Pebble Studio', 'Linen House', 'Forest Path', 'Hazel & Co',
    'Maple & Birch', 'Northern Light Studio', 'Dune Works', 'Cedar Atelier', 'Indigo Print Co',
    'Mira Studio', 'Cotton Lane', 'Folk & Bloom', 'Ember Atelier', 'River Stone Studio',
    'Willow & Wren', 'Fern Collective', 'Brass Petal', 'Thistle Studio', 'Daisy Chain Co',
    'Wild Meadow', 'Atelier Nord', 'Compass Print', 'Honeyfield Studio', 'Slate & Sage',
    'Morning Tide', 'Paper Birch Co', 'Quill & Bloom', 'Lantern Studio'
];

// 기타 (혼합 스타일) — 10%
const MISC_DESIGNERS = [
    'Atelier Nuage', 'Studio Verde', 'Bloom & Bone', 'Sol Pattern Lab',
    'Lumière Design', 'Studio Magnolia', 'Petit Jardin', 'Maison Linen',
    'Studio Cosmos', 'Tinta Atelier'
];

function pickArtist() {
    const r = Math.random();
    if (r < 0.30) return KR_DESIGNERS[Math.floor(Math.random() * KR_DESIGNERS.length)];
    if (r < 0.60) return JP_DESIGNERS[Math.floor(Math.random() * JP_DESIGNERS.length)];
    if (r < 0.90) return EN_DESIGNERS[Math.floor(Math.random() * EN_DESIGNERS.length)];
    return MISC_DESIGNERS[Math.floor(Math.random() * MISC_DESIGNERS.length)];
}

// ────────────────────────────────────────────────
// library.tags → user_patterns 카테고리 추정
// (UI에서 칩은 제거됐지만 DB 컬럼은 유지 — 향후 재활용 대비)
// ────────────────────────────────────────────────
function guessCategory(tags) {
    const t = (tags || '').toLowerCase();
    if (/(animal|동물|cat|dog|bird|fish|fox|bear|owl|panda|rabbit|whale|deer|sheep|owl|tiger|lion|elephant|zebra|horse|butterfly|nature)/i.test(t)) return 'animal';
    if (/(flower|plant|leaf|식물|꽃|tree|꽃|tropical|botanical|floral|herb|fern|monstera|palm|cactus)/i.test(t)) return 'plant';
    if (/(people|kid|child|baby|family|portrait|face|사람|dad|mom|girl|boy|man|woman)/i.test(t)) return 'people';
    if (/(geometric|abstract|modern|line|grid|미니멀|grid|stripe|dot|circle|square)/i.test(t)) return 'modern';
    if (/(mountain|sky|city|building|풍경|landscape|sunset|cloud|ocean|sea|forest|night)/i.test(t)) return 'scenery';
    if (/(font|letter|text|alphabet|타이포|typo|word|name|message)/i.test(t)) return 'typo';
    if (/(kid|child|baby|toy|game|키즈|cute|character)/i.test(t)) return 'kids';
    return 'etc';
}

// tags가 비었거나 'No Tag'일 때 대체용 이름
const FALLBACK_NAMES = [
    'Graphic Print', 'Mood Pattern', 'Quiet Mark', 'Soft Motif', 'Daily Sketch',
    'Studio Print', 'Open Notes', 'Drift Pattern', '데일리 그래픽', '모티프', '스튜디오 노트'
];

// ────────────────────────────────────────────────
// 메인
// ────────────────────────────────────────────────
async function main() {
    console.log('▶ seed_patterns_from_library 시작');
    console.log('  Supabase:', SUPABASE_URL);
    console.log('  Mode:', DRY ? 'DRY RUN' : (KEEP ? 'KEEP existing + add new' : 'WIPE then reseed'));

    // 1) 기존 user_patterns 숨김 처리 (옵션)
    //    DELETE는 pattern_royalties FK 제약 + RLS 정책으로 안전하지 않음 →
    //    status='rejected'로 업데이트해 갤러리(approved만 SELECT)에서만 숨기고 FK는 유지.
    if (!KEEP) {
        console.log('\n▶ 기존 user_patterns 숨김 처리 (status=rejected) 중...');
        if (DRY) {
            const { count } = await sb.from('user_patterns').select('id', { count: 'exact', head: true }).eq('status', 'approved');
            console.log(`  (dry) 숨김 대상 (approved 상태): ${count}건`);
        } else {
            const { data: hidden, error } = await sb.from('user_patterns')
                .update({ status: 'rejected' })
                .eq('status', 'approved')
                .select('id');
            if (error) {
                console.error('  ❌ UPDATE 실패:', error.message);
                console.error('  → RLS UPDATE 정책이 anon에 허용되어 있는지 확인하세요.');
                process.exit(1);
            }
            console.log(`  ✓ 숨김 완료: ${hidden ? hidden.length : 0}건 (status=rejected)`);
        }
    }

    // 2) library에서 graphic 카테고리 PNG 로드 (페이지네이션)
    console.log('\n▶ library 테이블에서 category=graphic 로드 중...');
    let all = [];
    let from = 0; const STEP = 500;
    while (true) {
        const { data, error } = await sb.from('library')
            .select('id, tags, thumb_url, data_url, category, created_at')
            .eq('category', 'graphic')
            .order('created_at', { ascending: false })
            .range(from, from + STEP - 1);
        if (error) { console.error('  ❌ library 쿼리 실패:', error.message); process.exit(1); }
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < STEP) break;
        from += STEP;
    }
    // PNG만 — thumb_url 또는 data_url이 .png로 끝나거나 둘 다 비어있지 않은 것
    const png = all.filter(r => {
        const u = r.thumb_url || r.data_url;
        return u && /\.png(\?.*)?$/i.test(u);
    });
    console.log(`  ✓ 전체 ${all.length}건 중 PNG ${png.length}건 선별`);

    if (png.length === 0) {
        console.log('  ⚠ PNG 자산이 없습니다 — 종료');
        return;
    }

    // 3) user_patterns INSERT
    console.log(`\n▶ user_patterns INSERT 시작 (${png.length}건)`);
    const seen = new Map(); // tag 중복 카운트 (이름 #NN 접미사용)
    let ok = 0, fail = 0;
    const rows = [];

    for (let i = 0; i < png.length; i++) {
        const lib = png[i];
        const rawTag = (lib.tags || '').trim();
        const cleanTag = (rawTag && rawTag !== 'No Tag') ? rawTag : FALLBACK_NAMES[i % FALLBACK_NAMES.length];

        // 같은 태그가 여러 번 나오면 #02, #03 ... 접미사
        const cnt = (seen.get(cleanTag) || 0) + 1;
        seen.set(cleanTag, cnt);
        const name = cnt === 1 ? cleanTag : `${cleanTag} #${String(cnt).padStart(2, '0')}`;

        const url = lib.thumb_url || lib.data_url;
        const row = {
            name,
            category: guessCategory(rawTag),
            author: pickArtist(),
            description: rawTag || cleanTag,  // 검색용 — 원본 태그 그대로
            thumb_url: url,
            original_url: lib.data_url || url,  // PNG 원본은 동일 URL 사용 (library 자산 재활용)
            mockup_urls: [],
            source: 'editor-library',   // 출처 표시 — 향후 필터링 가능
            status: 'approved'
        };
        rows.push(row);
    }

    if (DRY) {
        console.log('\n  (dry) 샘플 5건:');
        rows.slice(0, 5).forEach(r => console.log('   ·', r.name, '/', r.author, '/', r.category));
        console.log(`  (dry) 총 ${rows.length}건 삽입 대기`);
        return;
    }

    // 배치 단위로 INSERT (한 번에 너무 많이 보내면 timeout)
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const { data, error } = await sb.from('user_patterns').insert(chunk).select('id');
        if (error) {
            console.error(`  ❌ 배치 ${i}-${i + chunk.length} 실패:`, error.message);
            fail += chunk.length;
        } else {
            ok += (data ? data.length : chunk.length);
            process.stdout.write(`  ${ok}/${rows.length} 등록됨...\r`);
        }
    }

    console.log(`\n========== DONE ==========`);
    console.log(`등록 성공: ${ok}`);
    console.log(`실패:     ${fail}`);
    console.log(`\n확인: https://www.cotton-print.com/cotton_print.html`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
