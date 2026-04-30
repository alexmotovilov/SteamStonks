/**
 * SteamStonks Ladder Scoring Engine
 *
 * Season-end ladder scores two payouts simultaneously:
 *   1. Binary: +50 mana per game in its exact correct rank position
 *   2. Sequence: bonus for the longest common subsequence (LCS)
 *      of games appearing in the correct relative order in both
 *      the player's ladder and the actual top 8.
 *
 * The sequence run can be "shifted" — it doesn't need to start
 * at position 1 in either list, just needs to be contiguous
 * and in the same relative order in both.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const MANA_BINARY_CORRECT = 50

export const SEQUENCE_REWARDS: Record<number, number> = {
  2: 50,
  3: 100,
  4: 150,
  5: 250,
  6: 350,
  7: 500,
  8: 700,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LadderScoreResult {
  binary_mana: number
  sequence_mana: number
  sequence_length: number
  total_mana: number
  correct_positions: number[]   // 0-indexed positions of exact matches
  lcs_games: string[]           // game IDs in the longest correct sequence
}

export interface AuspiciousOmensResult {
  all_correct: boolean
  total_reward: number
  marks_count: number
}

// ─── Binary placement scoring ─────────────────────────────────────────────────

/**
 * Award +50 mana for each game in its exact correct rank position.
 * Both lists are 0-indexed arrays of game IDs.
 * actualTop8[0] = game with highest all-time peak players.
 */
export function scoreBinaryPlacements(
  playerLadder: string[],  // player's ranked list (index 0 = their #1 pick)
  actualTop8: string[]     // actual ranking (index 0 = true #1)
): { mana: number; correctPositions: number[] } {
  const correctPositions: number[] = []

  const len = Math.min(playerLadder.length, actualTop8.length)
  for (let i = 0; i < len; i++) {
    if (playerLadder[i] === actualTop8[i]) {
      correctPositions.push(i)
    }
  }

  return {
    mana: correctPositions.length * MANA_BINARY_CORRECT,
    correctPositions,
  }
}

// ─── Longest Common Subsequence ───────────────────────────────────────────────

/**
 * Find the longest common subsequence between two arrays.
 * Returns the actual subsequence (array of game IDs).
 *
 * This implements standard LCS with backtracking to recover the sequence.
 * We use this to find the longest chain of games that appear in the same
 * relative order in both the player's ladder and the actual top 8.
 */
export function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to recover the sequence
  const result: string[] = []
  let i = m
  let j = n

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return result
}

// ─── Sequence bonus scoring ───────────────────────────────────────────────────

/**
 * Award a sequence bonus based on the longest common subsequence.
 * The run can be "shifted" — it just needs to preserve relative order
 * and be contiguous in both lists.
 *
 * We use LCS which naturally handles the "shifted" case:
 * Player:  [C, A, D, E]
 * Actual:  [A, C, D, E]
 * LCS:     [A, D, E] or [C, D, E] (length 3) → +100 mana
 */
export function scoreSequenceBonus(
  playerLadder: string[],
  actualTop8: string[]
): { mana: number; length: number; sequence: string[] } {
  const lcs = longestCommonSubsequence(playerLadder, actualTop8)
  const length = lcs.length
  const mana = length >= 2 ? (SEQUENCE_REWARDS[length] ?? 0) : 0

  return { mana, length, sequence: lcs }
}

// ─── Full ladder scorer ───────────────────────────────────────────────────────

/**
 * Score a player's ladder against the actual top 8.
 * Both payouts (binary + sequence) apply simultaneously.
 */
export function scoreLadder(
  playerLadder: string[],  // player's list, index 0 = their predicted #1
  actualTop8: string[]     // actual ranking, index 0 = true #1 by peak players
): LadderScoreResult {
  // Trim both to 8 entries max
  const player8 = playerLadder.slice(0, 8)
  const actual8 = actualTop8.slice(0, 8)

  const binary   = scoreBinaryPlacements(player8, actual8)
  const sequence = scoreSequenceBonus(player8, actual8)

  return {
    binary_mana:      binary.mana,
    sequence_mana:    sequence.mana,
    sequence_length:  sequence.length,
    total_mana:       binary.mana + sequence.mana,
    correct_positions: binary.correctPositions,
    lcs_games:         sequence.sequence,
  }
}

// ─── Auspicious Omens scorer ──────────────────────────────────────────────────

/**
 * Score Auspicious Omens marks at season end.
 * Reward table: marks 1–8 each have a reward-per-mark value.
 * Total reward = reward_per_mark × number_of_marks.
 * If ANY marked game is not in the actual top 8, all rewards are forfeited.
 */

const AO_REWARD_PER_MARK: Record<number, number> = {
  1: 10,
  2: 25,
  3: 40,
  4: 55,
  5: 70,
  6: 85,
  7: 100,
  8: 115,
}

export function scoreAuspiciousOmens(
  markedGameIds: string[],    // game IDs the player marked
  actualTop8GameIds: string[] // actual top 8 game IDs
): AuspiciousOmensResult {
  if (markedGameIds.length === 0) {
    return { all_correct: true, total_reward: 0, marks_count: 0 }
  }

  const top8Set = new Set(actualTop8GameIds)
  const allCorrect = markedGameIds.every(id => top8Set.has(id))

  if (!allCorrect) {
    return { all_correct: false, total_reward: 0, marks_count: markedGameIds.length }
  }

  // Reward per mark scales with total number of marks
  const markCount = markedGameIds.length
  const rewardPerMark = AO_REWARD_PER_MARK[markCount] ?? 0
  const totalReward = rewardPerMark * markCount

  return {
    all_correct: true,
    total_reward: totalReward,
    marks_count: markCount,
  }
}

// ─── Augury distribution ─────────────────────────────────────────────────────

/**
 * Compute a crowd density distribution for the Ritual of Augury heatmap.
 * Returns normalized bucket counts (0–1) suitable for CSS gradient generation.
 *
 * For players: divides the full range into `buckets` equal-width bins.
 * For reviews: fixed 0–100 range divided into `buckets` bins.
 */
export function computeAuguryDistribution(
  midpoints: number[],
  rangeMin: number,
  rangeMax: number,
  buckets: number = 50
): number[] {
  const counts = new Array(buckets).fill(0)
  const rangeWidth = rangeMax - rangeMin

  if (rangeWidth <= 0 || midpoints.length === 0) return counts

  for (const midpoint of midpoints) {
    const normalized = (midpoint - rangeMin) / rangeWidth
    const bucket = Math.min(Math.floor(normalized * buckets), buckets - 1)
    if (bucket >= 0) counts[bucket]++
  }

  // Normalize to 0–1
  const max = Math.max(...counts, 1)
  return counts.map(c => c / max)
}

/**
 * Convert a normalized distribution array to a CSS linear-gradient string.
 * 0 = deep blue (sparse), 1 = bright red (dense).
 */
export function distributionToGradient(distribution: number[]): string {
  const stops = distribution.map((density, i) => {
    const pct = Math.round((i / (distribution.length - 1)) * 100)

    // Interpolate from deep blue (sparse) → amber (moderate) → bright red (dense)
    let r: number, g: number, b: number
    if (density < 0.5) {
      // blue → amber
      const t = density * 2
      r = Math.round(26  + t * (245 - 26))
      g = Math.round(35  + t * (158 - 35))
      b = Math.round(126 + t * (23  - 126))
    } else {
      // amber → red
      const t = (density - 0.5) * 2
      r = Math.round(245 + t * (198 - 245))
      g = Math.round(158 + t * (40  - 158))
      b = Math.round(23  + t * (40  - 23))
    }

    return `rgb(${r},${g},${b}) ${pct}%`
  })

  return `linear-gradient(to right, ${stops.join(', ')})`
}
