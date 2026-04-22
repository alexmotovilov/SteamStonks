// Scoring Engine for Steam Stonks
// Calculates prediction accuracy scores with multipliers

export interface Prediction {
  id: string
  user_id: string
  game_id: string
  season_id: string
  prediction_type: "week_one" | "season_end"
  player_count_min: number | null
  player_count_max: number | null
  review_score_min: number | null
  review_score_max: number | null
  locked_at: string | null
  is_locked: boolean
}

export interface ActualMetrics {
  player_count: number
  review_score: number // Percentage positive (0-100)
}

export interface ScoreResult {
  base_points: number
  multiplier: number
  final_points: number
  player_accuracy: number
  review_accuracy: number
  breakdown: {
    player_score: number
    review_score: number
    time_bonus: number
    narrowness_bonus: number
    contrarian_bonus: number
  }
}

// Constants
const MAX_PLAYER_RANGE = 500000 // Maximum expected player count for range calculations
const MAX_BASE_POINTS = 100
const PERFECT_HIT_BONUS = 50

/**
 * Calculate the score for a single prediction against actual metrics
 */
export function calculatePredictionScore(
  prediction: Prediction,
  actual: ActualMetrics,
  crowdMedian?: { players: number; review: number },
  gameReleaseDate?: Date
): ScoreResult {
  // Calculate individual accuracy scores
  const playerScore = calculateRangeScore(
    prediction.player_count_min ?? 0,
    prediction.player_count_max ?? MAX_PLAYER_RANGE,
    actual.player_count,
    MAX_PLAYER_RANGE
  )

  const reviewScore = calculateRangeScore(
    prediction.review_score_min ?? 0,
    prediction.review_score_max ?? 100,
    actual.review_score,
    100
  )

  // Base score is average of player and review accuracy
  const baseScore = Math.round((playerScore.score + reviewScore.score) / 2)

  // Calculate multipliers
  const timeBonus = calculateTimeBonus(prediction.locked_at, gameReleaseDate)
  const narrownessBonus = calculateNarrownessBonu(
    prediction.player_count_min ?? 0,
    prediction.player_count_max ?? MAX_PLAYER_RANGE,
    prediction.review_score_min ?? 0,
    prediction.review_score_max ?? 100
  )
  const contrarianBonus = crowdMedian
    ? calculateContrarianBonus(prediction, crowdMedian)
    : 0

  const totalMultiplier = 1 + timeBonus + narrownessBonus + contrarianBonus

  return {
    base_points: baseScore,
    multiplier: Math.round(totalMultiplier * 100) / 100,
    final_points: Math.round(baseScore * totalMultiplier),
    player_accuracy: playerScore.accuracy,
    review_accuracy: reviewScore.accuracy,
    breakdown: {
      player_score: playerScore.score,
      review_score: reviewScore.score,
      time_bonus: Math.round(timeBonus * 100) / 100,
      narrowness_bonus: Math.round(narrownessBonus * 100) / 100,
      contrarian_bonus: Math.round(contrarianBonus * 100) / 100,
    },
  }
}

/**
 * Calculate score for a range prediction
 * Returns score (0-150) and accuracy percentage
 */
function calculateRangeScore(
  min: number,
  max: number,
  actual: number,
  maxPossibleValue: number
): { score: number; accuracy: number } {
  const rangeWidth = max - min

  if (actual >= min && actual <= max) {
    // Perfect hit - score based on range narrowness
    const narrownessRatio = 1 - rangeWidth / maxPossibleValue
    const bonus = narrownessRatio * PERFECT_HIT_BONUS
    const score = MAX_BASE_POINTS + bonus

    // Calculate how centered the actual value is within the range
    const rangeCenter = (min + max) / 2
    const distanceFromCenter = Math.abs(actual - rangeCenter)
    const maxDistanceFromCenter = rangeWidth / 2
    const centeredness = maxDistanceFromCenter > 0 
      ? 1 - (distanceFromCenter / maxDistanceFromCenter) 
      : 1

    return {
      score: Math.round(score),
      accuracy: Math.round(centeredness * 100),
    }
  } else {
    // Miss - predictions outside the range earn no points regardless of proximity
    return { score: 0, accuracy: 0 }
  }
}

/**
 * Calculate time bonus based on when prediction was locked
 * Earlier predictions earn more (up to 0.5x bonus)
 */
function calculateTimeBonus(lockedAt: string | null, releaseDate?: Date): number {
  if (!lockedAt || !releaseDate) return 0

  const lockDate = new Date(lockedAt)
  const daysBeforeRelease = Math.max(
    0,
    (releaseDate.getTime() - lockDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Up to 0.5x bonus for locking 30+ days before release
  return Math.min(daysBeforeRelease * 0.017, 0.5)
}

/**
 * Calculate bonus for narrow prediction ranges
 * Narrower ranges are riskier but earn more (up to 0.4x bonus)
 */
function calculateNarrownessBonu(
  playerMin: number,
  playerMax: number,
  reviewMin: number,
  reviewMax: number
): number {
  const playerRangeRatio = (playerMax - playerMin) / MAX_PLAYER_RANGE
  const reviewRangeRatio = (reviewMax - reviewMin) / 100

  const playerBonus = Math.max(0, 0.2 - playerRangeRatio * 0.2)
  const reviewBonus = Math.max(0, 0.2 - reviewRangeRatio * 0.2)

  return playerBonus + reviewBonus
}

/**
 * Calculate bonus for predictions that differ from the crowd
 * Correct contrarian predictions earn more (up to 0.3x bonus)
 */
function calculateContrarianBonus(
  prediction: Prediction,
  crowdMedian: { players: number; review: number }
): number {
  const playerMid = ((prediction.player_count_min ?? 0) + (prediction.player_count_max ?? MAX_PLAYER_RANGE)) / 2
  const reviewMid = ((prediction.review_score_min ?? 0) + (prediction.review_score_max ?? 100)) / 2

  // Calculate deviation from crowd
  const playerDeviation = Math.abs(playerMid - crowdMedian.players) / MAX_PLAYER_RANGE
  const reviewDeviation = Math.abs(reviewMid - crowdMedian.review) / 100

  const avgDeviation = (playerDeviation + reviewDeviation) / 2

  // Only award bonus if deviation is significant (>10%)
  if (avgDeviation < 0.1) return 0

  return Math.min(avgDeviation * 0.6, 0.3)
}

/**
 * Calculate the crowd median for a game's predictions
 */
export function calculateCrowdMedian(predictions: Prediction[]): { players: number; review: number } {
  if (predictions.length === 0) {
    return { players: 50000, review: 70 } // Default median
  }

  const playerMids = predictions
    .filter(p => p.player_count_min != null && p.player_count_max != null)
    .map(p => ((p.player_count_min ?? 0) + (p.player_count_max ?? 0)) / 2)
    .sort((a, b) => a - b)

  const reviewMids = predictions
    .filter(p => p.review_score_min != null && p.review_score_max != null)
    .map(p => ((p.review_score_min ?? 0) + (p.review_score_max ?? 0)) / 2)
    .sort((a, b) => a - b)

  const medianIndex = Math.floor(predictions.length / 2)

  return {
    players: playerMids[medianIndex] ?? 50000,
    review: reviewMids[medianIndex] ?? 70,
  }
}

/**
 * Score all predictions for a game
 */
export function scoreGamePredictions(
  predictions: Prediction[],
  actual: ActualMetrics,
  gameReleaseDate?: Date
): Map<string, ScoreResult> {
  const crowdMedian = calculateCrowdMedian(predictions)
  const results = new Map<string, ScoreResult>()

  for (const prediction of predictions) {
    const score = calculatePredictionScore(prediction, actual, crowdMedian, gameReleaseDate)
    results.set(prediction.id, score)
  }

  return results
}

/**
 * Calculate leaderboard rankings from scores
 */
export function calculateRankings(
  userScores: Map<string, number>
): Array<{ userId: string; totalPoints: number; rank: number }> {
  const sorted = Array.from(userScores.entries())
    .map(([userId, totalPoints]) => ({ userId, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints)

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }))
}
