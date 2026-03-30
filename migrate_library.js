/**
 * Library data_url Migration Script
 *
 * DB에 저장된 Fabric.js JSON을 Supabase Storage로 옮기고
 * DB에는 Storage URL만 저장합니다.
 *
 * 관리자 페이지(global_admin) 브라우저 Console에서 실행하세요.
 *
 * 사용법:
 *   1. www.cafe2626.com/global_admin 접속 (관리자 로그인 필수)
 *   2. F12 → Console
 *   3. 이 파일 내용을 붙여넣기 → Enter
 */

(async function migrateLibraryDataUrl() {
    const BATCH_SIZE = 20;       // 한 번에 처리할 행 수
    const BUCKET = 'design';     // Storage 버킷
    const FOLDER = 'library';    // Storage 폴더
    const sb = window.sb;

    if (!sb) { console.error('❌ window.sb 없음. 관리자 페이지에서 실행하세요.'); return; }

    // 1. 마이그레이션 대상 카운트 (data_url이 JSON인 행 = '{'로 시작)
    console.log('📊 마이그레이션 대상 확인 중...');

    let totalMigrated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let hasMore = true;

    while (hasMore) {
        // data_url이 '{'로 시작하는 행만 선택 (JSON 데이터) — 이미 URL인 행은 건너뜀
        const { data: rows, error } = await sb
            .from('library')
            .select('id, data_url, category')
            .like('data_url', '{%')
            .order('id', { ascending: true })
            .limit(BATCH_SIZE);

        if (error) {
            console.error('❌ 쿼리 실패:', error.message);
            break;
        }

        if (!rows || rows.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`\n⏳ 배치 처리 중... (${rows.length}건, 시작 ID: ${rows[0].id})`);

        for (const row of rows) {
            try {
                const jsonStr = typeof row.data_url === 'string'
                    ? row.data_url
                    : JSON.stringify(row.data_url);

                // JSON 유효성 확인
                JSON.parse(jsonStr);

                // Storage에 업로드
                const path = `${FOLDER}/${row.id}.json`;
                const blob = new Blob([jsonStr], { type: 'application/json' });

                const { error: upErr } = await sb.storage
                    .from(BUCKET)
                    .upload(path, blob, { upsert: true });

                if (upErr) {
                    console.warn(`⚠️ ID ${row.id} 업로드 실패:`, upErr.message);
                    totalFailed++;
                    continue;
                }

                // Public URL 가져오기
                const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(path);
                const publicUrl = urlData.publicUrl;

                // DB 업데이트 — data_url을 Storage URL로 교체
                const { error: updateErr } = await sb
                    .from('library')
                    .update({ data_url: publicUrl })
                    .eq('id', row.id);

                if (updateErr) {
                    console.warn(`⚠️ ID ${row.id} DB 업데이트 실패:`, updateErr.message);
                    totalFailed++;
                    continue;
                }

                totalMigrated++;
            } catch (e) {
                console.warn(`⚠️ ID ${row.id} 처리 실패:`, e.message);
                totalFailed++;
            }
        }

        console.log(`✅ 진행: 마이그레이션 ${totalMigrated}건 | 실패 ${totalFailed}건`);

        // 속도 조절 (Supabase rate limit 방지)
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n' + '='.repeat(50));
    console.log(`🎉 마이그레이션 완료!`);
    console.log(`   ✅ 성공: ${totalMigrated}건`);
    console.log(`   ❌ 실패: ${totalFailed}건`);
    console.log(`   ⏭️ 스킵(이미 URL): ${totalSkipped}건`);
    console.log('='.repeat(50));
    console.log('\n💡 완료 후 VACUUM FULL library; 를 SQL Editor에서 실행하면 디스크가 회수됩니다.');
})();
