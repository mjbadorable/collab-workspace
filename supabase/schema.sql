-- collab-workspace: initial schema
-- Run in the Supabase SQL editor (or `supabase db push`) on a fresh database.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member' check (role in ('admin', 'member')),
  joined_at     timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  identifier    text not null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (workspace_id, identifier)
);

create table public.work_items (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'backlog' check (status in ('backlog', 'in_progress', 'done')),
  priority     text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee_id  uuid references auth.users(id) on delete set null,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table public.diagrams (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('flowchart', 'erd')),
  nodes       jsonb not null default '[]'::jsonb,
  edges       jsonb not null default '[]'::jsonb,
  deleted_at  timestamptz,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes

create index workspace_members_user_idx on public.workspace_members (user_id);
create index projects_workspace_idx     on public.projects (workspace_id);
create index work_items_project_idx     on public.work_items (project_id);
create index diagrams_project_idx       on public.diagrams (project_id);

-- ---------------------------------------------------------------- updated_at triggers

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger diagrams_set_updated_at before update on public.diagrams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS helpers
-- SECURITY DEFINER so policies can check membership without recursing into
-- the RLS of workspace_members / projects.

create function public.is_workspace_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create function public.is_workspace_admin(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role = 'admin'
  );
$$;

create function public.project_workspace(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from public.projects where id = p;
$$;

revoke all on function public.is_workspace_member(uuid), public.is_workspace_admin(uuid),
  public.project_workspace(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid), public.is_workspace_admin(uuid),
  public.project_workspace(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects          enable row level security;
alter table public.work_items        enable row level security;
alter table public.diagrams          enable row level security;

-- workspaces: members read; admins update. Creation goes through create_workspace() below.
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

-- workspace_members: members see co-members; admins manage; anyone may leave.
create policy members_select on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));
create policy members_update on public.workspace_members for update to authenticated
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy members_delete on public.workspace_members for delete to authenticated
  using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

-- projects: members read/write. Soft-delete via deleted_at; no hard-delete policy.
create policy projects_select on public.projects for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
create policy projects_update on public.projects for update to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- work_items
create policy work_items_select on public.work_items for select to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)));
create policy work_items_insert on public.work_items for insert to authenticated
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy work_items_update on public.work_items for update to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));

-- diagrams
create policy diagrams_select on public.diagrams for select to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)));
create policy diagrams_insert on public.diagrams for insert to authenticated
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy diagrams_update on public.diagrams for update to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));

-- ---------------------------------------------------------------- bootstrap RPC
-- Creates a workspace and makes the caller its admin in one atomic step
-- (a plain INSERT cannot pass the members policy before any member exists).

create function public.create_workspace(ws_name text, ws_slug text) returns public.workspaces
language plpgsql security definer set search_path = public as $$
declare
  ws public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.workspaces (name, slug) values (ws_name, ws_slug) returning * into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws.id, auth.uid(), 'admin');
  return ws;
end;
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;
