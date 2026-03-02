import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

serve(async (req) => {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
        return new Response(JSON.stringify({ error: "No DB URL" }), { status: 500 });
    }

    const sql = postgres(dbUrl, { max: 1 });

    try {
        await sql`
            CREATE TABLE IF NOT EXISTS public.advisor_qa_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at TIMESTAMPTZ DEFAULT now(),
                lang TEXT DEFAULT 'kr',
                customer_message TEXT NOT NULL,
                ai_response TEXT,
                products_recommended JSONB,
                has_image BOOLEAN DEFAULT false,
                admin_answer TEXT,
                is_reviewed BOOLEAN DEFAULT false,
                reviewed_at TIMESTAMPTZ,
                category TEXT DEFAULT 'general',
                is_active BOOLEAN DEFAULT true
            )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_qa_log_created ON public.advisor_qa_log(created_at DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_qa_log_reviewed ON public.advisor_qa_log(is_reviewed, is_active)`;

        // Grant access — service_role만 INSERT 가능, anon은 SELECT만
        await sql`GRANT ALL ON public.advisor_qa_log TO service_role`;
        await sql`GRANT SELECT ON public.advisor_qa_log TO anon`;
        await sql`REVOKE INSERT, UPDATE, DELETE ON public.advisor_qa_log FROM anon`;

        // 인덱스: reviewed_at 포함하여 Q&A 학습 쿼리 최적화
        await sql`DROP INDEX IF EXISTS idx_qa_log_reviewed`;
        await sql`CREATE INDEX IF NOT EXISTS idx_qa_log_reviewed ON public.advisor_qa_log(is_reviewed, is_active, reviewed_at DESC)`;

        // 학습 시스템용 번역 캐시 컬럼
        await sql`ALTER TABLE public.advisor_qa_log ADD COLUMN IF NOT EXISTS customer_message_ko TEXT`;
        await sql`ALTER TABLE public.advisor_qa_log ADD COLUMN IF NOT EXISTS admin_answer_ko TEXT`;

        // chat_rooms에 사이트 언어 컬럼 추가 (해외몰 구분용)
        await sql`ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS site_lang TEXT DEFAULT 'kr'`;

        // Storage RLS 정책: chat-files 버킷 업로드/다운로드 허용
        try {
            await sql`DROP POLICY IF EXISTS "chat-files-insert" ON storage.objects`;
            await sql`DROP POLICY IF EXISTS "chat-files-select" ON storage.objects`;
            await sql`DROP POLICY IF EXISTS "chat-files-update" ON storage.objects`;
            await sql`CREATE POLICY "chat-files-insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'chat-files')`;
            await sql`CREATE POLICY "chat-files-select" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'chat-files')`;
            await sql`CREATE POLICY "chat-files-update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'chat-files')`;
        } catch(pe) { console.log('Policy error (may already exist):', pe.message); }

        await sql.end();

        // Storage: chat-files 버킷 생성 (service_role key 사용)
        const supaUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supaUrl, serviceKey);

        // 버킷 존재 확인
        const { data: buckets } = await sb.storage.listBuckets();
        const exists = buckets?.some((b: any) => b.id === 'chat-files');
        let storageMsg = 'bucket already exists';

        if (!exists) {
            const { error: createErr } = await sb.storage.createBucket('chat-files', {
                public: true,
                fileSizeLimit: 52428800, // 50MB
            });
            storageMsg = createErr ? 'bucket create error: ' + createErr.message : 'bucket created';
        }

        return new Response(JSON.stringify({ status: "created", storage: storageMsg }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        await sql.end();
        return new Response(JSON.stringify({ status: "error", message: e.message }), {
            headers: { "Content-Type": "application/json" },
        });
    }
});
