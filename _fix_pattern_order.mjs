// user_patterns 정렬 보정
//   - 시드 스크립트가 library를 created_at DESC로 받아 그 순서대로 INSERT한 결과,
//     가장 최신 library 자산이 가장 이른 created_at을 갖게 되어 갤러리에서 역순 노출됨.
//   - thumb_url로 library row를 찾아 created_at을 복사 → 정렬이 library와 동일해짐.
//
// 사용법:
//   node _fix_pattern_order.mjs        (실제 적용)
//   node _fix_pattern_order.mjs --dry  (확인만)

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const DRY = process.argv.includes('--dry');

async function main() {
    console.log('▶ user_patterns 정렬 보정 시작');
    console.log('  Mode:', DRY ? 'DRY RUN' : 'APPLY');

    // 1) library: thumb_url(또는 data_url) → created_at 맵 만들기
    console.log('\n▶ library 인덱스 구축 중...');
    const urlToTime = new Map();
    let from = 0; const STEP = 1000;
    while (true) {
        const { data, error } = await sb.from('library')
            .select('thumb_url, data_url, created_at')
            .eq('category', 'graphic')
            .order('created_at', { ascending: false })
            .range(from, from + STEP - 1);
        if (error) { console.error('library 쿼리 실패:', error.message); process.exit(1); }
        if (!data || data.length === 0) break;
        data.forEach(r => {
            if (r.thumb_url) urlToTime.set(r.thumb_url, r.created_at);
            if (r.data_url)  urlToTime.set(r.data_url,  r.created_at);
        });
        if (data.length < STEP) break;
        from += STEP;
    }
    console.log(`  ✓ library URL ${urlToTime.size}개 인덱싱`);

    // 2) user_patterns 전체 로드
    console.log('\n▶ user_patterns 로드 중...');
    let pats = [];
    from = 0;
    while (true) {
        const { data, error } = await sb.from('user_patterns')
            .select('id, thumb_url, original_url, created_at')
            .eq('source', 'editor-library')
            .order('id', { ascending: true })
            .range(from, from + STEP - 1);
        if (error) { console.error('user_patterns 쿼리 실패:', error.message); process.exit(1); }
        if (!data || data.length === 0) break;
        pats = pats.concat(data);
        if (data.length < STEP) break;
        from += STEP;
    }
    console.log(`  ✓ user_patterns ${pats.length}건 (source='editor-library')`);

    // 3) 각 row의 새 created_at 결정
    const updates = [];
    let unmatched = 0;
    pats.forEach(p => {
        const newTs = urlToTime.get(p.thumb_url) || urlToTime.get(p.original_url);
        if (!newTs) { unmatched++; return; }
        if (newTs !== p.created_at) updates.push({ id: p.id, created_at: newTs });
    });
    console.log(`  · 매칭 실패(URL 미일치): ${unmatched}건`);
    console.log(`  · 업데이트 필요: ${updates.length}건`);

    if (DRY) {
        console.log('\n(dry) 샘플 5건:');
        updates.slice(0, 5).forEach(u => console.log(`   ${u.id} → ${u.created_at}`));
        return;
    }

    // 4) 배치 업데이트 — PostgREST는 다중 row 단일 SQL 업데이트가 안 되므로 개별 UPDATE
    console.log('\n▶ created_at 업데이트 중...');
    let ok = 0, fail = 0;
    const CONC = 8;  // 동시 처리량
    for (let i = 0; i < updates.length; i += CONC) {
        const batch = updates.slice(i, i + CONC);
        const results = await Promise.all(batch.map(u =>
            sb.from('user_patterns').update({ created_at: u.created_at }).eq('id', u.id).select('id')
        ));
        results.forEach(r => {
            if (r.error) { fail++; console.error('  ✗', r.error.message); }
            else { ok++; }
        });
        if (ok % 200 === 0 || i + CONC >= updates.length) {
            process.stdout.write(`  ${ok}/${updates.length} 완료\r`);
        }
    }
    console.log(`\n\n========== DONE ==========`);
    console.log(`성공: ${ok}  실패: ${fail}`);
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });
