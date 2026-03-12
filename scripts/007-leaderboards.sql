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

create index if not exists idx_leaderboards_season on public.leaderboards(season_id);
create index if not exists idx_leaderboards_rank on public.leaderboards(season_id, rank);
