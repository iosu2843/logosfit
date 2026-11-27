create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.app_state_backups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  source_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists app_state_backups_user_created_idx
  on public.app_state_backups (user_id, created_at desc, id desc);

alter table public.app_state_backups enable row level security;
revoke all on public.app_state_backups from public, anon, authenticated;
grant select on public.app_state_backups to authenticated;

drop policy if exists "Users read their own backups" on public.app_state_backups;
create policy "Users read their own backups"
  on public.app_state_backups for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.capture_app_state_backup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_user_id uuid;
  snapshot_data jsonb;
  snapshot_updated_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.data is not distinct from old.data then
      return new;
    end if;
    -- Preserve the state being replaced so restore and sync operations can't erase it.
    snapshot_user_id := old.user_id;
    snapshot_data := old.data;
    snapshot_updated_at := old.updated_at;
  else
    snapshot_user_id := new.user_id;
    snapshot_data := new.data;
    snapshot_updated_at := new.updated_at;
  end if;

  insert into public.app_state_backups (user_id, data, source_updated_at)
  values (snapshot_user_id, snapshot_data, coalesce(snapshot_updated_at, pg_catalog.now()));

  delete from public.app_state_backups b
  where b.user_id = snapshot_user_id
    and b.id not in (
      select recent.id
      from public.app_state_backups recent
      where recent.user_id = snapshot_user_id
      order by recent.created_at desc, recent.id desc
      offset 5
    );

  return new;
end;
$$;

create or replace function private.capture_new_user_initial_backup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.app_state_backups (user_id, data)
  values (new.id, '{"updatedAt":0,"items":{}}'::jsonb);
  return new;
end;
$$;

revoke all on function private.capture_app_state_backup() from public, anon, authenticated;
revoke all on function private.capture_new_user_initial_backup() from public, anon, authenticated;

drop trigger if exists app_state_capture_backup on public.app_state;
create trigger app_state_capture_backup
  after insert or update on public.app_state
  for each row execute function private.capture_app_state_backup();

drop trigger if exists auth_user_initial_backup on auth.users;
create trigger auth_user_initial_backup
  after insert on auth.users
  for each row execute function private.capture_new_user_initial_backup();

-- Create an initial backup for every account already present. The app_state
-- rows are only read; no existing user data is modified.
insert into public.app_state_backups (user_id, data, source_updated_at)
select u.id,
       coalesce(s.data, '{"updatedAt":0,"items":{}}'::jsonb),
       coalesce(s.updated_at, u.created_at, pg_catalog.now())
from auth.users u
left join public.app_state s on s.user_id = u.id
where not exists (
  select 1
  from public.app_state_backups b
  where b.user_id = u.id
);

-- Retain only the five most recent snapshots for each account.
delete from public.app_state_backups b
where b.id not in (
  select ranked.id
  from (
    select id,
           row_number() over (partition by user_id order by created_at desc, id desc) as position
    from public.app_state_backups
  ) ranked
  where ranked.position <= 5
);
