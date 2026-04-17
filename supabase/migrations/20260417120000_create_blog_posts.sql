-- ============================================================
-- Blog Posts: separate table for board.html blog/review/etc.
-- Previously the code reused community_posts which is owned by
-- community.html (local-community group posts) and does not have
-- author_name / view_count / thumbnail / rating / country_code /
-- category / target_code / markdown columns.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL DEFAULT 'blog',
    country_code text NOT NULL DEFAULT 'KR',
    target_code text,
    title text,
    content text,
    thumbnail text,
    rating integer,
    view_count integer DEFAULT 0,
    author_id uuid,
    author_name text,
    author_email text,
    markdown text,
    created_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.blog_posts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_blog_posts_category        ON public.blog_posts (category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_country_code    ON public.blog_posts (country_code);
CREATE INDEX IF NOT EXISTS idx_blog_posts_target_code     ON public.blog_posts (target_code);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at      ON public.blog_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_cat_country_cre ON public.blog_posts (category, country_code, created_at DESC);

-- View-count increment RPC used by board.html
CREATE OR REPLACE FUNCTION public.increment_view_count(post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE public.blog_posts
       SET view_count = COALESCE(view_count, 0) + 1
     WHERE id = post_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_view_count(uuid) TO anon, authenticated;
