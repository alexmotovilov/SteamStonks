-- ============================================================
-- Migration 015: Scoring result mailbox messages
-- ============================================================

-- ── 1. Extend mail_messages ───────────────────────────────────

ALTER TABLE public.mail_messages
  ADD COLUMN IF NOT EXISTS message_type   text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS prediction_id  uuid REFERENCES public.predictions(id),
  ADD COLUMN IF NOT EXISTS season_id      uuid REFERENCES public.seasons(id),
  ADD COLUMN IF NOT EXISTS metadata       jsonb,
  ADD COLUMN IF NOT EXISTS mana_reward    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_claimed_at timestamptz;

-- One scoring message per prediction (deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS mail_messages_prediction_unique
  ON public.mail_messages(prediction_id)
  WHERE prediction_id IS NOT NULL;

-- ── 2. Extend mail_reads ──────────────────────────────────────

ALTER TABLE public.mail_reads
  ADD COLUMN IF NOT EXISTS mana_claimed_at timestamptz;

-- ── 3. Mystery drops table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mail_mystery_drops (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id     uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.profiles(id),
  season_id      uuid NOT NULL REFERENCES public.seasons(id),
  drop_count     integer NOT NULL DEFAULT 1,
  revealed_at    timestamptz,
  revealed_items jsonb
);

ALTER TABLE public.mail_mystery_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_mystery_drops" ON public.mail_mystery_drops
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_mystery_drops_message ON public.mail_mystery_drops(message_id);
CREATE INDEX IF NOT EXISTS idx_mystery_drops_user    ON public.mail_mystery_drops(user_id);

-- ── 4. add_mana_balance RPC ───────────────────────────────────
-- Adds mana ONLY to spending balance (mana_balance), NOT to
-- prediction_mana_earned (leaderboard). Used when player claims
-- mana from a scoring mail — leaderboard was already updated by scorer.

CREATE OR REPLACE FUNCTION public.add_mana_balance(
  p_user_id   uuid,
  p_season_id uuid,
  p_amount    integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.season_entries
  SET mana_balance = mana_balance + p_amount,
      updated_at   = now()
  WHERE user_id   = p_user_id
    AND season_id = p_season_id;
END;
$$;

-- ── 5. Fix drop_history source constraint ─────────────────────

ALTER TABLE public.drop_history
  DROP CONSTRAINT IF EXISTS drop_history_source_check;

ALTER TABLE public.drop_history
  ADD CONSTRAINT drop_history_source_check
  CHECK (source IN (
    'prediction_players', 'prediction_reviews',
    'equipment_total', 'booster_total',
    'starter_kit', 'scoring_drop'
  ));
