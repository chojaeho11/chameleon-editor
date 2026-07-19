import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * cleanup-old-files — 고객 업로드/주문 파일 자동 정리
 *
 * 2026-07-20 재작성 (사장님 요청: "3개월 지난 고객 주문 파일 자동 삭제")
 *   [이전 문제] 폴더를 하나씩 list() 로 훑는 방식이라 user_uploads/thumbs 등 특정 경로만 처리했고,
 *   실제로는 3개월 지난 파일이 2만 개 넘게 남아 있었다(수동 일괄 정리로 26GB 회수).
 *   [현재] storage.objects 를 직접 조회해 버킷 전체에서 기준일 이전 객체를 찾는다.
 *
 * 보호 규칙 (지우면 안 되는 것):
 *   - design_gallery 에 등록된 작품 이미지 — 고객 갤러리에 계속 노출되므로 제외
 *   - RETAIN_PREFIXES 경로 (템플릿/샘플 등 자산성 파일)
 *   - 보호 목록 조회에 실패하면 design 버킷은 아예 건드리지 않는다(안전 우선)
 */
serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const DAYS = 90;                 // 3개월
    const BUCKETS = ['customer_uploads', 'orders', 'design'];
    const MAX_PER_RUN = 1500;        // 실행시간 보호 — 남으면 다음 날 이어서 정리
    const RETAIN_PREFIXES = ['templates/', 'samples/', 'assets/'];

    const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
    const log: string[] = [];

    // ── 보호 목록: 갤러리에 노출 중인 이미지 경로 ──────────────────────
    const protectedPaths = new Set<string>();
    try {
      const { data: gal, error: galErr } = await supabase
        .from('design_gallery').select('image_url,thumb_url');
      if (galErr) throw galErr;
      for (const g of (gal || [])) {
        for (const u of [g.image_url, g.thumb_url]) {
          if (!u) continue;
          const m = String(u).match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
          if (m) protectedPaths.add(decodeURIComponent(m[1]));
        }
      }
      log.push(`🛡️ 갤러리 보호 대상 ${protectedPaths.size}개`);
    } catch (e) {
      log.push(`⚠️ 갤러리 보호목록 조회 실패 → design 버킷 건너뜀: ${e.message}`);
      const i = BUCKETS.indexOf('design');
      if (i >= 0) BUCKETS.splice(i, 1);
    }

    // ── 버킷별 기준일 경과 객체 삭제 ────────────────────────────────
    const deleted: Record<string, number> = {};
    for (const bucket of BUCKETS) {
      deleted[bucket] = 0;
      // 2026-07-20: PostgREST 는 storage 스키마를 노출하지 않아(.schema('storage') 불가)
      //   public.list_old_storage_objects RPC(SECURITY DEFINER, service_role 전용)로 조회한다.
      const { data: rows, error } = await supabase.rpc('list_old_storage_objects', {
        p_bucket: bucket, p_cutoff: cutoff, p_limit: MAX_PER_RUN,
      });

      if (error) { log.push(`❌ ${bucket} 조회 실패: ${error.message}`); continue; }

      const paths = (rows || [])
        .map((r: any) => r.name as string)
        .filter((p) => p && !protectedPaths.has(p) && !RETAIN_PREFIXES.some((pre) => p.startsWith(pre)));

      for (let i = 0; i < paths.length; i += 100) {
        const batch = paths.slice(i, i + 100);
        const { error: delErr } = await supabase.storage.from(bucket).remove(batch);
        if (delErr) log.push(`⚠️ ${bucket} 삭제 실패(${i}): ${delErr.message}`);
        else deleted[bucket] += batch.length;
      }
      log.push(`🗑️ ${bucket}: ${deleted[bucket]}개 삭제 (조회 ${rows?.length ?? 0}개)`);
    }

    // ── 주문 레코드의 files 배열 비우기 (파일이 사라졌으니 링크도 정리) ──
    //   2026-07-20: 건별 UPDATE 루프는 1000건이면 150초 제한을 넘겨 함수가 죽었다 → 한 번의 UPDATE 로.
    let cleanedOrders = 0;
    try {
      const { data: upd, error: updErr } = await supabase
        .from('orders')
        .update({ files: [] })
        .lt('created_at', cutoff)
        .not('files', 'is', null)
        .select('id');
      if (updErr) throw updErr;
      cleanedOrders = (upd || []).length;
      log.push(`📦 주문 files 정리: ${cleanedOrders}건`);
    } catch (e) {
      log.push(`⚠️ 주문 files 정리 실패: ${e.message}`);
    }

    const summary = {
      success: true,
      cutoff_date: cutoff,
      retention_days: DAYS,
      results: { deleted, orders_cleaned: cleanedOrders },
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
