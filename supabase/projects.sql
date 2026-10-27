-- Project metadata for the multi-project control plane. Safe to re-run: every statement is idempotent.
-- Run in the Supabase SQL editor. Existing RLS policies on public.projects already cover the new columns.

alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists icon        text;
alter table public.projects add column if not exists is_public   boolean not null default true;
alter table public.projects add column if not exists github_url  text;
alter table public.projects add column if not exists live_url    text;
alter table public.projects add column if not exists functions      text[];
alter table public.projects add column if not exists frontend_stack text;
alter table public.projects add column if not exists backend_stack  text;
