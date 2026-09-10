alter table public.season_entries
  add column if not exists is_free_entry boolean not null default false,
  add column if not exists vested_at timestamptz default null;
