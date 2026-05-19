-- ============================================================
-- Migration 012: Scoring pipeline fixes
-- Adds columns the score-calculator needs that were never migrated,
-- backfills is_locked for already-released games, and fixes the
-- game_snapshots column names / snapshot_type constraint mismatch.
-- Safe to re-run (all DDL is idempotent).
-- ============================================================

-- ── 1. PREDICTIONS — add missing scoring columns ─────────────────────────────

ALTER TABLE public.predictions
  -- Lock flag: set true when game releases (by steam-collector) or early-lock
  ADD COLUMN IF NOT EXISTS is_locked            boolean DEFAULT false,
  -- Scoring timestamp: null = unscored, non-null = scored
  ADD COLUMN IF NOT EXISTS scored_at            timestamptz,
  -- Total mana earned (sum of all mana breakdown columns)
  ADD COLUMN IF NOT EXISTS final_points         integer DEFAULT 0,
  -- Actual Steam values written at score time (for display on tiles)
  ADD COLUMN IF NOT EXISTS actual_player_count  integer,
  ADD COLUMN IF NOT EXISTS actual_review_score  integer,
  -- Direct user/season references (scorer needs these without joining entry)
  ADD COLUMN IF NOT EXISTS user_id              uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS season_id            uuid REFERENCES public.seasons(id);

-- ── 2. BACKFILL — lock predictions for already-released games ─────────────────
-- These predictions were never locked because the steam-collector didn't do it.
-- Any unscored prediction on a released game is effectively locked.

UPDATE public.predictions p
SET is_locked = true
FROM public.games g
WHERE p.game_id = g.id
  AND g.is_released = true
  AND p.scored_at IS NULL
  AND (p.is_locked IS NULL OR p.is_locked = false);

-- ── 3. INDEX — speed up the score-calculator's inner query ───────────────────

CREATE INDEX IF NOT EXISTS idx_predictions_scoreable
  ON public.predictions(game_id, scored_at)
  WHERE scored_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_predictions_scored_at
  ON public.predictions(scored_at)
  WHERE scored_at IS NOT NULL;

-- ── 4. GAME_SNAPSHOTS — add columns matching what crons actually write ────────
-- The original schema (004-snapshots.sql) used different column names.
-- Both the steam-collector and score-calculator use player_count /
-- review_positive / review_negative. Add them if not already present.

ALTER TABLE public.game_snapshots
  ADD COLUMN IF NOT EXISTS player_count    integer,
  ADD COLUMN IF NOT EXISTS review_positive integer,
  ADD COLUMN IF NOT EXISTS review_negative integer;

-- ── 5. GAME_SNAPSHOTS — fix snapshot_type constraint ─────────────────────────
-- Original constraint: ('hourly', 'week1', 'season_end')
-- Crons write:         'daily', 'week_after_release', 'season_end'
-- Drop old constraint and replace with a union that covers both.

ALTER TABLE public.game_snapshots
  DROP CONSTRAINT IF EXISTS game_snapshots_snapshot_type_check;

ALTER TABLE public.game_snapshots
  ADD CONSTRAINT game_snapshots_snapshot_type_check
  CHECK (snapshot_type IN ('daily', 'week_after_release', 'season_end', 'hourly', 'week1'));
