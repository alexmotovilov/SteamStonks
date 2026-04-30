-- ============================================================
-- Migration 011: SteamStonks Game System
-- Covers: prediction rework, items, inventory, equipment,
--         rites, vendor, mana tracking, ladder rankings
-- Safe to re-run (all blocks are idempotent)
-- ============================================================

-- ============================================================
-- 1. PROFILES — add dual mana tracking and token balance rename
--    prediction_mana_earned = leaderboard score (never decreases)
--    mana_balance           = spendable wallet
--    token_balance          = already renamed in migration 010
--    is_banned              = already added manually
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prediction_mana_earned  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_balance             integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_prediction_bonus_claimed boolean DEFAULT false;

-- ============================================================
-- 2. SEASON_ENTRIES — equipment choice, mana tracking per season,
--    weekly stipend tracking, first prediction bonus tracking,
--    rename token columns from earlier manual migrations
-- ============================================================

-- Rename points_paid → tokens_paid if not already done
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'season_entries'
      AND column_name = 'points_paid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'season_entries'
      AND column_name = 'tokens_paid'
  ) THEN
    ALTER TABLE public.season_entries RENAME COLUMN points_paid TO tokens_paid;
  END IF;
END $$;

ALTER TABLE public.season_entries
  -- Which equipment the player chose for this season
  ADD COLUMN IF NOT EXISTS equipment_id            text, -- references items.slug
  -- Per-season mana tracking (resets each season)
  ADD COLUMN IF NOT EXISTS prediction_mana_earned  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_balance             integer DEFAULT 0,
  -- Equipment tier progression: count of Perfect+Partial week-one results this season
  ADD COLUMN IF NOT EXISTS equipment_tier_score     integer DEFAULT 0,
  -- Weekly stipend tracking
  ADD COLUMN IF NOT EXISTS last_stipend_at          timestamptz,
  ADD COLUMN IF NOT EXISTS stipend_week_number      integer DEFAULT 0,
  -- First prediction bonus
  ADD COLUMN IF NOT EXISTS first_prediction_bonus_claimed boolean DEFAULT false,
  -- Starter kit given on join
  ADD COLUMN IF NOT EXISTS starter_kit_claimed      boolean DEFAULT false;

-- ============================================================
-- 3. ITEMS — master catalogue of all boosters and equipment
--    slug is the stable identifier used throughout the system
-- ============================================================

CREATE TABLE IF NOT EXISTS public.items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,  -- e.g. 'scrying_orb_polish'
  name         text NOT NULL,
  description  text,
  item_type    text NOT NULL CHECK (item_type IN ('booster', 'equipment')),
  image_url    text,                  -- e.g. '/items/scrying-orb-polish.png'

  -- Booster-specific fields
  drop_rate    numeric(5,2),          -- percentage e.g. 25.00
  is_droppable boolean DEFAULT true,
  is_vendored  boolean DEFAULT false,
  vendor_price integer,               -- mana cost at vendor
  vendor_weekly_limit integer,        -- per-player purchases per week
  carry_over_limit integer,           -- max carried between seasons

  -- Effects stored as JSONB for flexibility
  -- Example: {"players_window_pct": 10, "mana_total_reward": 25}
  effects      jsonb DEFAULT '{}',

  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "items_select_all" ON public.items;
DROP POLICY IF EXISTS "items_admin_insert" ON public.items;
DROP POLICY IF EXISTS "items_admin_update" ON public.items;
DROP POLICY IF EXISTS "inventory_select_own" ON public.inventory;
DROP POLICY IF EXISTS "inventory_insert_own" ON public.inventory;
DROP POLICY IF EXISTS "inventory_update_own" ON public.inventory;
DROP POLICY IF EXISTS "ladder_select_all" ON public.ladder_rankings;
DROP POLICY IF EXISTS "ladder_insert_own" ON public.ladder_rankings;
DROP POLICY IF EXISTS "ladder_update_own" ON public.ladder_rankings;
DROP POLICY IF EXISTS "vendor_purchases_select_own" ON public.vendor_purchases;
DROP POLICY IF EXISTS "vendor_purchases_insert_own" ON public.vendor_purchases;
DROP POLICY IF EXISTS "rite_history_select_own" ON public.rite_history;
DROP POLICY IF EXISTS "rite_history_insert_own" ON public.rite_history;
DROP POLICY IF EXISTS "drop_history_select_own" ON public.drop_history;
DROP POLICY IF EXISTS "drop_history_insert_service" ON public.drop_history;

CREATE POLICY "items_select_all" ON public.items
  FOR SELECT USING (true);
CREATE POLICY "items_admin_insert" ON public.items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "items_admin_update" ON public.items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Seed all boosters and equipment
INSERT INTO public.items (slug, name, description, item_type, image_url, drop_rate, is_droppable, is_vendored, vendor_price, vendor_weekly_limit, carry_over_limit, effects)
VALUES
  -- Boosters (droppable)
  (
    'scrying_orb_polish',
    'Scrying Orb Polish',
    'A viscous green fluid that, when applied to a scrying orb, sharpens the visions within. Widens the peak player count prediction window.',
    'booster',
    '/items/scrying-orb-polish.png',
    26.00, true, true, 15, 2, 5,
    '{"players_window_pct": 10}'
  ),
  (
    'crystal_focus',
    'Crystal Focus',
    'A precision-ground crystal lens that clarifies review score readings. Widens the positive review prediction window.',
    'booster',
    '/items/crystal-focus.png',
    20.00, true, true, 20, 2, 5,
    '{"reviews_window_flat": 2}'
  ),
  (
    'evocation_distillate',
    'Evocation Distillate',
    'A volatile teal essence that amplifies the energy of any successful working. Adds bonus mana to total reward regardless of accuracy.',
    'booster',
    '/items/evocation-distillate.png',
    25.00, true, false, null, null, 5,
    '{"mana_total_reward": 25}'
  ),
  (
    'thaumaturgic_concentrate',
    'Thaumaturgic Concentrate',
    'An extraordinarily rare distillation of concentrated magical potential. Adds substantial bonus mana to total reward regardless of accuracy.',
    'booster',
    '/items/thaumaturgic-concentrate.png',
    5.00, true, false, null, null, 5,
    '{"mana_total_reward": 50}'
  ),
  (
    'blood_bargain',
    'Blood Bargain',
    'A forbidden compact sealed in blood. Widens the review window at the cost of a portion of your reward.',
    'booster',
    '/items/blood-bargain.png',
    10.00, true, true, 30, 1, 5,
    '{"reviews_window_flat": 3, "mana_reviews_penalty": 25}'
  ),
  (
    'black_gem_accumulator',
    'Black Gem Accumulator',
    'A soul-laden gem of terrible power. Narrows the player count window in exchange for a greatly amplified reward.',
    'booster',
    '/items/black-gem-accumulator.png',
    11.00, true, true, 20, 1, 5,
    '{"players_window_pct": -5, "mana_players_bonus": 75}'
  ),
  (
    'infernal_patrons_pact',
    'Infernal Patron''s Pact',
    'A smouldering scroll bound in chains. Narrows the review window but guarantees an additional loot drop.',
    'booster',
    '/items/infernal-patrons-pact.png',
    12.00, true, true, 25, 1, 5,
    '{"reviews_window_flat": -1, "drops_total_reward": 1}'
  ),
  (
    'tincture_of_divination',
    'Tincture of Divination',
    'A rare alchemical preparation available only from the trader. Simultaneously widens both prediction windows.',
    'booster',
    '/items/tincture-of-divination.png',
    null, false, true, 75, 1, 5,
    '{"players_window_pct": 10, "reviews_window_flat": 5}'
  ),

  -- Equipment
  (
    'seers_spectacles',
    'Seer''s Spectacles',
    'Ancient spectacles ground from oracle glass. Progressively widens both prediction windows as the mage''s accuracy improves.',
    'equipment',
    '/items/seers-spectacles.png',
    null, false, false, null, null, null,
    '{
      "tiers": [
        {"min_score": 0,  "max_score": 2, "players_window_pct": 3,  "reviews_window_flat": 1},
        {"min_score": 3,  "max_score": 5, "players_window_pct": 5,  "reviews_window_flat": 2},
        {"min_score": 6,  "max_score": null, "players_window_pct": 10, "reviews_window_flat": 5}
      ]
    }'
  ),
  (
    'arcanum_esoterica',
    'Arcanum Esoterica',
    'A tome of forbidden knowledge bound in shadow. Amplifies mana rewards for correct predictions, with greater power as mastery grows.',
    'equipment',
    '/items/arcanum-esoterica.png',
    null, false, false, null, null, null,
    '{
      "tiers": [
        {"min_score": 0,  "max_score": 2, "mana_players_bonus": 15, "mana_reviews_bonus": 15, "mana_both_bonus": 0,  "mana_total_reward": 0},
        {"min_score": 3,  "max_score": 5, "mana_players_bonus": 25, "mana_reviews_bonus": 25, "mana_both_bonus": 25, "mana_total_reward": 0},
        {"min_score": 6,  "max_score": null, "mana_players_bonus": 25, "mana_reviews_bonus": 25, "mana_both_bonus": 25, "mana_total_reward": 50}
      ]
    }'
  ),
  (
    'clockwork_familiar',
    'Clockwork Familiar',
    'A mechanical companion of brass and crystal that scurries through the aether collecting loot. Grants additional drops and booster slots as its bond deepens.',
    'equipment',
    '/items/clockwork-familiar.png',
    null, false, false, null, null, null,
    '{
      "tiers": [
        {"min_score": 0,  "max_score": 2, "drops_players_bonus": 1, "drops_reviews_bonus": 1, "extra_booster_slots": 0, "drops_total_reward": 0},
        {"min_score": 3,  "max_score": 5, "drops_players_bonus": 1, "drops_reviews_bonus": 1, "extra_booster_slots": 1, "drops_total_reward": 0},
        {"min_score": 6,  "max_score": null, "drops_players_bonus": 0, "drops_reviews_bonus": 0, "extra_booster_slots": 1, "drops_total_reward": 2}
      ]
    }'
  )
ON CONFLICT (slug) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  image_url    = EXCLUDED.image_url,
  drop_rate    = EXCLUDED.drop_rate,
  is_droppable = EXCLUDED.is_droppable,
  is_vendored  = EXCLUDED.is_vendored,
  vendor_price = EXCLUDED.vendor_price,
  vendor_weekly_limit = EXCLUDED.vendor_weekly_limit,
  carry_over_limit    = EXCLUDED.carry_over_limit,
  effects      = EXCLUDED.effects;

CREATE INDEX IF NOT EXISTS idx_items_type ON public.items(item_type);
CREATE INDEX IF NOT EXISTS idx_items_droppable ON public.items(is_droppable) WHERE is_droppable = true;
CREATE INDEX IF NOT EXISTS idx_items_vendored ON public.items(is_vendored) WHERE is_vendored = true;

-- ============================================================
-- 4. INVENTORY — player's booster stock
--    quantity tracks how many of each booster a player holds
--    equipment lives in season_entries.equipment_id, not here
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity   integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (user_id, item_id)
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_select_own" ON public.inventory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inventory_insert_own" ON public.inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inventory_update_own" ON public.inventory
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON public.inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item ON public.inventory(item_id);

-- ============================================================
-- 5. PREDICTIONS — full rework for new scoring model
--    Replaces the old slider range model with:
--    - Single midpoint values (window auto-computed at scoring time)
--    - week_one type: players midpoint + reviews midpoint
--    - No season_end prediction type on this table (ladder handles it)
--    - result: failed/partial/perfect
--    - Dual mana tracking on rewards
--    - Early lock tracking
--    - Applied boosters (JSONB array of item slugs)
--    - Applied rites (JSONB map of rite_slug → performed_at)
-- ============================================================

-- Add new columns to existing predictions table
ALTER TABLE public.predictions
  -- New midpoint model (replaces min/max range model)
  ADD COLUMN IF NOT EXISTS players_midpoint       integer,
  ADD COLUMN IF NOT EXISTS reviews_midpoint       integer CHECK (reviews_midpoint BETWEEN 0 AND 100),

  -- Computed windows (stored at scoring time for audit trail)
  ADD COLUMN IF NOT EXISTS players_window_low     integer,
  ADD COLUMN IF NOT EXISTS players_window_high    integer,
  ADD COLUMN IF NOT EXISTS reviews_window_low     integer,
  ADD COLUMN IF NOT EXISTS reviews_window_high    integer,

  -- Early lock
  ADD COLUMN IF NOT EXISTS early_locked_at        timestamptz,
  ADD COLUMN IF NOT EXISTS early_lock_mana        integer DEFAULT 0,

  -- Result
  ADD COLUMN IF NOT EXISTS result                 text CHECK (result IN ('perfect', 'partial', 'failed')),
  ADD COLUMN IF NOT EXISTS players_correct        boolean,
  ADD COLUMN IF NOT EXISTS reviews_correct        boolean,

  -- Reward breakdown (for transparency and debugging)
  ADD COLUMN IF NOT EXISTS mana_players           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_reviews           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_both_bonus        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_early_lock        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_boosters          integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_equipment         integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mana_first_prediction  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drops_awarded          integer DEFAULT 0,

  -- Applied boosters: array of item slugs e.g. ["scrying_orb_polish", "crystal_focus"]
  ADD COLUMN IF NOT EXISTS applied_boosters       text[] DEFAULT '{}',

  -- Applied rites: map of slug → performed_at timestamp
  ADD COLUMN IF NOT EXISTS applied_rites          jsonb DEFAULT '{}',

  -- Auspicious Omens mark on this prediction (for ladder)
  ADD COLUMN IF NOT EXISTS ao_marked              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ao_mark_number         integer, -- which mark # this was (1-8)
  ADD COLUMN IF NOT EXISTS ao_mark_cost           integer; -- mana spent on this mark

-- Drop old min/max columns if still present (may already be gone from migration 010)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'predictions'
      AND column_name = 'player_count_min'
  ) THEN
    ALTER TABLE public.predictions DROP COLUMN IF EXISTS player_count_min;
    ALTER TABLE public.predictions DROP COLUMN IF EXISTS player_count_max;
    ALTER TABLE public.predictions DROP COLUMN IF EXISTS review_score_min;
    ALTER TABLE public.predictions DROP COLUMN IF EXISTS review_score_max;
  END IF;
END $$;

-- Drop old scoring columns replaced by the breakdown columns above
ALTER TABLE public.predictions
  DROP COLUMN IF EXISTS base_points,
  DROP COLUMN IF EXISTS multiplier;

-- Update prediction_type check to only allow week_one
-- (season_end ladder is handled by ladder_rankings table)
ALTER TABLE public.predictions
  DROP CONSTRAINT IF EXISTS predictions_prediction_type_check;

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_prediction_type_check
  CHECK (prediction_type = 'week_one');

CREATE INDEX IF NOT EXISTS idx_predictions_result ON public.predictions(result) WHERE result IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_early_lock ON public.predictions(early_locked_at) WHERE early_locked_at IS NOT NULL;

-- ============================================================
-- 6. LADDER_RANKINGS — season-end ladder prediction
--    One row per player per season, storing the full ordered
--    list of game_ids as a JSONB array.
--    Locked positions stored separately per game.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ladder_rankings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_id   uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,

  -- Ordered array of game UUIDs representing the player's top 8 prediction
  -- Index 0 = predicted rank 1 (highest peak players), index 7 = rank 8
  -- Games are added as each new game's prediction deadline passes
  ranked_games jsonb DEFAULT '[]',

  -- Which game IDs have had their positions locked (deadline passed)
  -- Once locked a game cannot be repositioned
  locked_game_ids uuid[] DEFAULT '{}',

  -- Season-end scoring results
  binary_mana     integer DEFAULT 0,   -- sum of +50 mana per correct exact placement
  sequence_mana   integer DEFAULT 0,   -- sequence run bonus
  sequence_length integer DEFAULT 0,   -- longest correct run achieved
  total_mana      integer DEFAULT 0,   -- binary_mana + sequence_mana
  scored_at       timestamptz,

  -- Auspicious Omens tracking for this player this season
  ao_total_marks   integer DEFAULT 0,
  ao_total_cost    integer DEFAULT 0,  -- total mana spent on AO marks
  ao_all_correct   boolean,            -- null until scored
  ao_mana_reward   integer DEFAULT 0,

  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  UNIQUE (user_id, season_id)
);

ALTER TABLE public.ladder_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ladder_select_all" ON public.ladder_rankings
  FOR SELECT USING (true);
CREATE POLICY "ladder_insert_own" ON public.ladder_rankings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ladder_update_own" ON public.ladder_rankings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ladder_user    ON public.ladder_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_ladder_season  ON public.ladder_rankings(season_id);
CREATE INDEX IF NOT EXISTS idx_ladder_scored  ON public.ladder_rankings(scored_at) WHERE scored_at IS NOT NULL;

-- ============================================================
-- 7. VENDOR_PURCHASES — tracks per-player weekly purchase history
--    Used to enforce per-player weekly limits
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_purchases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  season_id   uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  quantity    integer NOT NULL DEFAULT 1,
  mana_cost   integer NOT NULL,
  vendor_week integer NOT NULL, -- week number within season (1-indexed)
  vendor_cycle text NOT NULL CHECK (vendor_cycle IN ('A', 'B')), -- which inventory cycle
  purchased_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_purchases_select_own" ON public.vendor_purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vendor_purchases_insert_own" ON public.vendor_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_user_week ON public.vendor_purchases(user_id, vendor_week, season_id);
CREATE INDEX IF NOT EXISTS idx_vendor_season    ON public.vendor_purchases(season_id);

-- ============================================================
-- 8. RITE_HISTORY — log of all rites performed
--    Used for audit trail, Auspicious Omens tracking,
--    and deducting mana costs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rite_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prediction_id uuid REFERENCES public.predictions(id) ON DELETE SET NULL,
  ladder_id     uuid REFERENCES public.ladder_rankings(id) ON DELETE SET NULL,
  season_id     uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  rite_slug     text NOT NULL, -- 'temporal_translocation' | 'ritual_of_augury' | 'eldritch_wager' | 'sigil_of_multiplicity' | 'auspicious_omens'
  mana_cost     integer NOT NULL,
  performed_at  timestamptz DEFAULT now(),
  metadata      jsonb DEFAULT '{}' -- extra data e.g. AO mark number, Augury snapshot data
);

ALTER TABLE public.rite_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rite_history_select_own" ON public.rite_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rite_history_insert_own" ON public.rite_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_rite_user    ON public.rite_history(user_id, season_id);
CREATE INDEX IF NOT EXISTS idx_rite_pred    ON public.rite_history(prediction_id) WHERE prediction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rite_ladder  ON public.rite_history(ladder_id) WHERE ladder_id IS NOT NULL;

-- ============================================================
-- 9. DROP_HISTORY — log of all loot drops awarded
--    Provides an audit trail and powers the drop animation/reveal UI
-- ============================================================

CREATE TABLE IF NOT EXISTS public.drop_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prediction_id uuid REFERENCES public.predictions(id) ON DELETE SET NULL,
  season_id     uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES public.items(id),
  source        text NOT NULL CHECK (source IN ('prediction_players', 'prediction_reviews', 'equipment_total', 'booster_total', 'starter_kit')),
  awarded_at    timestamptz DEFAULT now()
);

ALTER TABLE public.drop_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drop_history_select_own" ON public.drop_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "drop_history_insert_service" ON public.drop_history
  FOR INSERT WITH CHECK (true); -- service role only in practice

CREATE INDEX IF NOT EXISTS idx_drops_user   ON public.drop_history(user_id, season_id);
CREATE INDEX IF NOT EXISTS idx_drops_pred   ON public.drop_history(prediction_id) WHERE prediction_id IS NOT NULL;

-- ============================================================
-- 10. LEADERBOARDS — add mana-specific columns
--     total_points already exists, repurpose as prediction_mana
--     add separate columns for clarity
-- ============================================================

ALTER TABLE public.leaderboards
  ADD COLUMN IF NOT EXISTS prediction_mana_earned integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS week_one_mana           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ladder_mana             integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perfect_count           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partial_count           integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count            integer DEFAULT 0;

-- ============================================================
-- 11. SEASONS — add vendor cycle tracking
-- ============================================================

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS current_vendor_week   integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_vendor_cycle  text DEFAULT 'A' CHECK (current_vendor_cycle IN ('A', 'B')),
  ADD COLUMN IF NOT EXISTS last_vendor_reset_at  timestamptz;

-- ============================================================
-- 12. RPC FUNCTIONS — atomic increment helpers used by crons
-- ============================================================

-- Atomically increment mana on season_entries
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
    prediction_mana_earned  = prediction_mana_earned + p_mana,
    mana_balance            = mana_balance + p_mana,
    equipment_tier_score    = equipment_tier_score + p_tier_increment,
    first_prediction_bonus_claimed = CASE WHEN p_claim_first THEN true ELSE first_prediction_bonus_claimed END,
    updated_at              = now()
  WHERE user_id = p_user_id AND season_id = p_season_id;
END;
$$;

-- Atomically increment inventory quantity
CREATE OR REPLACE FUNCTION public.increment_inventory(
  p_user_id uuid,
  p_item_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory (user_id, item_id, quantity, updated_at)
  VALUES (p_user_id, p_item_id, 1, now())
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET
    quantity   = inventory.quantity + 1,
    updated_at = now();
END;
$$;

-- Atomically deduct mana from spendable balance (vendor purchases, rites)
-- Returns false if insufficient balance
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
  FROM public.season_entries
  WHERE user_id = p_user_id AND season_id = p_season_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN false;
  END IF;

  UPDATE public.season_entries
  SET mana_balance = mana_balance - p_amount,
      updated_at   = now()
  WHERE user_id = p_user_id AND season_id = p_season_id;

  RETURN true;
END;
$$;

-- Decrement inventory quantity (consuming a booster)
-- Returns false if insufficient quantity
CREATE OR REPLACE FUNCTION public.consume_inventory_item(
  p_user_id uuid,
  p_item_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty integer;
BEGIN
  SELECT quantity INTO v_qty
  FROM public.inventory
  WHERE user_id = p_user_id AND item_id = p_item_id
  FOR UPDATE;

  IF v_qty IS NULL OR v_qty < p_quantity THEN
    RETURN false;
  END IF;

  UPDATE public.inventory
  SET quantity   = quantity - p_quantity,
      updated_at = now()
  WHERE user_id = p_user_id AND item_id = p_item_id;

  RETURN true;
END;
$$;

-- Add weekly stipend to mana_balance only (not prediction_mana_earned)
CREATE OR REPLACE FUNCTION public.add_weekly_stipend(
  p_user_id   uuid,
  p_season_id uuid,
  p_amount    integer,
  p_week_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.season_entries
  SET
    mana_balance      = mana_balance + p_amount,
    last_stipend_at   = now(),
    stipend_week_number = p_week_number,
    updated_at        = now()
  WHERE user_id = p_user_id
    AND season_id = p_season_id
    AND (stipend_week_number IS NULL OR stipend_week_number < p_week_number);
END;
$$;

-- Lock a specific game's position in a player's ladder
CREATE OR REPLACE FUNCTION public.lock_ladder_game(
  p_user_id   uuid,
  p_season_id uuid,
  p_game_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ladder_rankings
  SET
    locked_game_ids = array_append(
      COALESCE(locked_game_ids, '{}'),
      p_game_id
    ),
    updated_at = now()
  WHERE user_id = p_user_id
    AND season_id = p_season_id
    AND NOT (p_game_id = ANY(COALESCE(locked_game_ids, '{}')));
END;
$$;
