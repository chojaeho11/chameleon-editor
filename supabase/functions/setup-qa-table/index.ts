import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

        await sql.end();
        return new Response(JSON.stringify({ status: "created" }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        await sql.end();
        return new Response(JSON.stringify({ status: "error", message: e.message }), {
            headers: { "Content-Type": "application/json" },
        });
    }
});
