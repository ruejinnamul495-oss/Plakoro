-- Plakoro account + match history schema
-- Run this entire script in Supabase Dashboard > SQL Editor using the project owner.
-- IMPORTANT: This app uses username-only login by mapping each username to a synthetic email.
-- In Supabase Auth settings, disable "Confirm email" before enabling username/password signup.
-- Never put a service_role/secret key in the browser.

create table if not exists public.plakoro_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint plakoro_profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create table if not exists public.plakoro_match_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  room_code text not null,
  result text not null check (result in ('win','loss')),
  opponent_username text not null default '상대',
  pokemon text not null,
  opponent_pokemon text not null,
  moves jsonb not null default '[]'::jsonb,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists plakoro_match_records_user_played_idx
  on public.plakoro_match_records(user_id, played_at desc);
create index if not exists plakoro_match_records_result_idx
  on public.plakoro_match_records(result);

alter table public.plakoro_profiles enable row level security;
alter table public.plakoro_match_records enable row level security;

drop policy if exists "Users can read own Plakoro profile" on public.plakoro_profiles;
create policy "Users can read own Plakoro profile"
  on public.plakoro_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create own Plakoro profile" on public.plakoro_profiles;
create policy "Users can create own Plakoro profile"
  on public.plakoro_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own Plakoro profile" on public.plakoro_profiles;
create policy "Users can update own Plakoro profile"
  on public.plakoro_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can read own Plakoro matches" on public.plakoro_match_records;
create policy "Users can read own Plakoro matches"
  on public.plakoro_match_records for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own Plakoro matches" on public.plakoro_match_records;
create policy "Users can insert own Plakoro matches"
  on public.plakoro_match_records for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Do not grant update/delete to clients: submitted history is append-only from the browser.
revoke all on public.plakoro_profiles from anon;
grant select, insert, update on public.plakoro_profiles to authenticated;
revoke all on public.plakoro_match_records from anon;
grant select, insert on public.plakoro_match_records to authenticated;

-- Public leaderboard exposes aggregate counts only, not individual match rows.
create or replace view public.plakoro_leaderboard
with (security_invoker = false) as
select
  p.username,
  count(m.id) filter (where m.result = 'win')::integer as wins,
  count(m.id) filter (where m.result = 'loss')::integer as losses,
  count(m.id)::integer as total_matches,
  case when count(m.id) = 0 then 0::numeric
       else round(100.0 * count(m.id) filter (where m.result = 'win') / count(m.id), 1)
  end as win_rate
from public.plakoro_profiles p
left join public.plakoro_match_records m on m.user_id = p.user_id
group by p.user_id, p.username;

grant select on public.plakoro_leaderboard to anon, authenticated;
