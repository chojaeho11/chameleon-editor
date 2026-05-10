// Bulk upload patterns from "패턴/" folder to Supabase user_patterns table
// Usage: node upload_patterns.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
// Service role key — RLS bypass for bulk admin upload
// IMPORTANT: ANON key insertion may fail or get RLS-blocked; use service_role from admin.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// 폴더명 → 카테고리 코드 매핑
const CATEGORY_MAP = {
    '동물': 'animal',
    '모던': 'modern',
    '식물': 'plant',
    '풍경': 'scenery',
    '기타': 'etc'
};

// 카테고리별 패턴 이름 풀 (자연스러운 한글 작품명)
const NAME_POOL = {
    animal: ['숲속의 친구들', '귀여운 토끼', '판다 가족', '북극곰 #', '고양이 패턴 #', '강아지 #', '나비의 춤', '밀림 동물', '바닷속 친구', '새벽의 사슴', '여우 #', '얼룩말 패턴', '곰돌이 #', '나무늘보 #', '수달 패턴', '레오파드 프린트', '얼룩말 라인', '코끼리 가족', '플라밍고 #', '펭귄 #'],
    modern: ['미니멀 라인 #', '모던 그래픽 #', '추상 형태 #', '기하학 패턴 #', '컬러블록 #', '브러시 스트로크', '디지털 아트 #', '바우하우스 #', '메모리 라인', '컨템포러리 #', '아트 데코 #', '큐비즘 #', '모노크롬 #', '미드센추리 #'],
    plant: ['보태니컬 가든 #', '몬스테라 #', '유칼립투스 #', '열대 잎사귀 #', '플로럴 부케', '들꽃 패턴', '튤립 #', '장미 정원 #', '벚꽃 #', '국화 #', '해바라기 #', '수국 #', '라벤더 #', '데이지 #', '호접란 #', '동백 #', '연꽃 #', '식물도감 #', '프레스드 플라워'],
    scenery: ['도시 야경 #', '바다 풍경 #', '산맥 실루엣', '노을 #', '숲의 새벽', '눈 덮인 산', '해변의 오후', '구름 풍경', '호수의 반영', '해질녘 #', '도시의 아침', '밤하늘 #', '들판 풍경', '계곡 #'],
    etc: ['빈티지 텍스타일 #', '모로칸 타일 #', '아이콘 패턴 #', '레트로 #', '에스닉 #', '북유럽 #', '오리엔탈 #', '아르누보 #', '페이즐리 #', '다마스크 #', '타탄체크 #', '하운즈투스 #', '아가일 #', '폴카 도트 #', '쉐브론 #', '워터컬러 #', '수채화 #', '잉크 워시 #']
};

// 가짜 디자이너명 풀 (다양한 작가)
const DESIGNER_POOL = [
    '로하 스튜디오', '문라이트 디자인', '하늘 패턴', '코튼 아뜰리에', '플로라', '모카 디자인',
    '뮤즈 스튜디오', '살구나무', '세이지 패턴', '은하수 디자인', '오로라 아뜰리에', '아카시아',
    '소나기 스튜디오', '아쿠아 디자인', '벨벳 패턴', '코코 아뜰리에', '핑크 살롱', '레인보우 스튜디오',
    '단풍나무', '보태닉 디자인', '미스티 스튜디오', '레몬트리', '카카오 패턴', '한지 디자인',
    'Studio Aria', 'Olive Design', 'Pebble Studio', 'Linen House', 'Forest Path', 'Hazel & Co'
];

const DESC_POOL = [
    '인테리어 커튼·쿠션 추천',
    '포토존 백드롭 인기',
    '카페·매장 디스플레이',
    '여름 의류 패턴',
    '키즈룸 인테리어',
    '소품·파우치 제작',
    '식탁보·러너 제작',
    '실외 천막·배너',
    '계절감 있는 패턴',
    '아이보리 톤 잘 어울림'
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function makeName(cat, idx) {
    const tmpl = pick(NAME_POOL[cat]);
    if (tmpl.endsWith('#')) return tmpl.replace('#', String(idx).padStart(2, '0'));
    if (tmpl.endsWith('# ')) return tmpl.replace('#', String(idx).padStart(2, '0'));
    return tmpl;
}

async function uploadOne(catFolder, catCode, fileName, idx) {
    const filePath = path.join(__dirname, '패턴', catFolder, fileName);
    const fileBuf = fs.readFileSync(filePath);
    const ext = path.extname(fileName).toLowerCase().replace('.', '') || 'jpg';
    const ts = Date.now();
    const safeFile = `${ts}_${idx}_${catCode}.${ext}`;

    // Storage 경로
    const thumbPath = `patterns/thumb/${safeFile}`;
    const origPath = `patterns/original/${safeFile}`;

    // 동일 파일을 thumb과 original 양쪽에 (실제 작가 업로드와 동일한 구조 유지)
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const { error: tErr } = await sb.storage.from('design').upload(thumbPath, fileBuf, { contentType, upsert: false });
    if (tErr && tErr.message.indexOf('already exists') < 0) throw tErr;
    const { error: oErr } = await sb.storage.from('design').upload(origPath, fileBuf, { contentType, upsert: false });
    if (oErr && oErr.message.indexOf('already exists') < 0) throw oErr;

    const thumbUrl = sb.storage.from('design').getPublicUrl(thumbPath).data.publicUrl;
    const origUrl = sb.storage.from('design').getPublicUrl(origPath).data.publicUrl;

    const author = pick(DESIGNER_POOL);
    const name = makeName(catCode, idx);
    const desc = pick(DESC_POOL);

    const { error: insErr } = await sb.from('user_patterns').insert({
        name,
        category: catCode,
        author,
        description: desc,
        thumb_url: thumbUrl,
        original_url: origUrl,
        mockup_urls: [],  // 자동 생성 X (gallery는 thumb_url로 폴백)
        source: 'cotton-print.com',
        status: 'approved'  // 즉시 노출 (관리자 등록)
    });
    if (insErr) throw insErr;

    return name;
}

async function main() {
    const baseDir = path.join(__dirname, '패턴');
    let total = 0, ok = 0, fail = 0;
    const failures = [];

    for (const folder of Object.keys(CATEGORY_MAP)) {
        const catCode = CATEGORY_MAP[folder];
        const dir = path.join(baseDir, folder);
        if (!fs.existsSync(dir)) { console.log(`[${folder}] folder not found, skip`); continue; }
        const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
        console.log(`\n=== [${folder} → ${catCode}] ${files.length} files ===`);

        for (let i = 0; i < files.length; i++) {
            total++;
            try {
                const name = await uploadOne(folder, catCode, files[i], i + 1);
                ok++;
                process.stdout.write(`  ${i+1}/${files.length} ✓ ${name}\n`);
            } catch (e) {
                fail++;
                failures.push({ folder, file: files[i], error: e.message });
                process.stdout.write(`  ${i+1}/${files.length} ✗ ${files[i]} — ${e.message}\n`);
            }
        }
    }

    console.log(`\n========== DONE ==========`);
    console.log(`Total: ${total}  Success: ${ok}  Failed: ${fail}`);
    if (failures.length) {
        console.log(`\nFailures:`);
        failures.slice(0, 10).forEach(f => console.log(`  - ${f.folder}/${f.file}: ${f.error}`));
        if (failures.length > 10) console.log(`  ... and ${failures.length - 10} more`);
    }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
