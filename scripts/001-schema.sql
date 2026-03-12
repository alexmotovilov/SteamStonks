-- Steam Stonks Database Schema
-- Run this migration to set up all tables

-- 1. Profiles table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  points_balance integer default 1000,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles 
  for select using (true);
create policy "profiles_insert_own" on public.profiles 
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles 
  for update using (auth.uid() = id);

-- 2. Seasons table
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prediction_lock_at timestamptz,
  entry_fee integer default 100,
  status text default 'upcoming' check (status in ('upcoming', 'active', 'scoring', 'complete')),
  prize_pool jsonb default '{"1": 5000, "2": 3000, "3": 2000, "4": 1500, "5": 1000, "6": 750, "7": 500, "8": 400, "9": 200, "10": 150}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.seasons enable row level security;

create policy "seasons_select_all" on public.seasons 
  for select using (true);
create policy "seasons_admin_insert" on public.seasons 
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
create policy "seasons_admin_update" on public.seasons 
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- 3. Games table
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  steam_appid integer unique not null,
  name text not null,
  release_date date,
  header_image text,
  description text,
  tags text[],
  status text default 'nominated' check (status in ('nominated', 'approved', 'released', 'scored')),
  nominated_by uuid references public.profiles(id),
  season_id uuid references public.seasons(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.games enable row level security;

create policy "games_select_all" on public.games 
  for select using (true);
create policy "games_insert_auth" on public.games 
  for insert with check (auth.uid() is not null);
create policy "games_admin_update" on public.games 
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- 4. Game snapshots table (Steam data collected by cron)
create table if not exists public.game_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  snapshot_type text default 'hourly' check (snapshot_type in ('hourly', 'week1', 'season_end')),
  concurrent_players integer,
  peak_players integer,
  review_score integer,
  review_count integer,
  positive_reviews integer,
  negative_reviews integer,
  captured_at timestamptz default now()
);

alter table public.game_snapshots enable row level security;

create policy "snapshots_select_all" on public.game_snapshots 
  for select using (true);

-- 5. Season entries (player registration for a season)
create table if not exists public.season_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  paid_at timestamptz default now(),
  final_score integer default 0,
  final_rank integer,
  created_at timestamptz default now(),
  unique(user_id, season_id)
);

alter table public.season_entries enable row level security;

create policy "entries_select_all" on public.season_entries 
  for select using (true);
create policy "entries_insert_own" on public.season_entries 
  for insert with check (auth.uid() = user_id);
create policy "entries_update_own" on public.season_entries 
  for update using (auth.uid() = user_id);

-- 6. Predictions table
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.season_entries(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  checkpoint text not null check (checkpoint in ('week1', 'season_end')),
  
  -- Player count prediction (range)
  players_min integer not null,
  players_max integer not null,
  players_confidence integer default 3 check (players_confidence between 1 and 5),
  
  -- Review score prediction (range, 0-100)
  reviews_min integer not null check (reviews_min between 0 and 100),
  reviews_max integer not null check (reviews_max between 0 and 100),
  reviews_confidence integer default 3 check (reviews_confidence between 1 and 5),
  
  locked_at timestamptz default now(),
  points_earned integer,
  multiplier decimal(4,2),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(entry_id, game_id, checkpoint)
);

alter table public.predictions enable row level security;

create policy "predictions_select_all" on public.predictions 
  for select using (true);
create policy "predictions_insert_own" on public.predictions 
  for insert with check (
    exists (
      select 1 from public.season_entries 
      where id = entry_id and user_id = auth.uid()
    )
  );
create policy "predictions_update_own" on public.predictions 
  for update using (
    exists (
      select 1 from public.season_entries 
      where id = entry_id and user_id = auth.uid()
    )
  );

-- 7. Leaderboard cache
create table if not exists public.leaderboards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  total_points integer default 0,
  rank integer,
  games_predicted integer default 0,
  accuracy_rate decimal(5,2),
  updated_at timestamptz default now(),
  
  unique(season_id, user_id)
);

alter table public.leaderboards enable row level security;

create policy "leaderboards_select_all" on public.leaderboards 
  for select using (true);

-- 8. Game nominations (for community suggestions)
create table if not exists public.game_nominations (
  id uuid primary key default gen_random_uuid(),
  steam_appid integer not null,
  name text not null,
  suggested_by uuid references public.profiles(id),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table public.game_nominations enable row level security;

create policy "nominations_select_all" on public.game_nominations 
  for select using (true);
create policy "nominations_insert_auth" on public.game_nominations 
  for insert with check (auth.uid() is not null);
create policy "nominations_admin_update" on public.game_nominations 
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Trigger to auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    lower(replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), ' ', '_')) || '_' || substr(new.id::text, 1, 4)
  )
  on conflict (id) do nothing;
  
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Index for better query performance
create index if not exists idx_games_season on public.games(season_id);
create index if not exists idx_games_status on public.games(status);
create index if not exists idx_snapshots_game on public.game_snapshots(game_id);
create index if not exists idx_snapshots_captured on public.game_snapshots(captured_at);
create index if not exists idx_predictions_entry on public.predictions(entry_id);
create index if not exists idx_predictions_game on public.predictions(game_id);
create index if not exists idx_leaderboards_season on public.leaderboards(season_id);
create index if not exists idx_leaderboards_rank on public.leaderboards(season_id, rank);
