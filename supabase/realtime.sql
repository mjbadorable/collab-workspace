-- Enables Supabase Realtime (postgres_changes) for work items. Run once in the SQL editor; safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'work_items'
  ) then
    alter publication supabase_realtime add table public.work_items;
  end if;
end $$;
