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

create index if not exists idx_games_season on public.games(season_id);
create index if not exists idx_games_status on public.games(status);
