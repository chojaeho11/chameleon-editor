// _backup.js — git push 시 자동 백업 (Supabase Storage)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const BUCKET = 'backups';

async function backup() {
    const projectDir = __dirname;

    // 1. 커밋 해시
    let hash = 'unknown';
    try {
        hash = execSync('git rev-parse --short HEAD', { cwd: projectDir }).toString().trim();
    } catch (e) {}

    // 2. 파일명 생성
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `backup_${dateStr}_${hash}.tar.gz`;
    const tmpFile = path.join(os.tmpdir(), filename);

    // 3. tar.gz 생성 (--force-local: Windows C: 경로를 원격호스트로 해석 방지)
    const tarCmd = `tar --force-local -czf "${tmpFile}" --exclude=node_modules --exclude=.git --exclude=.wrangler --exclude=nul --exclude=long/nul -C "${projectDir}" .`;
    try {
        execSync(tarCmd, { stdio: 'pipe', timeout: 30000 });
    } catch (e) {
        console.error('❌ tar failed:', e.message);
        return;
    }

    const fileBuffer = fs.readFileSync(tmpFile);
    const sizeKB = (fileBuffer.length / 1024).toFixed(0);
    console.log(`📦 Backup file: ${filename} (${sizeKB}KB)`);

    // 4. Supabase Storage 업로드
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { error } = await sb.storage.from(BUCKET).upload(filename, fileBuffer, {
        contentType: 'application/gzip',
        upsert: false
    });

    if (error) {
        console.error('❌ Upload failed:', error.message);
    } else {
        console.log(`✅ Backup uploaded: ${filename} (${sizeKB}KB)`);
    }

    // 5. 임시파일 삭제
    try { fs.unlinkSync(tmpFile); } catch (e) {}
}

backup().catch(err => {
    console.error('❌ Backup error:', err.message);
}).finally(() => {
    process.exit(0); // push 차단 안 함
});
