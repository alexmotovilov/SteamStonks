-- Migration 013: Add release_time_override to games
-- Allows admins to set an exact UTC launch timestamp for a game,
-- overriding the steam-collector's end-of-day fallback.
-- Safe to re-run (ADD COLUMN IF NOT EXISTS is idempotent).

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS release_time_override timestamptz;

COMMENT ON COLUMN public.games.release_time_override IS
  'Optional exact UTC launch time set by an admin. When present, overrides release_date for '
  'the is_released check in the steam-collector and for countdown timers on game tiles.';
