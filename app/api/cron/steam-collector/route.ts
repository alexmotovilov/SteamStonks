import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getPlayerCount, getReviewSummary, calculateReviewPercentage } from "@/lib/steam"

// Use service role for cron jobs (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"
export const maxDuration = 60 // 60 seconds max for data collection

/**
 * Cron job to collect Steam player counts and review data
 * Should be triggered daily via Vercel Cron
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/steam-collector",
 *     "schedule": "0 6 * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  // Verify this is a legitimate cron request (Vercel adds this header)
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development or if CRON_SECRET is not set
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    // Get all games that need data collection
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, steam_appid, name, release_date, is_released")
      .order("last_snapshot_at", { ascending: true, nullsFirst: true })
      .limit(50) // Process up to 50 games per run to stay within time limits

    if (gamesError) {
      console.error("[Steam Collector] Failed to fetch games:", gamesError)
      return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 })
    }

    if (!games || games.length === 0) {
      return NextResponse.json({ message: "No games to process", processed: 0 })
    }

    const results = {
      processed: 0,
      errors: 0,
      snapshots: [] as Array<{ game: string; players: number | null; reviews: number | null }>,
    }

    // Process each game
    for (const game of games) {
      try {
        // Fetch current player count
        const playerCount = await getPlayerCount(game.steam_appid)
        
        // Fetch review data
        const reviews = await getReviewSummary(game.steam_appid)
        const reviewPercentage = reviews
          ? calculateReviewPercentage(reviews.total_positive, reviews.total_negative)
          : null

        // Determine snapshot type
        const snapshotType = determineSnapshotType(game.release_date, game.is_released)

        // Insert snapshot
        const { error: snapshotError } = await supabase.from("game_snapshots").insert({
          game_id: game.id,
          player_count: playerCount,
          review_positive: reviews?.total_positive ?? null,
          review_negative: reviews?.total_negative ?? null,
          snapshot_type: snapshotType,
        })

        if (snapshotError) {
          console.error(`[Steam Collector] Failed to insert snapshot for ${game.name}:`, snapshotError)
          results.errors++
          continue
        }

        // Update game with latest data
        // We store the daily snapshot player count as the "24h peak" since this runs once daily
        const updateData: Record<string, unknown> = {
          last_snapshot_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (playerCount !== null) {
          // Update peak_24h_player_count with the daily snapshot
          updateData.peak_24h_player_count = playerCount
          
          // Also update all-time peak if current is higher
          const { data: currentGame } = await supabase
            .from("games")
            .select("peak_player_count")
            .eq("id", game.id)
            .single()
          
          if (!currentGame?.peak_player_count || playerCount > currentGame.peak_player_count) {
            updateData.peak_player_count = playerCount
          }
        }

        if (reviews) {
          updateData.review_score_positive = reviews.total_positive
          updateData.review_score_negative = reviews.total_negative
        }

        // Check if game has released
        if (!game.is_released && game.release_date) {
          const releaseDate = new Date(game.release_date)
          if (releaseDate <= new Date()) {
            updateData.is_released = true
          }
        }

        await supabase.from("games").update(updateData).eq("id", game.id)

        results.processed++
        results.snapshots.push({
          game: game.name,
          players: playerCount,
          reviews: reviewPercentage,
        })

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (err) {
        console.error(`[Steam Collector] Error processing ${game.name}:`, err)
        results.errors++
      }
    }

    console.log(`[Steam Collector] Completed: ${results.processed} processed, ${results.errors} errors`)

    return NextResponse.json({
      message: "Collection complete",
      ...results,
    })
  } catch (error) {
    console.error("[Steam Collector] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Determine the snapshot type based on release date
 */
function determineSnapshotType(
  releaseDate: string | null,
  isReleased: boolean
): "hourly" | "daily" | "week_after_release" | "season_end" {
  if (!releaseDate || !isReleased) {
    return "daily"
  }

  const release = new Date(releaseDate)
  const now = new Date()
  const daysSinceRelease = Math.floor(
    (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Week 1 snapshot (7 days after release)
  if (daysSinceRelease >= 6 && daysSinceRelease <= 8) {
    return "week_after_release"
  }

  return "daily"
}
