// Detect blank/white patterns by analyzing pixel content
// Usage: node detect_blank_patterns.mjs        # dry run
//        node detect_blank_patterns.mjs --delete  # delete from DB
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const DELETE = process.argv.includes('--delete');

// Resize to 64×64 grayscale, count "near-white" pixels (>240)
// If >85% pixels are near-white → blank
async function isBlank(url) {
    try {
        const r = await fetch(url);
        if (!r.ok) return { blank: false, err: 'fetch ' + r.status };
        const buf = Buffer.from(await r.arrayBuffer());
        const { data, info } = await sharp(buf)
            .resize(64, 64, { fit: 'cover' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
        let whiteCount = 0;
        const total = info.width * info.height;
        for (let i = 0; i < data.length; i++) {
            if (data[i] > 240) whiteCount++;
        }
        const whiteRatio = whiteCount / total;
        // also check standard deviation — uniform color = blank
        let mean = 0;
        for (let i = 0; i < data.length; i++) mean += data[i];
        mean /= data.length;
        let variance = 0;
        for (let i = 0; i < data.length; i++) variance += (data[i] - mean) ** 2;
        const stdev = Math.sqrt(variance / data.length);
        return { blank: whiteRatio > 0.85 || stdev < 8, whiteRatio, stdev: stdev.toFixed(1), mean: mean.toFixed(0) };
    } catch (e) {
        return { blank: false, err: e.message };
    }
}

async function main() {
    const { data, error } = await sb.from('user_patterns').select('id, name, category, thumb_url, original_url').eq('status', 'approved');
    if (error) throw error;
    console.log(`Analyzing ${data.length} patterns...\n`);

    const broken = [];
    let ok = 0;
    for (let i = 0; i < data.length; i++) {
        const p = data[i];
        const r = await isBlank(p.thumb_url);
        if (r.err) console.log(`? [${i+1}] ${p.name}: ${r.err}`);
        else if (r.blank) {
            broken.push(p);
            console.log(`✗ [${i+1}/${data.length}] ${p.category}/${p.name} — white:${(r.whiteRatio*100).toFixed(0)}% stdev:${r.stdev}`);
        } else {
            ok++;
        }
    }
    console.log(`\n=== Result ===\nGood: ${ok}\nBlank: ${broken.length}`);

    if (broken.length === 0) return;

    if (DELETE) {
        console.log(`\nDeleting ${broken.length} blank patterns from DB + Storage...`);
        // 1) DB rows
        for (let i = 0; i < broken.length; i += 50) {
            const ids = broken.slice(i, i+50).map(b => b.id);
            await sb.from('user_patterns').delete().in('id', ids);
        }
        // 2) Storage files (extract path from URL)
        const paths = [];
        broken.forEach(b => {
            [b.thumb_url, b.original_url].forEach(url => {
                if (!url) return;
                const m = url.match(/\/design\/(patterns\/(?:thumb|original)\/[^?]+)/);
                if (m) paths.push(m[1]);
            });
        });
        for (let i = 0; i < paths.length; i += 50) {
            const chunk = paths.slice(i, i+50);
            await sb.storage.from('design').remove(chunk);
        }
        console.log(`Deleted ${broken.length} rows + ${paths.length} files.`);
    } else {
        console.log(`\nRun with --delete to remove these:\n  node detect_blank_patterns.mjs --delete`);
    }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
