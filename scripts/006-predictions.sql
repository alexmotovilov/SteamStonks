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

create index if not exists idx_predictions_entry on public.predictions(entry_id);
create index if not exists idx_predictions_game on public.predictions(game_id);
