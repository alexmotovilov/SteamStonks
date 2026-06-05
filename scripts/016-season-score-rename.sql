-- ============================================================
-- Migration 016: Rename prediction_mana_earned → season_score
-- Makes the dual-mana distinction clear:
--   season_score  = leaderboard ranking value (never decreases)
--   mana_balance  = spendable wallet (can increase/decrease)
-- Safe to re-run (RENAME is idempotent via DO block).
-- ============================================================

-- season_entries
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'season_entries'
      AND column_name = 'prediction_mana_earned'
  ) THEN
    ALTER TABLE public.season_entries
      RENAME COLUMN prediction_mana_earned TO season_score;
  END IF;
END $$;

-- leaderboards
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaderboards'
      AND column_name = 'prediction_mana_earned'
  ) THEN
    ALTER TABLE public.leaderboards
      RENAME COLUMN prediction_mana_earned TO season_score;
  END IF;
END $$;

-- profiles (if column exists there too)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'prediction_mana_earned'
  ) THEN
    ALTER TABLE public.profiles
      RENAME COLUMN prediction_mana_earned TO season_score;
  END IF;
END $$;

-- Update increment_season_mana RPC to reference renamed column
CREATE OR REPLACE FUNCTION public.increment_season_mana(
  p_user_id        uuid,
  p_season_id      uuid,
  p_mana           integer,
  p_tier_increment integer DEFAULT 0,
  p_claim_first    boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.season_entries
  SET
    season_score             = season_score + p_mana,
    mana_balance             = mana_balance + p_mana,
    equipment_tier_score     = equipment_tier_score + p_tier_increment,
    first_prediction_bonus_claimed = CASE WHEN p_claim_first THEN true ELSE first_prediction_bonus_claimed END,
    updated_at               = now()
  WHERE user_id = p_user_id AND season_id = p_season_id;
END;
$$;
