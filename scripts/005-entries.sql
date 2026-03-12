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
