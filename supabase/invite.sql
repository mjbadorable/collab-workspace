-- collab-workspace: teammate invites
-- Run in the Supabase SQL editor after schema.sql. Safe to re-run.
--
-- Clients cannot read auth.users, so both functions are SECURITY DEFINER:
--   invite_workspace_member  admins add an already-registered user to a workspace by email
--   list_workspace_members   members see who is in a workspace, with emails

-- ---------------------------------------------------------------- invite

create or replace function public.invite_workspace_member(ws_id uuid, invite_email text, member_role text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_workspace_admin(ws_id) then
    raise exception 'not_authorized';
  end if;
  if member_role not in ('admin', 'member') then
    raise exception 'invalid_role';
  end if;

  select id into target from auth.users where lower(email) = lower(trim(invite_email)) limit 1;
  if target is null then
    raise exception 'user_not_found';
  end if;

  if exists (select 1 from public.workspace_members where workspace_id = ws_id and user_id = target) then
    raise exception 'already_member';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, target, member_role);
end;
$$;

revoke all on function public.invite_workspace_member(uuid, text, text) from public, anon;
grant execute on function public.invite_workspace_member(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- member list

create or replace function public.list_workspace_members(ws_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_workspace_member(ws_id) then
    raise exception 'not_authorized';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.joined_at
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = ws_id
    order by m.joined_at;
end;
$$;

revoke all on function public.list_workspace_members(uuid) from public, anon;
grant execute on function public.list_workspace_members(uuid) to authenticated;
