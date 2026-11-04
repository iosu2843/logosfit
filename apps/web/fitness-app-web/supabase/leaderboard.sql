-- LOGOSFIT · Clasificación online. Ejecutar UNA vez en el SQL editor de Supabase (después de schema.sql).
-- Los clientes no escriben directamente en estas tablas: solo mediante las funciones RPC, que validan y auditan.

create table if not exists public.public_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  friend_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  visibility text not null default 'private' check (visibility in ('private', 'friends', 'public')),
  hide_rankings boolean not null default false,
  logos integer not null default 0 check (logos between 0 and 10000),
  muscles jsonb not null default '{}'::jsonb,
  flagged boolean not null default false,
  submitted_at timestamptz not null default now(),
  daily_baseline integer not null default 0,
  daily_baseline_at timestamptz not null default now()
);

create table if not exists public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

create table if not exists public.score_reports (
  reporter uuid not null references auth.users (id) on delete cascade,
  reported uuid not null references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  created_at timestamptz not null default now(),
  primary key (reporter, reported)
);

create table if not exists public.audit_log (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.public_scores enable row level security;
alter table public.friendships enable row level security;
alter table public.score_reports enable row level security;
alter table public.audit_log enable row level security;

-- Cada usuario solo lee lo suyo; todo lo demás pasa por funciones security definer.
create policy "Read own score" on public.public_scores for select using (auth.uid() = user_id);
create policy "Read own friendships" on public.friendships for select using (auth.uid() in (requester, addressee));
create policy "Read own reports" on public.score_reports for select using (auth.uid() = reporter);
create policy "Read own audit" on public.audit_log for select using (auth.uid() = user_id);

create or replace function public.audit(p_user uuid, p_action text, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (user_id, action, detail) values (p_user, p_action, p_detail);
$$;
revoke all on function public.audit(uuid, text, jsonb) from public, anon, authenticated;

-- Validación en servidor: rangos, frecuencia, subida máxima diaria y existencia de datos sincronizados.
create or replace function public.submit_score(
  p_name text, p_country text, p_visibility text, p_hide boolean, p_logos integer, p_muscles jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prev public.public_scores%rowtype;
  max_daily constant integer := 1500;
  muscle record;
  accepted_logos integer := p_logos;
  baseline integer;
  baseline_at timestamptz;
  status text := 'ok';
begin
  if uid is null then raise exception 'Sesión requerida'; end if;
  if not exists (select 1 from public.app_state where user_id = uid) then
    perform public.audit(uid, 'rejected', jsonb_build_object('reason', 'sin datos sincronizados'));
    return jsonb_build_object('status', 'rejected', 'reason', 'Sincroniza tus datos antes de publicar tu puntuación.');
  end if;
  if p_logos is null or p_logos < 0 or p_logos > 10000 or jsonb_typeof(p_muscles) <> 'object' then
    perform public.audit(uid, 'rejected', jsonb_build_object('reason', 'rango', 'logos', p_logos));
    return jsonb_build_object('status', 'rejected', 'reason', 'Puntuación fuera de rango.');
  end if;
  for muscle in select key, value from jsonb_each(p_muscles) loop
    if jsonb_typeof(muscle.value) <> 'number' or (muscle.value #>> '{}')::numeric not between 0 and 10000 then
      perform public.audit(uid, 'rejected', jsonb_build_object('reason', 'músculo fuera de rango', 'muscle', muscle.key));
      return jsonb_build_object('status', 'rejected', 'reason', 'Puntuación muscular fuera de rango.');
    end if;
  end loop;
  if p_visibility not in ('private', 'friends', 'public') then p_visibility := 'private'; end if;
  p_name := left(coalesce(nullif(trim(p_name), ''), 'Atleta'), 30);
  if p_country is not null and p_country !~ '^[A-Z]{2}$' then p_country := null; end if;

  select * into prev from public.public_scores where user_id = uid;
  if found then
    if now() - prev.submitted_at < interval '20 seconds' then
      return jsonb_build_object('status', 'rate_limited', 'reason', 'Espera unos segundos antes de volver a publicar.');
    end if;
    baseline := prev.daily_baseline;
    baseline_at := prev.daily_baseline_at;
    if now() - baseline_at > interval '24 hours' then
      baseline := prev.logos;
      baseline_at := now();
    end if;
    if p_logos - baseline > max_daily then
      accepted_logos := baseline + max_daily;
      status := 'capped';
      perform public.audit(uid, 'capped', jsonb_build_object('submitted', p_logos, 'accepted', accepted_logos, 'baseline', baseline));
    end if;
    update public.public_scores set
      display_name = p_name, country = p_country, visibility = p_visibility, hide_rankings = p_hide,
      logos = accepted_logos, muscles = p_muscles, submitted_at = now(),
      daily_baseline = baseline, daily_baseline_at = baseline_at
    where user_id = uid;
  else
    insert into public.public_scores (user_id, display_name, country, visibility, hide_rankings, logos, muscles, daily_baseline)
    values (uid, p_name, p_country, p_visibility, p_hide, least(p_logos, max_daily * 2), p_muscles, 0);
    accepted_logos := least(p_logos, max_daily * 2);
    if accepted_logos <> p_logos then status := 'capped'; end if;
  end if;
  perform public.audit(uid, 'submit', jsonb_build_object('logos', accepted_logos, 'status', status));
  return jsonb_build_object('status', status, 'logos', accepted_logos, 'friend_code', (select friend_code from public.public_scores where user_id = uid));
end $$;

-- scope: global | friends | country. metric: logos o nombre de músculo.
create or replace function public.get_leaderboard(p_metric text, p_scope text, p_limit integer default 50)
returns table (user_id uuid, display_name text, country text, score integer, position bigint, is_self boolean)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  my_country text;
begin
  if uid is null then raise exception 'Sesión requerida'; end if;
  select s.country into my_country from public.public_scores s where s.user_id = uid;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  return query
    select r.user_id, r.display_name, r.country, r.score, row_number() over (order by r.score desc, r.display_name), r.user_id = uid
    from (
      select s.user_id, s.display_name, s.country,
        case when p_metric = 'logos' then s.logos else coalesce((s.muscles ->> p_metric)::numeric, 0)::integer end as score
      from public.public_scores s
      where s.user_id = uid
         or (not s.flagged and not s.hide_rankings and (s.visibility = 'public' or (s.visibility = 'friends' and p_scope = 'friends')))
    ) r
    where (p_scope = 'global' or p_scope is null)
       or (p_scope = 'country' and r.country is not null and r.country = my_country)
       or (p_scope = 'friends' and (r.user_id = uid or exists (
              select 1 from public.friendships f
              where f.status = 'accepted' and ((f.requester = uid and f.addressee = r.user_id) or (f.addressee = uid and f.requester = r.user_id)))))
    order by r.score desc, r.display_name
    limit p_limit;
end $$;

create or replace function public.send_friend_request(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid;
begin
  if uid is null then raise exception 'Sesión requerida'; end if;
  select user_id into target from public.public_scores where friend_code = lower(trim(p_code));
  if target is null or target = uid then return jsonb_build_object('status', 'not_found'); end if;
  if exists (select 1 from public.friendships where requester = target and addressee = uid) then
    update public.friendships set status = 'accepted' where requester = target and addressee = uid;
    return jsonb_build_object('status', 'accepted');
  end if;
  insert into public.friendships (requester, addressee) values (uid, target) on conflict do nothing;
  perform public.audit(uid, 'friend_request', jsonb_build_object('to', target));
  return jsonb_build_object('status', 'pending');
end $$;

create or replace function public.respond_friend_request(p_requester uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sesión requerida'; end if;
  if p_accept then
    update public.friendships set status = 'accepted' where requester = p_requester and addressee = uid;
  else
    delete from public.friendships where requester = p_requester and addressee = uid;
  end if;
end $$;

create or replace function public.list_friend_requests()
returns table (requester uuid, display_name text)
language sql security definer set search_path = public as $$
  select f.requester, s.display_name from public.friendships f
  join public.public_scores s on s.user_id = f.requester
  where f.addressee = auth.uid() and f.status = 'pending';
$$;

-- Con 3 reportes distintos la puntuación se marca y deja de aparecer en clasificaciones hasta que se revise.
create or replace function public.report_score(p_user uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); total integer;
begin
  if uid is null then raise exception 'Sesión requerida'; end if;
  if p_user = uid then return jsonb_build_object('status', 'invalid'); end if;
  insert into public.score_reports (reporter, reported, reason) values (uid, p_user, left(p_reason, 300))
  on conflict do nothing;
  select count(*) into total from public.score_reports where reported = p_user;
  if total >= 3 then update public.public_scores set flagged = true where user_id = p_user; end if;
  perform public.audit(uid, 'report', jsonb_build_object('reported', p_user, 'total', total));
  return jsonb_build_object('status', 'ok', 'flagged', total >= 3);
end $$;

revoke all on function public.submit_score(text, text, text, boolean, integer, jsonb) from public, anon;
revoke all on function public.get_leaderboard(text, text, integer) from public, anon;
revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.list_friend_requests() from public, anon;
revoke all on function public.report_score(uuid, text) from public, anon;
grant execute on function public.submit_score(text, text, text, boolean, integer, jsonb) to authenticated;
grant execute on function public.get_leaderboard(text, text, integer) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.list_friend_requests() to authenticated;
grant execute on function public.report_score(uuid, text) to authenticated;
