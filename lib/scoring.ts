/**
 * SteamStonks Scoring Engine — Phase 1
 *
 * Week-one predictions score on two binary metrics:
 *   - Correct peak players  → +50 mana, +1 drop
 *   - Correct reviews       → +50 mana, +1 drop
 *   - Both correct          → +50 mana bonus
 *   - Early lock            → linear 0–25 mana over 2 weeks
 *
 * Result states: perfect | partial | failed
 * Equipment and booster effects are applied on top in the cron.
 */

// ─── Base reward constants ───────────────────────────────────────────────────

export const MANA_CORRECT_PLAYERS  = 50
export const MANA_CORRECT_REVIEWS  = 50
export const MANA_BOTH_BONUS       = 50
export const MANA_EARLY_LOCK_MAX   = 25  // max mana from early lock
export const EARLY_LOCK_WINDOW_DAYS = 14  // days over which early lock scales
export const DROPS_CORRECT_PLAYERS = 1
export const DROPS_CORRECT_REVIEWS = 1
export const FIRST_PREDICTION_BONUS = 50

// Default window sizes
export const DEFAULT_PLAYERS_WINDOW_PCT = 0.10  // ±10% of midpoint
export const DEFAULT_REVIEWS_WINDOW_FLAT = 3    // ±3 percentage points

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WeekOnePrediction {
  id: string
  user_id: string
  game_id: string
  season_id: string
  players_midpoint: number
  reviews_midpoint: number
  players_window_low: number
  players_window_high: number
  reviews_window_low: number
  reviews_window_high: number
  early_locked_at: string | null
  applied_boosters: string[]   // array of item slugs
  applied_rites: Record<string, string>  // rite_slug → performed_at
  is_locked: boolean
  scored_at: string | null
}

export interface ActualMetrics {
  player_count: number   // 24h peak players 1 week after release
  review_score: number   // % positive reviews (0–100)
}

export interface BoosterEffects {
  players_window_pct_delta: number   // e.g. +10 or -5 from BGA
  reviews_window_flat_delta: number  // e.g. +2 or -1
  mana_total_reward: number          // unconditional mana additions
  mana_players_bonus: number         // added to players reward if correct
  mana_players_penalty: number       // subtracted from players reward if correct
  mana_reviews_bonus: number         // added to reviews reward if correct
  mana_reviews_penalty: number       // subtracted from reviews reward if correct
  drops_total_reward: number         // unconditional extra drops
  extra_booster_slots: number        // from equipment or Sigil of Multiplicity
}

export interface RiteEffects {
  eldritch_wager: boolean       // +25 mana per correct metric + both bonus
  sigil_of_multiplicity: boolean  // extra booster slot (informational only here)
}

export interface EquipmentTierEffect {
  players_window_pct: number
  reviews_window_flat: number
  mana_players_bonus: number
  mana_reviews_bonus: number
  mana_both_bonus: number
  mana_total_reward: number
  drops_players_bonus: number
  drops_reviews_bonus: number
  drops_total_reward: number
  extra_booster_slots: number
}

export interface WeekOneScoreResult {
  result: 'perfect' | 'partial' | 'failed'
  players_correct: boolean
  reviews_correct: boolean

  // Actual values used for scoring
  actual_player_count: number
  actual_review_score: number

  // Final window used (after booster + equipment adjustments)
  players_window_low: number
  players_window_high: number
  reviews_window_low: number
  reviews_window_high: number

  // Reward breakdown
  mana_players: number
  mana_reviews: number
  mana_both_bonus: number
  mana_early_lock: number
  mana_boosters: number        // total from mana_total_reward boosters
  mana_equipment: number       // total from equipment effects
  mana_rites: number           // total from rite effects (Eldritch Wager)
  mana_first_prediction: number
  final_mana: number           // sum of all mana components

  drops_awarded: number
}

// ─── Window calculation ───────────────────────────────────────────────────────

/**
 * Compute the prediction window for peak players.
 * Base: ±10% of midpoint. Adjustable by boosters/equipment.
 */
export function computePlayersWindow(
  midpoint: number,
  windowPctDelta: number = 0  // net % adjustment from boosters/equipment
): { low: number; high: number } {
  const effectivePct = DEFAULT_PLAYERS_WINDOW_PCT + windowPctDelta / 100
  const halfWindow = Math.round(midpoint * effectivePct)
  return {
    low:  Math.max(0, midpoint - halfWindow),
    high: midpoint + halfWindow,
  }
}

/**
 * Compute the prediction window for reviews.
 * Base: ±3. Adjustable by boosters/equipment.
 */
export function computeReviewsWindow(
  midpoint: number,
  windowFlatDelta: number = 0  // net flat adjustment from boosters/equipment
): { low: number; high: number } {
  const halfWindow = DEFAULT_REVIEWS_WINDOW_FLAT + windowFlatDelta
  return {
    low:  Math.max(0,   midpoint - halfWindow),
    high: Math.min(100, midpoint + halfWindow),
  }
}

// ─── Early lock bonus ─────────────────────────────────────────────────────────

/**
 * Linear mana bonus for early locking.
 * Scales from 0 (locked on release day) to 25 mana (locked 14+ days before release).
 */
export function calculateEarlyLockMana(
  earlyLockedAt: string | null,
  releaseDate: Date | null
): number {
  if (!earlyLockedAt || !releaseDate) return 0

  const lockDate = new Date(earlyLockedAt)
  const daysBeforeRelease = Math.max(
    0,
    (releaseDate.getTime() - lockDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const ratio = Math.min(daysBeforeRelease / EARLY_LOCK_WINDOW_DAYS, 1)
  return Math.round(ratio * MANA_EARLY_LOCK_MAX)
}

// ─── Core week-one scorer ────────────────────────────────────────────────────

/**
 * Score a single week-one prediction.
 * Boosters and equipment effects are pre-resolved by the caller.
 */
export function scoreWeekOnePrediction(
  prediction: WeekOnePrediction,
  actual: ActualMetrics,
  boosters: BoosterEffects,
  equipment: EquipmentTierEffect,
  rites: RiteEffects,
  releaseDate: Date | null,
  isFirstPrediction: boolean = false
): WeekOneScoreResult {

  // 1. Resolve effective windows (booster + equipment deltas stack)
  const playersPctDelta = boosters.players_window_pct_delta + equipment.players_window_pct
  const reviewsFlatDelta = boosters.reviews_window_flat_delta + equipment.reviews_window_flat

  const playersWindow = computePlayersWindow(prediction.players_midpoint, playersPctDelta)
  const reviewsWindow = computeReviewsWindow(prediction.reviews_midpoint, reviewsFlatDelta)

  // 2. Binary correctness
  const playersCorrect = actual.player_count >= playersWindow.low &&
                         actual.player_count <= playersWindow.high
  const reviewsCorrect = actual.review_score >= reviewsWindow.low &&
                         actual.review_score <= reviewsWindow.high
  const bothCorrect    = playersCorrect && reviewsCorrect

  // 3. Result state
  const result: 'perfect' | 'partial' | 'failed' =
    bothCorrect    ? 'perfect' :
    (playersCorrect || reviewsCorrect) ? 'partial' :
    'failed'

  // 4. Base mana rewards (only on correct metrics)
  let manaPlayers = 0
  let manaReviews = 0

  if (playersCorrect) {
    manaPlayers = MANA_CORRECT_PLAYERS
    manaPlayers += boosters.mana_players_bonus
    manaPlayers -= boosters.mana_players_penalty
    manaPlayers += equipment.mana_players_bonus
    if (rites.eldritch_wager) manaPlayers += 25
  }

  if (reviewsCorrect) {
    manaReviews = MANA_CORRECT_REVIEWS
    manaReviews += boosters.mana_reviews_bonus
    manaReviews -= boosters.mana_reviews_penalty
    manaReviews += equipment.mana_reviews_bonus
    if (rites.eldritch_wager) manaReviews += 25
  }

  // 5. Both-correct bonus
  let manaBothBonus = 0
  if (bothCorrect) {
    manaBothBonus = MANA_BOTH_BONUS
    manaBothBonus += equipment.mana_both_bonus
    if (rites.eldritch_wager) manaBothBonus += 25
  }

  // 6. Early lock bonus (guaranteed regardless of result)
  const manaEarlyLock = calculateEarlyLockMana(prediction.early_locked_at, releaseDate)

  // 7. Total reward mana (guaranteed regardless of result)
  const manaBoosters  = boosters.mana_total_reward
  const manaEquipment = equipment.mana_total_reward
  const manaRites     = 0  // Eldritch Wager is handled per-metric above
  const manaFirstPrediction = isFirstPrediction ? FIRST_PREDICTION_BONUS : 0

  const finalMana = Math.max(0,
    manaPlayers +
    manaReviews +
    manaBothBonus +
    manaEarlyLock +
    manaBoosters +
    manaEquipment +
    manaRites +
    manaFirstPrediction
  )

  // 8. Drops (base + equipment + booster total reward drops)
  let dropsAwarded = 0
  if (playersCorrect) dropsAwarded += DROPS_CORRECT_PLAYERS + equipment.drops_players_bonus
  if (reviewsCorrect) dropsAwarded += DROPS_CORRECT_REVIEWS + equipment.drops_reviews_bonus
  dropsAwarded += boosters.drops_total_reward + equipment.drops_total_reward

  return {
    result,
    players_correct: playersCorrect,
    reviews_correct: reviewsCorrect,
    actual_player_count: actual.player_count,
    actual_review_score: actual.review_score,
    players_window_low:  playersWindow.low,
    players_window_high: playersWindow.high,
    reviews_window_low:  reviewsWindow.low,
    reviews_window_high: reviewsWindow.high,
    mana_players:           manaPlayers,
    mana_reviews:           manaReviews,
    mana_both_bonus:        manaBothBonus,
    mana_early_lock:        manaEarlyLock,
    mana_boosters:          manaBoosters,
    mana_equipment:         manaEquipment,
    mana_rites:             manaRites,
    mana_first_prediction:  manaFirstPrediction,
    final_mana:             finalMana,
    drops_awarded:          dropsAwarded,
  }
}

// ─── Booster effect resolver ─────────────────────────────────────────────────

/**
 * Resolve all booster effects from a list of applied booster slugs.
 * Effects stack additively. Penalties are returned as positive numbers.
 */
export function resolveBoosterEffects(boosterSlugs: string[]): BoosterEffects {
  const effects: BoosterEffects = {
    players_window_pct_delta: 0,
    reviews_window_flat_delta: 0,
    mana_total_reward: 0,
    mana_players_bonus: 0,
    mana_players_penalty: 0,
    mana_reviews_bonus: 0,
    mana_reviews_penalty: 0,
    drops_total_reward: 0,
    extra_booster_slots: 0,
  }

  for (const slug of boosterSlugs) {
    switch (slug) {
      case 'scrying_orb_polish':
        effects.players_window_pct_delta += 10
        break
      case 'crystal_focus':
        effects.reviews_window_flat_delta += 2
        break
      case 'evocation_distillate':
        effects.mana_total_reward += 25
        break
      case 'thaumaturgic_concentrate':
        effects.mana_total_reward += 50
        break
      case 'blood_bargain':
        effects.reviews_window_flat_delta += 3
        effects.mana_reviews_penalty += 25
        break
      case 'black_gem_accumulator':
        effects.players_window_pct_delta -= 5
        effects.mana_players_bonus += 75
        break
      case 'infernal_patrons_pact':
        effects.reviews_window_flat_delta -= 1
        effects.drops_total_reward += 1
        break
      case 'tincture_of_divination':
        effects.players_window_pct_delta += 10
        effects.reviews_window_flat_delta += 5
        break
    }
  }

  return effects
}

// ─── Equipment tier resolver ─────────────────────────────────────────────────

/**
 * Resolve equipment effects based on the player's current tier score.
 * Returns zero effects if no equipment or tier score is 0 with equipment at 0-2 tier.
 */
export function resolveEquipmentEffects(
  equipmentSlug: string | null,
  tierScore: number  // count of Perfect+Partial results this season
): EquipmentTierEffect {
  const zero: EquipmentTierEffect = {
    players_window_pct: 0,
    reviews_window_flat: 0,
    mana_players_bonus: 0,
    mana_reviews_bonus: 0,
    mana_both_bonus: 0,
    mana_total_reward: 0,
    drops_players_bonus: 0,
    drops_reviews_bonus: 0,
    drops_total_reward: 0,
    extra_booster_slots: 0,
  }

  if (!equipmentSlug) return zero

  // Tier thresholds: 0-2, 3-5, 6+
  const tier = tierScore <= 2 ? 0 : tierScore <= 5 ? 1 : 2

  switch (equipmentSlug) {
    case 'seers_spectacles': {
      const tiers = [
        { players_window_pct: 3,  reviews_window_flat: 1 },
        { players_window_pct: 5,  reviews_window_flat: 2 },
        { players_window_pct: 10, reviews_window_flat: 5 },
      ]
      return { ...zero, ...tiers[tier] }
    }

    case 'arcanum_esoterica': {
      const tiers = [
        { mana_players_bonus: 15, mana_reviews_bonus: 15, mana_both_bonus: 0,  mana_total_reward: 0  },
        { mana_players_bonus: 25, mana_reviews_bonus: 25, mana_both_bonus: 25, mana_total_reward: 0  },
        { mana_players_bonus: 25, mana_reviews_bonus: 25, mana_both_bonus: 25, mana_total_reward: 50 },
      ]
      return { ...zero, ...tiers[tier] }
    }

    case 'clockwork_familiar': {
      const tiers = [
        { drops_players_bonus: 1, drops_reviews_bonus: 1, extra_booster_slots: 0, drops_total_reward: 0 },
        { drops_players_bonus: 1, drops_reviews_bonus: 1, extra_booster_slots: 1, drops_total_reward: 0 },
        { drops_players_bonus: 0, drops_reviews_bonus: 0, extra_booster_slots: 1, drops_total_reward: 2 },
      ]
      return { ...zero, ...tiers[tier] }
    }

    default:
      return zero
  }
}

// ─── Rite effect resolver ────────────────────────────────────────────────────

export function resolveRiteEffects(appliedRites: Record<string, string>): RiteEffects {
  return {
    eldritch_wager:         'eldritch_wager' in appliedRites,
    sigil_of_multiplicity:  'sigil_of_multiplicity' in appliedRites,
  }
}

// ─── Leaderboard helpers ─────────────────────────────────────────────────────

export function calculateRankings(
  userScores: Map<string, number>
): Array<{ userId: string; totalPoints: number; rank: number }> {
  return Array.from(userScores.entries())
    .map(([userId, totalPoints]) => ({ userId, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}
