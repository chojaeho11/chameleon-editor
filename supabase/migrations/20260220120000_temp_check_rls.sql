CREATE OR REPLACE FUNCTION public.check_all_policies()
RETURNS json AS $$
  SELECT json_agg(row_to_json(r)) FROM (
    SELECT 
      tablename,
      policyname,
      permissive,
      roles::text,
      cmd,
      substring(qual::text, 1, 100) AS using_expr,
      substring(with_check::text, 1, 100) AS check_expr
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  ) r;
$$ LANGUAGE sql SECURITY DEFINER;
