-- ============================================================
-- Migration 017: Move mana_balance from season_entries to profiles
--
-- Mana is now a cross-season persistent wallet stored on profiles.
-- season_entries.mana_balance is left in place but no longer written to.
-- ============================================================

-- ── 1. One-time seed: copy active season balances into profiles ──

UPDATE public.profiles p
SET mana_balance = p.mana_balance + COALESCE(se.mana_balance, 0)
FROM public.season_entries se
JOIN public.seasons s ON se.season_id = s.id
WHERE se.user_id = p.id
  AND s.status = 'active'
  AND se.mana_balance > 0;


-- ── 2. increment_season_mana ─────────────────────────────────────
-- Adds mana to both prediction_mana_earned (leaderboard) on season_entries
-- AND mana_balance (spendable wallet) on profiles.

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
  -- Leaderboard score + equipment tier stay on season_entries
  UPDATE public.season_entries
  SET
    prediction_mana_earned         = prediction_mana_earned + p_mana,
    equipment_tier_score           = equipment_tier_score + p_tier_increment,
    first_prediction_bonus_claimed = CASE WHEN p_claim_first THEN true ELSE first_prediction_bonus_claimed END,
    updated_at                     = now()
  WHERE user_id = p_user_id AND season_id = p_season_id;

  -- Spendable wallet is now on profiles (cross-season)
  UPDATE public.profiles
  SET mana_balance = mana_balance + p_mana
  WHERE id = p_user_id;
END;
$$;


-- ── 3. deduct_mana ───────────────────────────────────────────────
-- Atomically deducts from profiles.mana_balance.
-- Returns false if insufficient.

CREATE OR REPLACE FUNCTION public.deduct_mana(
  p_user_id   uuid,
  p_season_id uuid,
  p_amount    integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT mana_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET mana_balance = mana_balance - p_amount
  WHERE id = p_user_id;

  RETURN true;
END;
$$;


-- ── 4. add_weekly_stipend ────────────────────────────────────────
-- Adds stipend to profiles.mana_balance only (not leaderboard).
-- Stipend tracking columns (stipend_week_number, last_stipend_at) remain on season_entries.

CREATE OR REPLACE FUNCTION public.add_weekly_stipend(
  p_user_id     uuid,
  p_season_id   uuid,
  p_amount      integer,
  p_week_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only award if this week hasn't been claimed yet
  UPDATE public.season_entries
  SET
    last_stipend_at     = now(),
    stipend_week_number = p_week_number,
    updated_at          = now()
  WHERE user_id   = p_user_id
    AND season_id = p_season_id
    AND (stipend_week_number IS NULL OR stipend_week_number < p_week_number);

  -- Only credit mana if the stipend_week_number update actually applied
  IF FOUND THEN
    UPDATE public.profiles
    SET mana_balance = mana_balance + p_amount
    WHERE id = p_user_id;
  END IF;
END;
$$;


-- ── 5. add_mana_balance ──────────────────────────────────────────
-- Adds mana to spendable wallet only (not leaderboard).
-- Used when player claims mana from a scoring mailbox message.

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
  UPDATE public.profiles
  SET mana_balance = mana_balance + p_amount
  WHERE id = p_user_id;
END;
$$;
