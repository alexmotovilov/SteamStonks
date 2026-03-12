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
