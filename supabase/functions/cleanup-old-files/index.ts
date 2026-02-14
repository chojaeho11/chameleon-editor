import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const DAYS = 30; // 30일 경과 기준
    const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
    const log: string[] = [];

    // ─────────────────────────────────────────────
    // 1. 오래된 주문의 Storage 파일 정리
    // ─────────────────────────────────────────────
    const { data: oldOrders, error: orderErr } = await supabase
      .from('orders')
      .select('id, files, created_at')
      .lt('created_at', cutoff)
      .not('files', 'is', null);

    if (orderErr) {
      log.push(`❌ 주문 조회 실패: ${orderErr.message}`);
    }

    let deletedFiles = 0;
    let cleanedOrders = 0;

    for (const order of (oldOrders || [])) {
      const files = order.files;
      if (!Array.isArray(files) || files.length === 0) continue;

      const pathsToDelete: string[] = [];

      for (const f of files) {
        if (!f.url) continue;
        // URL에서 Storage path 추출
        // 형식: .../storage/v1/object/public/orders/customer_uploads/xxx.pdf
        const match = f.url.match(/\/storage\/v1\/object\/public\/orders\/(.+)/);
        if (match) {
          pathsToDelete.push(match[1]);
        }
      }

      if (pathsToDelete.length > 0) {
        // 한 번에 최대 100개씩 삭제
        for (let i = 0; i < pathsToDelete.length; i += 100) {
          const batch = pathsToDelete.slice(i, i + 100);
          const { error: delErr } = await supabase.storage
            .from('orders')
            .remove(batch);
          if (delErr) {
            log.push(`⚠️ 주문#${order.id} 파일 삭제 실패: ${delErr.message}`);
          } else {
            deletedFiles += batch.length;
          }
        }

        // 주문의 files 배열 비우기
        await supabase.from('orders').update({ files: [] }).eq('id', order.id);
        cleanedOrders++;
      }
    }

    log.push(`📦 주문 정리: ${cleanedOrders}건, 파일 ${deletedFiles}개 삭제`);

    // ─────────────────────────────────────────────
    // 2. customer_uploads 폴더 - 오래된 파일 직접 정리
    //    (주문과 연결되지 않은 고아 파일 포함)
    // ─────────────────────────────────────────────
    let orphanDeleted = 0;
    const folders = ['customer_uploads', 'thumbs'];

    for (const folder of folders) {
      let offset = 0;
      const BATCH = 100;

      while (true) {
        const { data: fileList, error: listErr } = await supabase.storage
          .from('orders')
          .list(folder, { limit: BATCH, offset, sortBy: { column: 'created_at', order: 'asc' } });

        if (listErr || !fileList || fileList.length === 0) break;

        const toDelete: string[] = [];
        for (const file of fileList) {
          if (file.created_at && new Date(file.created_at) < new Date(cutoff)) {
            toDelete.push(`${folder}/${file.name}`);
          }
        }

        if (toDelete.length > 0) {
          const { error: delErr } = await supabase.storage
            .from('orders')
            .remove(toDelete);
          if (!delErr) orphanDeleted += toDelete.length;
        }

        // 삭제하면 offset 조정 불필요 (파일이 줄어들므로)
        // 삭제 안 한 파일이 있으면 offset 이동
        if (toDelete.length < fileList.length) {
          offset += (fileList.length - toDelete.length);
        }

        // 마지막 배치가 limit보다 적으면 종료
        if (fileList.length < BATCH) break;
      }
    }

    log.push(`🗑️ 고아 파일 정리: ${orphanDeleted}개 삭제 (customer_uploads + thumbs)`);

    // ─────────────────────────────────────────────
    // 3. chat-files 버킷 정리
    // ─────────────────────────────────────────────
    let chatDeleted = 0;
    let chatOffset = 0;

    while (true) {
      const { data: chatFiles, error: chatErr } = await supabase.storage
        .from('chat-files')
        .list('', { limit: 100, offset: chatOffset, sortBy: { column: 'created_at', order: 'asc' } });

      if (chatErr || !chatFiles || chatFiles.length === 0) break;

      const toDelete: string[] = [];
      for (const file of chatFiles) {
        if (file.created_at && new Date(file.created_at) < new Date(cutoff)) {
          toDelete.push(file.name);
        }
      }

      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.storage
          .from('chat-files')
          .remove(toDelete);
        if (!delErr) chatDeleted += toDelete.length;
      }

      if (toDelete.length < chatFiles.length) {
        chatOffset += (chatFiles.length - toDelete.length);
      }

      if (chatFiles.length < 100) break;
    }

    log.push(`💬 chat-files 정리: ${chatDeleted}개 삭제`);

    // ─────────────────────────────────────────────
    // 4. design/user_uploads 버킷 정리
    // ─────────────────────────────────────────────
    let designDeleted = 0;

    // user_uploads 하위 폴더(userId)를 순회
    const { data: userFolders } = await supabase.storage
      .from('design')
      .list('user_uploads', { limit: 1000 });

    for (const userFolder of (userFolders || [])) {
      if (!userFolder.id) {
        // 폴더인 경우 (id가 null)
        const { data: userFiles } = await supabase.storage
          .from('design')
          .list(`user_uploads/${userFolder.name}`, { limit: 1000 });

        const toDelete: string[] = [];
        for (const file of (userFiles || [])) {
          if (file.created_at && new Date(file.created_at) < new Date(cutoff)) {
            toDelete.push(`user_uploads/${userFolder.name}/${file.name}`);
          }
        }

        if (toDelete.length > 0) {
          const { error: delErr } = await supabase.storage
            .from('design')
            .remove(toDelete);
          if (!delErr) designDeleted += toDelete.length;
        }
      }
    }

    log.push(`🎨 design/user_uploads 정리: ${designDeleted}개 삭제`);

    // ─────────────────────────────────────────────
    // 결과 반환
    // ─────────────────────────────────────────────
    const summary = {
      success: true,
      cutoff_date: cutoff,
      results: {
        orders_cleaned: cleanedOrders,
        order_files_deleted: deletedFiles,
        orphan_files_deleted: orphanDeleted,
        chat_files_deleted: chatDeleted,
        design_files_deleted: designDeleted,
      },
      log,
    };

    console.log(JSON.stringify(summary));

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('cleanup error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
