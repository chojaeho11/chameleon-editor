CREATE OR REPLACE FUNCTION public.check_indexes()
RETURNS json AS $$
  SELECT json_agg(row_to_json(r)) FROM (
    SELECT
      schemaname,
      tablename,
      indexname,
      pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname
  ) r;
$$ LANGUAGE sql SECURITY DEFINER;
