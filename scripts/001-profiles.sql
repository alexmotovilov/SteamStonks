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
