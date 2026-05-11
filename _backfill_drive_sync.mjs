// 누락된 주문 일괄 Drive 동기화 backfill
//
// 동작:
//   1. orders 테이블에서 status='접수됨' 또는 payment_status='결제완료'인 주문 모두 조회
//   2. 각 주문에 대해 sync-order-to-drive Edge Function 호출 (멱등성 있어 안전)
//   3. 이미 동기화된 폴더는 자동 스킵, 누락만 새로 생성
//
// 사용법:
//   node _backfill_drive_sync.mjs              (전체)
//   node _backfill_drive_sync.mjs --days 30    (최근 30일만)
//   node _backfill_drive_sync.mjs --dry        (확인만, 호출 안 함)

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

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const daysIdx = args.indexOf('--days');
const DAYS = daysIdx >= 0 ? parseInt(args[daysIdx + 1], 10) : null;

async function callSync(orderId) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-order-to-drive`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify({ order_id: String(orderId) }),
    });
    return r.json();
}

async function main() {
    console.log('▶ Drive backfill 시작');
    console.log('  Mode:', DRY ? 'DRY RUN' : 'APPLY');
    if (DAYS) console.log(`  최근 ${DAYS}일치만`);

    let q = sb.from('orders')
        .select('id, manager_name, order_date, status, payment_status, created_at')
        // 임시작성/미결제 제외 (Edge Function이 어차피 스킵하지만 호출 비용 절약)
        .neq('status', '임시작성')
        .order('created_at', { ascending: false });

    if (DAYS) {
        const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte('created_at', cutoff);
    }

    const { data, error } = await q.limit(2000);
    if (error) { console.error('주문 조회 실패:', error.message); process.exit(1); }

    console.log(`\n  대상 주문: ${data.length}건`);

    if (DRY) {
        console.log('\n(dry) 첫 10건 미리보기:');
        data.slice(0, 10).forEach(o =>
            console.log(`   #${o.id}  ${o.manager_name || '-'}  ${o.status}/${o.payment_status}  ${(o.order_date || o.created_at || '').slice(0,10)}`)
        );
        return;
    }

    let ok = 0, skipped = 0, fail = 0;
    for (let i = 0; i < data.length; i++) {
        const o = data[i];
        try {
            const res = await callSync(o.id);
            if (res?.skipped) { skipped++; }
            else if (res?.ok) { ok++; }
            else { fail++; console.warn(`  ✗ #${o.id}: ${JSON.stringify(res).slice(0,120)}`); }
        } catch (e) {
            fail++;
            console.warn(`  ✗ #${o.id}: ${e.message}`);
        }
        if ((i + 1) % 10 === 0 || i === data.length - 1) {
            process.stdout.write(`  ${i+1}/${data.length}  생성:${ok}  이미동기화:${skipped}  실패:${fail}\r`);
        }
        // Edge Function rate-limit 보호 — 약간 텀
        await new Promise(r => setTimeout(r, 250));
    }

    console.log(`\n\n========== DONE ==========`);
    console.log(`총: ${data.length}  생성: ${ok}  이미동기화: ${skipped}  실패: ${fail}`);
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });
