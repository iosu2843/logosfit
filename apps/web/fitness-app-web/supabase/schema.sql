-- Run once in the Supabase SQL editor.
create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "Users read their own state"
  on public.app_state for select
  using (auth.uid() = user_id);

create policy "Users insert their own state"
  on public.app_state for insert
  with check (auth.uid() = user_id);

create policy "Users update their own state"
  on public.app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete their own state"
  on public.app_state for delete
  using (auth.uid() = user_id);
