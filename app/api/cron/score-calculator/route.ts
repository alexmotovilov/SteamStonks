import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculatePredictionScore, calculateCrowdMedian, calculateRankings } from "@/lib/scoring"

// Use service role for cron jobs (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Cron job to calculate prediction scores
 * Should be triggered daily or after game releases
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/score-calculator",
 *     "schedule": "0 4 * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    // Get games that have been released and have unscored predictions
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, steam_appid, name, release_date, is_released, current_player_count, peak_player_count, review_score_positive, review_score_negative")
      .eq("is_released", true)

    if (gamesError) {
      console.error("[Score Calculator] Failed to fetch games:", gamesError)
      return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 })
    }

    const results = {
      gamesProcessed: 0,
      predictionsScored: 0,
      errors: 0,
    }

    for (const game of games || []) {
      // Skip games without review data
      if (game.review_score_positive === null || game.review_score_negative === null) {
        continue
      }

      // Calculate review percentage
      const totalReviews = game.review_score_positive + game.review_score_negative
      const reviewScore = totalReviews > 0
        ? Math.round((game.review_score_positive / totalReviews) * 100)
        : 0

      // Get the appropriate player count based on prediction type
      // For week_one predictions, we need the week 1 snapshot
      // For season_end, we use the current/peak count

      // Get unscored predictions for this game
      const { data: predictions, error: predError } = await supabase
        .from("predictions")
        .select("*")
        .eq("game_id", game.id)
        .eq("is_locked", true)
        .is("scored_at", null)

      if (predError || !predictions || predictions.length === 0) {
        continue
      }

      // Separate by prediction type
      const weekOnePredictions = predictions.filter(p => p.prediction_type === "week_one")
      const seasonEndPredictions = predictions.filter(p => p.prediction_type === "season_end")

      // Score week_one predictions (7+ days after release)
      if (weekOnePredictions.length > 0 && game.release_date) {
        const releaseDate = new Date(game.release_date)
        const daysSinceRelease = Math.floor(
          (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysSinceRelease >= 7) {
          // Get week 1 snapshot
          const { data: weekOneSnapshot } = await supabase
            .from("game_snapshots")
            .select("*")
            .eq("game_id", game.id)
            .eq("snapshot_type", "week_after_release")
            .order("captured_at", { ascending: false })
            .limit(1)
            .single()

          const actualMetrics = {
            player_count: weekOneSnapshot?.player_count ?? game.peak_player_count ?? 0,
            review_score: reviewScore,
          }

          const crowdMedian = calculateCrowdMedian(weekOnePredictions)

          for (const prediction of weekOnePredictions) {
            try {
              const scoreResult = calculatePredictionScore(
                prediction,
                actualMetrics,
                crowdMedian,
                releaseDate
              )

              await supabase
                .from("predictions")
                .update({
                  actual_player_count: actualMetrics.player_count,
                  actual_review_score: actualMetrics.review_score,
                  base_points: scoreResult.base_points,
                  multiplier: scoreResult.multiplier,
                  final_points: scoreResult.final_points,
                  scored_at: new Date().toISOString(),
                })
                .eq("id", prediction.id)

              results.predictionsScored++
            } catch (err) {
              console.error(`[Score Calculator] Error scoring prediction ${prediction.id}:`, err)
              results.errors++
            }
          }
        }
      }

      results.gamesProcessed++
    }

    // Update leaderboards for active seasons
    await updateLeaderboards()

    console.log(`[Score Calculator] Completed: ${results.gamesProcessed} games, ${results.predictionsScored} predictions`)

    return NextResponse.json({
      message: "Score calculation complete",
      ...results,
    })
  } catch (error) {
    console.error("[Score Calculator] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Update leaderboard rankings for active seasons
 */
async function updateLeaderboards() {
  // Get active seasons
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id")
    .in("status", ["active", "scoring"])

  for (const season of seasons || []) {
    // Calculate total points per user
    const { data: userScores } = await supabase
      .from("predictions")
      .select("user_id, final_points")
      .eq("season_id", season.id)
      .not("final_points", "is", null)

    if (!userScores || userScores.length === 0) continue

    // Aggregate scores by user
    const scoreMap = new Map<string, number>()
    for (const score of userScores) {
      const current = scoreMap.get(score.user_id) || 0
      scoreMap.set(score.user_id, current + (score.final_points || 0))
    }

    // Calculate rankings
    const rankings = calculateRankings(scoreMap)

    // Upsert leaderboard entries
    for (const entry of rankings) {
      const { data: predStats } = await supabase
        .from("predictions")
        .select("id, final_points")
        .eq("user_id", entry.userId)
        .eq("season_id", season.id)

      const predictionsMade = predStats?.length || 0
      const predictionsScored = predStats?.filter(p => p.final_points !== null).length || 0

      await supabase.from("leaderboards").upsert(
        {
          season_id: season.id,
          user_id: entry.userId,
          total_points: entry.totalPoints,
          predictions_made: predictionsMade,
          predictions_scored: predictionsScored,
          rank: entry.rank,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "season_id,user_id" }
      )
    }
  }
}
