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
