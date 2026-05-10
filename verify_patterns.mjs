// Verify all uploaded patterns: HEAD-check thumb URL + delete broken rows
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const DELETE = process.argv.includes('--delete');

async function checkUrl(url) {
    try {
        const r = await fetch(url);
        const ct = r.headers.get('content-type') || '';
        if (!r.ok) return { ok: false, status: r.status, type: ct, size: 0 };
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const size = bytes.length;
        // Magic bytes: JPEG=FFD8FF, PNG=89504E47, GIF=474946, WEBP=52494646...57454250
        let format = 'unknown';
        if (size >= 3 && bytes[0]===0xFF && bytes[1]===0xD8 && bytes[2]===0xFF) format = 'jpeg';
        else if (size >= 4 && bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4E && bytes[3]===0x47) format = 'png';
        else if (size >= 4 && bytes[0]===0x47 && bytes[1]===0x49 && bytes[2]===0x46) format = 'gif';
        else if (size >= 12 && bytes[0]===0x52 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x46 && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50) format = 'webp';
        return { ok: true, status: r.status, type: ct, size, format };
    } catch (e) {
        return { ok: false, status: 0, error: e.message };
    }
}

async function main() {
    const { data, error } = await sb.from('user_patterns').select('id, name, category, thumb_url').eq('status', 'approved');
    if (error) { console.error(error); return; }
    console.log(`Checking ${data.length} approved patterns...\n`);

    const broken = [];
    let ok = 0;
    for (let i = 0; i < data.length; i++) {
        const p = data[i];
        const r = await checkUrl(p.thumb_url);
        // 200 + valid image format + reasonable size
        const validFormat = ['jpeg','png','gif','webp'].includes(r.format);
        const sizeOk = r.size > 1024;
        const allGood = r.ok && validFormat && sizeOk;
        if (allGood) { ok++; }
        else {
            broken.push({ id: p.id, name: p.name, category: p.category, url: p.thumb_url, status: r.status, size: r.size, type: r.type, format: r.format, err: r.error });
            console.log(`✗ [${i+1}/${data.length}] ${p.category}/${p.name} — status:${r.status} type:${r.type} format:${r.format} size:${r.size}`);
        }
        if ((i+1) % 25 === 0) process.stdout.write(`  ...${i+1} checked, ${broken.length} broken so far\n`);
    }
    console.log(`\n=== Result ===\nOK: ${ok}\nBroken: ${broken.length}`);

    if (broken.length === 0) return;

    if (DELETE) {
        console.log(`\nDeleting ${broken.length} broken rows...`);
        const ids = broken.map(b => b.id);
        // chunk to 50
        for (let i = 0; i < ids.length; i += 50) {
            const chunk = ids.slice(i, i+50);
            const { error: dErr } = await sb.from('user_patterns').delete().in('id', chunk);
            if (dErr) console.error('delete error:', dErr.message);
        }
        console.log('Done. Deleted broken rows.');
    } else {
        console.log(`\nRun with --delete to remove these from DB:`);
        console.log(`  node verify_patterns.mjs --delete`);
    }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
