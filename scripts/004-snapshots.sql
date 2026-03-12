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

create index if not exists idx_snapshots_game on public.game_snapshots(game_id);
create index if not exists idx_snapshots_captured on public.game_snapshots(captured_at);
