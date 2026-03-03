const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
    'https://qinvtnhiidtmrzosyvys.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
);

function isPng(d) {
    if (!d) return false;
    if (typeof d === 'string') {
        if (d.startsWith('data:image/png')) return true;
        if (d.startsWith('http') && d.toLowerCase().includes('.png')) return true;
        try {
            const j = JSON.parse(d);
            if (j.objects) return j.objects.some(o => o.src && (o.src.toLowerCase().includes('.png') || o.src.startsWith('data:image/png')));
        } catch(e) {}
    }
    if (typeof d === 'object' && d && d.objects) {
        return d.objects.some(o => o.src && (o.src.toLowerCase().includes('.png') || o.src.startsWith('data:image/png')));
    }
    return false;
}

async function processCategory(cat) {
    console.log(`\n--- Processing: ${cat} ---`);
    let page = 0;
    const ps = 200;
    let totalScanned = 0;
    let totalDeleted = 0;

    while (true) {
        const { data, error } = await sb
            .from('library')
            .select('id, data_url')
            .eq('category', cat)
            .order('id', { ascending: true })
            .range(page * ps, (page + 1) * ps - 1);

        if (error) { console.error(`  Query error p${page}:`, error.message); break; }
        if (!data || data.length === 0) break;

        totalScanned += data.length;
        const nonPng = data.filter(i => !isPng(i.data_url));

        if (nonPng.length > 0) {
            const ids = nonPng.map(i => i.id);
            for (let i = 0; i < ids.length; i += 20) {
                const batch = ids.slice(i, i + 20);
                const { error: delErr } = await sb.from('library').delete().in('id', batch);
                if (delErr) console.error(`  Delete failed:`, delErr.message);
                else totalDeleted += batch.length;
            }
        }

        console.log(`  page ${page}: scanned=${data.length}, deleted=${nonPng.length} (total: scanned=${totalScanned}, deleted=${totalDeleted})`);
        if (data.length < ps) break;
        page++;
    }

    console.log(`  DONE ${cat}: scanned=${totalScanned}, deleted=${totalDeleted}`);
    return { cat, totalScanned, totalDeleted };
}

async function main() {
    const categories = ['graphic', 'logo', 'vector', 'transparent-graphic', 'clip'];
    const results = [];
    for (const cat of categories) {
        const r = await processCategory(cat);
        results.push(r);
    }
    console.log('\n=== SUMMARY ===');
    for (const r of results) {
        console.log(`  ${r.cat}: scanned=${r.totalScanned}, deleted=${r.totalDeleted}`);
    }
    console.log('All done!');
}
main();
