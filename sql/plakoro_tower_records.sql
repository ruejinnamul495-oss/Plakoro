-- Run this script in Supabase SQL Editor to enable online rankings for both Plakoro towers.
create table if not exists public.plakoro_tower_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  best_floor integer not null default 0 check (best_floor >= 0),
  pokemon text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.plakoro_tower_records enable row level security;

drop policy if exists "Tower records are publicly readable" on public.plakoro_tower_records;
create policy "Tower records are publicly readable"
  on public.plakoro_tower_records for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can insert their own tower record" on public.plakoro_tower_records;
create policy "Users can insert their own tower record"
  on public.plakoro_tower_records for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tower record" on public.plakoro_tower_records;
create policy "Users can update their own tower record"
  on public.plakoro_tower_records for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.plakoro_tower_records to anon, authenticated;
grant insert, update on public.plakoro_tower_records to authenticated;


-- Separate online leaderboard for 방울탑. Existing 불탄탑 records remain in plakoro_tower_records.
create table if not exists public.plakoro_bell_tower_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  best_floor integer not null default 0 check (best_floor >= 0),
  pokemon text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.plakoro_bell_tower_records enable row level security;

drop policy if exists "Bell tower records are publicly readable" on public.plakoro_bell_tower_records;
create policy "Bell tower records are publicly readable"
  on public.plakoro_bell_tower_records for select to anon, authenticated using (true);

drop policy if exists "Users can insert their own bell tower record" on public.plakoro_bell_tower_records;
create policy "Users can insert their own bell tower record"
  on public.plakoro_bell_tower_records for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update their own bell tower record" on public.plakoro_bell_tower_records;
create policy "Users can update their own bell tower record"
  on public.plakoro_bell_tower_records for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.plakoro_bell_tower_records to anon, authenticated;
grant insert, update on public.plakoro_bell_tower_records to authenticated;
